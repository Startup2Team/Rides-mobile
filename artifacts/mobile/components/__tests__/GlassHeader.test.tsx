jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  StyleSheet: { create: (styles: object) => styles, hairlineWidth: 1 },
  View: 'View',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  usePathname: () => '/stats',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('@/components/BackButton', () => ({
  BackButton: 'BackButton',
}));

jest.mock('@/components/AppText', () => ({
  AppText: 'AppText',
}));

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    border: '#ddd',
    foreground: '#111',
  }),
}));

import { headerScrollStore } from '@/components/GlassHeader';

describe('headerScrollStore', () => {
  afterEach(() => {
    headerScrollStore.set('/stats', false);
    headerScrollStore.set('/profile', false);
  });

  test('retains the scrolled state after the last listener unsubscribes', () => {
    const updates: boolean[] = [];
    const unsubscribe = headerScrollStore.subscribe('/stats', value => updates.push(value));

    headerScrollStore.set('/stats', true);
    expect(headerScrollStore.get('/stats')).toBe(true);
    expect(updates).toEqual([true]);

    unsubscribe();

    expect(headerScrollStore.get('/stats')).toBe(true);
  });
});
