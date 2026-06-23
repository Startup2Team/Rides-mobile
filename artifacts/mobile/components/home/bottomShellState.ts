import type { BottomShellState } from './BottomShell';

export type BottomShellLayerMode = 'home' | 'booking' | 'closing';

/** Booking map/sheet affordances are active whenever the shell is not fully home. */
export function isBookingShellActive(state: BottomShellState): boolean {
  return state !== 'home';
}

export function resolveBottomShellLayerMode(state: BottomShellState): BottomShellLayerMode {
  if (state === 'home') return 'home';
  if (state === 'booking') return 'booking';
  return 'closing';
}

/** Skip the close slide when the sheet is already at its dismissed offset. */
export function shouldSkipCloseSlide(currentTranslateY: number, targetHeight: number): boolean {
  const target = Math.max(1, Math.round(targetHeight || 0));
  return currentTranslateY >= target - 1;
}

export function assertBottomShellState(state: BottomShellState): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  if (state !== 'home' && state !== 'booking' && state !== 'closingBooking') {
    console.error('[BottomShell] invalid shell state:', state);
  }
}

export function assertBottomShellLayerVisibility(
  state: BottomShellState,
  homeInteractive: boolean,
  bookingInteractive: boolean,
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  if (state === 'home') {
    if (!homeInteractive || bookingInteractive) {
      console.error('[BottomShell] home mode must show home only', { homeInteractive, bookingInteractive });
    }
    return;
  }

  if (state === 'booking') {
    if (homeInteractive || !bookingInteractive) {
      console.error('[BottomShell] booking mode must show booking only', { homeInteractive, bookingInteractive });
    }
    return;
  }

  // During close, both child layers are non-interactive; the shell owns the transition.
  if (homeInteractive || bookingInteractive) {
    console.error('[BottomShell] closing mode must not expose interactive child layers', {
      homeInteractive,
      bookingInteractive,
    });
  }
}
