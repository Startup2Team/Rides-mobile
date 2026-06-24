import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { ImageGalleryPreview, type GalleryImage } from '../ImageGalleryPreview';

const mockClose = jest.fn();
const mockIndexChange = jest.fn();
const images: GalleryImage[] = [
  { id: 'front', title: 'Driver License Front', uri: 'license-front://photo' },
  { id: 'back', title: 'Driver License Back', uri: 'license-back://photo' },
  { id: 'vehicle', title: 'Vehicle Outside', uri: 'vehicle://photo' },
];

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) =>
    React.createElement(name, { ...props, ref }));

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(value: number) {
      this.value = value;
    }

    interpolate(config: { outputRange: unknown[] }) {
      return config.outputRange[config.outputRange.length - 1];
    }
  }

  const animate = (value: AnimatedValue, config: { toValue: number }) => ({
    start: (callback?: () => void) => {
      value.setValue(config.toValue);
      callback?.();
    },
  });
  const absoluteFill = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const MockImage = Object.assign(host('Image'), {
    prefetch: jest.fn(() => Promise.resolve(true)),
  });

    return {
      ActivityIndicator: host('ActivityIndicator'),
      FlatList: React.forwardRef(({ data, keyExtractor, renderItem, ...props }: {
        data?: unknown[];
        keyExtractor?: (item: unknown, index: number) => string;
        renderItem?: (info: { item: unknown; index: number }) => React.ReactElement | null;
      }, ref: unknown) => React.createElement(
        'FlatList',
        { ...props, ref },
        data?.map((item, index) => (
          React.createElement(React.Fragment, { key: keyExtractor?.(item, index) ?? String(index) }, renderItem?.({ item, index }))
        )),
      )),
      Animated: {
        add: (left: unknown, right: unknown) => ({ left, right }),
      Image: host('AnimatedImage'),
      Value: AnimatedValue,
      View: host('AnimatedView'),
      multiply: (left: unknown, right: unknown) => ({ left, right }),
      parallel: (animations: Array<{ start: (callback?: () => void) => void }>) => ({
        start: (callback?: () => void) => {
          animations.forEach(animation => animation.start());
          callback?.();
        },
      }),
      spring: animate,
      timing: animate,
    },
    Image: MockImage,
    Modal: ({
      children,
      visible,
      ...props
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => visible ? React.createElement('Modal', props, children) : null,
    StyleSheet: {
      absoluteFill,
      absoluteFillObject: absoluteFill,
      create: (styles: object) => styles,
      flatten: (style: unknown) => Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style,
    },
    Text: host('Text'),
    TouchableOpacity: host('TouchableOpacity'),
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    View: host('View'),
    Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
    PlatformColor: (name: string) => name,
    useColorScheme: () => 'light',
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 16, left: 0 }),
}));

jest.mock('../BackButton', () => {
  const React = require('react');
  const { TouchableOpacity } = require('react-native');
  return {
    BackButton: React.forwardRef((props: any, ref: any) => {
      return React.createElement(TouchableOpacity, {
        accessibilityLabel: props.accessibilityLabel,
        onPress: props.onPress,
        testID: "back-button-mock",
      });
    }),
  };
});

function renderGallery(props: Partial<React.ComponentProps<typeof ImageGalleryPreview>> = {}) {
  const result = render(
    <ImageGalleryPreview
      images={images}
      initialIndex={0}
      onClose={mockClose}
      onIndexChange={mockIndexChange}
      visible
      {...props}
    />,
  );
  fireEvent(screen.getByTestId('image-gallery-swipe-area'), 'layout', {
    nativeEvent: { layout: { width: 400, height: 800 } },
  });
  markRenderedImagesReady();
  return result;
}

function markRenderedImagesReady() {
  const active = screen.queryByTestId('image-gallery-image');
  if (active) {
    fireEvent(active, 'load', {
      nativeEvent: { source: { width: 400, height: 800 } },
    });
    fireEvent(active, 'loadEnd');
  }
  const previous = screen.queryByTestId(
    'image-gallery-previous-image',
    { includeHiddenElements: true },
  );
  if (previous) fireEvent(previous, 'loadEnd');
  const next = screen.queryByTestId(
    'image-gallery-next-image',
    { includeHiddenElements: true },
  );
  if (next) fireEvent(next, 'loadEnd');
}

