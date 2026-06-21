import { Dimensions } from 'react-native';
import { VEHICLE_BASE_FARE, VehicleType } from '@/types';
import { getCoordDistance } from '@/utils/locationUtils';
import { TAB_BAR_CONTENT_HEIGHT, TAB_BAR_SCREEN_BOTTOM_PADDING } from '@/constants/tabBar';

const windowDimensions =
  typeof Dimensions?.get === 'function'
    ? Dimensions.get('window')
    : { width: 0, height: 0 };

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = windowDimensions;

// Compact until ride details/actions appear; expanded when stats and Find Driver are visible.
// ~0.3 cm shorter than prior compact/expanded sizes (~11pt)
export const COMPACT_PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.315, 258);
export const EXPANDED_PANEL_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);
export const ROUTE_DRAW_STEP = 0.055;
export const ROUTE_DRAW_INTERVAL_MS = 45;
export const HOME_LOCATION_DELTA = 0.012;
export const ROUTE_FIT_SIDE_PADDING = 32;
/** Space below top location card overlay on booking map. */
export const BOOKING_MAP_TOP_OVERLAY = 88;
export const HOME_TAB_BAR_HEIGHT = TAB_BAR_CONTENT_HEIGHT;
export const HOME_TAB_BAR_BOTTOM_PADDING = TAB_BAR_SCREEN_BOTTOM_PADDING;

/** Lift save-form overlay (translateY) above the software keyboard. */
export function computeOverlayFormKeyboardLift(keyboardHeight: number, bottomInset: number): number {
  return Math.max(0, keyboardHeight - bottomInset);
}

export function computeOverlayFormKeyboardLiftFromFrame(
  screenHeight: number,
  keyboardScreenY: number,
  bottomInset: number,
): number {
  return Math.max(0, screenHeight - keyboardScreenY - bottomInset);
}

export const HOME_FLOATING_PANEL_FALLBACK_HEIGHT = 236;
/** ~0.5cm extra inset for floating panel content alignment. */
export const GREETING_LEFT_INSET = 14;
export const BOOKING_SHEET_PADDING_H = 22;
/** Equal inset from top + right form edges for the booking close control. */
export const BOOKING_CLOSE_EDGE_INSET = 16;
/** Extra room so the close icon can spin during sheet drag without clipping. */
export const BOOKING_CLOSE_ROTATION_PAD = 10;
export const SAVE_LOCATION_LABELS = ['Home', 'Work', 'School', 'Church', 'Market', 'Other'];
export const SAVE_LABEL_GAP = 8;
export const SAVE_LABEL_SHEET_HORIZONTAL_PADDING = BOOKING_SHEET_PADDING_H;
export const SAVE_LABEL_CONTENT_INSET = GREETING_LEFT_INSET;
const SAVE_LABEL_AVAILABLE_WIDTH =
  SCREEN_WIDTH
  - SAVE_LABEL_SHEET_HORIZONTAL_PADDING * 2
  - SAVE_LABEL_CONTENT_INSET * 2
  - SAVE_LABEL_GAP * (SAVE_LOCATION_LABELS.length - 1);
export const SAVE_LABEL_WIDTHS: Record<string, number> = {
  Home: SAVE_LABEL_AVAILABLE_WIDTH * 0.14,
  Work: SAVE_LABEL_AVAILABLE_WIDTH * 0.14,
  School: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Church: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Market: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Other: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
};

export const MAP_TYPES = ['standard', 'satellite', 'hybrid'] as const;
export type AppMapType = typeof MAP_TYPES[number];
export type MapPickerTarget = 'pickup' | 'dropoff' | 'savedLocation';

export const DRIVER_OFFSETS = [
  { lat:  0.0018, lng:  0.0022 }, { lat: -0.0025, lng:  0.0015 },
  { lat:  0.0031, lng: -0.0018 }, { lat: -0.0012, lng: -0.0030 },
  { lat:  0.0008, lng:  0.0038 }, { lat: -0.0040, lng:  0.0008 },
  { lat:  0.0022, lng: -0.0035 }, { lat: -0.0035, lng: -0.0020 },
  { lat:  0.0045, lng:  0.0012 }, { lat: -0.0018, lng:  0.0042 },
  { lat:  0.0010, lng: -0.0048 }, { lat: -0.0050, lng:  0.0030 },
  { lat:  0.0038, lng:  0.0040 }, { lat: -0.0028, lng: -0.0045 },
  { lat:  0.0055, lng: -0.0010 }, { lat: -0.0060, lng:  0.0018 },
  { lat:  0.0015, lng:  0.0055 }, { lat: -0.0042, lng: -0.0055 },
  { lat:  0.0062, lng:  0.0032 }, { lat: -0.0070, lng: -0.0025 },
];

export function calcEstFare(type: VehicleType, dist: number) {
  const base = VEHICLE_BASE_FARE[type];
  const perKm =
    type === 'moto' || type === 'rifani'
      ? 200
      : type === 'cab'
        ? 400
        : type === 'hilux'
          ? 600
          : 800;
  return Math.round((base + dist * perKm) / 100) * 100;
}

function interpolateCoord(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  progress: number,
) {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * progress,
    longitude: a.longitude + (b.longitude - a.longitude) * progress,
  };
}

export function sliceRouteByProgress(
  coords: { latitude: number; longitude: number }[],
  startProgress: number,
  endProgress: number,
) {
  if (coords.length < 2) return [];

  const segmentLengths = coords.slice(0, -1).map((coord, index) => getCoordDistance(coord, coords[index + 1]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return coords.slice(0, 2);

  const startDistance = totalLength * Math.max(0, Math.min(1, startProgress));
  const endDistance = totalLength * Math.max(0, Math.min(1, endProgress));
  const sliced: { latitude: number; longitude: number }[] = [];
  let travelled = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segmentStart = travelled;
    const segmentEnd = travelled + segmentLengths[i];
    const segmentLength = segmentLengths[i];
    const from = coords[i];
    const to = coords[i + 1];

    if (segmentEnd < startDistance) {
      travelled = segmentEnd;
      continue;
    }
    if (segmentStart > endDistance) break;

    const localStart = Math.max(startDistance, segmentStart);
    const localEnd = Math.min(endDistance, segmentEnd);
    const startRatio = segmentLength === 0 ? 0 : (localStart - segmentStart) / segmentLength;
    const endRatio = segmentLength === 0 ? 1 : (localEnd - segmentStart) / segmentLength;
    const startCoord = interpolateCoord(from, to, startRatio);
    const endCoord = interpolateCoord(from, to, endRatio);

    if (sliced.length === 0) sliced.push(startCoord);
    sliced.push(endCoord);
    travelled = segmentEnd;
  }

  return sliced.length > 1 ? sliced : coords.slice(0, 2);
}
