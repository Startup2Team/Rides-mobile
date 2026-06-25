import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useBackButtonEntrance } from '@/hooks/useBackButtonEntrance';
import { useCloseButtonSpin } from '@/hooks/useCloseButtonSpin';
import { useColors } from '@/hooks/useColors';

const BUTTON_SIZE = 44;

interface CircleNavButtonProps {
  icon: 'chevron-left' | 'x';
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  iconSize?: number;
  flat?: boolean;
  color?: string;
}

function CircleNavButton({
  icon,
  onPress,
  style,
  accessibilityLabel,
  iconSize = 24,
  flat = false,
  color,
}: CircleNavButtonProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.button,
        flat ? styles.flatButton : { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      activeOpacity={0.8}
    >
      <Feather name={icon} size={iconSize} color={color ?? colors.foreground} />
    </TouchableOpacity>
  );
}

interface NavButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export type BackButtonHandle = {
  playEntrance: () => void;
  playExit: (onComplete?: () => void) => void;
};

interface BackButtonProps extends NavButtonProps {
  /** Nudge left before calling onPress. Default true. */
  exitOnPress?: boolean;
  /** Slide in from the left when mounted. Default true. */
  autoPlayOnMount?: boolean;
  wrapperStyle?: StyleProp<ViewStyle>;
  flat?: boolean;
  color?: string;
}

export const BackButton = React.forwardRef<BackButtonHandle, BackButtonProps>(function BackButton(
  {
    onPress,
    style,
    wrapperStyle,
    accessibilityLabel = 'Go back',
    exitOnPress = true,
    autoPlayOnMount = true,
    flat = true,
    color,
  },
  ref,
) {
  const { translateX, opacity, scale, playEntrance, playExit } = useBackButtonEntrance(autoPlayOnMount);

  useImperativeHandle(ref, () => ({ playEntrance, playExit }), [playEntrance, playExit]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (exitOnPress) {
      playExit(onPress);
      return;
    }
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.backEntranceWrap,
        wrapperStyle,
        {
          opacity,
          transform: [{ translateX }, { scale }],
        },
      ]}
    >
      <CircleNavButton
        icon="chevron-left"
        onPress={handlePress}
        style={style}
        accessibilityLabel={accessibilityLabel}
        iconSize={30}
        flat={flat}
        color={color}
      />
    </Animated.View>
  );
});

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
  /** Applied to the rotation wrapper (use for layout / hit area). */
  wrapperStyle?: StyleProp<ViewStyle>;
}

export const CloseButton = forwardRef<CloseButtonHandle, CloseButtonProps>(function CloseButton(
  {
    onPress,
    style,
    wrapperStyle,
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
    <Animated.View
      style={[styles.closeSpinWrap, wrapperStyle, { transform: [{ rotate: rotation }] }]}
    >
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
  backEntranceWrap: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSpinWrap: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatButton: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
