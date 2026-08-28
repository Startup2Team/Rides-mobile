import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { getAccessToken } from '@/persistence/authTokens';
import { expectField } from '@/observability/monitoring';
import { resolveBackendTransportConfig } from '@/data/remote/transport/backendTransportConfig';

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
  /**
   * Per-document review state: PENDING | APPROVED | REJECTED.
   *
   * Optional because it only exists once the append-only documents change is
   * deployed. Older servers omit it, and this must keep working against both.
   */
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  /**
   * Whether the API would accept a replacement. An APPROVED document is
   * view-only unless an admin opened a re-upload window, so the app can render
   * the correct affordance rather than offering a button that 409s.
   */
  editable?: boolean;
  /** SHA-256 of the stored bytes, when the server records one. */
  sha256?: string;
}

// Backend shape: GET /v1/driver/documents → { data: { documents: [ ... ] } }
// where each entry is a driver_documents row (snake_case, `uploaded_at`).
interface DriverDocumentDto {
  id: string;
  document_type: string;
  file_url: string;
  uploaded_at: string;
  review_status?: string;
  editable?: boolean;
  sha256?: string | null;
}

function normalizeReviewStatus(v: string | undefined): DriverDocument['reviewStatus'] {
  switch (v) {
    case 'PENDING':
    case 'APPROVED':
    case 'REJECTED':
      return v;
    default:
      return undefined;
  }
}

function toDriverDocument(dto: DriverDocumentDto): DriverDocument {
  const reviewStatus = normalizeReviewStatus(dto.review_status);
  return {
    id: dto.id,
    documentType: dto.document_type,
    fileUrl: dto.file_url,
    createdAt: dto.uploaded_at,
    reviewStatus,
    // Trust the server's own computation when present. Only fall back to a
    // guess when the field is absent (older server), and be permissive there
    // rather than disabling an action the API would have allowed.
    editable: dto.editable ?? (reviewStatus ? reviewStatus !== 'APPROVED' : undefined),
    sha256: dto.sha256 ?? undefined,
  };
}

function resolveUploadUrlForMobile(targetUrl: string): string {
  if (Platform.OS === 'web') return targetUrl;
  try {
    const config = resolveBackendTransportConfig();
    const backendBaseUrl = config.baseUrl ?? process.env.EXPO_PUBLIC_BACKEND_BASE_URL;
    if (!backendBaseUrl) return targetUrl;

    const backendUrlObj = new URL(backendBaseUrl);
    const backendHost = backendUrlObj.hostname;
    const backendOrigin = backendUrlObj.origin;

    if (
      targetUrl.includes('localhost') ||
      targetUrl.includes('127.0.0.1') ||
      targetUrl.includes('minio:9000') ||
      targetUrl.includes(':9000') ||
      targetUrl.startsWith('https:///') ||
      targetUrl.includes('<your-public-r2-domain>')
    ) {
      let resolved = targetUrl
        .replace('localhost', backendHost)
        .replace('127.0.0.1', backendHost)
        .replace('minio', backendHost);

      if (targetUrl.includes('<your-public-r2-domain>')) {
        const pathPart = targetUrl.split('<your-public-r2-domain>')[1] || '';
        resolved = `${backendOrigin}/api/v1/uploads/objects${pathPart}`;
      } else if (resolved.includes(':9000') || resolved.startsWith('https:///')) {
        const match = resolved.match(/(?::9000|\/rides-docs|\/ride-documents)\/+(.+)$/);
        if (match && match[1]) {
          resolved = `${backendOrigin}/api/v1/uploads/objects/${match[1]}`;
        }
      }

      console.log('[MOBILE:UPLOAD] 🔀 Resolved local upload URL for mobile device:', { original: targetUrl, resolved });
      return resolved;
    }
  } catch (err) {
    console.warn('[MOBILE:UPLOAD] Could not parse upload URL host:', err);
  }
  return targetUrl;
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
  console.log('[MOBILE:UPLOAD] 🔑 Requesting presigned upload target...', { contentType, purpose });
  const response = await getAppBackendClient().post<Envelope<PresignResponse>>(
    '/v1/uploads/presigned-url',
    { body: { content_type: contentType, purpose } },
  );
  const target = { uploadUrl: response.data.data.upload_url, fileUrl: response.data.data.file_url };
  console.log('[MOBILE:UPLOAD] 🔑 Presigned target acquired:', target);
  return target;
}

// Step 2: stream the local file's bytes to the upload target. In proxy mode the
// object key is the credential (no bearer needed); we still send it when present
// so authenticated proxy setups also work.
export async function uploadFileBytes(
  rawUploadUrl: string,
  localUri: string,
  contentType: string,
): Promise<void> {
  const uploadUrl = resolveUploadUrlForMobile(rawUploadUrl);
  console.log('[MOBILE:UPLOAD] 📤 Starting binary file upload...', { localUri, uploadUrl, contentType, platform: Platform.OS });
  const token = await getAccessToken().catch(() => null);
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token && uploadUrl.includes('/uploads/objects/')) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(localUri);
    const blob = await fileResponse.blob();
    const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers });
    if (!put.ok) {
      console.error('[MOBILE:UPLOAD_ERROR] ❌ Web fetch upload failed with status:', put.status);
      throw new Error(`upload failed with status ${put.status}`);
    }
    console.log('[MOBILE:UPLOAD] ✅ Web fetch upload completed successfully!');
    return;
  }

  console.log('[MOBILE:UPLOAD] ⚡ Streaming binary bytes using FileSystem.uploadAsync...');
  const result = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers,
  });

  console.log('[MOBILE:UPLOAD] 📥 Upload result status:', result.status);
  if (result.status < 200 || result.status >= 300) {
    console.error('[MOBILE:UPLOAD_ERROR] ❌ FileSystem.uploadAsync failed with status:', result.status, 'body:', result.body);
    throw new Error(`upload failed with status ${result.status}`);
  }

  console.log('[MOBILE:UPLOAD] ✅ Binary file upload completed successfully!');
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
  const response = await getAppBackendClient().get<
    Envelope<{ documents: DriverDocumentDto[] | null } | null>
  >('/v1/driver/documents');
  const payload = response.data.data;
  expectField(payload, 'documents', 'driverDocuments.list');
  return (payload?.documents ?? []).map(toDriverDocument);
}
