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
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { clearSensitiveStorage } from '@/persistence/secureStorage';
import { endSession } from '@/services/authSession';
import { getAccessToken, clearAuthTokens } from '@/persistence/authTokens';
import { refreshAccessToken } from '@/services/tokenRefresh';
import { fetchProfile } from '@/services/profile';
import { setDriverAvailability } from '@/services/driverAvailability';
import {
  clearRoleSync,
  initRoleSync,
  queueRoleSync,
  readRoleSyncRejection,
  subscribeRoleSync,
  type RoleSyncEvent,
} from '@/services/roleSwitchSync';
import { navigateToModeHome } from '@/navigation/navigationPolicy';
import { cancelRide, getActiveRide } from '@/services/rides';
import {
  cancelModeSwitch,
  completeModeSwitch,
  getAppModeState,
  requestModeSwitch,
  resetAppModeForLogout,
} from '@/state/appModeStore';
import { isRideSwitchBlocking } from '@/state/rideActivityStore';
import { reportOperationalFailure } from '@/observability/monitoring';
import { getDriverProfile } from '@/services/driverProfile';
import { configurePushNotifications, registerPushToken, resetPushRegistration } from '@/services/pushRegistration';
import { AppMode, DriverProfile, User } from '@/types';
import { canAccessDriverMode } from '@/utils/driverVerification';
import { getApprovedDriverVehicles, getDriverVehicleForSession, setDriverActiveVehicle } from '@/domain/driverVehicles';
import { activateVehicleByPlate } from '@/services/driverVehicles';

// Every way a role switch can be refused. Callers get a typed answer instead
// of a silent no-op, so the UI can always tell the user what happened.
export type RoleSwitchFailureReason =
  | 'not-authenticated'
  | 'not-verified'
  | 'active-ride'
  | 'switch-in-progress';

export type RoleSwitchResult =
  | { ok: true; mode: AppMode; changed: boolean }
  | { ok: false; reason: RoleSwitchFailureReason };

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
  switchMode: (mode: AppMode) => Promise<RoleSwitchResult>;
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

// Build a LOCAL driver profile from the backend's GET /driver/profile response.
// Used on login / app-load when there is no local profile yet (fresh login, or
// logout cleared storage) so a driver is recognised as a driver — the backend is
// the source of truth for driver identity, not local storage.
type BackendDriverProfile = Awaited<ReturnType<typeof getDriverProfile>>;
function buildLocalDriverProfile(b: BackendDriverProfile): DriverProfile {
  const status = mapApprovalStatus(b.approvalStatus);
  const approved = b.approvalStatus === 'APPROVED';
  const vehicleType = b.vehicleType ?? 'moto';
  return {
    verificationStatus: status ?? 'pending_review',
    vehicleType,
    plateNumber: b.vehiclePlate,
    licenseNumber: b.licenseNumber,
    province: b.province,
    district: b.district,
    sector: b.sector,
    cell: b.cell,
    village: b.village,
    city: b.city,
    momoCode: b.momoPayCode ?? '',
    momoProvider: b.momoProvider === 'airtel' ? 'airtel' : 'mtn',
    dob: '',
    isOnline: b.isOnline,
    isVerified: approved,
    acceptanceRate: b.acceptanceRate ?? 0,
    completedRides: b.totalRides ?? 0,
    dailyRides: 0,
    dailyDeclines: 0,
    policyAccepted: b.policyAccepted ?? false,
    earningsTotal: 0,
    passengerSeats: b.passengerSeats ?? undefined,
    loadCapacityKg: b.loadCapacityKg ?? undefined,
    rejectionReason: b.rejectionReason ?? undefined,
    vehicles: [
      {
        id: b.id,
        vehicleType,
        status: approved
          ? ('approved' as const)
          : status === 'rejected'
            ? ('rejected' as const)
            : ('pending_review' as const),
        plateNumber: b.vehiclePlate,
        licenseNumber: b.licenseNumber,
      },
    ],
  };
}

// Backend refusal codes from PATCH /v1/users/mode (internal/location/service.go
// SwitchMode). Each one is actionable, so each gets its own copy — a generic
// "please try again" sends the driver in circles on a state they must fix.
function getRoleSwitchFailureTitle(code: string | null) {
  if (code === 'ACTIVE_RIDE') return 'Finish your ride first';
  if (code === 'POLICY_NOT_ACCEPTED') return 'Accept the driver policies';
  if (code === 'DRIVER_NOT_ACTIVE' || code === 'NO_DRIVER_PROFILE') return 'Driver account not active';
  return 'Mode switch failed';
}

