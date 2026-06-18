# State & Backend Audit — what's real vs. on-device

The goal: every number and action reflects the **backend** (Postgres/Redis), not
on-device prototype state. This documents how things are stored, how state &
login work, what's still local, and the role-by-role plan to make it all real.

---

## 0. Case study: "34 rides → 0"

- The **real** backend value for pac (`+250791377973`) is `total_rides = 2`
  (2 completed rides on the current DB). The whole `rides` table is 2 completed
  + 1 cancelled.
- The "34" was **never backend data** — it was the app computing stats *locally*
  from on-device ride history. And we ran `docker compose down -v` for clean
  testing, which **wiped the DB**, so any prior history is gone.
- Some driver screens still show that **local activity summary** (derived from
  the *customer* ride history — the wrong, empty dataset for a driver), so they
  read 0 even though the backend says 2. **That's the bug class to kill.**

This single case is the whole project in miniature: prefer the backend number,
delete the local one.

---

## 1. Where things are stored (3 layers)

### Postgres (durable source of truth)
`users`, `driver_profiles`, `rides`, `ride_events`, `negotiation_rounds`,
`wallets` + `wallet_transactions`, `ride_packages` + `driver_ride_credits`,
`bonus_*`, `admin_accounts` + `admin_roles`, `device_sessions`, `landmarks`,
`pricing_configs`, support `tickets`/`incidents`/`inbox`/`reports`.

### Redis (hot, ephemeral)
- Driver presence/matching: `drivers:geo:<TYPE>` (GEO index), `driver:<id>:state`,
  `driver:location:<id>` (120s TTL), `driver:location:<id>:history`,
  `driver:<id>:active_ride`, `driver:<id>:smoothed_location`.
- Ride runtime: `ride:state:<id>`, `ride:driver_location:<id>`,
  `ride:credit_charged:<id>` (idempotency).
- Auth/sessions: `session:<userId>:<jti>`, OTP attempt/rate-limit counters.
- Fraud: `driver:gps_anomalies:<id>:session_count`, daily cancel counters.

### On-device (mobile, AsyncStorage/SecureStore — `persistence/`)
`authPersistence` (user, driver profile cache), `secureStorage` (JWT tokens),
`driverEntitlementPersistence` (packages/credits — **local authority today**),
`driverRatingPersistence` (**local only**), `ride history` (AsyncStorage),
`savedLocations`, `payment`, `driverOnboarding` (draft), `profile` image.

> Rule we want: on-device storage is a **cache + offline buffer**, never the
> authority. The backend is the authority.

---

## 2. How state is managed (mobile)

- **`AuthContext`** — user + driver profile + login/logout/updateUser. Now hydrates
  the driver profile from `GET /driver/profile` on login *and* app launch, and
  `updateUser` persists to `PUT /customer/profile`. ✅ (just fixed)
- **`RideProvider`** (`context/ride/`) — the active ride + history. Active ride is
  recovered from `GET /…/rides/active`; history is in AsyncStorage and partially
  synced from `GET /customer/rides`. `rideMatching.ts` still has prototype logic.
- **`DriverEntitlementContext`** — packages & credits. **Local authority** via
  `domain/driverRidePackages.ts` — does NOT read `GET /driver/credits`. ❌
- Per-screen `useState` + the `persistence/` layer for caching.

---

## 3. How login/auth works

1. `POST /auth/register` → OTP (dev echoes `dev_otp`).
2. `POST /auth/verify-otp` → `{ access_token, refresh_token, role_state, user_id }`;
   tokens saved in SecureStore.
3. App routes by `role_state`; for driver roles it calls `GET /driver/profile`
   to restore rider status (no re-onboarding).
4. **JWT carries the role** (`role_state`) — frozen at issue time. Role changes
   (apply → PENDING, approve → ACTIVE) only reach the app after a **token
   refresh** (wired at apply + on the in-review screen).
5. `api.ts` interceptor: attaches the token, proactively refreshes near expiry,
   retries once on 401. Logout revokes the backend session + marks driver offline.

---

## 4. Dev mode (what's relaxed, and the flags)

