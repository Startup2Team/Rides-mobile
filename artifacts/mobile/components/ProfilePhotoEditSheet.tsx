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
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

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
          duration: 220,
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
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 500,
        duration: 200,
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
            paddingBottom: Math.max(insets.bottom, 20),
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
            <Text style={[styles.sheetTitleText, { color: colors.foreground }]}>Edit profile picture</Text>
          </View>
          <TouchableOpacity
            style={[styles.sheetCloseButton, { backgroundColor: colors.muted }]}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close edit menu"
          >
            <Feather name="x" size={16} color={colors.foreground} />
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
            <Text style={[styles.sheetOptionText, { color: colors.foreground }]}>
              Take photo
            </Text>
            <Feather name="camera" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.sheetOptionRow}
            onPress={onChoosePhoto}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Choose photo"
          >
            <Text style={[styles.sheetOptionText, { color: colors.foreground }]}>
              Choose photo
            </Text>
            <Feather name="image" size={18} color={colors.foreground} />
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
                <Text style={[styles.sheetOptionText, { color: colors.destructive }]}>
                  Delete photo
                </Text>
                <Feather name="trash-2" size={18} color={colors.destructive} />
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
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    zIndex: 90,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitial: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  sheetTitleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  sheetCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionsCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 8,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sheetOptionText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
});
