import {
  DRIVER_CTA_PILL_WIDTH,
} from '@/constants/homeDriverCta';
import {
  VEHICLE_CHIP_IMAGE_SIZE,
  VEHICLE_MAP_IMAGE_SIZE,
  VEHICLE_SEARCHING_IMAGE_SIZE,
} from '@/constants/vehicles';

export const sizes = {
  button: {
    sm: 44,
    md: 50,
    lg: 50,
  },
  input: {
    sm: 44,
    md: 48,
    lg: 52,
  },
  avatar: {
    xs: 28,
    sm: 32,
    md: 40,
    lg: 52,
    xl: 64,
    xxl: 80,
  },
  iconButton: {
    sm: 34,
    md: 44,
    lg: 46,
    xl: 52,
  },
  sheetHandle: {
    width: 40,
    height: 4,
  },
  sheet: {
    handleWidth: 40,
    handleHeight: 4,
  },
  mapControl: {
    sm: 44,
    md: 46,
    lg: 52,
  },
  thumbnail: {
    sm: 56,
    md: 72,
    lg: 76,
    xl: 80,
  },
  tabBar: {
    iosHeight: 62,
    androidHeight: 56,
    safeBottom: 6,
    itemHeight: 44,
  },
  vehicle: {
    chip: VEHICLE_CHIP_IMAGE_SIZE,
    map: VEHICLE_MAP_IMAGE_SIZE,
    searching: VEHICLE_SEARCHING_IMAGE_SIZE,
  },
  driverCta: {
    pillWidth: DRIVER_CTA_PILL_WIDTH,
  },
} as const;

export type SizeToken = keyof typeof sizes;
