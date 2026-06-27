import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from './BackButton';
import { icons } from '@/constants/icons';
import { duration } from '@/constants/motion';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { zIndex } from '@/constants/zIndex';
import { useColors } from '@/hooks/useColors';
import { SheetBackdrop } from './SheetBackdrop';
import { typography } from '@/constants/typography';

export type GalleryImage = {
  id: string;
  height?: number;
  uri?: string | null;
  title?: string;
  subtitle?: string;
  thumbnailUri?: string;
  width?: number;
};

export type EditOption = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

export type EditMenu = {
  title: string;
  avatarUri?: string | null;
  options: EditOption[];
};

export type ImageGalleryPreviewProps = {
  enablePaging?: boolean;
  enableSwipeDownToClose?: boolean;
  enableZoom?: boolean;
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  showCounter?: boolean;
  testID?: string;
  visible: boolean;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
  editMenu?: EditMenu;
};

type GalleryPageSlot = {
  image?: GalleryImage;
  position: 'previous' | 'current' | 'next';
  sourceIndex: number;
  key: string;
};

const MIN_ZOOM = 1;
const MIN_ELASTIC_ZOOM = 0.85;
const MAX_ZOOM = 3;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_DELAY = 280;
const TAP_MOVEMENT = 12;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const EDGE_RESISTANCE = 0.24;
const MAX_IMAGE_OVERSCROLL = 44;

export function getGalleryIndex(index: number, delta: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, index + delta));
}

