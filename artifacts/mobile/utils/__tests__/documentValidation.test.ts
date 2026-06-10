import { isValidDocumentImageUri, isValidImageAsset } from '../documentValidation';

describe('driver document image validation', () => {
  test.each([
    'file:///documents/licence-front.jpg',
    'content://media/external/images/123',
    'https://example.com/national-id.png?token=1',
    'data:image/jpeg;base64,abc',
  ])('accepts supported image URI %s', uri => {
    expect(isValidDocumentImageUri(uri)).toBe(true);
  });

  test.each(['', 'not-a-uri', 'file:///documents/licence.pdf', 'https://example.com/file.txt'])('rejects invalid image URI %s', uri => {
    expect(isValidDocumentImageUri(uri)).toBe(false);
  });

  test('rejects an asset with a non-image MIME type', () => {
    expect(isValidImageAsset({ uri: 'file:///documents/licence.jpg', mimeType: 'application/pdf' })).toBe(false);
  });
});
