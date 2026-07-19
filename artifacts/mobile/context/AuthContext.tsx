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
import { AppState, type AppStateStatus } from 'react-native';
import { clearSensitiveStorage } from '@/persistence/secureStorage';
import { endSession } from '@/services/authSession';
import { getAccessToken, clearAuthTokens } from '@/persistence/authTokens';
import { fetchProfile } from '@/services/profile';
import { switchUserMode } from '@/services/userMode';
import { setDriverAvailability } from '@/services/driverAvailability';
import { getDriverProfile } from '@/services/driverProfile';
import { configurePushNotifications, registerPushToken, resetPushRegistration } from '@/services/pushRegistration';
import { AppMode, DriverProfile, User } from '@/types';
import { canAccessDriverMode } from '@/utils/driverVerification';
import { getApprovedDriverVehicles, getDriverVehicleForSession, setDriverActiveVehicle } from '@/domain/driverVehicles';
import { activateVehicleByPlate } from '@/services/driverVehicles';

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
  // Re-pull the driver's real approval status + online state from the backend.
  // Screens that show approval state (e.g. submission confirmation) call this on
  // focus so a PENDING → APPROVED transition appears without a cold restart.
  refreshDriverProfile: () => Promise<void>;
}

// Backend approval_status → mobile status. The backend uses PENDING_REVIEW for a
// freshly submitted application; NEEDS_MORE_INFO is actionable (re-submit), so it
// maps to 'rejected' which drives the "Update Application" CTA.
function mapApprovalStatus(status: string): DriverProfile['verificationStatus'] | null {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'NEEDS_MORE_INFO':
      return 'rejected';
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'pending_review';
    default:
      return null;
  }
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
    configurePushNotifications();
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [storedUser, storedDriverProfile] = await Promise.all([
        loadStoredUser(),
        loadStoredDriverProfile(),
      ]);
      if (storedUser.data) {
        // A user is only really authenticated if a session token is present.
        // Otherwise (e.g. a login stored before the auth wiring) every
        // authenticated call would 401 — so drop the stale session and force a
        // clean re-login instead of showing a broken signed-in state.
        const token = await getAccessToken();
        if (token) {
          setUser(storedUser.data);
          void syncProfileFromBackend();
          void registerPushToken();
        } else {
          await clearAuthTokens();
        }
      }
      if (storedDriverProfile.data) {
        setDriverProfile(storedDriverProfile.data);
        void syncDriverProfileFromBackend();
      }
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

  // Sync the driver's real approval status + online state from the backend
  // (GET /driver/profile). Only for existing drivers; merges non-destructively.
  const syncDriverProfileFromBackend = useCallback(async () => {
    if (!driverProfileRef.current) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const backend = await getDriverProfile();
      const status = mapApprovalStatus(backend.approvalStatus);
      setDriverProfile(prev => {
        if (!prev) return prev;
        const updated: DriverProfile = {
          ...prev,
          verificationStatus: status ?? prev.verificationStatus,
          // canAccessDriverMode() gates on isVerified too — keep it in lockstep
          // with the backend approval, otherwise an approved driver can never
          // switch into driver mode (switchMode silently bails).
          isVerified: status === 'approved' ? true : status === 'rejected' ? false : prev.isVerified,
          isOnline: backend.isOnline,
          acceptanceRate: backend.acceptanceRate || prev.acceptanceRate,
          completedRides: backend.totalRides || prev.completedRides,
          rejectionReason: backend.rejectionReason ?? prev.rejectionReason,
        };
        void saveStoredDriverProfile(updated);
        return updated;
      });
    } catch {
      // Not a driver yet, or backend unreachable — keep the local profile.
    }
  }, []);

  // Re-sync from the backend whenever the app returns to the foreground, so an
  // approval that happened while the app was backgrounded (or a profile change)
  // is reflected everywhere — home header badge, submission screen, etc. — even
  // if the user never cold-restarts.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      void syncProfileFromBackend();
      void syncDriverProfileFromBackend();
    });
    return () => subscription.remove();
  }, [syncProfileFromBackend, syncDriverProfileFromBackend]);

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await saveStoredUser(newUser);
    void syncProfileFromBackend();
    void registerPushToken();
  }, [syncProfileFromBackend]);

  const logout = useCallback(async () => {
    setUser(null);
    setDriverProfile(null);
    // Revoke the backend session + drop tokens, then wipe local sensitive data.
    resetPushRegistration();
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
    const selected = vehicleId !== null
      ? getApprovedDriverVehicles(prev).find(vehicle => vehicle.id === vehicleId)
      : null;
    if (vehicleId !== null && !selected) return;
    const updated = setDriverActiveVehicle(prev, vehicleId);
    setDriverProfile(updated);
    await saveStoredDriverProfile(updated);
    // Tell the backend which vehicle is active (POST /driver/vehicles/{id}/activate).
    // Matched by plate; best-effort so an offline switch still works locally.
    if (selected) {
      try {
        await activateVehicleByPlate(selected.plateNumber);
      } catch {
        // Backend unreachable or rejected (e.g. active ride) — keep local state.
      }
    }
  }, []);

  const setDriverOnline = useCallback(async (isOnline: boolean) => {
    const prev = driverProfileRef.current;
    if (!prev || prev.isOnline === isOnline) return;
    if (isOnline) {
      // Approval is a DRIVER-level fact (backend approval → canAccessDriverMode),
      // NOT the local vehicle row's status: that row can still read
      // 'pending_review' from application time even after the backend approved the
      // driver, which wrongly blocked going online. Gate on the driver's approval.
      if (!canAccessDriverMode(prev)) return;
      const vehicle = getDriverVehicleForSession(prev);
      const updated: DriverProfile = {
        ...prev,
        isOnline: true,
        onlineVehicleSession: {
          vehicleId: vehicle?.id ?? 'primary',
          vehicleType: vehicle?.vehicleType ?? prev.vehicleType ?? 'moto',
          startedAt: new Date().toISOString(),
        },
      };
      setDriverProfile(updated);
      await saveStoredDriverProfile(updated);
      // Mark the driver online on the backend so customers' nearby-driver search
      // (WHERE is_online = TRUE) can find them. Best-effort: if it fails we roll
      // the local state back so the toggle reflects reality instead of lying.
      try {
        await setDriverAvailability(true);
      } catch {
        const reverted: DriverProfile = { ...updated, isOnline: false, onlineVehicleSession: null };
        setDriverProfile(reverted);
        await saveStoredDriverProfile(reverted);
      }
      return;
    }
    const updated: DriverProfile = { ...prev, isOnline: false, onlineVehicleSession: null };
    setDriverProfile(updated);
    try {
      await setDriverAvailability(false);
    } catch {
      // keep local offline state
    }
    await saveStoredDriverProfile(updated);
  }, []);

  const switchMode = useCallback(async (mode: AppMode) => {
    if (!userRef.current) return;
    if (mode === 'driver' && !canAccessDriverMode(driverProfileRef.current)) return;
    const updated = { ...userRef.current, mode };
    setUser(updated);
    await saveStoredUser(updated);
    // Real backend: PATCH /users/mode updates role_state. Best-effort — the
    // local UX already reflects the switch; a failure is retried next switch.
    try {
      await switchUserMode(mode === 'driver' ? 'driver' : 'customer');
    } catch {
      // ignore — keep the local mode
    }
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
    refreshDriverProfile: syncDriverProfileFromBackend,
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
    syncDriverProfileFromBackend,
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
