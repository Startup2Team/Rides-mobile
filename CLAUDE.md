# Taravelis — Claude Code Standing Instructions

These rules apply to **every single prompt** in this project, without exception. Before doing anything, Claude must mentally apply all skill domains below to the task at hand.

---

## 0. Prime Directive

Every response, every change, every suggestion must reflect **world-class craftsmanship** — the standard of a senior engineer who is also a discerning designer, a growth-minded product thinker, and a meticulous QA engineer. Mediocre output is not acceptable. If something can be done better, do it better without being asked.

---

## 1. Design & Visual Craft (apply to every UI change)

### Always ask before shipping any screen or component:
- Does this pass the **Huashu aesthetic** standard? — elegant, refined, purposeful negative space, layered depth without noise, calligraphic balance in typography
- Does this reflect **impeccable quality**? — every shadow, radius, and spacing intentional; no placeholder colors, no wrong fonts, no clipped content; pixel-perfect at 1x/2x/3x
- Does this show **taste**? — restraint, knowing what NOT to add, consistency policed across every screen
- Is this following **native UI patterns**? — iOS: HIG, SF Symbols, Safe Areas, sheet modals, swipe-back; Android: Material 3, predictive back, edge-to-edge
- Is **dark mode parity** maintained? — both modes designed, not derived
- Are **all states designed**? — empty, error, loading, success, offline — every state, no placeholder text

### Design tool awareness (apply when creating or reviewing UI):
- Structure components as **Figma Auto Layout** would (fill/hug/fixed sizing mental model)
- Design tokens for color, spacing, typography — never hardcoded raw values
- SF Symbols for iOS icons (`expo-symbols`), Lucide for cross-platform
- Illustrations and icons follow a single consistent style guide
- App icon: communicates in <1 second, no text, tested on real home screen backgrounds
- Screenshots and previews: designed as ad creatives, first screenshot = highest impact

---

## 2. Motion & Animation (apply to every interaction)

- Use `react-native-reanimated` (worklet-based, UI thread) for all performance-sensitive animations — never JS-thread Animated API for gestures
- Use `react-native-gesture-handler` for all touch interactions
- Use `lottie-react-native` for illustrative/celebratory animations
- Use `framer-motion` in web/mockup-sandbox contexts
- Every animation has **semantic meaning** — direction, hierarchy, causality
- Duration budget: navigation 300ms, micro-interactions 150ms, celebrations 600ms
- Always implement `prefers-reduced-motion` accessibility fallback
- Easing: spring physics for interactive, ease-out for entrances, ease-in for exits

---

## 3. Testing & Quality (apply to every code change)

### Automated testing stack — all installed:
- `jest-expo` + `@testing-library/react-native` — unit and component tests for mobile
- `@playwright/test` — E2E tests for React Native Web targets
- `axe-core` — accessibility audits (run on every screen)
- `eslint` + `eslint-config-expo` — linting (zero warnings policy)
- `husky` + `lint-staged` — pre-commit enforcement
- `@sentry/react-native` + `@sentry/node` — crash monitoring in both app and server

### Quality gates — never skip:
- TypeScript strict mode, zero `any`
- All interactive elements: `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`
- Touch targets ≥ 44×44pt
- Color contrast ≥ 4.5:1 (WCAG AA)
- No screen ships without: empty state, error state, loading state designed and implemented

---

## 4. Performance (apply to every feature)

- All list views use `FlatList`, never `ScrollView` for dynamic data
- All animations use `useNativeDriver: true` or Reanimated worklets
- Images always use `expo-image` with blurhash placeholder
- `@react-native-community/netinfo` for offline detection — every data-fetching screen handles offline gracefully
- React Query `staleTime` and `gcTime` set deliberately, not left as defaults
- Cold start target: < 2 seconds — defer non-critical init after first render
- No unnecessary re-renders — `memo`, `useMemo`, `useCallback` applied after measurement

---

## 5. Internationalization (apply to all text)

