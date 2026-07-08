import type { RemoteReadinessDomain, RemoteReadinessRecommendation, RemoteReadinessRiskCategory } from './remoteReadinessTypes';

export interface RemoteReadinessPolicySet {
  contractWeight: number;
  shadowWeight: number;
  safetyWeight: number;
  riskWeights: Record<RemoteReadinessRiskCategory, number>;
  scoreThresholds: Record<RemoteReadinessRecommendation, number>;
}

export const remoteReadinessPolicies: RemoteReadinessPolicySet = {
  contractWeight: 18,
  shadowWeight: 12,
  safetyWeight: 10,
  riskWeights: {
    low: 0,
    medium: -4,
    high: -8,
    financial: -10,
    lifecycle: -8,
    'identity/security': -9,
  },
  scoreThresholds: {
    not_ready: 0,
    shadow_only: 40,
    staging_shadow_candidate: 72,
    hybrid_candidate: 84,
    remote_candidate: 95,
  },
};

export const remoteReadinessRolloutOrder: RemoteReadinessDomain[] = [
  'savedLocations',
  'profile',
  'paymentMethods',
  'notifications',
  'vehicles',
  'rideReads',
  'driverOnboarding',
  'search',
  'map',
  'auth',
  'packages',
];

export const remoteReadinessPolicyNotes: Record<RemoteReadinessDomain, string[]> = {
  auth: [
    'token/session persistence strategy still needs a backend-cutover design',
    'OTP shadow flow must stay dry-run only',
  ],
  profile: [
    'one-account identity already modeled; safe hybrid candidate once staging parity is confirmed',
  ],
  savedLocations: [
    'local persistence is already stable and low risk',
  ],
  notifications: [
    'safe semantic comparison available through unread/read state and feed counts',
  ],
  vehicles: [
    'driver-vehicle truth stays local today; approval authority remains out of scope',
  ],
  packages: [
    'financial reconciliation and credit authority still need stronger backend gating',
  ],
  paymentMethods: [
    'method metadata can advance before transaction authority',
  ],
  rideReads: [
    'read-only ride surfaces are candidate staging inputs; lifecycle writes stay local',
  ],
  driverOnboarding: [
    'review state is diagnostic only; approval authority stays backend/admin-owned later',
  ],
  search: [
    'semantic comparison and privacy controls are required because ranking can vary',
  ],
  map: [
    'route and fare previews need tolerance policies and coarse telemetry',
  ],
  rideCommands: [
    'ride command write authority remains disabled',
  ],
  realtimeEvents: [
    'realtime authority remains local/live-provider controlled',
  ],
  paymentTransactions: [
    'transaction authority is still future backend work',
  ],
  wallet: [
    'wallet balance authority is not ready for remote cutover',
  ],
  adminReview: [
    'admin review authority remains backend-owned future work',
  ],
};

export const remoteReadinessDocsEvidence: Record<RemoteReadinessDomain, string[]> = {
  auth: ['otp shadow dry-run documented', 'local session authoritative'],
  profile: ['shared identity remote prototype documented', 'local profile authoritative'],
  savedLocations: ['saved locations remote prototype documented', 'local saved locations authoritative'],
  notifications: ['notifications remote prototype documented', 'local notifications authoritative'],
  vehicles: ['vehicle remote prototype documented', 'local driver profile-backed vehicle authority'],
  packages: ['packages remote prototype documented', 'financial authority out of scope'],
  paymentMethods: ['payment methods remote prototype documented', 'payment execution out of scope'],
  rideReads: ['ride reads remote prototype documented', 'local/live-provider ride authority'],
  driverOnboarding: ['driver onboarding remote prototype documented', 'backend/admin approval future authority'],
  search: ['search remote prototype documented', 'privacy/tolerance comparison documented'],
  map: ['map remote prototype documented', 'route/fare tolerance comparison documented'],
  rideCommands: ['ride command remote writes disabled'],
  realtimeEvents: ['realtime remote authority remains disabled'],
  paymentTransactions: ['payment transaction authority future work'],
  wallet: ['wallet authority future work'],
  adminReview: ['admin review authority future work'],
};