function touch(x: number, y: number) {
  return { locationX: x, locationY: y, pageX: x, pageY: y };
}

function start(x: number, y: number) {
  fireEvent(screen.getByTestId('image-gallery-swipe-area'), 'touchStart', {
    nativeEvent: { touches: [touch(x, y)] },
  });
}

function move(x: number, y: number) {
  fireEvent(screen.getByTestId('image-gallery-swipe-area'), 'touchMove', {
    nativeEvent: { touches: [touch(x, y)] },
  });
}

function end(x: number, y: number) {
  fireEvent(screen.getByTestId('image-gallery-swipe-area'), 'touchEnd', {
    nativeEvent: { changedTouches: [touch(x, y)], touches: [] },
  });
}

function swipe(fromX: number, toX: number, y = 400) {
  const pager = screen.getByTestId('image-gallery-pager');
  const targetOffsetX = toX < fromX ? 800 : 0;
  const startedAt = Date.now();
  fireEvent(pager, 'scrollBeginDrag', {
    nativeEvent: { contentOffset: { x: 400, y: 0 } },
  });
  fireEvent(pager, 'scroll', {
    nativeEvent: { contentOffset: { x: targetOffsetX, y: 0 } },
  });
  fireEvent(pager, 'scrollEndDrag', {
    nativeEvent: { contentOffset: { x: targetOffsetX, y: 0 } },
  });
  const elapsed = Date.now() - startedAt;
  const shouldCommit = Math.abs(toX - fromX) >= 120 || elapsed < 180;
  if (shouldCommit) {
    fireEvent(pager, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: targetOffsetX, y: 0 } },
    });
  }
}

function pinchToTwoTimes() {
  const stage = screen.getByTestId('image-gallery-swipe-area');
  fireEvent(stage, 'touchStart', {
    nativeEvent: { touches: [touch(100, 300), touch(200, 300)] },
  });
  fireEvent(stage, 'touchMove', {
    nativeEvent: { touches: [touch(50, 300), touch(250, 300)] },
  });
  fireEvent(stage, 'touchEnd', {
    nativeEvent: { changedTouches: [], touches: [] },
  });
}

function pinch(
  startPoints: [ReturnType<typeof touch>, ReturnType<typeof touch>],
  endPoints: [ReturnType<typeof touch>, ReturnType<typeof touch>],
) {
  const stage = screen.getByTestId('image-gallery-swipe-area');
  fireEvent(stage, 'touchStart', {
    nativeEvent: { touches: startPoints },
  });
  fireEvent(stage, 'touchMove', {
    nativeEvent: { touches: endPoints },
  });
  fireEvent(stage, 'touchEnd', {
    nativeEvent: { changedTouches: endPoints, touches: [] },
  });
}

