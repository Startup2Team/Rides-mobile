import { Dimensions } from 'react-native';

export const SAVED_LOCATIONS_KEY = '@taravelis_saved_locations';
export const SAVE_LOCATION_LABELS = ['Home', 'Work', 'School', 'Market', 'Other'] as const;

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
  Home: SAVE_LABEL_AVAILABLE_WIDTH * 0.16,
  Work: SAVE_LABEL_AVAILABLE_WIDTH * 0.16,
  School: SAVE_LABEL_AVAILABLE_WIDTH * 0.22,
  Market: SAVE_LABEL_AVAILABLE_WIDTH * 0.23,
  Other: SAVE_LABEL_AVAILABLE_WIDTH * 0.23,
};

export const MAX_SAVED_LOCATIONS = 20;
