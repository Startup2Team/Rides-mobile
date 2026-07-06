import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { getAccessToken } from '@/persistence/authTokens';

// Driver document upload = 3 steps:
//   1. POST /uploads/presigned-url {content_type, purpose} → {upload_url, file_url}
//   2. PUT the file bytes to upload_url (R2 presigned, or API proxy → MinIO/R2)
//   3. POST /driver/documents {document_type, file_url} to record it
// This is where driver KYC images are stored (R2 in prod, MinIO proxy in dev).

export type DriverDocumentType =
  | 'LICENCE_FRONT'
  | 'LICENCE_BACK'
  | 'NATIONAL_ID_FRONT'
  | 'NATIONAL_ID_BACK'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_AUTHORIZATION'
  | 'SELFIE';

export interface DriverDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  status?: string;
  createdAt?: string;
}

interface Envelope<T> {
  data: T;
}

interface PresignResponse {
  upload_url: string;
  file_url: string;
}

// Step 1: ask the backend where to upload.
export async function requestUploadTarget(
  contentType: string,
  purpose = 'driver_document',
): Promise<{ uploadUrl: string; fileUrl: string }> {
  const response = await getAppBackendClient().post<Envelope<PresignResponse>>(
    '/v1/uploads/presigned-url',
    { body: { content_type: contentType, purpose } },
  );
  return { uploadUrl: response.data.data.upload_url, fileUrl: response.data.data.file_url };
}

// Step 2: stream the local file's bytes to the upload target. In proxy mode the
// object key is the credential (no bearer needed); we still send it when present
// so authenticated proxy setups also work.
export async function uploadFileBytes(
  uploadUrl: string,
  localUri: string,
  contentType: string,
): Promise<void> {
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const token = await getAccessToken().catch(() => null);
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token && uploadUrl.includes('/uploads/objects/')) {
    headers.Authorization = `Bearer ${token}`;
  }
  const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers });
  if (!put.ok) {
    throw new Error(`upload failed with status ${put.status}`);
  }
}

// Step 3: record the uploaded document against the driver.
export async function recordDriverDocument(
  documentType: DriverDocumentType,
  fileUrl: string,
): Promise<void> {
  await getAppBackendClient().post('/v1/driver/documents', {
    body: { document_type: documentType, file_url: fileUrl },
  });
}

// Convenience: presign → upload → record in one call. Returns the stored URL.
export async function uploadDriverDocument(
  localUri: string,
  documentType: DriverDocumentType,
  contentType = 'image/jpeg',
): Promise<string> {
  const { uploadUrl, fileUrl } = await requestUploadTarget(contentType);
  await uploadFileBytes(uploadUrl, localUri, contentType);
  await recordDriverDocument(documentType, fileUrl);
  return fileUrl;
}

export async function listDriverDocuments(): Promise<DriverDocument[]> {
  const response = await getAppBackendClient().get<Envelope<DriverDocument[] | null>>(
    '/v1/driver/documents',
  );
  return response.data.data ?? [];
}
