import { Dimensions } from 'react-native';
import { STORAGE_KEYS } from '@/constants/storage';

export const SAVED_LOCATIONS_KEY = STORAGE_KEYS.savedLocations;
export const SAVE_LOCATION_LABELS = ['Home', 'Work', 'School', 'Church', 'Market', 'Other'] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SAVE_LABEL_GAP = 8;
const SAVE_LABEL_SHEET_HORIZONTAL_PADDING = 22;
const SAVE_LABEL_CONTENT_INSET = 14;
const SAVE_LABEL_AVAILABLE_WIDTH =
  SCREEN_WIDTH
  - SAVE_LABEL_SHEET_HORIZONTAL_PADDING * 2
  - SAVE_LABEL_CONTENT_INSET * 2
  - SAVE_LABEL_GAP * (SAVE_LOCATION_LABELS.length - 1);

export const SAVE_LABEL_WIDTHS: Record<(typeof SAVE_LOCATION_LABELS)[number], number> = {
  Home: SAVE_LABEL_AVAILABLE_WIDTH * 0.14,
  Work: SAVE_LABEL_AVAILABLE_WIDTH * 0.14,
  School: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Church: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Market: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
  Other: SAVE_LABEL_AVAILABLE_WIDTH * 0.18,
};

export const MAX_SAVED_LOCATIONS = 20;
