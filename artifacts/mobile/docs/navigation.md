# Navigation Rules

## Route Tree

- Auth
  - `/(auth)/welcome`
  - `/(auth)/login`
  - `/(auth)/register`
  - `/(auth)/otp`
- Customer tabs
  - `/(tabs)`
- Customer stack
  - `/location-search`
  - `/saved-place-selector`
  - `/map-picker`
  - `/ride-detail`
  - `/searching`
  - `/negotiation`
  - `/ride`
  - `/rating`
- Driver tabs
  - `/(driver)`
- Driver stack
  - `/driver-onboarding`
  - `/driver-submission-confirmation`
  - `/driver-packages`
  - `/driver-package-payment`
  - `/driver-documents`
  - `/driver-vehicles`
  - `/driver-vehicle-details`
  - `/driver-add-vehicle`
  - `/driver-navigate`
  - `/driver-ride-complete`

## Ownership Rules

- `CustomerHome` owns the shell only: map, header, current location, vehicle selection, route preview, and launchers.
- `LocationSearch` owns search, suggestions, saved locations, and launching downstream routes.
- `MapPicker` owns map picking, drag state, reverse geocoding, and confirm/cancel.
- `SavedPlaceSelector` owns add/edit drafts, consume-once map results, and persistence handoff.
- `RideContext` owns ride draft state.
- `SavedLocationsContext` owns saved places.
- `MapPickerContext` owns only the transient, session-scoped picker result.
- Driver screens own their own driver-specific flows.

## Navigation Method Rules

- `push` means go deeper into a flow.
- `back` means close a temporary screen or cancel an in-progress step.
- `replace` is reserved for boundaries and completion points:
  - auth success
  - logout
  - role switch
  - completed onboarding
  - completed rating or ride flow
  - canonical redirect screens

## Central Navigation Helpers

Use `navigation/navigationPolicy.ts` for explicit helpers:

- `pushFlowScreen`
- `replaceFlowScreen`
- `replaceAuthBoundary`
- `navigateToCustomerHomeAfterCompletion`
- `navigateToDriverHomeAfterCompletion`
- `closeTemporaryScreen`

These helpers keep replacement behavior reviewable.

## Forbidden Patterns

- No native `Modal` plus route push for full-screen flows.
- No route-param handoff hacks for map picker.
- No raw `replace` in feature screens when a named helper exists.
- No CustomerHome-owned picker/search overlays.

## Scale Rationale

- Predictable stack behavior.
- Easier testing and deep linking.
- Fewer stale state bugs.
- Clearer navigation ownership boundaries.
- Lower risk as driver and customer usage scales.
