import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { AppMode, DriverProfile, User } from '@/types';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import * as authService from '@/services/auth';

const USER_SNAPSHOT_KEY = 'auth:user_snapshot';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  saveDriverProfile: (profile: DriverProfile) => Promise<void>;
  loadDriverProfile: () => Promise<void>;
  /** Refresh the customer profile from GET /customer/profile and update in-memory state. */
  loadCustomerProfile: () => Promise<void>;
  switchMode: (mode: AppMode) => Promise<void>;
  /** Call after driver registration to swap the stale JWT for one with DRIVER_ACTIVE role. */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapApiUserToUser = (p: any): User => {
  const isDriver =
    p.is_driver === true ||
    p.role_state === 'DRIVER_ACTIVE' ||
    p.role_state === 'DRIVER_PENDING';

  // If the profile doesn't carry an explicit mode (most endpoints don't),
  // derive a sensible default: drivers land on the driver dashboard,
  // everyone else on the customer screen.
  const mode: AppMode =
    (p.mode as AppMode) ?? (isDriver ? 'driver' : 'customer');

  return {
    id: p.id,
    name: p.full_name || p.name || 'User',
    phone: p.phone_number || '',
    email: p.email ?? undefined,
    mode,
    isDriver,
    createdAt: p.created_at ?? new Date().toISOString(),
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const persistSnapshot = async (u: User) => {
    await AsyncStorage.setItem(USER_SNAPSHOT_KEY, JSON.stringify(u));
  };

  const clearSnapshot = async () => {
    await AsyncStorage.removeItem(USER_SNAPSHOT_KEY);
  };

  const loadStoredData = async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      // Show cached snapshot instantly so the app doesn't block on the network
      const snapshot = await AsyncStorage.getItem(USER_SNAPSHOT_KEY);
      if (snapshot) {
        setUser(JSON.parse(snapshot) as User);
        setIsLoading(false);
      }

      // Refresh from API in background (or foreground if no snapshot)
      try {
        const { data: p } = await api.get('/customer/profile');
        const fresh = mapApiUserToUser(p);
        setUser(fresh);
        await persistSnapshot(fresh);
      } catch {
        // Network unavailable — keep showing snapshot, tokens stay valid
        if (!snapshot) throw new Error('no snapshot and no network');
      }
    } catch {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      await clearSnapshot();
    } finally {
      setIsLoading(false);
    }
  };

  const loadDriverProfile = useCallback(async () => {
    try {
      const { data: d } = await api.get('/driver/profile');
      setDriverProfile({
        vehicleType: d.transport_type,
        plateNumber: d.vehicle_plate ?? '',
        licenseNumber: d.license_number ?? '',
        province: d.province ?? '',
        district: d.district ?? '',
        sector: d.sector ?? '',
        city: d.city ?? '',
        momoCode: d.momo_pay_code ?? '',
        momoProvider: d.momo_provider ?? 'mtn',
        dob: d.date_of_birth ?? '',
        isOnline: d.is_online ?? false,
        isVerified: d.approval_status === 'APPROVED',
        acceptanceRate: d.acceptance_rate ?? 0,
        completedRides: d.total_rides ?? 0,
        dailyRides: 0,
        dailyDeclines: 0,
        policyAccepted: d.policy_accepted ?? false,
        earningsTotal: 0,
      } as DriverProfile);
    } catch {
      // user has no driver profile — that's fine
    }
  }, []);

  const loadCustomerProfile = useCallback(async () => {
    try {
      const { data: p } = await api.get('/customer/profile');
      const fresh = mapApiUserToUser(p);
      setUser(fresh);
      await persistSnapshot(fresh);
    } catch {
      // Network unavailable — keep showing cached data
    }
  }, []);

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await persistSnapshot(newUser);
  }, []);

  const logoutInFlight = React.useRef(false);
  const logout = useCallback(async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    try {
      // Pass isDriver so auth.ts only calls POST /driver/availability for
      // accounts that actually have a driver profile (avoids 403/405 for
      // pure CUSTOMER_ONLY accounts).
      await authService.logout(user?.isDriver ?? false);
      setUser(null);
      setDriverProfile(null);
      await clearSnapshot();
      // Navigate unconditionally — the user could be on any screen (driver
      // dashboard, negotiation, ride, etc.) and index.tsx's redirect only
      // fires when '/' is the active route.
      router.replace('/(auth)/welcome');
    } finally {
      logoutInFlight.current = false;
    }
  }, [user?.isDriver]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await persistSnapshot(updated);
  }, [user]);

  const saveDriverProfile = useCallback(async (profile: DriverProfile) => {
    setDriverProfile(profile);
  }, []);

  const switchMode = useCallback(async (mode: AppMode) => {
    if (!user) return;

    // Switching to customer is always safe — everyone can be a customer.
    // Do it locally without a network round-trip so it never fails.
    if (mode === 'customer') {
      const updated = { ...user, mode };
      setUser(updated);
      await persistSnapshot(updated);
      return;
    }

    // Switching to driver requires backend validation (checks approval status,
    // policy acceptance, etc.).
    try {
      await api.patch('/users/mode', { mode });
      const updated = { ...user, mode };
      setUser(updated);
      await persistSnapshot(updated);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'NO_DRIVER_PROFILE') {
        Alert.alert(
          'Driver registration required',
          'Your driver application is pending review or not yet submitted. Complete onboarding to access driver mode.',
        );
      } else if (code === 'POLICY_NOT_ACCEPTED') {
        // Auto-accept the policy then retry the mode switch once
        try {
          await api.post('/driver/policy/accept');
          await api.patch('/users/mode', { mode });
          const updated = { ...user, mode };
          setUser(updated);
          await persistSnapshot(updated);
        } catch (retryErr: any) {
          throw retryErr;
        }
      } else if (code === 'DRIVER_NOT_ACTIVE') {
        Alert.alert(
          'Application pending',
          'Your driver application is still under review. You will be notified once approved.',
        );
      } else {
        throw err;
      }
    }
  }, [user]);

  const refreshSession = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) throw new Error('no refresh token');
      const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      // Re-fetch profile so user object reflects the new role_state
      const { data: p } = await api.get('/customer/profile');
      const fresh = mapApiUserToUser(p);
      setUser(fresh);
      await persistSnapshot(fresh);
    } catch (err) {
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      driverProfile,
      isLoading,
      login,
      logout,
      updateUser,
      saveDriverProfile,
      loadDriverProfile,
      loadCustomerProfile,
      switchMode,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
