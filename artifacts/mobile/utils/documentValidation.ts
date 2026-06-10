const IMAGE_EXTENSION = /\.(?:jpe?g|png|heic|heif|webp)(?:[?#].*)?$/i;
const FILE_EXTENSION = /\.[a-z0-9]{2,5}(?:[?#].*)?$/i;
const SUPPORTED_URI_SCHEME = /^(?:file|content|ph|assets-library|blob|https?):/i;

export function isValidDocumentImageUri(uri: string | null | undefined): boolean {
  const value = uri?.trim();
  if (!value) return false;
  if (/^data:image\/(?:jpeg|png|heic|heif|webp);/i.test(value)) return true;
  if (!SUPPORTED_URI_SCHEME.test(value)) return false;
  if (IMAGE_EXTENSION.test(value)) return true;
  return !FILE_EXTENSION.test(value);
}

export function isValidImageAsset(asset: { uri: string; mimeType?: string | null; fileName?: string | null }): boolean {
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) return false;
  if (asset.fileName && FILE_EXTENSION.test(asset.fileName) && !IMAGE_EXTENSION.test(asset.fileName)) return false;
  return isValidDocumentImageUri(asset.uri);
}
