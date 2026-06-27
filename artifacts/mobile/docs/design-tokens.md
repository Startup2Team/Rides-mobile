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
- Documented odd-value visual constants that are intentionally calibrated and not token-friendly.
- Branded/custom shadows and other one-off surface treatments documented during Phase 5E.

## Enforcement

Run the checker before merging mobile UI changes:

```bash
pnpm.cmd --dir artifacts/mobile run check:design-tokens
```

The script scans production source and reports raw spacing, radius, elevation, z-index, icon size, and component size values.

Allowed exception categories:

- Map geometry, route fitting, marker sizing, and vehicle artwork dimensions.
- Dynamic avatar and image math.
- SVG, canvas, and other draw-math code.
- Animation interpolation math and gesture physics.
- Documented odd-value visual constants.
- Branded/custom shadows explicitly called out during migration.
- Files or lines marked with `design-token-exception`.
- Legacy deferred surfaces that are still waiting on their final token migration pass and are explicitly listed in the checker.

How to justify an exception:

1. Add a short `design-token-exception` comment near the line or at the top of the file.
2. State the category the value belongs to, for example `map geometry`, `vehicle artwork`, or `branded shadow`.
3. Keep the exception narrow. Prefer a single line over a whole file whenever possible.
4. If a whole file is still a legacy deferred surface, add it to the checker allowlist only as a temporary migration exception.

Valid token usage:

```ts
padding: semanticSpacing.cardPadding,
borderRadius: radius.card,
...elevation.card,
zIndex: zIndex.header,
<Feather name="search" size={icons.semantic.row} />
height: sizes.input.lg,
```

Invalid raw values:

```ts
padding: 16,
borderRadius: 14,
elevation: 8,
zIndex: 10,
<Feather name="search" size={18} />
height: 52,
```

## Migration Plan

- Phase 5C: migrate shared components first.
- Phase 5D: migrate high-visibility screens.
- Phase 5E: migrate remaining driver-facing screens and technical exceptions.
- Phase 5F: add enforcement scripts for raw spacing, radius, elevation, z-index, icon size, and component size values with documented exceptions.
