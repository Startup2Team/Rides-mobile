# App Development Skills Compendium

A comprehensive reference of every skill domain required to ship a world-class mobile application — from first pixel to store ranking.

---

## 1. Design & Visual Craft

### UI/UX Design (Pro Max)
- Information architecture & user flows
- Wireframing → low-fi → high-fi prototyping
- Gestalt principles, visual hierarchy, grid systems
- Micro-interactions & feedback loops
- Empty states, error states, loading states — every state designed
- Onboarding UX (progressive disclosure, aha-moment engineering)
- Conversion-focused UI patterns (CTAs, friction reduction)

### Taste & Aesthetic Judgment
- Knowing when something is "off" before you can articulate why
- Restraint: knowing what NOT to add
- Consistency policing across the full screen inventory
- Font pairing, white space discipline, contrast ratios
- Pixel-perfect QA — matching design spec to 1dp accuracy

### Impeccable Design Quality
- Every shadow, radius, and spacing intentional
- No visual debt shipped (placeholder colors, wrong fonts, clipped content)
- Cross-resolution testing (1x, 2x, 3x, all screen sizes)
- Dark mode parity — both modes designed, not derived
- RTL support awareness

### Huashu Design (华书 Design Aesthetic)
- Elegant, refined visual language rooted in clarity and Rides
- Calligraphic proportions applied to typography choices
- Purposeful negative space (ma — 間) — breathing room as design element
- Layered depth without noise
- Cultural sensitivity in iconography and color symbolism

### Native UI Patterns
- **iOS**: Human Interface Guidelines (HIG), SF Symbols, Dynamic Island, Live Activities, Safe Areas, swipe-to-go-back, sheet modals
- **Android**: Material Design 3, predictive back gesture, adaptive icons, edge-to-edge layout
- Platform-native navigation metaphors (tabs vs. drawers vs. back stack)
- Haptic feedback design (light, medium, heavy, selection, notification)
- Adaptive layouts (compact/regular size classes)

---

## 2. Motion & Animation

### Framer Motion
- `AnimatePresence` for mount/unmount transitions
- Layout animations (`layout`, `layoutId` shared element transitions)
- Gesture-driven animations (`useMotionValue`, `useTransform`, `useDrag`)
- Stagger children, orchestration (`transition.staggerChildren`)
- `useScroll`, `useSpring` for physics-based feel
- Variants system for state-driven animation trees

### React Native Animation Stack
- `Animated` API (basic, `useNativeDriver: true` always)
- `react-native-reanimated` — worklet-based, runs on UI thread
- `react-native-gesture-handler` — native gesture recognition
- `Lottie` — After Effects → JSON → native playback
- Shared element transitions with `react-navigation-shared-element`
- Skeleton loading animations

### Motion Design Principles
- Easing curves: ease-in, ease-out, spring, custom bezier
- Duration budget per interaction type (navigation: 300ms, micro: 150ms)
- Animation communicates — direction, hierarchy, causality
- Never animate for the sake of it; every motion has semantic meaning
- Reduced motion accessibility (`prefers-reduced-motion`)

---

## 3. App Icon & Branding

### App Icon Design
- iOS: 1024×1024 source, no transparency, rounded by system
- Android: Adaptive icon (foreground + background layer, 108dp with safe zone at 72dp)
- Icon communicates the app in <1 second glance
- Avoid text in icon (too small to read on home screen)
- Test on real home screens (dark/light wallpapers)
- Consistency with brand mark but optimized for small scale
- A/B test icon variants before launch (TestFlight, Play Store experiments)

### Brand System
- Logo variants: full, wordmark, icon-only, monochrome
- Color palette with semantic tokens (primary, secondary, surface, error, success)
- Typography scale: display, heading, body, label, caption
- Iconography style (stroke weight, corner radius, fill vs. outline)
- Illustration style guide
- Motion personality guide (snappy vs. fluid vs. playful)

---

## 4. Canvas Design Tools

### Figma (Primary)
- Auto Layout (responsive components, fill/hug/fixed)
- Component library architecture (atoms → molecules → organisms)
- Variables & Design Tokens (color, typography, spacing)
- Prototyping with smart animate
- Dev Mode — inspecting specs, extracting code snippets
- Figma plugins: Stark (a11y), Content Reel, Iconify, Tokens Studio

### Supplementary Tools
- **Sketch** — legacy iOS design, symbol libraries
- **Adobe Illustrator** — vector assets, icon sets, SVG export
- **Framer (canvas)** — interactive prototype code-export
- **Principle / Protopie** — high-fidelity interaction prototyping
- **Rotato / ScreenSnapAI** — app store screenshot mockups
- **Canva** — quick marketing assets

---

## 5. Testing & Quality Assurance

