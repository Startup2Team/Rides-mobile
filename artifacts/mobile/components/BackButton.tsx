import { Feather } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useCloseButtonSpin } from '@/hooks/useCloseButtonSpin';
import { useColors } from '@/hooks/useColors';

const BUTTON_SIZE = 44;

interface CircleNavButtonProps {
  icon: 'chevron-left' | 'x';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  iconSize?: number;
}

function CircleNavButton({
  icon,
  onPress,
  style,
  accessibilityLabel,
  iconSize = 24,
}: CircleNavButtonProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.button,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.8}
    >
      <Feather name={icon} size={iconSize} color={colors.foreground} />
    </TouchableOpacity>
  );
}

interface NavButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function BackButton({
  onPress,
  style,
  accessibilityLabel = 'Go back',
}: NavButtonProps) {
  return (
    <CircleNavButton
      icon="chevron-left"
      onPress={onPress}
      style={style}
      accessibilityLabel={accessibilityLabel}
      iconSize={24}
    />
  );
}

export type CloseButtonHandle = {
  spinOpen: () => void;
  spinShut: () => void;
  /** 1 = open rotation, 0 = shut — for interactive sheet drag. */
  setSpinProgress: (progress: number) => void;
};

interface CloseButtonProps extends NavButtonProps {
  /** Spin shut when pressed before calling onPress. Default true. */
  shutOnPress?: boolean;
  /** Play open spin when the button mounts. Default true. */
  autoSpinOnMount?: boolean;
}

export const CloseButton = forwardRef<CloseButtonHandle, CloseButtonProps>(function CloseButton(
  {
    onPress,
    style,
    accessibilityLabel = 'Close',
    shutOnPress = true,
    autoSpinOnMount = true,
  },
  ref,
) {
  const { rotation, spinOpen, spinShut, setSpinProgress } = useCloseButtonSpin(autoSpinOnMount);

  useImperativeHandle(
    ref,
    () => ({ spinOpen, spinShut, setSpinProgress }),
    [spinOpen, spinShut, setSpinProgress],
  );

  const handlePress = () => {
    if (shutOnPress) {
      spinShut();
    }
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
      <CircleNavButton
        icon="x"
        onPress={handlePress}
        style={style}
        accessibilityLabel={accessibilityLabel}
        iconSize={22}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
