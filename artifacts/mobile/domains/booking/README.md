# Booking Domain

Owns customer booking draft state.

Owns:
- pickup draft
- destination draft
- selected vehicle
- booking flow status

Must not own:
- driver verification
- saved-place persistence
- ride lifecycle truth

Current source files outside this domain:
- `state/bookingStore.ts`
- `context/ride/RideProvider.tsx`
- `app/location-search.tsx`

Future migration plan:
- migrate booking rules into `domains/booking`
- keep draft state in `bookingStore`
- keep backend writes behind `BookingRepository`

Ownership:
- repository: `BookingRepository`
- store: `bookingStore`
- query: future fare/estimate hooks
- events: booking-created, booking-cancelled projections