export function ImageGalleryPreview({
  enablePaging = true,
  enableSwipeDownToClose = true,
  enableZoom = true,
  images,
  initialIndex,
  onClose,
  onIndexChange,
  showCounter = true,
  testID = 'image-gallery',
  visible,
  rightActionLabel,
  onRightActionPress,
  editMenu,
}: ImageGalleryPreviewProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const scheme = useColorScheme();
  const colors = useColors();
  const [currentIndex, setCurrentIndex] = React.useState(() => clampIndex(initialIndex, images.length));
  const [showEditSheet, setShowEditSheet] = React.useState(false);
  const sheetAnim = React.useRef(new Animated.Value(320)).current;

  React.useEffect(() => {
    if (showEditSheet) {
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 320,
        duration: duration.toast,
        useNativeDriver: true,
      }).start();
    }
  }, [showEditSheet, sheetAnim]);
  const [zoom, setZoom] = React.useState(MIN_ZOOM);
  const [imageSize, setImageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = React.useState({ width: window.width, height: window.height });
  const [chromeVisible, setChromeVisible] = React.useState(true);
  const [draggingDown, setDraggingDown] = React.useState(0);
  const [readyImageKeys, setReadyImageKeys] = React.useState<ReadonlySet<string>>(() => new Set());

  const openingProgress = React.useRef(new Animated.Value(1)).current;
  const chromeOpacity = React.useRef(new Animated.Value(1)).current;
  const zoomScale = React.useRef(new Animated.Value(MIN_ZOOM)).current;
  const imageOffsetX = React.useRef(new Animated.Value(0)).current;
  const imageOffsetY = React.useRef(new Animated.Value(0)).current;
  const dismissOffsetY = React.useRef(new Animated.Value(0)).current;
  const pageListRef = React.useRef<FlatList<GalleryPageSlot>>(null);

  const imageOffsetRef = React.useRef({ x: 0, y: 0 });
  const readyImageKeysRef = React.useRef<ReadonlySet<string>>(new Set());
  const zoomRef = React.useRef(MIN_ZOOM);
  const touchStart = React.useRef<{ at: number; x: number; y: number } | null>(null);
  const pinchStart = React.useRef<{
    distance: number;
    offsetX: number;
    offsetY: number;
    zoom: number;
  } | null>(null);
  const pinchActive = React.useRef(false);
  const panStart = React.useRef<{ offsetX: number; offsetY: number; x: number; y: number } | null>(null);
  const panMoved = React.useRef(false);
  const pagingActive = React.useRef(false);
  const lastTapAt = React.useRef(0);
  const singleTapTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentImage = images[currentIndex];
  const previousImage = images[currentIndex - 1];
  const nextImage = images[currentIndex + 1];
  const pageWidth = stageSize.width;
  const pageScrollEnabled = enablePaging && images.length > 1 && zoom <= MIN_ZOOM;
  const pageSlots = React.useMemo<GalleryPageSlot[]>(() => ([
    {
      position: 'previous',
      image: previousImage,
      sourceIndex: getGalleryIndex(currentIndex, -1, images.length),
      key: getPageSlotKey(previousImage, 'previous'),
    },
    {
      position: 'current',
      image: currentImage,
      sourceIndex: currentIndex,
      key: getPageSlotKey(currentImage, 'current'),
    },
    {
      position: 'next',
      image: nextImage,
      sourceIndex: getGalleryIndex(currentIndex, 1, images.length),
      key: getPageSlotKey(nextImage, 'next'),
    },
  ]), [currentIndex, currentImage, images.length, nextImage, previousImage]);

  const markImageReady = React.useCallback((image?: GalleryImage) => {
    const key = getImageReadyKey(image);
    if (!key) return;
    if (!readyImageKeysRef.current.has(key)) {
      const nextReadyKeys = new Set(readyImageKeysRef.current);
      nextReadyKeys.add(key);
      readyImageKeysRef.current = nextReadyKeys;
    }
    setReadyImageKeys(current => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  const resetImage = React.useCallback((animated: boolean) => {
    setZoom(MIN_ZOOM);
    zoomRef.current = MIN_ZOOM;
    imageOffsetRef.current = { x: 0, y: 0 };
    const animations = [
      Animated.spring(zoomScale, { damping: 20, stiffness: 220, toValue: MIN_ZOOM, useNativeDriver: true }),
      Animated.spring(imageOffsetX, { damping: 20, stiffness: 220, toValue: 0, useNativeDriver: true }),
      Animated.spring(imageOffsetY, { damping: 20, stiffness: 220, toValue: 0, useNativeDriver: true }),
    ];
    if (animated) {
      Animated.parallel(animations).start();
    } else {
      zoomScale.setValue(MIN_ZOOM);
      imageOffsetX.setValue(0);
      imageOffsetY.setValue(0);
    }
  }, [imageOffsetX, imageOffsetY, zoomScale]);

  React.useLayoutEffect(() => {
    if (!visible) return;
    const nextIndex = clampIndex(initialIndex, images.length);
    setCurrentIndex(nextIndex);
    setImageSize(getDeclaredImageSize(images[nextIndex]));
    const initiallyReadyKeys = new Set(
      images
        .filter(image => !image.uri)
        .map(getImageReadyKey)
        .filter((key): key is string => Boolean(key)),
    );
    readyImageKeysRef.current = initiallyReadyKeys;
    setReadyImageKeys(initiallyReadyKeys);
    setChromeVisible(true);
    chromeOpacity.setValue(1);
    setDraggingDown(0);
    dismissOffsetY.setValue(0);
    resetImage(false);
    setShowEditSheet(false);
    sheetAnim.setValue(320);
    openingProgress.setValue(0);
    Animated.timing(openingProgress, {
      duration: duration.slow,
      easing: undefined,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [
    chromeOpacity,
    dismissOffsetY,
    images.length,
    initialIndex,
    openingProgress,
    resetImage,
    visible,
  ]);

  React.useEffect(() => {
    if (!visible || pageWidth <= 0) return;
    pageListRef.current?.scrollToOffset({ animated: false, offset: pageWidth });
  }, [currentIndex, pageWidth, visible]);

  React.useEffect(() => {
    if (!visible || images.length < 2) return;
    const adjacent = [images[currentIndex - 1], images[currentIndex + 1]].filter(
      (image): image is GalleryImage & { uri: string } => Boolean(image?.uri),
    );
    adjacent.forEach(image => {
      void Image.prefetch(image.uri)
        .then(() => markImageReady(image))
        .catch(() => undefined);
    });
  }, [currentIndex, images, markImageReady, visible]);

  React.useEffect(() => () => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
  }, []);

  const toggleChrome = React.useCallback(() => {
    setChromeVisible(current => {
      const next = !current;
      Animated.timing(chromeOpacity, {
        duration: 170,
        toValue: next ? 1 : 0,
        useNativeDriver: true,
      }).start();
      return next;
    });
  }, [chromeOpacity]);

  const commitImageIndex = React.useCallback((nextIndex: number) => {
    resetImage(false);
    setImageSize(getDeclaredImageSize(images[nextIndex]));
    setCurrentIndex(nextIndex);
    onIndexChange?.(nextIndex);
  }, [images, onIndexChange, resetImage]);

  const handleTap = (touch: NativeTouchEvent) => {
    const now = Date.now();
    if (enableZoom && now - lastTapAt.current <= DOUBLE_TAP_DELAY) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = null;
      if (zoomRef.current > MIN_ZOOM) {
        resetImage(true);
      } else {
        const focal = getLocalTouchPoint(touch, stageSize);
        setZoom(DOUBLE_TAP_ZOOM);
        zoomRef.current = DOUBLE_TAP_ZOOM;
        const nextOffset = clampImageOffset(
          getFocalAdjustedOffset({
            focal,
            fromScale: MIN_ZOOM,
            offset: { x: 0, y: 0 },
            stageSize,
            toScale: DOUBLE_TAP_ZOOM,
          }),
          DOUBLE_TAP_ZOOM,
          stageSize,
          imageSize,
        );
        imageOffsetRef.current = nextOffset;
        Animated.parallel([
          Animated.spring(zoomScale, {
            damping: 20,
            stiffness: 220,
            toValue: DOUBLE_TAP_ZOOM,
            useNativeDriver: true,
          }),
          Animated.spring(imageOffsetX, {
            damping: 20,
            stiffness: 220,
            toValue: nextOffset.x,
            useNativeDriver: true,
          }),
          Animated.spring(imageOffsetY, {
            damping: 20,
            stiffness: 220,
            toValue: nextOffset.y,
            useNativeDriver: true,
          }),
        ]).start();
      }
      lastTapAt.current = 0;
      return;
    }

    lastTapAt.current = now;
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      lastTapAt.current = 0;
      toggleChrome();
    }, DOUBLE_TAP_DELAY);
  };

  const handleTouchStart = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (pagingActive.current) return;
    if (enableZoom && event.nativeEvent.touches.length >= 2) {
      const first = event.nativeEvent.touches[0];
      const second = event.nativeEvent.touches[1];
      const distance = getTouchDistance(first, second);
      pinchStart.current = distance > 0 ? {
        distance,
        offsetX: imageOffsetRef.current.x,
        offsetY: imageOffsetRef.current.y,
        zoom: zoomRef.current,
      } : null;
      pinchActive.current = Boolean(pinchStart.current);
      panStart.current = null;
      touchStart.current = null;
      return;
    }

    const touch = event.nativeEvent.touches[0] ?? event.nativeEvent;
    if (zoomRef.current > MIN_ZOOM) {
      panStart.current = {
        offsetX: imageOffsetRef.current.x,
        offsetY: imageOffsetRef.current.y,
        x: touch.pageX,
        y: touch.pageY,
      };
      panMoved.current = false;
      touchStart.current = null;
      return;
    }
    touchStart.current = { at: Date.now(), x: touch.pageX, y: touch.pageY };
  };

  const handleTouchMove = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (pagingActive.current) return;
    if (event.nativeEvent.touches.length >= 2 && enableZoom) {
      const first = event.nativeEvent.touches[0];
      const second = event.nativeEvent.touches[1];
      const distance = getTouchDistance(first, second);
      if (!pinchStart.current) {
        pinchStart.current = distance > 0 ? {
          distance,
          offsetX: imageOffsetRef.current.x,
          offsetY: imageOffsetRef.current.y,
          zoom: zoomRef.current,
        } : null;
        pinchActive.current = Boolean(pinchStart.current);
        return;
      }
      const focal = getTouchMidpoint(first, second, stageSize);
      const nextZoom = Math.max(
        MIN_ELASTIC_ZOOM,
        Math.min(MAX_ZOOM, pinchStart.current.zoom * (distance / pinchStart.current.distance)),
      );
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
      zoomScale.setValue(nextZoom);
      const adjusted = getFocalAdjustedOffset({
        focal,
        fromScale: pinchStart.current.zoom,
        offset: { x: pinchStart.current.offsetX, y: pinchStart.current.offsetY },
        stageSize,
        toScale: nextZoom,
      });
      const resisted = nextZoom <= MIN_ZOOM
        ? {
            x: adjusted.x * Math.max(0, (nextZoom - MIN_ELASTIC_ZOOM) / (MIN_ZOOM - MIN_ELASTIC_ZOOM)),
            y: adjusted.y * Math.max(0, (nextZoom - MIN_ELASTIC_ZOOM) / (MIN_ZOOM - MIN_ELASTIC_ZOOM)),
          }
        : resistImageOffset(adjusted, nextZoom, stageSize, imageSize);
      imageOffsetRef.current = resisted;
      imageOffsetX.setValue(resisted.x);
      imageOffsetY.setValue(resisted.y);
      return;
    }

    const touch = event.nativeEvent.touches[0];
    if (!touch) return;

    if (zoomRef.current > MIN_ZOOM && panStart.current) {
      const proposed = {
        x: panStart.current.offsetX + touch.pageX - panStart.current.x,
        y: panStart.current.offsetY + touch.pageY - panStart.current.y,
      };
      if (
        Math.abs(touch.pageX - panStart.current.x) > TAP_MOVEMENT ||
        Math.abs(touch.pageY - panStart.current.y) > TAP_MOVEMENT
      ) {
        panMoved.current = true;
      }
      const resisted = resistImageOffset(proposed, zoomRef.current, stageSize, imageSize);
      imageOffsetRef.current = resisted;
      imageOffsetX.setValue(resisted.x);
      imageOffsetY.setValue(resisted.y);
      return;
    }

    const start = touchStart.current;
    if (!start || zoomRef.current > MIN_ZOOM) return;
    const deltaX = touch.pageX - start.x;
    const deltaY = touch.pageY - start.y;

    if (
      enableSwipeDownToClose &&
      deltaY > 0 &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      setDraggingDown(deltaY);
      dismissOffsetY.setValue(deltaY);
      return;
    }

    setDraggingDown(0);
    dismissOffsetY.setValue(0);
  };

  const handleTouchEnd = (event: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (pagingActive.current) return;
    if (pinchActive.current) {
      if (event.nativeEvent.touches.length < 2) {
        pinchStart.current = null;
        pinchActive.current = false;
        panStart.current = null;
        panMoved.current = false;
        if (zoomRef.current <= MIN_ZOOM + 0.01) {
          zoomRef.current = MIN_ZOOM;
          setZoom(MIN_ZOOM);
          resetImage(true);
        } else {
          const bounded = clampImageOffset(imageOffsetRef.current, zoomRef.current, stageSize, imageSize);
          imageOffsetRef.current = bounded;
          Animated.parallel([
            Animated.spring(imageOffsetX, {
              damping: 20,
              stiffness: 220,
              toValue: bounded.x,
              useNativeDriver: true,
            }),
            Animated.spring(imageOffsetY, {
              damping: 20,
              stiffness: 220,
              toValue: bounded.y,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
      return;
    }

    if (panStart.current) {
      const touch = event.nativeEvent.changedTouches[0] ?? event.nativeEvent;
      if (!panMoved.current) {
        handleTap(touch);
      } else {
        const bounded = clampImageOffset(imageOffsetRef.current, zoomRef.current, stageSize, imageSize);
        imageOffsetRef.current = bounded;
        Animated.parallel([
          Animated.spring(imageOffsetX, {
            damping: 20,
            stiffness: 220,
            toValue: bounded.x,
            useNativeDriver: true,
          }),
          Animated.spring(imageOffsetY, {
            damping: 20,
            stiffness: 220,
            toValue: bounded.y,
            useNativeDriver: true,
          }),
        ]).start();
      }
      panStart.current = null;
      panMoved.current = false;
      return;
    }

    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const touch = event.nativeEvent.changedTouches[0] ?? event.nativeEvent;
    const deltaX = touch.pageX - start.x;
    const deltaY = touch.pageY - start.y;
    const elapsed = Math.max(Date.now() - start.at, 16);
    const velocityY = deltaY / elapsed * 1000;

    if (
      zoomRef.current === MIN_ZOOM &&
      enableSwipeDownToClose &&
      Math.abs(deltaY) > Math.abs(deltaX) &&
      (deltaY >= DISMISS_DISTANCE || velocityY >= DISMISS_VELOCITY)
    ) {
      onClose();
      return;
    }

    setDraggingDown(0);
    Animated.spring(dismissOffsetY, {
      damping: 22,
      stiffness: 240,
      toValue: 0,
      useNativeDriver: true,
    }).start();

    if (Math.abs(deltaX) <= TAP_MOVEMENT && Math.abs(deltaY) <= TAP_MOVEMENT) {
      handleTap(touch);
    }
  };

  const handleTouchCancel = () => {
    touchStart.current = null;
    pinchStart.current = null;
    pinchActive.current = false;
    panStart.current = null;
    panMoved.current = false;
    pagingActive.current = false;
    setDraggingDown(0);
    Animated.parallel([
      Animated.spring(dismissOffsetY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const handlePageScrollEnd = React.useCallback((event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    if (!pagingActive.current || zoomRef.current > MIN_ZOOM) {
      pagingActive.current = false;
      return;
    }
    const width = Math.max(pageWidth, 1);
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    const nextIndex = page === 0
      ? getGalleryIndex(currentIndex, -1, images.length)
      : page === 2
        ? getGalleryIndex(currentIndex, 1, images.length)
        : currentIndex;

    if (nextIndex !== currentIndex) {
      commitImageIndex(nextIndex);
    }

    pagingActive.current = false;
    pageListRef.current?.scrollToOffset({ animated: false, offset: width });
  }, [commitImageIndex, currentIndex, images.length, pageWidth]);

  const renderPage = React.useCallback(({ item }: ListRenderItemInfo<GalleryPageSlot>) => {
    const image = item.image;
    const initiallyReady = isImageReady(image, readyImageKeys);
    return (
      <View style={{ width: pageWidth, height: '100%' }}>
        <GalleryImagePage
          active={item.position === 'current'}
          image={image}
          imageOffsetX={item.position === 'current' ? imageOffsetX : undefined}
          imageOffsetY={item.position === 'current' ? imageOffsetY : undefined}
          initiallyReady={initiallyReady}
          pageWidth={pageWidth}
          position={item.position}
          testID={`${testID}-${item.position === 'current' ? 'image' : item.position === 'previous' ? 'previous-image' : 'next-image'}`}
          zoomScale={item.position === 'current' ? zoomScale : undefined}
          onImageSize={item.position === 'current' ? setImageSize : undefined}
          onReady={() => markImageReady(image)}
        />
      </View>
    );
  }, [imageOffsetX, imageOffsetY, markImageReady, pageWidth, readyImageKeys, setImageSize, testID, zoomScale]);

  const dismissProgress = Math.min(draggingDown / Math.max(stageSize.height, 1), 0.72);

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      testID={`${testID}-modal`}
      transparent
      visible={visible}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} backgroundColor="transparent" translucent />
      <View accessibilityViewIsModal style={styles.root} testID={`${testID}-fullscreen`}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            {
              backgroundColor: colors.background,
              opacity: openingProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1 - dismissProgress],
              }),
            },
          ]}
          testID={`${testID}-backdrop`}
        />

        <Animated.View
          pointerEvents={chromeVisible ? 'box-none' : 'none'}
          style={[
            styles.header,
            {
              opacity: Animated.multiply(openingProgress, chromeOpacity),
              paddingLeft: Math.max(insets.left, 16),
              paddingRight: Math.max(insets.right, 16),
              paddingTop: Math.max(insets.top, 12),
            },
          ]}
          testID={`${testID}-chrome`}
        >
          <View style={styles.headerContent}>
            <BackButton exitOnPress={false} onPress={onClose} flat={true} color={colors.foreground} accessibilityLabel="Back from preview" />
            <View style={styles.headerCenter}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
                {currentImage?.title ?? 'Image preview'}
              </Text>
              {currentImage?.subtitle ? (
                <Text numberOfLines={1} style={[styles.subtitle, { color: colors.mutedForeground }]}>{currentImage.subtitle}</Text>
              ) : null}
              {showCounter && images.length > 1 ? (
                <Text accessibilityLabel="Image counter" style={[styles.counter, { color: colors.mutedForeground }]}>
                  {currentIndex + 1} of {images.length}
                </Text>
              ) : null}
            </View>
            {rightActionLabel && (onRightActionPress || editMenu) ? (
              <TouchableOpacity
                accessibilityLabel={rightActionLabel}
                accessibilityRole="button"
                onPress={() => {
                  if (editMenu) {
                    setShowEditSheet(true);
                  } else if (onRightActionPress) {
                    onRightActionPress();
                  }
                }}
                style={[styles.rightActionButton, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.rightActionText, { color: colors.foreground }]}>{rightActionLabel}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSpacer} />
            )}
          </View>
        </Animated.View>

        <View
          accessibilityHint="Swipe to browse. Pinch or double tap to zoom. Drag down to close when fitted."
          onLayout={event => {
            const layout = event.nativeEvent.layout;
            setStageSize({ width: layout.width, height: layout.height });
          }}
          onTouchCancel={handleTouchCancel}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          style={styles.imageStage}
          testID={`${testID}-swipe-area`}
        >
          <Animated.View
            style={[
              styles.animatedImageStage,
              {
                opacity: openingProgress,
                transform: [
                  { translateY: dismissOffsetY },
                  {
                    scale: openingProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
            testID={`${testID}-expanding-image`}
          >
            <FlatList
              contentOffset={{ x: pageWidth, y: 0 }}
              data={pageSlots}
              horizontal
              initialScrollIndex={1}
              keyExtractor={item => item.key}
              keyboardShouldPersistTaps="handled"
              onMomentumScrollEnd={handlePageScrollEnd}
              onScrollBeginDrag={() => {
                if (zoomRef.current <= MIN_ZOOM) pagingActive.current = true;
              }}
              pagingEnabled={pageScrollEnabled}
              ref={pageListRef}
              removeClippedSubviews={false}
              renderItem={renderPage}
              scrollEnabled={pageScrollEnabled}
              showsHorizontalScrollIndicator={false}
              style={styles.pageList}
              testID={`${testID}-pager`}
              getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
            />
          </Animated.View>
        </View>

        {/* Slide-in Edit Bottom Sheet */}
        {showEditSheet && (
          <SheetBackdrop
            onPress={() => setShowEditSheet(false)}
            blurIntensity={0}
            lightScrimOpacity={0.3}
            darkScrimOpacity={0.45}
          />
        )}

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              transform: [{ translateY: sheetAnim }],
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleGroup}>
              {currentImage?.uri ? (
                <Image source={{ uri: currentImage.uri }} style={styles.sheetAvatar} />
              ) : (
                <View style={[styles.sheetAvatarPlaceholder, { backgroundColor: colors.muted }]}>
                  <Feather name="user" size={icons.semantic.button} color={colors.mutedForeground} />
                </View>
              )}
              <Text style={[styles.sheetTitleText, { color: colors.foreground }]}>Edit profile picture</Text>
            </View>
            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowEditSheet(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close edit menu"
            >
              <Feather name="x" size={icons.semantic.button} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Options Card */}
          {editMenu?.options && (
            <View style={[styles.sheetOptionsCard, { backgroundColor: colors.card }]}>
              {editMenu.options.map((option, index) => {
                const isLast = index === editMenu.options.length - 1;
                const iconColor = option.destructive ? colors.destructive : colors.foreground;
                const textColor = option.destructive ? colors.destructive : colors.foreground;

                return (
                  <React.Fragment key={option.label}>
                    <TouchableOpacity
                      style={styles.sheetOptionRow}
                      onPress={() => {
                        setShowEditSheet(false);
                        option.onPress();
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                    >
                      <Text style={[styles.sheetOptionText, { color: textColor }]}>
                        {option.label}
                      </Text>
                      <Feather name={option.icon} size={icons.semantic.row} color={iconColor} />
                    </TouchableOpacity>
                    {!isLast && <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function clampIndex(index: number, imageCount: number) {
  if (imageCount <= 0) return 0;
  return Math.max(0, Math.min(imageCount - 1, index));
}

function getTouchDistance(
  first: Pick<NativeTouchEvent, 'pageX' | 'pageY'>,
  second: Pick<NativeTouchEvent, 'pageX' | 'pageY'>,
) {
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function getLocalTouchPoint(
  touch: Pick<NativeTouchEvent, 'locationX' | 'locationY' | 'pageX' | 'pageY'>,
  stageSize: { width: number; height: number },
) {
  return {
    x: Number.isFinite(touch.locationX) ? touch.locationX : Math.max(0, Math.min(stageSize.width, touch.pageX)),
    y: Number.isFinite(touch.locationY) ? touch.locationY : Math.max(0, Math.min(stageSize.height, touch.pageY)),
  };
}

function getTouchMidpoint(
  first: Pick<NativeTouchEvent, 'locationX' | 'locationY' | 'pageX' | 'pageY'>,
  second: Pick<NativeTouchEvent, 'locationX' | 'locationY' | 'pageX' | 'pageY'>,
  stageSize: { width: number; height: number },
) {
  const firstPoint = getLocalTouchPoint(first, stageSize);
  const secondPoint = getLocalTouchPoint(second, stageSize);
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  };
}

function getDeclaredImageSize(image?: GalleryImage) {
  return image?.width && image?.height
    ? { width: image.width, height: image.height }
    : null;
}

function getImageReadyKey(image?: GalleryImage) {
  if (!image) return null;
  return image.uri ? `${image.id}|${image.uri}` : image.id;
}

function getPageSlotKey(image: GalleryImage | undefined, position: 'previous' | 'current' | 'next') {
  return getImageReadyKey(image) ?? position;
}

function isImageReady(image: GalleryImage | undefined, readyKeys: ReadonlySet<string>) {
  const key = getImageReadyKey(image);
  return Boolean(key && readyKeys.has(key));
}

function getFocalAdjustedOffset({
  focal,
  fromScale,
  offset,
  stageSize,
  toScale,
}: {
  focal: { x: number; y: number };
  fromScale: number;
  offset: { x: number; y: number };
  stageSize: { width: number; height: number };
  toScale: number;
}) {
  const safeFromScale = Math.max(fromScale, 0.001);
  const ratio = toScale / safeFromScale;
  const focalFromCenter = {
    x: focal.x - stageSize.width / 2,
    y: focal.y - stageSize.height / 2,
  };
  return {
    x: focalFromCenter.x - (focalFromCenter.x - offset.x) * ratio,
    y: focalFromCenter.y - (focalFromCenter.y - offset.y) * ratio,
  };
}

function getImageOffsetLimits(
  zoom: number,
  stageSize: { width: number; height: number },
  imageSize: { width: number; height: number } | null,
) {
  const sourceSize = imageSize ?? stageSize;
  const fitScale = Math.min(
    stageSize.width / Math.max(sourceSize.width, 1),
    stageSize.height / Math.max(sourceSize.height, 1),
  );
  const displayedWidth = sourceSize.width * fitScale * zoom;
  const displayedHeight = sourceSize.height * fitScale * zoom;
  const horizontalRoom = Math.max(0, (displayedWidth - stageSize.width) / 2);
  const verticalRoom = Math.max(0, (displayedHeight - stageSize.height) / 2);

  return {
    maxX: horizontalRoom,
    minX: -horizontalRoom,
    maxY: verticalRoom,
    minY: -verticalRoom,
  };
}

function resistAxis(value: number, min: number, max: number) {
  if (value > max) {
    return max + Math.min((value - max) * EDGE_RESISTANCE, MAX_IMAGE_OVERSCROLL);
  }
  if (value < min) {
    return min - Math.min((min - value) * EDGE_RESISTANCE, MAX_IMAGE_OVERSCROLL);
  }
  return value;
}

function resistImageOffset(
  offset: { x: number; y: number },
  zoom: number,
  stageSize: { width: number; height: number },
  imageSize: { width: number; height: number } | null,
) {
  const limits = getImageOffsetLimits(zoom, stageSize, imageSize);
  return {
    x: resistAxis(offset.x, limits.minX, limits.maxX),
    y: resistAxis(offset.y, limits.minY, limits.maxY),
  };
}

function clampImageOffset(
  offset: { x: number; y: number },
  zoom: number,
  stageSize: { width: number; height: number },
  imageSize: { width: number; height: number } | null,
) {
  const limits = getImageOffsetLimits(zoom, stageSize, imageSize);
  return {
    x: Math.max(limits.minX, Math.min(limits.maxX, offset.x)),
    y: Math.max(limits.minY, Math.min(limits.maxY, offset.y)),
  };
}

const GalleryImagePage = React.memo(function GalleryImagePage({
  active = false,
  image,
  imageOffsetX,
  imageOffsetY,
  initiallyReady,
  onImageSize,
  onReady,
  pageWidth,
  position,
  testID,
  zoomScale,
}: {
  active?: boolean;
  image?: GalleryImage;
  imageOffsetX?: Animated.Value;
  imageOffsetY?: Animated.Value;
  initiallyReady: boolean;
  onImageSize?: (size: { width: number; height: number } | null) => void;
  onReady: () => void;
  pageWidth: number;
  position: 'previous' | 'current' | 'next';
  testID: string;
  zoomScale?: Animated.Value;
}) {
  const colors = useColors();
  const [loading, setLoading] = React.useState(Boolean(image) && !initiallyReady);
  const [failed, setFailed] = React.useState(false);
  const readyRef = React.useRef(initiallyReady);

  React.useEffect(() => {
    readyRef.current = initiallyReady;
    setFailed(false);
    setLoading(Boolean(image?.uri) && !initiallyReady);
  }, [image?.id, image?.uri, initiallyReady]);

  const pageStyle = [
    styles.galleryPage,
    {
      width: pageWidth,
    },
  ];

  if ((!image?.uri || failed) && !active) {
    return (
      <Animated.View
        pointerEvents="none"
        style={pageStyle}
        testID={`${testID}-page`}
      />
    );
  }

  if (!image?.uri || failed) {
    return (
      <Animated.View
        pointerEvents={active ? 'auto' : 'none'}
        style={pageStyle}
        testID={`${testID}-page`}
      >
        <View style={styles.errorState} testID={active ? `${testID.replace(/-image$/, '')}-error` : `${testID}-error`}>
          <Feather color={colors.mutedForeground} name="image" size={34} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Image unavailable</Text>
        </View>
      </Animated.View>
    );
  }

  const imageStyle = active && imageOffsetX && imageOffsetY && zoomScale
    ? [
        styles.image,
        {
          transform: [
            { translateX: imageOffsetX },
            { translateY: imageOffsetY },
            { scale: zoomScale },
          ],
        },
      ]
    : styles.image;

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={pageStyle}
      testID={`${testID}-page`}
    >
      <Animated.Image
        accessibilityElementsHidden={!active}
        accessibilityLabel={active ? image.title ?? 'Gallery image' : undefined}
        onError={() => {
          setLoading(false);
          setFailed(true);
          onReady();
        }}
        onLoad={(event) => {
          const source = event.nativeEvent.source;
          if (source?.width && source?.height) {
            onImageSize?.({ width: source.width, height: source.height });
          }
        }}
        onLoadEnd={() => {
          readyRef.current = true;
          setLoading(false);
          onReady();
        }}
        onLoadStart={() => {
          if (!readyRef.current) setLoading(true);
        }}
        resizeMode="contain"
        source={{ uri: image.uri }}
        style={imageStyle}
        testID={testID}
      />
      {loading ? (
        <View style={styles.loadingState} testID={active ? `${testID.replace(/-image$/, '')}-loading` : `${testID}-loading`}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      ) : null}
      <View testID={`${testID}-${position}-sentinel`} style={styles.hiddenSentinel} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  backdrop: {},
  header: {
    position: 'absolute',
    left: spacing[0],
    right: spacing[0],
    top: spacing[0],
    minHeight: sizes.avatar.xl,
    paddingBottom: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: zIndex.raised + 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerCenter: {
    position: 'absolute',
    left: 60,
    right: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, fontFamily: typography.badge.fontFamily, textAlign: 'center' },
  subtitle: { ...typography.caption, fontFamily: typography.label.fontFamily, marginTop: spacing[2], textAlign: 'center' },
  counter: { ...typography.caption, fontFamily: typography.label.fontFamily, marginTop: spacing[2], textAlign: 'center' },
  headerSpacer: { width: sizes.iconButton.md },
  rightActionButton: {
    minWidth: sizes.iconButton.md,
    height: sizes.iconButton.md,
    paddingHorizontal: semanticSpacing.inlineGap,
    borderRadius: radius.sheetCompact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActionText: {
    ...typography.bodySmall,
    fontFamily: typography.title.fontFamily,
  },
  imageStage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  animatedImageStage: { width: '100%', height: '100%' },
  galleryPage: {
    position: 'absolute',
    top: spacing[0],
    bottom: spacing[0],
    left: spacing[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  pageList: { flex: 1, width: '100%', height: '100%' },
  hiddenSentinel: { height: 0, opacity: 0, width: 0 },
  loadingState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: semanticSpacing.rowGap },
  errorText: { ...typography.label, fontFamily: typography.label.fontFamily },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: zIndex.header,
  },
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
  },
  sheetAvatarPlaceholder: {
    width: sizes.avatar.sm,
    height: sizes.avatar.sm,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
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