- All user-facing strings go through `i18next` / `react-i18next` — never hardcoded
- `expo-localization` for locale detection from device settings
- Support: English, French, Kinyarwanda (Rwanda's three official languages)
- Currency: RWF (Rwandan Franc) via `Intl.NumberFormat`
- Dates/times: `Intl.DateTimeFormat` with locale awareness
- RTL support: `I18nManager.forceRTL` awareness for all layouts

---

## 6. Real-time & Backend (apply to all data flows)

- `socket.io` (server) + `socket.io-client` (mobile) for live driver location and ride status
- All API routes follow OpenAPI spec in `lib/api-spec/openapi.yaml` — spec-first
- Auth: `jsonwebtoken` (access + refresh token rotation) + `bcryptjs` for password hashing
- Security: `helmet` headers + `express-rate-limit` on all routes
- OTP/SMS: Africa's Talking for Rwandan phone numbers
- PostGIS geospatial queries for finding nearby drivers

---

## 7. Analytics & Growth (apply to every user-facing feature)

- Every feature ships with `posthog-react-native` events: screen_view, button_tap, conversion events
- Event taxonomy: `entity_action` format (ride_requested, driver_accepted, payment_completed)
- Push notifications via `expo-notifications`: always prompt after a positive moment, never on cold launch
- In-app review prompt: `expo-store-review` after first completed ride

---

## 8. App Store & ASO (consider for every release-affecting change)

### Apple App Store Preflight — always verify:
- Privacy manifest (`PrivacyInfo.xcprivacy`) up to date
- `expo-tracking-transparency` ATT prompt wired correctly
- All permissions have usage description strings in `Info.plist`
- No placeholder content, broken links, or missing test credentials

### Google Play Preflight — always verify:
- Target API level compliant
- 64-bit support confirmed
- Data safety form matches actual data collection

### ASO Standards:
- App title: lead keyword in first word, ≤30 chars (iOS) / ≤50 chars (Android)
- Screenshots: designed as ad creatives with benefit-first headline overlays
- Description: keyword density ~2-3%, benefits not features
- Ratings prompt: only after a clearly positive event

### Apple Search Ads awareness:
- Features that improve conversion rate (TTR > 5%, CR > store average) are prioritized
- Custom Product Pages for different audience segments
- Deep links support for re-engagement campaigns

---

## 9. Maps & Location (apply to all map/location features)

- `@rnmapbox/maps` for full Mapbox SDK features (custom styles, offline tiles)
- `react-native-maps` for simpler map views where Mapbox is overkill
- `expo-location` with appropriate foreground/background permissions
- Background location for driver tracking — handle iOS battery/permission edge cases
- Geofencing for pickup/dropoff arrival detection
- Location smoothing to filter GPS noise

---

## 10. DevOps & Release (apply to all structural changes)

- Branch strategy: `main` (production) → `develop` (staging) → feature branches
- EAS Build for iOS/Android cloud builds, EAS Update for OTA JS-only patches
- Sentry source maps uploaded on every build
- Phased rollout: 1% → 5% → 20% → 50% → 100% over 7 days
- Never ship without: crash-free rate baseline, rollback plan documented

---

## 11. Design Tools & Platforms Awareness

When making decisions about UI, always reason as if you have full access to and fluency with:

| Tool / Platform | How it applies |
|---|---|
| **Figma** | Component library, Auto Layout, Variables/Tokens, Dev Mode specs |
| **Sketch** | Legacy iOS symbol libraries reference |
| **Adobe Illustrator** | SVG asset optimization, vector icon creation |
| **Framer (canvas)** | Interactive prototype logic and code-export patterns |
| **Principle / Protopie** | High-fidelity interaction prototyping mental model |
| **Rotato / ScreenSnapAI** | App Store screenshot mockup standards |
| **Canva** | Quick marketing asset creation |
| **Mapbox Studio** | Custom map style design |
| **App Store Connect** | Metadata, pricing, TestFlight, phased rollout controls |
| **Xcode Organizer** | Validate App, symbols, crash logs |
| **TestFlight** | Beta distribution, tester feedback |
| **Apple Search Ads** | Keyword strategy, CPT bidding, Creative Sets |
| **Google Play Console** | Internal/closed/open tracks, staged rollouts, Android Vitals |
| **AppFollow / AppTweak** | ASO rank tracking, competitor analysis |
| **Africa's Talking** | SMS/OTP delivery for Rwanda |
| **Lokalise / Phrase** | Translation pipeline management |

---

## 12. The Non-Negotiable Bar

Every pull request, every screen, every endpoint must clear this bar:

1. **Would this ship in a top-10 App Store app?** If not, why not — fix it.
2. **Does a user with VoiceOver / TalkBack have a complete experience?**
3. **Does this work offline, on slow 2G, and on the oldest supported device?**
4. **Is every piece of text translatable?**
5. **Does this have a test?**
6. **Is there a Sentry event if this fails in production?**

If the answer to any of these is no — the task is not done.

---

*This file is always loaded. These are permanent standing instructions for all Claude Code sessions on this project.*
