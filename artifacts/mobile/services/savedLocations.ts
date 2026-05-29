import { api } from './api';

export const getSavedLocations = () => api.get('/users/me/saved-locations');

export const createSavedLocation = (label: string, address: string, lat: number, lng: number) =>
  api.post('/users/me/saved-locations', { label, address, lat, lng });

export const deleteSavedLocation = (id: string) => api.delete(`/users/me/saved-locations/${id}`);