### Playwright (E2E Testing)
- Browser automation for React Native Web targets
- `page.goto`, `locator`, `expect(locator).toBeVisible()`
- Screenshot comparison (`toMatchSnapshot`)
- Mobile viewport emulation (`devices['iPhone 15']`)
- Network interception (`page.route`) for API mocking
- CI integration — run on every PR
- Visual regression testing with Percy / Argos

### React Native Testing
- **Jest** — unit tests for utilities, context, hooks
- **React Native Testing Library** — component render + user-event
- **Detox** — E2E on real iOS/Android simulators
- **Maestro** — mobile UI testing with YAML flows (simpler than Detox)

### Quality Gates
- TypeScript strict mode — zero `any`
- ESLint + Prettier (enforced in CI)
- Husky pre-commit hooks
- Lighthouse / Expo Doctor checks
- Bundle size monitoring
- Crash-free rate monitoring (Sentry / Firebase Crashlytics)

### Accessibility (a11y) Testing
- Screen reader testing: VoiceOver (iOS), TalkBack (Android)
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- Touch target size ≥ 44×44pt
- `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` on all interactive elements
- axe-core / Stark Figma plugin for early detection

---

## 6. App Store Optimization (ASO)

### ASO Audit
- Keyword research: volume, difficulty, relevance triangle
- Title (30 chars iOS / 50 chars Android) — lead keyword in first word
- Subtitle (30 chars iOS) — secondary keyword cluster
- Keyword field (100 chars iOS, comma-separated, no spaces, no repeated words)
- Short description (80 chars Android) — hook + keyword
- Long description — narrative, bullet benefits, keyword density ~2-3%
- Localization: translate + transcreate for each market
- Competitor gap analysis — rank tracking over time

### App Store Screenshots & Preview Video
- Screenshots sell the app — design them as ad creatives
- Device frames + lifestyle/context imagery
- Headline overlay on each screenshot (benefit, not feature)
- First screenshot = highest impact (above the fold)
- Preview video: first 3 seconds decide watch-through
- Localized screenshots for key markets
- Tools: Rotato, AppFollow, MobileAction, AppTweak

### Ratings & Reviews Strategy
- In-app review prompt timing (after positive event, not on launch)
- `SKStoreReviewController.requestReview()` (iOS) — max 3 prompts/year
- Reply to every 1-2 star review within 24h
- Monitor review sentiment for product insights

---

## 7. Apple Search Ads (ASA)

### Campaign Structure
- Search Match (auto, discovery) → find new keywords
- Exact Match campaigns (harvested from Search Match) → scale winners
- Brand campaigns — protect your brand name
- Competitor campaigns — bid on rival brand keywords
- Discovery → Exact pipeline (weekly keyword harvest)

### Bidding & Optimization
- CPT (Cost Per Tap) bidding strategy
- TTR (Tap-Through Rate) — target > 5%
- CR (Conversion Rate) — track install rate post-tap
- CPA (Cost Per Acquisition) — optimize toward goal metric
- Dayparting — pause low-converting hours
- Audience refinement: new vs. returning, age, gender

### Creative Sets
- Custom Product Pages (CPP) for ASA — match ad to landing page
- A/B test screenshots tied to keyword intent
- Seasonality creative swaps (holidays, events)

---

## 8. App Store Preflight & Submission

### App Store Preflight (iOS)
- Xcode Organizer → Validate App (catches most rejections pre-submission)
- Privacy manifest (`PrivacyInfo.xcprivacy`) — declare all data APIs used
- Required reasons API compliance (file timestamps, UserDefaults, etc.)
- App Privacy nutrition label (App Store Connect) — accurate data practices
- Export compliance (encryption declaration)
- IDFA/ATT — `AppTrackingTransparency` framework, usage string in Info.plist
- Age rating questionnaire
- In-app purchase setup and sandbox testing

### Google Play Preflight
- Target API level compliance (latest - 1 at minimum)
- 64-bit support
- Play App Signing enrolled
- Data safety form (equivalent to Apple Privacy label)
- Content rating questionnaire (IARC)
- Permissions declaration — justify each dangerous permission

### Common Rejection Reasons to Pre-empt
- Broken links or placeholder content
- Login required without test credentials provided
- Crashes on review device (test on oldest supported OS)
- Misleading screenshots or metadata
- Missing privacy policy URL
- Incomplete in-app purchase implementation

### Release Strategy
- Phased rollout: 1% → 5% → 20% → 50% → 100% over 7 days
- TestFlight / Internal Testing → External Beta → Production
- Staged rollout pause triggers (crash rate spike, negative review spike)
- Release notes written for humans, not bots

---

## 9. Performance Engineering