| Flag (`.env`) | Effect in dev | Must be in prod |
|---|---|---|
| `ENV=development` | echoes `dev_otp`, disables device-collision auto-suspend, **skips GPS plausibility**, **skips admin 2FA** | `production` |
| `DEV_AUTO_APPROVE_DRIVERS=false` | manual admin approval (we want this) | false |
| `DEV_SKIP_GEOFENCE=true` | accept arrive/start/complete without being at the pin | false |
| `PAYMENTS_ENABLED=true` | simulate wallet top-up/buy without MoMo | false until MoMo |

Free-trial credit auto-grants in dev when a driver accepts with no credits.

---

## 5. Endpoints

Full request/response reference is in **`Rides-api/API_REFERENCE.md`** (auth,
customer, driver, wallet, packages, bonuses, locations, uploads, WebSocket
events, error codes). Use it as the contract.

---

## 6. Audit (today: weak)

- There IS an append-only event log (`ride_events`) + an analytics stream for
  ride lifecycle. Good for rides.
- There is **no admin action audit** (who approved/suspended/changed pricing).
  Planned in `Rides-api/ADMIN_RBAC_PLAN.md` (`admin_audit_log`). Build it with the
  two-role admin work.

---

## 7. Role-by-role: real vs local (the fix list)

### Customer
| Area | Status | Fix |
|---|---|---|
| Register / OTP / login | ✅ real | — |
| Profile (name/email) | ✅ real (just wired) | — |
| Nearby drivers, fare estimate, book, cancel, negotiate | ✅ real | — |
| Live tracking (WS) | ✅ real | — |
| Saved locations | ✅ real (`/users/me/saved-locations`) | verify all CRUD buttons call it |
| Ride history | ⚠️ local + partial sync | make `GET /customer/rides` the source; AsyncStorage = cache only |
| Wallet | ⚠️ gated/dev | finish on MoMo |

### Driver (rider)
| Area | Status | Fix |
|---|---|---|
| Apply + documents | ⚠️ apply ✅, **documents not wired** (no storage) | wire `/uploads/presigned-url` → `/driver/documents` |
| Approval restore on login/launch | ✅ real (just wired) | — |
| Online/offline, location, accept/decline/lifecycle | ✅ real | — |
| **Stats (total rides, earnings, acceptance)** | ❌ **shows local activity summary in places** | read ONLY `getDriverStats`/`getDailyEarnings`; delete the local summary |
| **Packages / credits** | ❌ **local authority** (`driverRidePackages.ts`) | read `GET /driver/credits` + `/driver/packages`; buy via `/driver/packages/purchase`; drop local entitlement |
| **Ratings** | ❌ **local only** (no backend) | add a backend rating endpoint, then wire |
| Earnings/payout | ⚠️ earnings real, payout dev | finish on MoMo |

### Admin (web)
| Area | Status | Fix |
|---|---|---|
| Login, approve/reject drivers, list customers/drivers/rides | ✅ real | — |
| Packages/pricing/bonuses CRUD | ✅ real | — |
| **RBAC enforcement** | ❌ single `ADMIN` gate, roles cosmetic | two-role enforcement (see ADMIN_RBAC_PLAN) |
| **Admin audit log** | ❌ none | build `admin_audit_log` |
| Insights | ⚠️ some placeholder | real aggregates + cached rollup |

---

## 8. Suggested fix order (role by role)

1. **Driver stats → 100% backend** (kills the "0 rides" class). Delete the local
   activity summary; every driver number reads `getDriverStats`/`getDailyEarnings`.
2. **Driver packages/credits → backend** (`/driver/credits`, `/driver/packages`,
   purchase). Retire `domain/driverRidePackages.ts` as authority.
3. **Driver documents** upload flow (needs storage env + presign).
4. **Customer ride history → backend-sourced.**
5. **Ratings** backend endpoint + wiring.
6. **Admin RBAC + audit log** (two-role plan).
7. **MoMo** (wallet top-up/withdraw/payout) — unblocks wallet + real payouts.

Each step: find every button/screen in that area, point it at the real endpoint,
delete the local-authority copy, keep on-device only as a cache.
