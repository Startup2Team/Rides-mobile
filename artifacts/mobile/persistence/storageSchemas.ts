import { z } from 'zod';
import { migrateDriverProfileToMultiVehicle } from '@/domain/driverVehicles';
import { normalizeEntitlement } from '@/domain/driverRidePackages';
import type { ManualPaymentClaimAuditAction, ManualPaymentClaimStatus, ManualPaymentProvider } from '@/domains/package-payments';

const vehicleTypeSchema = z.enum(['moto', 'rifani', 'cab', 'fuso', 'hilux']);
const appModeSchema = z.enum(['customer', 'driver']);
const driverVerificationStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);
const driverVehicleStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);
const driverRidePackageIdSchema = z.string().trim().min(1);
const locationTypeSchema = z.enum(['precise', 'generic']);
const rideStatusSchema = z.enum([
  'idle',
  'searching',
  'driver_assigned',
  'negotiating',
  'confirmed',
  'arriving',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
]);

export const rideLocationSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  address: z.string().optional(),
  locationType: locationTypeSchema.optional(),
}).passthrough();

export const savedLocationSchema = rideLocationSchema.extend({
  id: z.string(),
  label: z.string(),
}).passthrough();

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  mode: appModeSchema,
  isDriver: z.boolean(),
  createdAt: z.string(),
}).passthrough();

export const paymentMethodsSchema = z.array(z.object({
  id: z.string(),
  provider: z.enum(['mtn', 'airtel', 'cash']),
  label: z.string(),
  phoneNumber: z.string().optional(),
  isDefault: z.boolean(),
}).passthrough());

const MANUAL_PAYMENT_CLAIM_AUDIT_ACTIONS = [
  'claim_created',
  'claim_submitted',
  'review_started',
  'clarification_requested',
  'clarification_resubmitted',
  'claim_approved',
  'claim_rejected',
  'claim_expired',
  'claim_cancelled',
  'activation_requested',
  'activation_completed',
] as const;

const MANUAL_PAYMENT_PROVIDER_VALUES = ['mtn', 'airtel'] as const;

const MANUAL_PAYMENT_CLAIM_STATUS_VALUES = [
  'draft',
  'submitted',
  'pending_review',
  'needs_clarification',
  'approved',
  'rejected',
  'expired',
  'cancelled',
] as const;

const manualPaymentClaimAuditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actorType: z.enum(['driver', 'admin', 'support', 'system']),
  actorId: z.string().optional(),
  action: z.enum(MANUAL_PAYMENT_CLAIM_AUDIT_ACTIONS),
  reasonCode: z.string().optional(),
});

export const manualPaymentClaimsSchema = z.array(z.object({
  id: z.string(),
  version: z.number().int().positive().default(1),
  driverId: z.string(),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  offerId: z.string(),
  packageId: z.string(),
  packageVersion: z.string(),
  packageName: z.string(),
  expectedAmountRwf: z.number().positive(),
  provider: z.enum(MANUAL_PAYMENT_PROVIDER_VALUES),
  merchantCodeSnapshot: z.string(),
  payerPhoneNumber: z.string(),
  transactionReference: z.string().optional(),
  proofImageId: z.string().optional(),
  status: z.enum(MANUAL_PAYMENT_CLAIM_STATUS_VALUES),
  createdAt: z.string(),
  submittedAt: z.string().optional(),
  expiresAt: z.string(),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
  clarificationMessage: z.string().optional(),
  supportNote: z.string().optional(),
  activationId: z.string().optional(),
  purchaseTransactionId: z.string().optional(),
  idempotencyKey: z.string(),
  auditLog: z.array(manualPaymentClaimAuditEntrySchema),
}).passthrough());

export const profileImageSchema = z.string();

const documentFacesSchema = z.tuple([z.string().nullable(), z.string().nullable()]);