function getRoleSwitchFailureMessage(mode: AppMode, code: string | null, message: string | null) {
  switch (code) {
    case 'ACTIVE_RIDE':
      return 'You still have a ride in progress. Complete or cancel it, then switch modes.';
    case 'POLICY_NOT_ACCEPTED':
      return 'You need to accept the driver policies before driving. Open your driver profile to review them.';
    case 'DRIVER_NOT_ACTIVE':
      return 'Your driver account is not approved for driving right now. Check your application status.';
    case 'NO_DRIVER_PROFILE':
      return "We couldn't find your driver profile on this account. Apply as a driver to continue.";
    default:
      break;
  }
  if (message) return message;
  return mode === 'driver'
    ? "We couldn't switch you to driver mode. Please try again."
    : "We couldn't switch you to customer mode. Please try again.";
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

  // Backend refused a role switch outright (4xx the sync engine can't retry
  // away): the local mode is a lie — driver endpoints and the driver socket
  // would be rejected forever. Roll back to what the backend accepts and say
  // so, instead of leaving the app half-switched.
  useEffect(() => {
    void initRoleSync();
    return subscribeRoleSync((event: RoleSyncEvent) => {
      if (event.type !== 'failed') return;
      const current = userRef.current;
      if (!current || current.mode !== event.mode) return;
      const revertTo: AppMode = event.mode === 'driver' ? 'customer' : 'driver';
      const reverted = { ...current, mode: revertTo };
      setUser(reverted);
      void saveStoredUser(reverted).catch(() => {});
      completeModeSwitch(revertTo);
      // The reverted mode is meaningless while the screen for the REFUSED mode
      // is still on top — the driver dashboard stayed up under the alert,
      // showing driver UI backed by customer state. Send them where the
      // rollback actually put them.
      navigateToModeHome(revertTo);
      // The refused mode was rolled back — say WHY, using the backend's own
      // reason (policy not accepted, active ride, …) rather than a dead end.
      const { code, message } = readRoleSyncRejection(event.error);
      const title = getRoleSwitchFailureTitle(code);
      const body = getRoleSwitchFailureMessage(event.mode, code, message);
      if (code === 'ACTIVE_RIDE') {
        // A ride the user never finished — often one abandoned mid-search —
        // blocks every future switch with no in-app way out. Offer to release
        // it. Destructive, so it is explicitly confirmed, never automatic.
        Alert.alert(title, `${body}\n\nIf you're not actually on a ride, you can release it now.`, [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Release ride',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  const active = await getActiveRide();
                  if (!active?.id) {
                    Alert.alert('Nothing to release', 'We found no active ride on your account. Try switching again.');
                    return;
                  }
                  await cancelRide(active.id);
                  Alert.alert('Ride released', 'You can switch modes now.');
                } catch (error) {
                  reportOperationalFailure('auth.roleSwitch.releaseRide', error);
                  Alert.alert('Could not release the ride', 'Please try again, or contact support if it keeps failing.');
                }
              })();
            },
          },
        ]);
        return;
      }
      Alert.alert(title, body);
    });
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
          // No usable access token — but before bouncing a returning user to
          // the login screen, try a SILENT re-auth with the stored refresh
          // token (valid 30 days). refreshAccessToken() no-ops to false when
          // there is no refresh token (e.g. after logout, which wipes it), so
          // this only rescues genuine sessions whose access token expired.
          // Without it, a 15-minute access-token expiry logged people out.
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            setUser(storedUser.data);
            void syncProfileFromBackend();
            void registerPushToken();
          } else {
            await clearAuthTokens();
          }
        }
      }
      if (storedDriverProfile.data) {
        setDriverProfile(storedDriverProfile.data);
      }
      // Always reconcile driver identity from the backend when authed (the call
      // self-guards on the token). A driver may have NO local profile after a
      // fresh login / logout, so this is what recognises them as a driver.
      void syncDriverProfileFromBackend();
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
        // Emergency contacts must come along. Edit Profile seeds its form from
        // this user object and now sends '' to clear a field, so a form opened
        // before these landed showed them blank and Save ERASED them on the
        // server — losing the very data the sync was added to preserve.
        const updated: User = {
          ...prev,
          name: profile.fullName || prev.name,
          email: profile.email ?? prev.email,
          emergencyContactName: profile.emergencyContactName ?? prev.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone ?? prev.emergencyContactPhone,
        };
        void saveStoredUser(updated);
        return updated;
      });
    } catch {
      // Backend unreachable — keep the locally stored profile.
    }
  }, []);

  // Sync the driver's real approval status + online state from the backend
  // (GET /driver/profile). The backend is the source of truth for driver
  // IDENTITY: on a fresh login (or after logout cleared local storage) there is
  // no local profile, so if the backend says this user is a driver we BUILD one —
  // otherwise a real driver would come back as a customer with a "Join as rider"
  // prompt. Non-driver users 404 here (caught) and stay customers.
  const syncDriverProfileFromBackend = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const backend = await getDriverProfile();
      const status = mapApprovalStatus(backend.approvalStatus);
      setDriverProfile(prev => {
        if (!prev) {
          const built = buildLocalDriverProfile(backend);
          void saveStoredDriverProfile(built);
          return built;
        }
        // Bridge the backend approval onto the LOCAL vehicle rows. A vehicle is
        // stored locally as 'pending_review' at apply time and never updated, so
        // screens (home header, profile, vehicles list) keep showing "in review"
        // long after the backend approved the driver. The backend approves the
        // driver + their vehicle together, so mirror the decision onto any local
        // vehicle still stuck in draft/pending_review.
        const syncedVehicles =
          status && prev.vehicles
            ? prev.vehicles.map(v => {
                if (v.status !== 'pending_review' && v.status !== 'draft') return v;
                const nextStatus =
                  status === 'approved'
                    ? ('approved' as const)
                    : status === 'rejected'
                      ? ('rejected' as const)
                      : v.status;
                return { ...v, status: nextStatus };
              })
            : prev.vehicles;
        const updated: DriverProfile = {
          ...prev,
          verificationStatus: status ?? prev.verificationStatus,
          // canAccessDriverMode() gates on isVerified too — keep it in lockstep
          // with the backend approval, otherwise an approved driver can never
          // switch into driver mode (switchMode silently bails). Preserve the
          // prior flag on a transient/unknown status so we don't un-verify a
          // driver on a blip.
          isVerified: status === 'approved' ? true : status === 'rejected' ? false : prev.isVerified,
          vehicles: syncedVehicles,
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
    // Recognise a returning driver: pull their real driver profile from the
    // backend (identity survives logout, which clears local storage).
    void syncDriverProfileFromBackend();
    void registerPushToken();
  }, [syncProfileFromBackend, syncDriverProfileFromBackend]);

  const logout = useCallback(async () => {
    setUser(null);
    setDriverProfile(null);
    // A pending role sync belongs to the session being revoked.
    resetAppModeForLogout();
    await clearRoleSync();
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

  // The role switch is optimistic and instant: commit locally, navigate, and
  // let roleSwitchSync guarantee the backend converges (with retry across
  // restarts). Nothing here touches the network, so the slider never freezes
  // on a slow connection. Refusals are typed — never a silent no-op.
  const switchMode = useCallback(async (mode: AppMode): Promise<RoleSwitchResult> => {
    const current = userRef.current;
    if (!current) return { ok: false, reason: 'not-authenticated' };
    if (current.mode === mode) return { ok: true, mode, changed: false };
    if (mode === 'driver' && !canAccessDriverMode(driverProfileRef.current)) {
      return { ok: false, reason: 'not-verified' };
    }
    // Switching mid-ride is what made the customer and driver flow navigators
    // fight over the router — finish or cancel the ride first.
    if (isRideSwitchBlocking()) return { ok: false, reason: 'active-ride' };
    if (getAppModeState().switching) return { ok: false, reason: 'switch-in-progress' };
    requestModeSwitch(mode);
    try {
      // Leaving driver mode always pushes is_online = FALSE to the backend —
      // otherwise the dispatcher keeps assigning rides to a driver whose
      // socket is gone and every request expires against their stats.
      const profile = driverProfileRef.current;
      const driverOffline = mode === 'customer' && profile !== null;
      if (driverOffline && profile.isOnline) {
        const offlineProfile: DriverProfile = { ...profile, isOnline: false, onlineVehicleSession: null };
        setDriverProfile(offlineProfile);
        void saveStoredDriverProfile(offlineProfile).catch(error =>
          reportOperationalFailure('auth.roleSwitch.profilePersist', error),
        );
      }
      const updated = { ...current, mode };
      setUser(updated);
      void saveStoredUser(updated).catch(error =>
        reportOperationalFailure('auth.roleSwitch.userPersist', error),
      );
      queueRoleSync({ mode: mode === 'driver' ? 'driver' : 'customer', driverOffline });
      completeModeSwitch(mode);
      return { ok: true, mode, changed: true };
    } catch (error) {
      cancelModeSwitch();
      reportOperationalFailure('auth.roleSwitch.commit', error, { mode });
      throw error;
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
