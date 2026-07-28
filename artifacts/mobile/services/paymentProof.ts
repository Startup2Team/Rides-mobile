import { requestUploadTarget, uploadFileBytes } from '@/services/driverDocuments';

// Manual package-payment proof screenshot upload. Two steps (no "record"
// step — proof lives on the claim, not the driver's KYC documents):
//   1. POST /uploads/presigned-url {purpose: 'payment_proof'} → {upload_url, file_url}
//   2. PUT the image bytes to upload_url
// Returns the stored file URL, which becomes the claim's proof_image_id.
//
// Object storage (MinIO in dev, Cloudflare R2 in prod) must be enabled for the
// presign step to succeed; when it is disabled the presign call 404s and the
// caller should fall back to the transaction-reference text proof.
export async function uploadPaymentProofImage(
  localUri: string,
  contentType = 'image/jpeg',
): Promise<string> {
  const { uploadUrl, fileUrl } = await requestUploadTarget(contentType, 'payment_proof');
  await uploadFileBytes(uploadUrl, localUri, contentType);
  return fileUrl;
}
