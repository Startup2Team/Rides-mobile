import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadStoredDriverProfile,
  loadStoredUser,
  saveStoredDriverProfile,
  saveStoredUser,
} from '@/persistence/authPersistence';
import { clearSensitiveStorage } from '@/persistence/secureStorage';
import { AppMode, DriverProfile, User } from '@/types';
import { canAccessDriverMode } from '@/utils/driverVerification';
import { api } from '@/services/api';
import { logout as authLogout } from '@/services/auth';
import { setDriverAvailability } from '@/services/driverRides';
import { API_TO_LEGACY_VEHICLE } from '@/services/vehicleTypes';
import { formatDateDdMmYyyy } from '@/utils/dateUtils';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  saveDriverProfile: (profile: DriverProfile) => Promise<void>;
  setDriverOnline: (isOnline: boolean) => Promise<void>;
  switchMode: (mode: AppMode) => Promise<void>;
  recordCompletedRide: (agreedFare?: number | null) => Promise<void>;
  /** Hydrate the driver profile from the backend (GET /driver/profile). */
  loadDriverProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef(user);
  const driverProfileRef = useRef(driverProfile);
  userRef.current = user;
  driverProfileRef.current = driverProfile;

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [storedUser, storedDriverProfile] = await Promise.all([
        loadStoredUser(),
        loadStoredDriverProfile(),
      ]);
      if (storedUser.data) setUser(storedUser.data);
      if (storedDriverProfile.data) setDriverProfile(storedDriverProfile.data);
      // Refresh the driver profile from the backend so an approval (or rejection)
      // that happened while the app was closed is reflected, and the status is
      // authoritative rather than stale local. No-op for customer-only accounts.
      if (storedUser.data) void loadDriverProfile();
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await saveStoredUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    // Revoke the backend session and mark the driver offline BEFORE clearing the
    // token locally — otherwise "logout" only forgets the token on-device while
    // the session stays valid server-side. Best-effort (short timeout inside).
    const wasDriver = Boolean(userRef.current?.isDriver) || canAccessDriverMode(driverProfileRef.current);
    try { await authLogout(wasDriver); } catch { /* token cleared below regardless */ }
    setUser(null);
    setDriverProfile(null);
    await clearSensitiveStorage();
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!userRef.current) return;
    const updated = { ...userRef.current, ...updates };
    setUser(updated);
    await saveStoredUser(updated);
    // Persist to the backend so the change is authoritative and survives
    // reinstall / re-login / a new device (PUT /customer/profile updates the
    // shared users row, and the /customer group also allows driver roles).
    try {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.full_name = updates.name;
      if (updates.email !== undefined) body.email = updates.email ?? null;
      if (updates.profileImageUrl !== undefined) body.profile_image_url = updates.profileImageUrl;
      if (Object.keys(body).length > 0) await api.put('/customer/profile', body);
    } catch {
      // Local copy is already saved; the next successful edit will sync.
    }
  }, []);

  const saveDriverProfile = useCallback(async (profile: DriverProfile) => {
    setDriverProfile(profile);
    await saveStoredDriverProfile(profile);
  }, []);

  // Pulls the authoritative driver profile from the backend and maps it to the
  // local shape. Called after login (driver roles) so an approved driver like
  // pac is recognised without re-running onboarding. No-op for customer-only
  // accounts (the endpoint 403/404s and we keep the existing state).
  const loadDriverProfile = useCallback(async () => {
    try {
      const { data: d } = await api.get('/driver/profile');
      const apiType = String(d?.transport_type ?? '') as keyof typeof API_TO_LEGACY_VEHICLE;
      const approved = d?.approval_status === 'APPROVED';
      const verificationStatus: DriverProfile['verificationStatus'] = approved
        ? 'approved'
        : d?.approval_status === 'REJECTED'
          ? 'rejected'
          : 'pending_review';
      const profile: DriverProfile = {
        verificationStatus,
        vehicleType: (API_TO_LEGACY_VEHICLE[apiType] ?? 'moto') as DriverProfile['vehicleType'],
        plateNumber: d?.vehicle_plate ?? '',
        licenseNumber: d?.license_number ?? '',
        province: d?.province ?? '',
        district: d?.district ?? '',
        sector: d?.sector ?? '',
        city: d?.city ?? '',
        momoCode: d?.momo_pay_code ?? '',
        momoProvider: d?.momo_provider === 'airtel' ? 'airtel' : 'mtn',
        dob: d?.date_of_birth ? formatDateDdMmYyyy(new Date(d.date_of_birth)) : '',
        isOnline: d?.is_online ?? false,
        isVerified: approved,
        acceptanceRate: Number(d?.acceptance_rate ?? 0),
        completedRides: Number(d?.total_rides ?? 0),
        dailyRides: 0,
        dailyDeclines: 0,
        policyAccepted: d?.policy_accepted ?? false,
        earningsTotal: 0,
      };
      setDriverProfile(profile);
      await saveStoredDriverProfile(profile);
    } catch {
      // Customer-only account or offline — keep existing state.
    }
  }, []);

  const setDriverOnline = useCallback(async (isOnline: boolean) => {
    const prev = driverProfileRef.current;
    if (!prev || prev.isOnline === isOnline) return;
    const updated: DriverProfile = { ...prev, isOnline };
    setDriverProfile(updated);
    await saveStoredDriverProfile(updated);
    try {
      await setDriverAvailability(isOnline);
    } catch {
      setDriverProfile(prev);
      await saveStoredDriverProfile(prev);
      throw new Error(isOnline
        ? 'Could not go online — check your connection and try again'
        : 'Could not go offline — check your connection and try again');
    }
  }, []);

  const switchMode = useCallback(async (mode: AppMode) => {
    if (!userRef.current) return;
    if (mode === 'driver' && !canAccessDriverMode(driverProfileRef.current)) return;
    const updated = { ...userRef.current, mode };
    setUser(updated);
    await saveStoredUser(updated);
  }, []);

  const recordCompletedRide = useCallback(async (agreedFare?: number | null) => {
    const prev = driverProfileRef.current;
    if (!prev) return;
    const completedRides = (prev.completedRides ?? 0) + 1;
    const dailyRides = (prev.dailyRides ?? 0) + 1;
    const completedFare = typeof agreedFare === 'number' && Number.isFinite(agreedFare)
      ? Math.max(0, agreedFare)
      : 0;
    const earningsTotal = (prev.earningsTotal ?? 0) + completedFare;
    const totalDecisions = dailyRides + (prev.dailyDeclines ?? 0);
    const acceptanceRate = totalDecisions > 0
      ? Math.round((dailyRides / totalDecisions) * 100)
      : prev.acceptanceRate;
    const updated: DriverProfile = { ...prev, completedRides, dailyRides, earningsTotal, acceptanceRate };
    setDriverProfile(updated);
    await saveStoredDriverProfile(updated);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    driverProfile,
    isLoading,
    login,
    logout,
    updateUser,
    saveDriverProfile,
    setDriverOnline,
    switchMode,
    recordCompletedRide,
    loadDriverProfile,
  }), [
    driverProfile,
    isLoading,
    loadDriverProfile,
    login,
    logout,
    recordCompletedRide,
    saveDriverProfile,
    setDriverOnline,
    switchMode,
    updateUser,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
