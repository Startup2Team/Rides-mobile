import { Dimensions, Platform, StyleSheet } from 'react-native';
import { buttonCornerRadius } from '@/constants/buttons';
import { FLOATING_PANEL_TOP_RADIUS } from '@/constants/surfaces';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GREETING_LEFT_INSET = 14;
const BOOKING_SHEET_PADDING_H = 22;
const BOOKING_CLOSE_EDGE_INSET = 16;
const BOOKING_CLOSE_ROTATION_PAD = 10;
const SUGGESTION_ROW_MIN_HEIGHT = 52;
/** ~5 rows visible before the list scrolls (Apple Maps-style). */
const SUGGESTIONS_REST_MAX_HEIGHT = SUGGESTION_ROW_MIN_HEIGHT * 5.5;

export const EDIT_SAVED_FORM_TAB_BAR_PADDING = Platform.OS === 'web' ? 88 : 72;

export const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    borderRadius: FLOATING_PANEL_TOP_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 14,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
      default: {},
    }),
  },
  sheetSearch: {
    overflow: 'hidden',
  },
  sheetRaised: {
    zIndex: 90,
  },
  closeAnchor: {
    position: 'absolute',
    top: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    right: BOOKING_CLOSE_EDGE_INSET - BOOKING_CLOSE_ROTATION_PAD,
    width: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    height: 44 + BOOKING_CLOSE_ROTATION_PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  body: {
    paddingHorizontal: BOOKING_SHEET_PADDING_H,
    gap: 10,
  },
  bodySearch: {
    flex: 1,
    minHeight: 0,
  },
  chromeTapZone: {
    alignSelf: 'stretch',
  },
  headerPressable: {
    alignSelf: 'stretch',
  },
  dragZone: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  handleTouch: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    minHeight: 44,
  },
  subheader: {
    paddingLeft: GREETING_LEFT_INSET,
    paddingRight: 52,
    gap: 4,
    paddingBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  formFields: {
    gap: 10,
    paddingBottom: 8,
  },
  formFieldsSearch: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    marginHorizontal: GREETING_LEFT_INSET,
    gap: 10,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    lineHeight: 16,
    paddingLeft: 4,
  },
  suggestionsListWrap: {
    marginHorizontal: GREETING_LEFT_INSET,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  suggestionsListWrapRest: {
    maxHeight: SUGGESTIONS_REST_MAX_HEIGHT,
  },
  suggestionsListWrapExpanded: {
    flex: 1,
    minHeight: 0,
  },
  suggestionsScroll: {
    flex: 1,
  },
  suggestionsScrollContent: {
    flexGrow: 0,
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: buttonCornerRadius(48),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 10,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsLoading: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionIcon: {
    width: 28,
    alignItems: 'center',
  },
  suggestionText: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  suggestionSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  suggestionsEmpty: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  delete: {
    minHeight: 44,
    borderRadius: buttonCornerRadius(44),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