describe('ImageGalleryPreview', () => {
  beforeEach(() => {
    mockClose.mockClear();
    mockIndexChange.mockClear();
    (Image.prefetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('opens as a full-screen dark gallery with synchronized backdrop and image animation', () => {
    renderGallery();

    expect(screen.getByTestId('image-gallery-modal').props.transparent).toBe(true);
    expect(screen.getByTestId('image-gallery-modal').props.presentationStyle).toBe('overFullScreen');
    expect(screen.getByTestId('image-gallery-fullscreen')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('image-gallery-backdrop').props.style))
      .toEqual(expect.objectContaining({ backgroundColor: '#050505' }));
    expect(screen.getByTestId('image-gallery-expanding-image').props.style)
      .toEqual(expect.arrayContaining([expect.objectContaining({ opacity: expect.anything() })]));
    expect(screen.queryByTestId('image-gallery-floating-frame')).toBeNull();
    expect(screen.getByText('Driver License Front')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([1, ' of ', 3]);
  });

  test('respects initial index zero and opens the first image', () => {
    renderGallery({ initialIndex: 0 });

    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-front://photo',
    });
    expect(screen.getByText('Driver License Front')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([1, ' of ', 3]);
  });

  test('opens the requested second image with matching title and counter', () => {
    renderGallery({ initialIndex: 1 });

    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([2, ' of ', 3]);
  });

  test('back arrow and Android back close the gallery', () => {
    renderGallery();

    fireEvent.press(screen.getByLabelText('Back from preview'));
    fireEvent(screen.getByTestId('image-gallery-modal'), 'requestClose');

    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  test('single tap hides and shows gallery chrome', () => {
    jest.useFakeTimers();
    renderGallery();

    start(200, 400);
    end(200, 400);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByTestId('image-gallery-chrome').props.pointerEvents).toBe('none');

    start(200, 400);
    end(200, 400);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.getByTestId('image-gallery-chrome').props.pointerEvents).toBe('box-none');
  });

  test('pages left and right and resets the selected image', () => {
    renderGallery();

    swipe(340, 100);
    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(mockIndexChange).toHaveBeenLastCalledWith(1);

    swipe(80, 330);
    expect(screen.getByText('Driver License Front')).toBeTruthy();
    expect(mockIndexChange).toHaveBeenLastCalledWith(0);
  });

  test('quick flick changes image even below the distance threshold', () => {
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1040);
    renderGallery();

    swipe(220, 180);

    expect(screen.getByText('Driver License Back')).toBeTruthy();
  });

  test('slow drag below the threshold springs back without paging', () => {
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1600);
    renderGallery();

    swipe(220, 180);

    expect(screen.getByText('Driver License Front')).toBeTruthy();
    expect(mockIndexChange).not.toHaveBeenCalled();
  });

  test('preloads only the adjacent images', () => {
    renderGallery({ initialIndex: 1 });

    expect(Image.prefetch).toHaveBeenCalledWith('license-front://photo');
    expect(Image.prefetch).toHaveBeenCalledWith('vehicle://photo');
    expect(Image.prefetch).toHaveBeenCalledTimes(2);
  });

  test('image readiness is cached by id and uri, then reused on repeated load starts', () => {
    const { rerender } = renderGallery({
      images: [{ ...images[0], uri: 'license-front://photo' }],
    });

    expect(screen.queryByTestId('image-gallery-loading')).toBeNull();
    fireEvent(screen.getByTestId('image-gallery-image'), 'loadStart');
    expect(screen.queryByTestId('image-gallery-loading')).toBeNull();

    rerender(
      <ImageGalleryPreview
        images={[{ ...images[0], uri: 'license-front://replacement' }]}
        initialIndex={0}
        onClose={mockClose}
        onIndexChange={mockIndexChange}
        visible
      />,
    );

    expect(screen.getByTestId('image-gallery-loading')).toBeTruthy();
  });

  test('renders decoded adjacent images so paging never exposes an empty frame', () => {
    renderGallery({ initialIndex: 1 });

    expect(screen.getByTestId('image-gallery-previous-image-page')).toBeTruthy();
    expect(screen.getByTestId('image-gallery-image-page')).toBeTruthy();
    expect(screen.getByTestId('image-gallery-next-image-page')).toBeTruthy();
    expect(screen.getByTestId(
      'image-gallery-previous-image',
      { includeHiddenElements: true },
    ).props.source).toEqual({
      uri: 'license-front://photo',
    });
    expect(screen.getByTestId(
      'image-gallery-next-image',
      { includeHiddenElements: true },
    ).props.source).toEqual({
      uri: 'vehicle://photo',
    });
    expect(screen.getByTestId('image-gallery-image')).toBeTruthy();
    expect(screen.queryByTestId('image-gallery-error')).toBeNull();
  });

  test('next image is already mounted and visible on the track before index commit', () => {
    renderGallery();

    fireEvent(screen.getByTestId('image-gallery-pager'), 'scrollBeginDrag', {
      nativeEvent: { contentOffset: { x: 400, y: 0 } },
    });
    fireEvent(screen.getByTestId('image-gallery-pager'), 'scroll', {
      nativeEvent: { contentOffset: { x: 760, y: 0 } },
    });

    expect(screen.getByTestId('image-gallery-next-image', { includeHiddenElements: true }).props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(screen.getByText('Driver License Front')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([1, ' of ', 3]);
  });

  test('header and counter update immediately when the page commits', () => {
    renderGallery();

    swipe(340, 100);

    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([2, ' of ', 3]);
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(screen.getByTestId('image-gallery-expanding-image').props.style[1].transform[0].translateY.value).toBe(0);
  });

  test('swiping to a ready image does not retain or reload over the displayed image', () => {
    renderGallery();

    swipe(340, 100);

    expect(screen.queryByTestId('image-gallery-retained-image')).toBeNull();
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(screen.queryByTestId('image-gallery-loading')).toBeNull();

    fireEvent(screen.getByTestId('image-gallery-image'), 'loadStart');
    expect(screen.queryByTestId('image-gallery-loading')).toBeNull();
    fireEvent(screen.getByTestId('image-gallery-image'), 'loadEnd');
    expect(screen.queryByTestId('image-gallery-retained-image')).toBeNull();
  });

  test('commits the next page even when the image is still warming up', () => {
    render(
      <ImageGalleryPreview
        images={images}
        initialIndex={0}
        onClose={mockClose}
        onIndexChange={mockIndexChange}
        visible
      />,
    );
    fireEvent(screen.getByTestId('image-gallery-swipe-area'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 800 } },
    });
    fireEvent(screen.getByTestId('image-gallery-image'), 'load', {
      nativeEvent: { source: { width: 400, height: 800 } },
    });
    fireEvent(screen.getByTestId('image-gallery-image'), 'loadEnd');

    swipe(340, 100);

    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([2, ' of ', 3]);
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(mockIndexChange).toHaveBeenLastCalledWith(1);
  });

  test('disables paging and swipe-down dismissal while zoomed, but allows panning', () => {
    renderGallery({ initialIndex: 1 });
    pinchToTwoTimes();

    swipe(340, 80);
    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'license-back://photo',
    });
    expect(screen.getByTestId('image-gallery-previous-image', { includeHiddenElements: true }).props.source).toEqual({
      uri: 'license-front://photo',
    });

    start(200, 300);
    move(200, 520);
    end(200, 520);

    expect(mockClose).not.toHaveBeenCalled();
    const imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[1].translateY.value).not.toBe(0);
  });

  test('active zoom transforms do not affect previous and next pages', () => {
    renderGallery({ initialIndex: 1 });
    pinchToTwoTimes();

    const activeStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(activeStyle.transform[2].scale.value).toBe(2);
    expect(StyleSheet.flatten(screen.getByTestId('image-gallery-previous-image', { includeHiddenElements: true }).props.style).transform).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('image-gallery-next-image', { includeHiddenElements: true }).props.style).transform).toBeUndefined();
  });

  test('rubber-band pan springs back inside image bounds', () => {
    renderGallery();
    pinchToTwoTimes();

    start(200, 400);
    move(700, 400);
    end(700, 400);

    const imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[0].translateX.value).toBe(200);
  });

  test('pinch can repeatedly return to one times and reactivate', () => {
    renderGallery();

    pinch(
      [touch(100, 300), touch(200, 300)],
      [touch(50, 300), touch(250, 300)],
    );
    pinch(
      [touch(50, 300), touch(250, 300)],
      [touch(100, 300), touch(200, 300)],
    );
    let imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(1);

    pinch(
      [touch(100, 300), touch(200, 300)],
      [touch(0, 300), touch(300, 300)],
    );
    imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(3);

    pinch(
      [touch(0, 300), touch(300, 300)],
      [touch(100, 300), touch(200, 300)],
    );
    imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(1);
  });

  test('pinch zoom uses the finger midpoint instead of the screen center', () => {
    renderGallery();

    pinch(
      [touch(50, 100), touch(150, 100)],
      [touch(0, 100), touch(200, 100)],
    );

    const imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(2);
    expect(imageStyle.transform[0].translateX.value).toBe(100);
    expect(imageStyle.transform[1].translateY.value).toBe(300);
  });

  test('pinch below one times elastically under-zooms and springs back to fit', () => {
    renderGallery();

    const stage = screen.getByTestId('image-gallery-swipe-area');
    fireEvent(stage, 'touchStart', {
      nativeEvent: { touches: [touch(100, 300), touch(300, 300)] },
    });
    fireEvent(stage, 'touchMove', {
      nativeEvent: { touches: [touch(140, 300), touch(260, 300)] },
    });

    let imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(0.85);

    fireEvent(stage, 'touchEnd', {
      nativeEvent: { changedTouches: [], touches: [] },
    });

    imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[0].translateX.value).toBe(0);
    expect(imageStyle.transform[1].translateY.value).toBe(0);
    expect(imageStyle.transform[2].scale.value).toBe(1);

    pinch(
      [touch(100, 300), touch(200, 300)],
      [touch(0, 300), touch(300, 300)],
    );

    imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(3);
  });

  test('fitted image bounds prevent large black gaps while zoomed', () => {
    renderGallery({
      images: [{ ...images[0], width: 800, height: 400 }],
    });
    fireEvent(screen.getByTestId('image-gallery-image'), 'load', {
      nativeEvent: { source: { width: 800, height: 400 } },
    });
    pinchToTwoTimes();

    start(200, 400);
    move(200, 1400);
    const movingStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(Math.abs(movingStyle.transform[1].translateY.value)).toBeLessThanOrEqual(44);
    end(200, 1400);

    const settledStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(settledStyle.transform[1].translateY.value).toBe(0);
  });

  test('swipe-down closes only while fitted at one times zoom', () => {
    renderGallery();

    start(200, 250);
    move(200, 430);
    end(200, 430);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('double tap zooms around the touched point and toggles back to fit', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    renderGallery();

    start(80, 180);
    end(80, 180);
    jest.setSystemTime(1100);
    start(80, 180);
    end(80, 180);

    let imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(2);
    expect(imageStyle.transform[0].translateX.value).toBe(120);
    expect(imageStyle.transform[1].translateY.value).toBe(220);

    jest.setSystemTime(1500);
    start(80, 180);
    end(80, 180);
    jest.setSystemTime(1600);
    start(80, 180);
    end(80, 180);

    imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(imageStyle.transform[2].scale.value).toBe(1);
  });

  test('moving to another image resets zoom and position', () => {
    renderGallery();
    pinchToTwoTimes();

    const stage = screen.getByTestId('image-gallery-swipe-area');
    fireEvent(stage, 'touchStart', {
      nativeEvent: { touches: [touch(100, 300), touch(200, 300)] },
    });
    fireEvent(stage, 'touchMove', {
      nativeEvent: { touches: [touch(100, 300), touch(200, 300)] },
    });
    fireEvent(stage, 'touchEnd', {
      nativeEvent: { changedTouches: [], touches: [] },
    });

    jest.useFakeTimers();
    jest.setSystemTime(1000);
    start(200, 400);
    end(200, 400);
    jest.setSystemTime(1100);
    start(200, 400);
    end(200, 400);
    swipe(340, 100);

    const imageStyle = screen.getByTestId('image-gallery-image').props.style[1];
    expect(screen.getByText('Driver License Back')).toBeTruthy();
    expect(imageStyle.transform[0].translateX.value).toBe(0);
    expect(imageStyle.transform[1].translateY.value).toBe(0);
    expect(imageStyle.transform[2].scale.value).toBe(1);
  });

  test('invalid image displays an unavailable state without crashing', () => {
    renderGallery();

    fireEvent(screen.getByTestId('image-gallery-image'), 'error');

    expect(screen.getByTestId('image-gallery-error')).toBeTruthy();
    expect(screen.getAllByText('Image unavailable').length).toBeGreaterThanOrEqual(1);
  });

  test('missing image keeps its stable index and does not shift later images', () => {
    const imagesWithMissing: GalleryImage[] = [
      images[0],
      { id: 'missing', title: 'Missing Document', uri: null },
      images[2],
    ];
    renderGallery({ images: imagesWithMissing, initialIndex: 1 });

    expect(screen.getByText('Missing Document')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([2, ' of ', 3]);
    expect(screen.getByTestId('image-gallery-error')).toBeTruthy();

    swipe(340, 100);

    expect(screen.getByText('Vehicle Outside')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([3, ' of ', 3]);
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'vehicle://photo',
    });
  });

  test('rapid consecutive paging remains synchronized and keeps an image rendered', () => {
    renderGallery();

    swipe(340, 100);
    markRenderedImagesReady();
    swipe(340, 100);

    expect(screen.getByText('Vehicle Outside')).toBeTruthy();
    expect(screen.getByLabelText('Image counter').props.children).toEqual([3, ' of ', 3]);
    expect(screen.getByTestId('image-gallery-image').props.source).toEqual({
      uri: 'vehicle://photo',
    });
    expect(mockIndexChange.mock.calls).toEqual([[1], [2]]);
  });
});
