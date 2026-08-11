import { clearProfilePhoto, fetchProfile, updateProfile, uploadProfilePhoto } from '@/services/profile';
import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { requestUploadTarget, uploadFileBytes } from '@/services/driverDocuments';

jest.mock('@/data/remote/client/appBackendClient', () => ({
  getAppBackendClient: jest.fn(),
}));

jest.mock('@/services/driverDocuments', () => ({
  requestUploadTarget: jest.fn(),
  uploadFileBytes: jest.fn(),
}));

const mockedClient = getAppBackendClient as jest.MockedFunction<typeof getAppBackendClient>;
const mockedPresign = requestUploadTarget as jest.MockedFunction<typeof requestUploadTarget>;
const mockedUploadBytes = uploadFileBytes as jest.MockedFunction<typeof uploadFileBytes>;

function stubClient(profile: Record<string, unknown> = {}) {
  const get = jest.fn().mockResolvedValue({ data: { data: profile } });
  const put = jest.fn().mockResolvedValue({ data: null });
  mockedClient.mockReturnValue({ get, put } as unknown as ReturnType<typeof getAppBackendClient>);
  return { get, put };
}

describe('customer profile service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reads back every field the account owns', async () => {
    stubClient({
      id: 'user-1',
      phone_number: '+250788111000',
      full_name: 'Alice Rider',
      email: 'alice@example.com',
      role_state: 'CUSTOMER',
      profile_image_url: 'https://cdn.test/avatars/a.jpg',
      emergency_contact_name: 'Bob',
      emergency_contact_phone: '+250788222333',
    });

    await expect(fetchProfile()).resolves.toEqual({
      id: 'user-1',
      phoneNumber: '+250788111000',
      fullName: 'Alice Rider',
      email: 'alice@example.com',
      fcmToken: null,
      roleState: 'CUSTOMER',
      profileImageUrl: 'https://cdn.test/avatars/a.jpg',
      emergencyContactName: 'Bob',
      emergencyContactPhone: '+250788222333',
    });
  });

  test("treats a cleared field ('') as not set", async () => {
    stubClient({
      id: 'user-1',
      phone_number: '+250788111000',
      full_name: 'Alice Rider',
      role_state: 'CUSTOMER',
      profile_image_url: '',
      emergency_contact_name: '   ',
    });

    const profile = await fetchProfile();

    expect(profile.profileImageUrl).toBeNull();
    expect(profile.emergencyContactName).toBeNull();
  });

  test('sends only the fields the caller provided', async () => {
    const { put } = stubClient();

    await updateProfile({ fullName: 'Alice', emergencyContactPhone: '+250788222333' });

    expect(put).toHaveBeenCalledWith('/v1/customer/profile', {
      body: { full_name: 'Alice', emergency_contact_phone: '+250788222333' },
    });
  });

  test('stores the avatar in object storage and points the account at it', async () => {
    const { put } = stubClient();
    mockedPresign.mockResolvedValue({
      uploadUrl: 'https://upload.test/put',
      fileUrl: 'https://cdn.test/avatars/new.jpg',
    });

    await expect(uploadProfilePhoto('file://picked.jpg')).resolves.toBe('https://cdn.test/avatars/new.jpg');

    // The 'profile_image' purpose is what keys the object under avatars/.
    expect(mockedPresign).toHaveBeenCalledWith('image/jpeg', 'profile_image');
    expect(mockedUploadBytes).toHaveBeenCalledWith('https://upload.test/put', 'file://picked.jpg', 'image/jpeg');
    // Without this PUT the bytes exist but nothing links them to the user, which
    // is exactly why the photo never followed anyone to a second device.
    expect(put).toHaveBeenCalledWith('/v1/customer/profile', {
      body: { profile_image_url: 'https://cdn.test/avatars/new.jpg' },
    });
  });

  test("clears the avatar with '' because null means 'leave unchanged'", async () => {
    const { put } = stubClient();

    await clearProfilePhoto();

    expect(put).toHaveBeenCalledWith('/v1/customer/profile', { body: { profile_image_url: '' } });
  });
});
