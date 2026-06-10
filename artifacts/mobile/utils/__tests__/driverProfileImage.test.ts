import {
  buildDriverWithUploadedPhoto,
  resolveDriverProfileImage,
} from '@/utils/driverProfileImage';
import type { MockDriver } from '@/types';

const driver: MockDriver = {
  id: 'driver-1',
  name: 'Jean Pierre',
  phone: '+250788111001',
  vehicleType: 'moto',
  plateNumber: 'RAD 001 A',
  location: { latitude: -1.9421, longitude: 30.0599 },
  rating: 4.8,
  eta: 3,
};

describe('driver profile images', () => {
  it('does not use generated placeholder images for ride drivers', () => {
    expect(resolveDriverProfileImage({
      profileImage: 'https://i.pravatar.cc/120?img=3',
    })).toBeUndefined();
  });

  it('preserves an uploaded image that belongs to the assigned driver', () => {
    expect(resolveDriverProfileImage({
      profileImage: 'https://cdn.example.com/drivers/driver-1.jpg',
    })).toBe('https://cdn.example.com/drivers/driver-1.jpg');
  });

  it('does not attach the signed-in user photo to a mock matched driver', () => {
    const matchedDriver = buildDriverWithUploadedPhoto({
      ...driver,
      profileImage: 'https://i.pravatar.cc/120?img=3',
    });

    expect(matchedDriver).toEqual(driver);
  });
});
