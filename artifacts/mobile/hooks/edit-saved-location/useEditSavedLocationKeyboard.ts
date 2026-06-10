import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EDIT_SHEET_SEARCH_TOP_GAP = 10;
const EDIT_SHEET_KEYBOARD_OPEN_THRESHOLD = 80;

export type EditSavedLocationSheetMode = 'rest' | 'search';

function keyboardBottomInset(screenHeight: number, keyboardScreenY: number): number {
  return Math.max(0, screenHeight - keyboardScreenY);
}

function expandedSheetHeight(keyboardScreenY: number, topInset: number): number {
  return Math.max(320, keyboardScreenY - topInset - EDIT_SHEET_SEARCH_TOP_GAP);
}

export function useEditSavedLocationKeyboard(topInset: number) {
  const [mode, setMode] = useState<EditSavedLocationSheetMode>('rest');
  const [sheetHeight, setSheetHeight] = useState(0);
  const keyboardOpenRef = useRef(false);
  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;

  const resetKeyboard = useCallback(() => {
    keyboardOpenRef.current = false;
    keyboardLiftAnim.setValue(0);
    setMode('rest');
    setSheetHeight(0);
    Keyboard.dismiss();
  }, [keyboardLiftAnim]);

  const resetForEntrance = useCallback(() => {
    keyboardLiftAnim.setValue(0);
    setMode('rest');
    setSheetHeight(0);
  }, [keyboardLiftAnim]);

  const dismissKeyboard = useCallback(() => {
    if (!keyboardOpenRef.current) return;
    Keyboard.dismiss();
  }, []);

  const applyKeyboardFrame = useCallback(
    (keyboardScreenY: number, duration = 250) => {
      const bottomInset = keyboardBottomInset(SCREEN_HEIGHT, keyboardScreenY);
      const keyboardOpen = bottomInset > EDIT_SHEET_KEYBOARD_OPEN_THRESHOLD;
      keyboardOpenRef.current = keyboardOpen;

      if (keyboardOpen) {
        setMode('search');
        setSheetHeight(expandedSheetHeight(keyboardScreenY, topInset));
      } else {
        setMode('rest');
        setSheetHeight(0);
      }

      const anim =
        Platform.OS === 'ios'
          ? Animated.timing(keyboardLiftAnim, {
              toValue: bottomInset,
              duration,
              useNativeDriver: true,
            })
          : Animated.spring(keyboardLiftAnim, {
              toValue: bottomInset,
              damping: 24,
              stiffness: 260,
              mass: 0.85,
              useNativeDriver: true,
            });

      anim.start();
    },
    [keyboardLiftAnim, topInset],
  );

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const sub = Keyboard.addListener('keyboardWillChangeFrame', event => {
        applyKeyboardFrame(event.endCoordinates.screenY, event.duration ?? 250);
      });
      return () => sub.remove();
    }

    const showSub = Keyboard.addListener('keyboardDidShow', event => {
      applyKeyboardFrame(event.endCoordinates.screenY, event.duration ?? 220);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', event => {
      applyKeyboardFrame(SCREEN_HEIGHT, event.duration ?? 180);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [applyKeyboardFrame]);

  return {
    mode,
    sheetHeight,
    keyboardOpenRef,
    keyboardLiftAnim,
    dismissKeyboard,
    resetKeyboard,
    resetForEntrance,
  };
}
