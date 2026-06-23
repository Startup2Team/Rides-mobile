/**
 * Layout values for bottom-anchored form sheets paired with KeyboardStickyView.
 *
 * KeyboardStickyView owns vertical movement (native frame sync).
 * This hook only owns padding + the max height available above the keyboard.
 */
import { useMemo } from 'react';
import { Dimensions } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** Buffer between sheet content and home indicator / keyboard top. */
export const FORM_SHEET_CONTENT_PADDING = 18;

/** Handle + title + typical subheader — used to size the scroll body. */
export const FORM_SHEET_CHROME_HEIGHT = 118;

export function useFormSheetKeyboardLayout(enabled: boolean) {
  const insets = useSafeAreaInsets();
  const isKeyboardOpen = useKeyboardState(state => state.isVisible);
  const keyboardHeight = useKeyboardState(state => state.height);

  const active = enabled && isKeyboardOpen;

  const paddingBottom = active
    ? FORM_SHEET_CONTENT_PADDING
    : insets.bottom + FORM_SHEET_CONTENT_PADDING;

  const maxSheetHeight = useMemo(() => {
    if (!active) return undefined;
    return Math.max(220, SCREEN_HEIGHT - keyboardHeight - insets.top);
  }, [active, keyboardHeight, insets.top]);

  const maxBodyScrollHeight = useMemo(() => {
    if (maxSheetHeight == null) return undefined;
    return Math.max(
      120,
      maxSheetHeight - FORM_SHEET_CHROME_HEIGHT - paddingBottom,
    );
  }, [maxSheetHeight, paddingBottom]);

  return {
    isKeyboardOpen: active,
    paddingBottom,
    maxSheetHeight,
    maxBodyScrollHeight,
  };
}
