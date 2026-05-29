import { api } from './api';

export async function getRideForDriver(rideId: string) {
  const { data } = await api.get(`/driver/rides/${rideId}`);
  return data;
}

/** Returns the driver's active ride, or null if there is none (404 = idle state). */
export async function getActiveRideForDriver() {
  try {
    const { data } = await api.get('/driver/rides/active');
    return data ?? null;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function acceptRideRequest(rideId: string) {
  await api.post(`/driver/rides/${rideId}/accept`);
}

export async function declineRideRequest(rideId: string) {
  await api.post(`/driver/rides/${rideId}/decline`);
}

export async function cancelRideAsDriver(rideId: string) {
  await api.post(`/driver/rides/${rideId}/cancel`);
}

export async function markArrived(rideId: string) {
  await api.post(`/driver/rides/${rideId}/arrive`);
}

export async function startRide(rideId: string) {
  await api.post(`/driver/rides/${rideId}/start`);
}

export async function completeRide(rideId: string) {
  await api.post(`/driver/rides/${rideId}/complete`, {});
}

export async function setDriverAvailability(isOnline: boolean) {
  await api.post('/driver/availability', { is_online: isOnline });
}

export async function updateDriverLocation(lat: number, lng: number) {
  await api.post('/driver/location', { lat, lng });
}

export async function proposeDriverFare(rideId: string, amount: number) {
  await api.post(`/driver/rides/${rideId}/negotiation/propose`, { amount });
}

export async function acceptCustomerFare(rideId: string) {
  await api.post(`/driver/rides/${rideId}/negotiation/accept`);
}

export async function lockManualFare(rideId: string, amount: number) {
  await api.post(`/driver/rides/${rideId}/negotiation/lock-fare`, { amount });
}