### React Native Performance
- JS thread vs. UI thread — keep animations off JS thread (`useNativeDriver`)
- `FlatList` vs. `ScrollView` — always `FlatList` for dynamic lists
- `memo`, `useMemo`, `useCallback` — measure before applying
- Hermes engine — enabled by default in new Expo projects
- Bundle splitting — lazy load heavy screens
- Image optimization: `expo-image` (caching, blurhash placeholders)
- `react-native-fast-image` for aggressive caching

### App Launch Performance
- Cold start < 2 seconds (measure with Instruments / Android Profiler)
- Splash screen → first meaningful paint optimization
- Defer non-critical initialization after first render
- Pre-warm Mapbox tiles on startup

### Network Performance
- React Query caching strategy (staleTime, gcTime)
- Optimistic updates for perceived speed
- Request deduplication
- Offline-first with AsyncStorage fallback
- Image CDN + WebP format

---

## 10. Backend & API Engineering

### REST API Design
- OpenAPI 3.1 spec-first development
- RESTful resource naming (`/rides`, `/drivers`, not `/getRide`)
- Versioning strategy (`/api/v1/`)
- Pagination (cursor-based for feeds, offset for admin)
- Error response schema (code, message, details)
- Rate limiting & throttling

### Real-time Architecture
- WebSockets (Socket.io) for live driver location updates
- Server-Sent Events (SSE) for ride status changes
- Polling fallback for environments blocking WS

### Authentication & Security
- JWT with refresh token rotation
- OAuth 2.0 / social login (Google, Apple Sign-In)
- Phone/OTP auth (Twilio, Africa's Talking for Rwanda)
- Row-level security in PostgreSQL
- HTTPS everywhere, certificate pinning in production

### Database (PostgreSQL + Drizzle)
- Schema design: users, drivers, rides, locations, payments
- Indexes on hot query paths (rider_id, driver_id, status, created_at)
- PostGIS extension for geospatial queries (find nearby drivers)
- Connection pooling (PgBouncer)
- Migrations — never destructive without backup

---

## 11. DevOps & CI/CD

### Continuous Integration
- GitHub Actions — lint, typecheck, test on every PR
- Expo EAS Build — cloud builds for iOS/Android
- EAS Submit — automated App Store / Play Store submissions
- Branch strategy: `main` (production), `develop` (staging), feature branches

### Monitoring & Observability
- Sentry — crash reporting, performance traces, session replay
- PostHog / Mixpanel — product analytics, funnel analysis
- Pino structured logging (backend)
- Uptime monitoring (Better Uptime, Checkly)
- Alerting on crash-free rate drop or p95 latency spike

### Deployment
- EAS Update (OTA updates) for JS-only changes — no App Store review cycle
- Blue/green deployment for API server
- Database migration strategy (zero-downtime)
- Environment management: local, staging, production

---

## 12. Growth & Product Analytics

### Product Analytics
- Event taxonomy design (screen_view, button_tap, ride_requested, etc.)
- Funnel analysis: install → register → first ride → retained
- Retention cohorts (D1, D7, D30)
- Session recording for UX debugging
- A/B testing framework (Statsig, LaunchDarkly, or Expo's built-in)

### Push Notifications
- Permission prompt timing (after value delivered, not on first launch)
- Segmentation: riders vs. drivers, active vs. lapsed
- Ride event notifications (driver found, driver arriving, ride complete)
- Re-engagement campaigns with deep links
- Expo Push Notifications → APNs / FCM

---

## 13. Localization & Internationalization (i18n)

- `i18next` / `react-i18next` — translation management
- Locale detection from device settings
- Pluralization rules (English vs. French vs. Kinyarwanda)
- Date/time formatting per locale (`Intl.DateTimeFormat`)
- Currency formatting (RWF — Rwandan Franc)
- RTL layout support (`I18nManager.forceRTL`)
- Translation pipeline: export → translate (Lokalise/Phrase) → import

---

## 14. Maps & Geolocation

### Mapbox
- `mapbox-gl-js` / `@rnmapbox/maps` for React Native
- Directions API — turn-by-turn routing
- Isochrone API — reachability zones
- Geocoding API — address → coordinates
- Custom map styles (Mapbox Studio)
- Offline tiles for low-connectivity markets

### Location Engineering
- `expo-location` — foreground + background permissions
- Background location for driver tracking (significant challenge on iOS)
- Geofencing — detect arrival at pickup/dropoff
- Location smoothing — filter GPS noise with Kalman filter
- Battery impact — adaptive polling rate based on speed

---

## Skill Maturity Levels

| Level | Definition |
|---|---|
| **Aware** | Know it exists, understand its purpose |
| **Practitioner** | Can apply it with reference to docs |
| **Proficient** | Apply fluently without docs, handle edge cases |
| **Expert** | Teach it, design systems around it, spot non-obvious failure modes |

Use this grid to self-assess across all domains above and prioritize learning investments.

---

*Last updated: 2026-05-27*
