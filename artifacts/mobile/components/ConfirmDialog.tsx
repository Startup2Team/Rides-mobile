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
import { elevation } from '@/constants/elevation';
import { radius } from '@/constants/radius';
import { semanticSpacing } from '@/constants/spacing';
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
    padding: semanticSpacing.sectionGap,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius['3xl'],
    padding: 22,
    gap: semanticSpacing.listItemPadding,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    ...elevation.modal,
  },
});