const driverDocumentRecordSchema = z.object({
  key: z.enum(['license', 'nationalId', 'insurance', 'authorization']),
  faces: documentFacesSchema,
  documentNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  reviewStatus: z.enum(['verified', 'pending_review', 'rejected']),
  submissionKind: z.enum(['initial', 'replacement']),
  submittedAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const driverDocumentsSchema = z.object({
  license: driverDocumentRecordSchema,
  nationalId: driverDocumentRecordSchema,
  insurance: driverDocumentRecordSchema,
  authorization: driverDocumentRecordSchema,
});

const driverVehicleDocumentSetSchema = driverDocumentsSchema;

const driverVehicleProfileSchema = z.object({
  id: z.string(),
  vehicleType: vehicleTypeSchema,
  status: driverVehicleStatusSchema,
  plateNumber: z.string(),
  licenseNumber: z.string(),
  model: z.string().optional(),
  brand: z.string().optional(),
  manufactureYear: z.number().int().optional(),
  passengerSeats: z.number().optional(),
  loadCapacityKg: z.number().optional(),
  licenseExpiryDate: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  authorizationExpiryDate: z.string().optional(),
  photos: z.object({
    outside: z.string().nullable().optional(),
    inside: z.string().nullable().optional(),
  }).optional(),
  documents: driverVehicleDocumentSetSchema.optional(),
  pendingDocumentUpdate: z.object({
    status: z.enum(['pending_review', 'approved', 'rejected']),
    submittedAt: z.string(),
    reviewedAt: z.string().optional(),
    rejectionReason: z.string().optional(),
    documents: driverVehicleDocumentSetSchema,
    photos: z.object({
      outside: z.string().nullable().optional(),
      inside: z.string().nullable().optional(),
    }).optional(),
  }).nullable().optional(),
  submittedAt: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  reviewHistory: z.array(z.object({
    id: z.string(),
    type: z.enum(['submitted', 'under_review', 'documents_updated', 'approved', 'rejected']),
    at: z.string(),
    reason: z.string().optional(),
  }).passthrough()).optional(),
}).passthrough();

const verificationSubmissionStatusSchema = z.enum([
  'draft',
  'submitted',
  'pending_review',
  'approved',
  'rejected',
  'resubmitted',
  'cancelled',
]);
const verificationReviewStatusSchema = z.enum(['pending_review', 'approved', 'rejected']);
const verificationSubmissionHistoryEventTypeSchema = z.enum([
  'draft',
  'submitted',
  'pending_review',
  'resubmitted',
  'approved',
  'rejected',
  'cancelled',
]);
const verificationReviewDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewedAt: z.string(),
  reviewedBy: z.string().optional(),
  reason: z.string().optional(),
  rejectedFields: z.array(z.string()).optional(),
  rejectedDocuments: z.array(z.string()).optional(),
});
const verificationSubmissionChangedFieldSchema = z.enum(['license', 'nationalId', 'insurance', 'authorization', 'outside', 'inside']);
const verificationSubmissionHistoryEventSchema = z.object({
  id: z.string(),
  type: verificationSubmissionHistoryEventTypeSchema,
  at: z.string(),
  reason: z.string().optional(),
  rejectedFields: z.array(z.string()).optional(),
  rejectedDocuments: z.array(z.string()).optional(),
  reviewedBy: z.string().optional(),
});
const submissionDocumentSetSchema = driverVehicleDocumentSetSchema;
const submissionPhotoSchema = z.object({
  outside: z.string().nullable().optional(),
  inside: z.string().nullable().optional(),
}).passthrough();
const driverApplicationSubmissionSchema = z.object({
  id: z.string(),
  clientSubmissionId: z.string(),
  kind: z.literal('driver_application'),
  status: verificationSubmissionStatusSchema,
  reviewStatus: verificationReviewStatusSchema,
  submittedAt: z.string(),
  updatedAt: z.string(),
  reviewDecision: verificationReviewDecisionSchema.optional(),
  history: z.array(verificationSubmissionHistoryEventSchema),
  userId: z.string(),
  fullName: z.string(),
  phone: z.string(),
  dob: z.string(),
  nationalId: z.string(),
  operatingLocation: z.object({
    province: z.string(),
    district: z.string(),
    sector: z.string(),
    cell: z.string().optional(),
    village: z.string().optional(),
    city: z.string().optional(),
  }).passthrough(),
  momoDetails: z.object({
    provider: z.enum(['mtn', 'airtel']),
    momoCode: z.string(),
    merchantCode: z.string().optional(),
  }).passthrough(),
  selfieImage: z.string().nullable(),
  firstVehicle: z.object({
    vehicleType: vehicleTypeSchema,
    plateNumber: z.string(),
    licenseNumber: z.string(),
    model: z.string().optional(),
    brand: z.string().optional(),
    manufactureYear: z.number().int().optional(),
    passengerSeats: z.number().optional(),
    loadCapacityKg: z.number().optional(),
    licenseExpiryDate: z.string().optional(),
    insuranceExpiryDate: z.string().optional(),
    authorizationExpiryDate: z.string().optional(),
  }).passthrough(),
  documents: submissionDocumentSetSchema,
  photos: submissionPhotoSchema.optional(),
}).passthrough();
const vehicleApplicationSubmissionSchema = z.object({
  id: z.string(),
  clientSubmissionId: z.string(),
  kind: z.literal('vehicle_application'),
  status: verificationSubmissionStatusSchema,
  reviewStatus: verificationReviewStatusSchema,
  submittedAt: z.string(),
  updatedAt: z.string(),
  reviewDecision: verificationReviewDecisionSchema.optional(),
  history: z.array(verificationSubmissionHistoryEventSchema),
  userId: z.string(),
  driverId: z.string(),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  plateNumber: z.string(),
  licenseNumber: z.string(),
  brand: z.string().optional(),
  model: z.string().optional(),
  manufactureYear: z.number().int().optional(),
  passengerSeats: z.number().optional(),
  loadCapacityKg: z.number().optional(),
  licenseExpiryDate: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  authorizationExpiryDate: z.string().optional(),
  documents: submissionDocumentSetSchema,
  photos: submissionPhotoSchema.optional(),
}).passthrough();
const vehicleDocumentUpdateSubmissionSchema = z.object({
  id: z.string(),
  clientSubmissionId: z.string(),
  kind: z.literal('vehicle_document_update'),
  status: verificationSubmissionStatusSchema,
  reviewStatus: verificationReviewStatusSchema,
  submittedAt: z.string(),
  updatedAt: z.string(),
  reviewDecision: verificationReviewDecisionSchema.optional(),
  history: z.array(verificationSubmissionHistoryEventSchema),
  userId: z.string(),
  driverId: z.string(),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  plateNumber: z.string(),
  changedFields: z.array(verificationSubmissionChangedFieldSchema),
  previousDocumentMetadata: z.object({
    documents: submissionDocumentSetSchema.optional(),
    photos: submissionPhotoSchema.optional(),
  }).optional(),
  documents: submissionDocumentSetSchema,
  photos: submissionPhotoSchema.optional(),
}).passthrough();
const verificationSubmissionStoreZodSchema = z.object({
  driverApplications: z.array(driverApplicationSubmissionSchema),
  vehicleApplications: z.array(vehicleApplicationSubmissionSchema),
  vehicleDocumentUpdates: z.array(vehicleDocumentUpdateSubmissionSchema),
});

