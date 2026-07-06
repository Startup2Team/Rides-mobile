import { getAppBackendClient } from '@/data/remote/client/appBackendClient';

// Real backend mode switch: PATCH /api/v1/users/mode { mode: customer | driver }.
// The backend updates role_state; the app should re-fetch the profile after.

export type AppUserMode = 'customer' | 'driver';

export async function switchUserMode(mode: AppUserMode): Promise<void> {
  await getAppBackendClient().patch('/v1/users/mode', { body: { mode } });
}
