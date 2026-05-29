import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Centered alert-style dialog with theme-aware scrim and elevated card
 * so the sheet reads clearly above the screen in dark mode.
 */
export function ConfirmDialog({
  visible,
  onClose,
  children,
  cardStyle,
}: ConfirmDialogProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const scrimColor = isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.42)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: scrimColor }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
              shadowOpacity: isDark ? 0.55 : 0.2,
            },
            cardStyle,
          ]}
          accessibilityViewIsModal
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 22,
    gap: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 28,
  },
});
