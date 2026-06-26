# Design Tokens

Rides mobile tokens centralize non-typography design decisions without changing screen layout during Phase 5B.

## Token Files

- `constants/spacing.ts`: numeric spacing scale and semantic spacing aliases.
- `constants/radius.ts`: corner radius scale for controls, cards, sheets, pills, and full-round elements.
- `constants/elevation.ts`: reusable shadow and Android elevation presets.
- `constants/motion.ts`: duration, easing, and spring presets.
- `constants/icons.ts`: icon size scale and semantic aliases.
- `constants/sizes.ts`: component dimensions for buttons, inputs, avatars, icon buttons, sheet handles, map controls, thumbnails, tab bar, and vehicle artwork.
- `constants/zIndex.ts`: app layer scale for local stacking, headers, sheets, overlays, modals, map picker, and toast.

## Usage

Use tokens when adding new shared styles:

```ts
import { spacing, semanticSpacing } from '@/constants/spacing';
import { radius } from '@/constants/radius';
import { elevation } from '@/constants/elevation';

const styles = StyleSheet.create({
  card: {
    padding: semanticSpacing.cardPadding,
    borderRadius: radius.xl,
    ...elevation.sm,
  },
  row: {
    gap: spacing[8],
  },
});
```

Use `sizes` for fixed-format component dimensions:

```ts
import { sizes } from '@/constants/sizes';

const input = {
  height: sizes.input.lg,
};
```

Use `motion` for animation timing:

```ts
import { duration, easing } from '@/constants/motion';

Animated.timing(value, {
  toValue: 1,
  duration: duration.normal,
  easing: easing.easeOutCubic,
  useNativeDriver: true,
});
```

## Allowed Exceptions

- Map geometry, route fitting, marker artwork, and generated vehicle image dimensions.
- Safe-area and platform expressions.
- One-off animation choreography where values are tied to a specific sequence.
- Third-party API values and external SDK options.
- Temporary legacy styles until Phase 5C/5D migration reaches them.

## Migration Plan

- Phase 5C: migrate shared components first.
- Phase 5D: migrate high-visibility screens.
- Phase 5E: add enforcement scripts for raw spacing, radius, elevation, motion, icon size, component size, and z-index values with documented exceptions.
