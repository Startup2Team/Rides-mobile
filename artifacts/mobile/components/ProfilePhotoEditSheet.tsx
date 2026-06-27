import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetBackdrop } from './SheetBackdrop';
import { AppText } from './AppText';
import { icons } from '@/constants/icons';
import { duration } from '@/constants/motion';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { zIndex } from '@/constants/zIndex';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { typography } from '@/constants/typography';

interface ProfilePhotoEditSheetProps {
  visible: boolean;
  onClose: () => void;
  profileImage: string | null;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onDeletePhoto?: () => void;
}

export function ProfilePhotoEditSheet({
  visible,
  onClose,
  profileImage,
  onTakePhoto,
  onChoosePhoto,
  onDeletePhoto,
}: ProfilePhotoEditSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const name = user?.name ?? '';
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
  const isDriver = user?.mode === 'driver';
  const gradientColors = isDriver ? (['#69A8F7', '#6674D8'] as const) : (['#9DBBE0', '#7984C3'] as const);

  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetTranslateY = React.useRef(new Animated.Value(500)).current;
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: duration.slow,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(500);
      setShouldRender(false);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: duration.toast,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 500,
        duration: duration.toast,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onClose();
    });
  };

  if (!shouldRender) return null;

  return (
    <Modal
      visible={shouldRender}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <SheetBackdrop
        onPress={handleClose}
        animatedOpacity={backdropOpacity}
        blurIntensity={0}
        lightScrimOpacity={0.3}
        darkScrimOpacity={0.45}
      />
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            transform: [{ translateY: sheetTranslateY }],
            paddingBottom: Math.max(insets.bottom, spacing[20]),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleGroup}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.sheetAvatar} />
            ) : (
              <LinearGradient colors={gradientColors} style={styles.sheetAvatar}>
                <Text style={styles.sheetAvatarInitial}>{initials}</Text>
              </LinearGradient>
            )}
            <AppText style={[styles.sheetTitleText, { color: colors.foreground }]}>Edit profile picture</AppText>
          </View>
          <TouchableOpacity
            style={[styles.sheetCloseButton, { backgroundColor: colors.muted }]}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close edit menu"
          >
            <Feather name="x" size={icons.semantic.button} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Options Card */}
        <View style={[styles.sheetOptionsCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.sheetOptionRow}
            onPress={onTakePhoto}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <AppText style={[styles.sheetOptionText, { color: colors.foreground }]}>
              Take photo
            </AppText>
            <Feather name="camera" size={icons.semantic.row} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.sheetOptionRow}
            onPress={onChoosePhoto}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Choose photo"
          >
            <AppText style={[styles.sheetOptionText, { color: colors.foreground }]}>
              Choose photo
            </AppText>
            <Feather name="image" size={icons.semantic.row} color={colors.foreground} />
          </TouchableOpacity>

          {profileImage && onDeletePhoto && (
            <>
              <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={onDeletePhoto}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
              >
                <AppText style={[styles.sheetOptionText, { color: colors.destructive }]}>
                  Delete photo
                </AppText>
                <Feather name="trash-2" size={icons.semantic.row} color={colors.destructive} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    left: spacing[0],
    right: spacing[0],
    bottom: spacing[0],
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing[16],
    paddingHorizontal: semanticSpacing.sheetPadding,
    zIndex: zIndex.modal,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: semanticSpacing.inlineGap,
  },
  sheetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.rowGap,
  },
  sheetAvatar: {
    width: sizes.avatar.sm,
    height: sizes.avatar.sm,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitial: {
    color: '#FFFFFF',
    ...typography.caption,
    fontFamily: typography.title.fontFamily,
  },
  sheetTitleText: {
    ...typography.title,
    fontFamily: typography.title.fontFamily,
  },
  sheetCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionsCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
    marginTop: spacing[16],
    marginBottom: semanticSpacing.inlineGap,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[16],
    paddingHorizontal: semanticSpacing.cardPadding,
  },
  sheetOptionText: {
    ...typography.title,
    fontFamily: typography.label.fontFamily,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: semanticSpacing.cardPadding,
  },
});
