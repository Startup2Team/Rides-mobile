import { getAppBackendClient } from '@/data/remote/client/appBackendClient';
import { toBackendTransportType } from '@/constants/vehicles';
import type { VehicleType } from '@/types';

// Real backend: GET /api/v1/customer/fare-estimate — server-side pricing so the
// quote can't be tampered with client-side. Maps/routing stay client-side; the
// backend computes distance + fare from pricing config.

export interface FareEstimate {
  vehicleType: VehicleType;
  distanceKm: number;
  durationMinutes: number;
  totalFareRwf: number;
  baseFareRwf: number;
  distanceChargeRwf: number;
  nightSurchargeRwf: number;
  nightSurchargeApplied: boolean;
  minFareRwf: number;
  cancellationFeeRwf: number;
  note: string;
}

interface FareBreakdownDto {
  base_fare_rwf: number;
  distance_charge_rwf: number;
  night_surcharge_rwf: number;
  total_fare_rwf: number;
  night_surcharge_applied: boolean;
}

interface FareEstimateDto {
  transport_type: string;
  distance_km: number;
  duration_minutes: number;
  breakdown: FareBreakdownDto;
  min_fare_rwf: number;
  cancellation_fee_rwf: number;
  note: string;
}

interface FareEstimateEnvelope {
  data: FareEstimateDto;
}

export interface FareEstimateInput {
  vehicleType: VehicleType;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
}

export async function estimateFare(input: FareEstimateInput): Promise<FareEstimate> {
  const client = getAppBackendClient();
  const response = await client.get<FareEstimateEnvelope>('/v1/customer/fare-estimate', {
    query: {
      transport_type: toBackendTransportType(input.vehicleType),
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      dest_lat: input.destLat,
      dest_lng: input.destLng,
    },
  });
  const d = response.data.data;
  return {
    vehicleType: input.vehicleType,
    distanceKm: d.distance_km,
    durationMinutes: d.duration_minutes,
    totalFareRwf: d.breakdown.total_fare_rwf,
    baseFareRwf: d.breakdown.base_fare_rwf,
    distanceChargeRwf: d.breakdown.distance_charge_rwf,
    nightSurchargeRwf: d.breakdown.night_surcharge_rwf,
    nightSurchargeApplied: d.breakdown.night_surcharge_applied,
    minFareRwf: d.min_fare_rwf,
    cancellationFeeRwf: d.cancellation_fee_rwf,
    note: d.note,
  };
}
