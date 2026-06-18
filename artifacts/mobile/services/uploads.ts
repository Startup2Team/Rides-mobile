import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import type { DocFaces, DocumentKey } from '@/hooks/driver-onboarding/onboardingTypes';

/**
 * Backend document_type vocabulary (matches the validator in
 * api-server/internal/driver/handler.go). One row per (driver, type); a repeat
 * upload of the same type replaces the previous file.
 */
export type DriverDocumentType =
  | 'LICENCE_FRONT'
  | 'LICENCE_BACK'
  | 'NATIONAL_ID_FRONT'
  | 'NATIONAL_ID_BACK'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_AUTHORIZATION'
  | 'SELFIE';

interface PresignResult {
  upload_url: string;
  file_url: string;
}

// ─── Background document-upload status ────────────────────────────────────────
// The onboarding flow kicks off document uploads in the background and navigates
// straight to the waiting screen. This tiny pub/sub lets that screen reflect
// progress ("uploading" → "done" / "partial") without blocking submission.
export type DocUploadStatus = 'idle' | 'uploading' | 'done' | 'partial';

let docUploadStatus: DocUploadStatus = 'idle';
const docUploadListeners = new Set<(s: DocUploadStatus) => void>();

export function getDocUploadStatus(): DocUploadStatus {
  return docUploadStatus;
}

export function subscribeDocUploadStatus(fn: (s: DocUploadStatus) => void): () => void {
  docUploadListeners.add(fn);
  return () => docUploadListeners.delete(fn);
}

function setDocUploadStatus(s: DocUploadStatus): void {
  docUploadStatus = s;
  docUploadListeners.forEach(l => l(s));
}

/** Already-stored remote URLs are http(s); local picker results are file://. */
function isLocalUri(uri: string | null | undefined): uri is string {
  return !!uri && !/^https?:\/\//i.test(uri);
}

/** Pick a content_type the backend accepts from the file extension. */
function contentTypeFor(uri: string): string {
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  if (u.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

/**
 * Upload one local image/PDF to object storage and return its public file_url.
 *
 * Flow (matches the production presign contract, but in dev the API brokers the
 * bytes to MinIO itself — see api-server/internal/upload/handler.go):
 *   1. POST /uploads/presigned-url  -> { upload_url, file_url }
 *   2. PUT the raw bytes to upload_url
 *   3. caller registers file_url via POST /driver/documents
 *
 * The PUT goes through the API's authenticated proxy route, so we attach the
 * bearer token manually (fetch, not the axios instance, is used because RN
 * handles a raw Blob body far more reliably than axios does).
 */
export async function uploadDocumentImage(localUri: string): Promise<string> {
  const contentType = contentTypeFor(localUri);

  const { data } = await api.post('/uploads/presigned-url', {
    content_type: contentType,
    purpose: 'driver_document',
  });
  const { upload_url, file_url } = data as PresignResult;

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const token = await SecureStore.getItemAsync('access_token');
  const put = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${token ?? ''}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`document upload failed (${put.status})`);
  }
  return file_url;
}

/**
 * Upload a profile avatar image and return its public file_url.
 * Same presign flow as documents but with purpose 'profile_image'.
 */
export async function uploadProfileImage(localUri: string): Promise<string> {
  const contentType = contentTypeFor(localUri);

  const { data } = await api.post('/uploads/presigned-url', {
    content_type: contentType,
    purpose: 'profile_image',
  });
  const { upload_url, file_url } = data as PresignResult;

  const fileResp = await fetch(localUri);
  const blob = await fileResp.blob();

  const token = await SecureStore.getItemAsync('access_token');
  const put = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${token ?? ''}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: blob,
  });
  if (!put.ok) {
    throw new Error(`profile image upload failed (${put.status})`);
  }
  return file_url;
}

/** Register a stored file_url against the driver's profile (POST /driver/documents). */
export async function registerDriverDocument(
  documentType: DriverDocumentType,
  fileUrl: string,
): Promise<void> {
  await api.post('/driver/documents', { document_type: documentType, file_url: fileUrl });
}

/** Upload + register one document type in a single step. */
export async function submitDriverDocument(
  documentType: DriverDocumentType,
  localUri: string,
): Promise<string> {
  const fileUrl = await uploadDocumentImage(localUri);
  await registerDriverDocument(documentType, fileUrl);
  return fileUrl;
}

// Onboarding faces -> backend document types.
const FACE_TYPES: { key: DocumentKey; face: 0 | 1; type: DriverDocumentType }[] = [
  { key: 'license', face: 0, type: 'LICENCE_FRONT' },
  { key: 'license', face: 1, type: 'LICENCE_BACK' },
  { key: 'nationalId', face: 0, type: 'NATIONAL_ID_FRONT' },
  { key: 'nationalId', face: 1, type: 'NATIONAL_ID_BACK' },
  { key: 'insurance', face: 0, type: 'VEHICLE_INSURANCE' },
  { key: 'authorization', face: 0, type: 'VEHICLE_AUTHORIZATION' },
];

/**
 * Upload the locally-picked faces for a single document key (used by the
 * standalone Documents screen when a driver replaces a document). Returns the
 * backend types that failed (empty = all good). Faces that are already remote
 * URLs are skipped.
 */
export async function uploadDocumentFaces(
  key: DocumentKey,
  faces: DocFaces,
): Promise<DriverDocumentType[]> {
  const failures: DriverDocumentType[] = [];
  for (const { key: k, face, type } of FACE_TYPES) {
    if (k !== key) continue;
    const uri = faces[face];
    if (!isLocalUri(uri)) continue;
    try {
      await submitDriverDocument(type, uri);
    } catch {
      failures.push(type);
    }
  }
  return failures;
}

/**
 * Upload every locally-picked onboarding document (and the selfie) to the
 * backend so the admin can review them. Best-effort: must be called AFTER
 * applyDriver() created the driver_profiles row and the token was refreshed to
 * DRIVER_PENDING. Returns the document types that failed to upload (empty = all
 * succeeded) so the caller can warn without blocking submission — anything that
 * fails can be re-taken later from the documents screen.
 */
export async function uploadOnboardingDocuments(
  docs: Record<DocumentKey, DocFaces>,
  selfieUri: string | null,
): Promise<DriverDocumentType[]> {
  setDocUploadStatus('uploading');
  const failures: DriverDocumentType[] = [];

  for (const { key, face, type } of FACE_TYPES) {
    const uri = docs[key]?.[face];
    if (!isLocalUri(uri)) continue; // not picked, or already a remote URL
    try {
      await submitDriverDocument(type, uri);
    } catch {
      failures.push(type);
    }
  }

  if (isLocalUri(selfieUri)) {
    try {
      await submitDriverDocument('SELFIE', selfieUri);
    } catch {
      failures.push('SELFIE');
    }
  }

  setDocUploadStatus(failures.length ? 'partial' : 'done');
  return failures;
}