const driverProfileShapeSchema = z.object({
  verificationStatus: driverVerificationStatusSchema.optional(),
  vehicleType: vehicleTypeSchema,
  plateNumber: z.string(),
  licenseNumber: z.string(),
  nationalId: z.string().optional(),
  licenseExpiryDate: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  authorizationExpiryDate: z.string().optional(),
  province: z.string(),
  district: z.string(),
  sector: z.string(),
  cell: z.string().optional(),
  village: z.string().optional(),
  city: z.string().optional(),
  momoCode: z.string(),
  merchantCode: z.string().optional(),
  momoProvider: z.enum(['mtn', 'airtel']),
  dob: z.string(),
  profileImage: z.string().optional(),
  isOnline: z.boolean(),
  isVerified: z.boolean(),
  acceptanceRate: z.number(),
  completedRides: z.number(),
  dailyRides: z.number(),
  dailyDeclines: z.number(),
  policyAccepted: z.boolean(),
  policyAcceptedAt: z.string().optional(),
  earningsTotal: z.number(),
  passengerSeats: z.number().optional(),
  loadCapacityKg: z.number().optional(),
  rejectionReason: z.string().optional(),
  activeVehicle: z.object({
    vehicleId: z.string().nullable(),
    selectedAt: z.string().optional(),
  }).optional(),
  onlineVehicleSession: z.object({
    vehicleId: z.string(),
    vehicleType: vehicleTypeSchema,
    startedAt: z.string(),
  }).nullable().optional(),
  vehicles: z.array(driverVehicleProfileSchema).optional(),
}).passthrough();

