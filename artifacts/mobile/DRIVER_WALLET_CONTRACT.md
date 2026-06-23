# Driver Earnings, Wallet, Ratings, and Payout Contract

This contract prepares the mobile app for future backend wallet and payout integration. It does not implement real payouts, payment collection, or backend calls. Until a backend becomes authoritative, mobile earnings screens are activity summaries only, not an official payout ledger.

## Authority Model

Wallet, payout, earning, rating, and performance records carry an `authority` field:

- `local_prototype`: data is useful for local UI and product validation only.
- `backend`: data was created or confirmed by the backend and can be treated as authoritative.

Production payout decisions must use `backend` records only. Local prototype records must never trigger a real transfer.

## Earnings From Completed Rides

A driver earning is created from a completed ride after the backend confirms the ride is terminal and payable.

Required source facts:

- `rideId`
- `driverId`
- `customerId`
- final `agreedFare`
- completion timestamp
- fare collection method
- idempotency key

The future backend should create a `DriverEarningLedgerEntry` using the idempotency key:

```text
driver-earning:completed-ride:{rideId}
```

This guarantees that one completed ride creates one earning entry, even if completion events are retried by the app, network, or backend workers.

## One Completed Ride, One Earning Entry

The earning ledger must enforce uniqueness by completed ride ID and idempotency key. Duplicate completion events should return the existing earning entry instead of creating a second entry.

Mobile must not infer payout eligibility from local ride history alone. Local history can display activity, but the backend ledger decides whether an earning is pending, available, paid, failed, or reversed.

## Cash-Collected vs Platform-Collected Rides

`cash_collected` means the driver collected the fare directly from the customer. It can appear in activity totals, but it is not money owed by the platform to the driver.

`platform_collected` means the platform collected the customer payment and may owe the driver a payout after fees, holds, and settlement checks.

Wallet payable Rides should only include platform-collected net earnings. Cash-collected rides can be shown as activity or income history, but not as an available payout Rides.

## Rides States

`DriverWalletBalance` separates payout-relevant balances:

- `pendingRwf`: platform-collected earnings recorded but not yet available.
- `availableRwf`: platform-collected earnings eligible for payout.
- `processingRwf`: earnings attached to a payout request currently being processed.
- `paidRwf`: earnings successfully paid to the driver.
- `failedRwf`: payout attempt failed and needs retry, review, or return to available.
- `reversedRwf`: earnings reversed after dispute, correction, refund, fraud review, or manual adjustment.
- `cashCollectedRwf`: driver-collected cash activity, not platform payout liability.
- `activityGrossRwf`: gross fare activity across included entries.

## Payout Lifecycle

Payout lifecycle uses `DriverPayoutStatus`:

1. `pending`: earning exists but cannot be paid yet.
2. `available`: earning passed availability rules and can be included in a payout request.
3. `processing`: payout request has been submitted to the payout provider.
4. `paid`: provider confirmed successful payment.
5. `failed`: provider rejected or failed the payout.
6. `reversed`: previously payable or paid value was reversed by backend decision.

The mobile app may display these states once backend data exists, but it must not simulate transfers or create fake payout history.

## Payout Methods

`DriverPayoutMethod` represents a backend-verifiable payout destination such as MTN MoMo or Airtel Money. A payout method must be verified before real payouts can be requested.

Current mobile onboarding only captures payout destination information for future use. It does not verify the account and does not enable payout.

## Rating Persistence Rules

`DriverRating` represents a persisted rating for a completed ride. The backend should enforce:

- one rating per completed ride per customer
- rating only after ride completion
- stars must be 1 through 5
- optional review text may require moderation
- updates, hiding, or moderation must preserve audit history

Until ratings are persisted by the backend, mobile can collect feedback for prototype UX but must not claim ratings are averaged or affect driver standing.

## Performance Metrics

`DriverPerformanceMetrics` provides backend-ready windows for:

- today
- 7 days
- 30 days
- lifetime

Metrics should be computed from backend ride events, not mutable local profile counters. Acceptance rate should count accepted and declined ride decisions within the selected window. Completion rate should count completed rides against accepted rides once the backend defines cancellation and no-show rules.

## Backend Dependencies

Future integration needs:

- authoritative ride completion events
- idempotent earning creation
- fare collection method on each completed ride
- platform fee and net earning calculation
- wallet Rides service
- payout method verification
- payout provider integration
- payout request lifecycle
- rating persistence and moderation
- performance metrics aggregation
- admin tooling for reversals, disputes, and payout support
