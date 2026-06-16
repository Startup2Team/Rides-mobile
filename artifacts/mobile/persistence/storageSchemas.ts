import { z } from 'zod';

const vehicleTypeSchema = z.enum(['moto', 'rifani', 'cab', 'fuso', 'hilux']);
const appModeSchema = z.enum(['customer', 'driver']);
const driverVerificationStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);
const driverRidePackageIdSchema = z.enum(['launch_starter', 'growth', 'pro']);
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

export const profileImageSchema = z.string();

export const driverProfileSchema = z.object({
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
}).passthrough();

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
});

export const driverDocumentsSchema = z.object({
  license: driverDocumentRecordSchema,
  nationalId: driverDocumentRecordSchema,
  insurance: driverDocumentRecordSchema,
  authorization: driverDocumentRecordSchema,
});

export const driverOnboardingDraftSchema = z.object({
  form: z.object({
    vehicleType: vehicleTypeSchema,
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
  selfieUri: z.string().nullable(),
  acceptedTerms: z.boolean(),
  step: z.number().int().min(0).max(4),
  updatedAt: z.string(),
});

const packageActivationSchema = z.object({
  id: z.string(),
  packageId: driverRidePackageIdSchema,
  activatedAt: z.string(),
  pricePaidRwf: z.number().nonnegative(),
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
  packageId: driverRidePackageIdSchema,
  amount: z.number().nonnegative(),
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

const driverEntitlementShapeSchema = z.object({
  activePackageId: driverRidePackageIdSchema.nullable(),
  remainingRideCredits: z.number().int().nonnegative(),
  remainingBonusRides: z.number().int().nonnegative(),
  activations: z.array(packageActivationSchema),
  creditTransactions: z.array(driverCreditTransactionSchema),
  purchaseHistory: z.array(driverPackagePurchaseSchema),
  updatedAt: z.string(),
  authority: z.enum(['local_prototype', 'backend']),
});

export const driverEntitlementSchema = z.preprocess(value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return {
    remainingBonusRides: 0,
    ...value,
  };
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
