# Typography

Rides uses Inter as the only product font family. The app loads Inter through Expo Google Fonts and keeps the global Text/TextInput font patch as a fallback for unmigrated or third-party surfaces.

## Fonts

- Regular: `Inter_400Regular`
- Medium: `Inter_500Medium`
- Semibold: `Inter_600SemiBold`
- Bold: `Inter_700Bold`
- Code/debug: platform monospace through `typography.code`

## Variants

- `displayXL`: major emphasized metrics and large prices.
- `display`: emphasized metrics.
- `h1`: screen titles.
- `h2`: page and bottom sheet titles.
- `h3`: section titles.
- `title`: card titles and compact important labels.
- `body`: primary body copy.
- `bodySmall`: secondary body copy and list subtitles.
- `label`: input labels and compact labels.
- `caption`: helper text, timestamps, hints, and validation messages.
- `tiny`: small chips and compact metadata.
- `button`: button labels.
- `tab`: tab bar labels.
- `badge`: status badges.
- `code`: error/debug monospace text only.

## AppText

Use `AppText` for rendered text:

```tsx
<AppText variant="title">Book a Ride</AppText>
<AppText variant="bodySmall" color={colors.mutedForeground}>
  Arriving soon
</AppText>
```

Token styles are applied first, so local style overrides can still set alignment, spacing-related text properties, or rare semantic weight adjustments.

## TextInput

Do not wrap `TextInput` with `AppText`. Use typography tokens directly:

```tsx
style={[styles.input, typography.body, { color: colors.foreground }]}
```

## Do Not Use

- `fontSize: 17`
- `fontWeight: '600'`
- `fontFamily: 'Inter_600SemiBold'`

Use `AppText` variants or `typography` token styles instead.

## Enforcement

Run:

```sh
pnpm --dir artifacts/mobile run check:typography
```

The checker blocks raw numeric `fontSize`, quoted Inter `fontFamily`, and `fontWeight` in production mobile source.

## Allowed Exceptions

- `constants/fonts.ts`, `constants/typography.ts`, and `components/AppText.tsx`.
- `app/_layout.tsx` global fallback font patch.
- Dynamic avatar initials such as `fontSize: size * 0.4`.
- Error/debug monospace text in `ErrorFallback`.
- Tests, mocks, generated files, config, scripts, and docs.
- A local `typography-exception` comment may be used only for technical sizing such as icon-like glyphs, map markers, or avatar text.