export const driverProfileSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return migrateDriverProfileToMultiVehicle(value as z.infer<typeof driverProfileShapeSchema>);
}, driverProfileShapeSchema);

export const verificationSubmissionStoreSchema = verificationSubmissionStoreZodSchema;

export const driverOnboardingDraftSchema = z.object({
  form: z.object({
    vehicleType: vehicleTypeSchema,
    brand: z.string().optional().default(''),
    model: z.string().optional().default(''),
    manufactureYear: z.string().optional().default(''),
    plateNumber: z.string(),
    licenseNumber: z.string(),
    nationalId: z.string(),
    licenseExpiryDate: z.string(),
    insuranceExpiryDate: z.string(),
    authorizationExpiryDate: z.string(),
    dob: z.string(),
    province: z.string(),
    district: z.string(),
    sector: z.string(),
    cell: z.string(),
    village: z.string(),
    momoProvider: z.enum(['mtn', 'airtel']),
    momoCode: z.string(),
    merchantCode: z.string(),
    passengerSeats: z.string(),
    loadCapacityKg: z.string(),
  }),
  docs: z.object({
    license: documentFacesSchema,
    nationalId: documentFacesSchema,
    insurance: documentFacesSchema,
    authorization: documentFacesSchema,
  }),
  vehiclePhotos: z.object({
    outside: z.string().nullable().optional().default(null),
    inside: z.string().nullable().optional().default(null),
  }).optional().default({ outside: null, inside: null }),
  selfieUri: z.string().nullable(),
  acceptedTerms: z.boolean(),
  step: z.number().int().min(0).max(4),
  updatedAt: z.string(),
});

const packageActivationSchema = z.object({
  id: z.string(),
  packageId: driverRidePackageIdSchema,
  packageVersion: z.string().optional(),
  packageName: z.string().optional(),
  campaignId: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  campaignType: z.enum(['global', 'vehicle_type', 'first_purchase', 'referral']).nullable().optional(),
  campaignStatus: z.enum(['draft', 'scheduled', 'active', 'expired', 'archived']).nullable().optional(),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  activatedAt: z.string(),
  pricePaidRwf: z.number().nonnegative(),
  pricePaid: z.number().nonnegative().optional(),
  ridesGranted: z.number().int().nonnegative().optional(),
  bonusRidesGranted: z.number().int().nonnegative().optional(),
  purchasedAt: z.string().optional(),
  creditsGranted: z.number().int().positive(),
  authority: z.enum(['local_prototype', 'backend']),
});

const driverPackagePurchaseStatusSchema = z.enum([
  'idle',
  'pending',
  'processing',
  'successful',
  'failed',
  'cancelled',
  'expired',
]);

