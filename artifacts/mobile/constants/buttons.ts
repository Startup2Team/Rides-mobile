/**
 * iOS-style button tokens (maps to SwiftUI button styles).
 *
 * - primary   → .borderedProminent (filled accent)
 * - secondary → .bordered (filled gray, no stroke)
 * - plain     → .borderless (label only, accent color)
 * - danger        → .borderedProminent + destructive role
 * - dangerPlain   → tinted destructive (Decline, cancel icon)
 * - ghost         → .plain on dark/custom backgrounds
 *
 * outline is kept for compatibility; it renders like secondary (filled, no stroke).
 */
export const BUTTON_HEIGHT = {
  sm: 44,
  md: 50,
  lg: 50,
} as const;

/** iOS capsule corner radius for a control of the given height (height ÷ 2). */
export function buttonCornerRadius(height: number): number {
  return height / 2;
}

/** Default pill radius for the standard small button height (44pt → 22). */
export const BUTTON_RADIUS = buttonCornerRadius(BUTTON_HEIGHT.sm);

export const BUTTON_FONT_SIZE = {
  sm: 15,
  md: 17,
  lg: 17,
} as const;
