import { z } from 'zod';

const vehicleTypeSchema = z.enum(['moto', 'rifani', 'cab', 'fuso', 'hilux']);
const appModeSchema = z.enum(['customer', 'driver']);
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
  vehicleType: vehicleTypeSchema,
  plateNumber: z.string(),
  licenseNumber: z.string(),
  province: z.string(),
  district: z.string(),
  sector: z.string(),
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
}).passthrough();

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
