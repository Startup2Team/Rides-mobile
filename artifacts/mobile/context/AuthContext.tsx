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
import { endSession } from '@/services/authSession';
import { getAccessToken } from '@/persistence/authTokens';
import { fetchProfile } from '@/services/profile';
import { AppMode, DriverProfile, User } from '@/types';
import { canAccessDriverMode } from '@/utils/driverVerification';
import { getApprovedDriverVehicles, getDriverVehicleForSession, setDriverActiveVehicle } from '@/domain/driverVehicles';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  saveDriverProfile: (profile: DriverProfile) => Promise<void>;
  setActiveVehicle: (vehicleId: string | null) => Promise<void>;
  setDriverOnline: (isOnline: boolean) => Promise<void>;
  switchMode: (mode: AppMode) => Promise<void>;
  recordCompletedRide: (agreedFare?: number | null) => Promise<void>;
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
      if (storedUser.data) {
        setUser(storedUser.data);
        void syncProfileFromBackend();
      }
      if (storedDriverProfile.data) setDriverProfile(storedDriverProfile.data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Best-effort hydrate of the display fields from the real backend profile
  // (GET /customer/profile). Non-destructive: only name + email, only when a
  // session token exists; offline/failure keeps the stored user.
  const syncProfileFromBackend = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const profile = await fetchProfile();
      setUser(prev => {
        if (!prev) return prev;
        const updated: User = {
          ...prev,
          name: profile.fullName || prev.name,
          email: profile.email ?? prev.email,
        };
        void saveStoredUser(updated);
        return updated;
      });
    } catch {
      // Backend unreachable — keep the locally stored profile.
    }
  }, []);

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await saveStoredUser(newUser);
    void syncProfileFromBackend();
  }, [syncProfileFromBackend]);

  const logout = useCallback(async () => {
    setUser(null);
    setDriverProfile(null);
    // Revoke the backend session + drop tokens, then wipe local sensitive data.
    await endSession();
    await clearSensitiveStorage();
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!userRef.current) return;
    const updated = { ...userRef.current, ...updates };
    setUser(updated);
    await saveStoredUser(updated);
  }, []);

  const saveDriverProfile = useCallback(async (profile: DriverProfile) => {
    setDriverProfile(profile);
    await saveStoredDriverProfile(profile);
  }, []);

  const setActiveVehicle = useCallback(async (vehicleId: string | null) => {
    const prev = driverProfileRef.current;
    if (!prev || prev.isOnline) return;
    if (vehicleId !== null && !getApprovedDriverVehicles(prev).some(vehicle => vehicle.id === vehicleId)) return;
    const updated = setDriverActiveVehicle(prev, vehicleId);
    setDriverProfile(updated);
    await saveStoredDriverProfile(updated);
  }, []);

  const setDriverOnline = useCallback(async (isOnline: boolean) => {
    const prev = driverProfileRef.current;
    if (!prev || prev.isOnline === isOnline) return;
    if (isOnline) {
      const vehicle = getDriverVehicleForSession(prev);
      if (!vehicle || vehicle.status !== 'approved') return;
      const updated: DriverProfile = {
        ...prev,
        isOnline: true,
        onlineVehicleSession: {
          vehicleId: vehicle.id,
          vehicleType: vehicle.vehicleType,
          startedAt: new Date().toISOString(),
        },
      };
      setDriverProfile(updated);
      await saveStoredDriverProfile(updated);
      return;
    }
    const updated: DriverProfile = { ...prev, isOnline: false, onlineVehicleSession: null };
    setDriverProfile(updated);
    await saveStoredDriverProfile(updated);
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
    setActiveVehicle,
    setDriverOnline,
    switchMode,
    recordCompletedRide,
  }), [
    driverProfile,
    isLoading,
    login,
    logout,
    recordCompletedRide,
    saveDriverProfile,
    setActiveVehicle,
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

export function useOptionalAuth() {
  return useContext(AuthContext);
}
