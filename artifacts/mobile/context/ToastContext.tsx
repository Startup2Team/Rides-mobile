import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** iOS transient feedback — brief, like “Copied” / “Saved”. */
const TOAST_DURATION_MS = 2000;
const TOAST_BOTTOM_OFFSET = Platform.OS === 'web' ? 96 : 88;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastId = useRef(0);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 8,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [opacity, scale, translateY]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    if (hideTimer.current) clearTimeout(hideTimer.current);

    toastId.current += 1;
    setToast({ id: toastId.current, message, variant });

    if (variant === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (variant === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    opacity.setValue(0);
    translateY.setValue(12);
    scale.setValue(0.94);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 22,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 22,
        bounciness: 0,
      }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      hideToast();
    }, TOAST_DURATION_MS);
  }, [hideToast, opacity, scale, translateY]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const capsuleStyle = useMemo(
    () => [
      styles.capsule,
      isDark ? styles.capsuleDark : styles.capsuleLight,
    ],
    [isDark],
  );

  const scrimStyle = useMemo(
    () => [
      styles.scrim,
      isDark ? styles.scrimDark : styles.scrimLight,
    ],
    [isDark],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.host,
            {
              bottom: insets.bottom + TOAST_BOTTOM_OFFSET,
              opacity,
              transform: [{ translateY }, { scale }],
            },
          ]}
        >
          <View style={capsuleStyle}>
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={isDark ? 84 : 72}
                tint={isDark ? 'light' : 'dark'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={scrimStyle} />
            <View style={styles.content}>
              <View style={styles.iconWrap}>
                {toast.variant === 'success' ? (
                  <Feather name="check-circle" size={14} color={colors.primary} />
                ) : toast.variant === 'error' ? (
                  <Feather name="x-circle" size={14} color={colors.destructive} />
                ) : (
                  <Feather name="info" size={14} color={colors.primary} />
                )}
              </View>
              <Text style={styles.message} numberOfLines={2}>
                {toast.message}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200,
    paddingHorizontal: 28,
  },
  capsule: {
    overflow: 'hidden',
    borderRadius: 22,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 10,
    ...Platform.select({
      ios: { borderCurve: 'continuous' },
    }),
  },
  capsuleLight: {
    shadowOpacity: 0.28,
    ...Platform.select({
      default: {
        backgroundColor: 'rgba(44,44,46,0.94)',
      },
    }),
  },
  capsuleDark: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowOpacity: 0.55,
    ...Platform.select({
      default: {
        backgroundColor: 'rgba(72,72,74,0.94)',
      },
    }),
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimLight: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.28)' : 'transparent',
  },
  scrimDark: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(58,58,60,0.72)' : 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 19,
    color: '#FFFFFF',
  },
});