const driverPackagePurchaseSchema = z.object({
  offerId: z.string().optional(),
  packageId: driverRidePackageIdSchema,
  packageVersion: z.string().optional(),
  packageName: z.string().optional(),
  campaignId: z.string().nullable().optional(),
  campaignName: z.string().nullable().optional(),
  campaignType: z.enum(['global', 'vehicle_type', 'first_purchase', 'referral']).nullable().optional(),
  campaignStatus: z.enum(['draft', 'scheduled', 'active', 'expired', 'archived']).nullable().optional(),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  amount: z.number().nonnegative(),
  pricePaid: z.number().nonnegative().optional(),
  ridesGranted: z.number().int().nonnegative().optional(),
  bonusRidesGranted: z.number().int().nonnegative().optional(),
  purchasedAt: z.string().optional(),
  provider: z.enum(['mtn', 'airtel']),
  phoneNumber: z.string(),
  transactionId: z.string(),
  status: driverPackagePurchaseStatusSchema,
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

const driverCreditTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(['credit', 'debit']),
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  amount: z.number().int(),
  createdAt: z.string(),
  packageActivationId: z.string().optional(),
  completedRideId: z.string().optional(),
  idempotencyKey: z.string(),
  authority: z.enum(['local_prototype', 'backend']),
});

const driverRatingSchema = z.object({
  id: z.string(),
  rideId: z.string(),
  driverId: z.string(),
  customerId: z.string().optional(),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  reviewText: z.string().optional(),
  moderationStatus: z.enum(['pending', 'published', 'hidden', 'flagged']),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  idempotencyKey: z.string(),
  authority: z.enum(['local_prototype', 'backend']),
});

export const driverRatingsSchema = z.array(driverRatingSchema);

const driverDailyGoalRecordSchema = z.object({
  amountRwf: z.number().int().min(1_000).max(1_000_000),
  effectiveFromLocalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough();

export const driverDailyGoalsSchema = z.array(driverDailyGoalRecordSchema);

const vehicleEntitlementSchema = z.object({
  vehicleId: z.string(),
  vehicleType: vehicleTypeSchema,
  activePackageId: driverRidePackageIdSchema.nullable(),
  remainingRideCredits: z.number().int().nonnegative(),
  remainingBonusRides: z.number().int().nonnegative(),
  activations: z.array(packageActivationSchema),
  creditTransactions: z.array(driverCreditTransactionSchema),
  purchaseHistory: z.array(driverPackagePurchaseSchema),
  updatedAt: z.string(),
  authority: z.enum(['local_prototype', 'backend']),
});

const driverEntitlementShapeSchema = vehicleEntitlementSchema.extend({
  vehicleId: z.string().nullable(),
  vehicleType: vehicleTypeSchema.nullable(),
  vehicleEntitlements: z.array(vehicleEntitlementSchema),
});

export const driverEntitlementSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return normalizeEntitlement({
    remainingBonusRides: 0,
    vehicleEntitlements: [],
    ...value,
  } as unknown as Parameters<typeof normalizeEntitlement>[0]);
}, driverEntitlementShapeSchema);

const negotiationMessageSchema = z.object({
  id: z.string(),
  sender: z.enum(['customer', 'driver', 'system']),
  type: z.enum(['offer', 'text']),
  amount: z.number().optional(),
  text: z.string().optional(),
  timestamp: z.string(),
  isFinal: z.boolean().optional(),
}).passthrough();

const mockDriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicleType: vehicleTypeSchema,
  plateNumber: z.string(),
  profileImage: z.string().optional(),
  location: z.object({
    latitude: z.number().finite(),
    longitude: z.number().finite(),
  }).passthrough(),
  rating: z.number(),
  eta: z.number(),
}).passthrough();

export const rideSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  driverId: z.string().optional(),
  driverName: z.string().optional(),
  driver: mockDriverSchema.optional(),
  vehicleType: vehicleTypeSchema,
  vehicleId: z.string().optional(),
  requestedVehicleType: vehicleTypeSchema.optional(),
  matchedVehicleType: vehicleTypeSchema.optional(),
  matchedVehicleId: z.string().optional(),
  pickup: rideLocationSchema,
  destination: rideLocationSchema,
  status: rideStatusSchema,
  distance: z.number(),
  duration: z.number(),
  suggestedFare: z.number(),
  agreedFare: z.number().optional(),
  negotiation: z.array(negotiationMessageSchema),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  arrivedAt: z.string().optional(),
  waitStartedAt: z.string().optional(),
}).passthrough();

export const rideHistorySchema = z.array(rideSchema);
export const savedLocationsSchema = z.array(savedLocationSchema);
