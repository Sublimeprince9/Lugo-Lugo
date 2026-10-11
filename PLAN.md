# Lugo Lugo: MVP Development Plan

> Reusable, QR-driven event-map PWA with a 16-bit pixel-art map and a "stall passport" game layer.
> First venue: UMA Showgrounds, Lugogo, Kampala. Built multi-event from day one.
> Companion to the v2.0 proposal. This file is the build spec: work top to bottom.

---

## 0. How to use this file

- Work in order. Each milestone has a checklist and an **exit gate**. Do not start the next milestone until the gate passes.
- Gates marked **KILL** are stop/redirect decisions, not formalities.
- Anything marked `TODO(decision)` needs a choice from you before coding that part.
- Keep this file in the repo root as `PLAN.md` and tick boxes as you go.

---

## 1. MVP definition

### 1.1 In scope (MVP)

| # | Capability | Notes |
| --- | --- | --- |
| 1 | Pixel-art event map, pan and pinch-zoom | Static map assets per event, cached offline |
| 2 | Stall markers + sector filter chips | Luxury, Food, Drinks, Science, Farming, Tech |
| 3 | Vendor drawer | Media, description, price list, "Chat on WhatsApp" deep link |
| 4 | QR stall check-in | Scan stall QR, server validates, awards coins/reward |
| 5 | Coins + stalls-visited progress ("fog of war" per zone) | Tied to check-ins only |
| 6 | Leaderboard | Stalls visited, coins |
| 7 | Vendor gift/voucher claim | Limited quantity; visitor checks in and meets any configured eligibility rules |
| 8 | Vendor onboarding and approved stall profiles | Vendor contact, website, photos, map placement; organizer reviews before publishing |
| 9 | Exhibitor dashboard | Taps, check-ins, WhatsApp clicks, claims |
| 10 | Admin panel | Create event, import stalls, assign vendors, review profiles, generate QR sheets |
| 11 | Installable PWA, offline map shell | Works on slow 3G |

### 1.2 Out of scope (post-MVP)

- Live GPS avatar, A* wayfinding, indoor positioning
- GPS-based stall navigation for the initial release; optional outdoor stall coordinates may supplement, but never replace, event map placement
- Payments inside the app (exhibitor billing is manual/invoice at first)
- Native apps
- Chat, social features, friends
- Multi-language (English only; keep strings in a dictionary file so Luganda/Swahili is easy later)

### 1.3 Success metrics for the MVP pilot

Set the target numbers with the organizer before the pilot. Track:

- Activation: visitors who scan the entrance QR and open the map
- Engagement: check-ins per active user
- Exhibitor value: taps, check-ins, WhatsApp clicks per stall
- Reliability: error rate, p95 load time on 3G, claim-abuse incidents

---

## 2. Milestone overview

| Milestone | Goal | Duration (solo, estimate) | Gate |
| --- | --- | --- | --- |
| M0 | Validation: organizer access, exhibitor demand, GPS test | 1 to 2 weeks | **KILL** gate |
| M1 | Project scaffold, schema, map rendering spike | 1 week | Renderer chosen, map renders on a low-end phone |
| M2 | Map, filters, vendor drawer, offline | 1 to 2 weeks | Usable browse-only app |
| M3 | QR check-in, coins, leaderboard, verification | 1 to 2 weeks | End-to-end reward loop works, abuse tests pass |
| M4 | Exhibitor dashboard + admin tools | 1 week | Exhibitor can see live stats; admin can set up an event in under 1 hour |
| M5 | Hardening, load test, pilot launch | 1 week | Pilot go/no-go checklist passes |

Durations are estimates, not commitments. Re-estimate after M1.

---

## 3. M0: Validation (before writing app code)

### 3.1 Checklist

- [ ] Meet UMA or the fair organizer. Request: venue floor plan (hall and field layouts), exhibitor list/stall numbers format, permission to place QR standees, a named contact.
- [ ] Get a **written** yes (email is fine) for a pilot.
- [ ] Build a clickable prototype (Figma or a throwaway HTML page) showing map, filter, vendor drawer, check-in reward.
- [ ] Pitch at least 15 exhibitors. Ask for a paid commitment (deposit or signed letter of intent) for a featured pin or sponsored drop.
- [ ] GPS test: walk Main Hall, Jubilee Hall, Multi-Purpose Hall and one outdoor field with 3 to 4 different phones. Log accuracy values from `navigator.geolocation` (use the logger in Appendix D).
- [ ] Verify the attendance figure with the organizer (the original proposal quoted 300,000+, unconfirmed).

### 3.2 KILL criteria

| Test | Pass | If it fails |
| --- | --- | --- |
| Organizer access | Floor plan + written yes | Stop UMA plan. Pivot to a smaller event as the first customer. |
| Exhibitor demand | 10 or more paid/LOI commitments | Do not build. Rework the offer or the target. |
| GPS | Median error under 10 m outdoors | GPS stays out of rewards (already the default). Drop the avatar from the roadmap if outdoor error is also poor. |
| Pilot venue | A live event within reach to test on before the next fair | Run the pilot at any smaller expo, campus fair, or market day. |

---

## 4. Tech stack (MVP)

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + React + TypeScript | One codebase for PWA, API routes, admin |
| Styling | Tailwind CSS | Fast mobile UI |
| Map rendering | PixiJS v8 + `pixi-viewport` (pan/zoom/pinch) | Keeps the pixel-art identity, light on assets |
| Fallback renderer | Leaflet with `CRS.Simple` and a pre-rendered map image | Use if the M1 spike shows PixiJS is too heavy on low-end Android |
| Backend | Supabase (Postgres, Auth, Storage, RLS) | Fast to ship, row-level security |
| QR scanning | `html5-qrcode` or the browser `BarcodeDetector` API with fallback | Scans in-browser, no native app |
| QR signing | HMAC-SHA256, server-side | Prevents forged/shared codes |
| PWA | `@serwist/next` (or `next-pwa`) | Service worker, offline shell |
| Validation | Zod | Shared client/server schemas |
| Tests | Vitest (unit), Playwright (e2e) | |
| Hosting | Vercel | Edge CDN, easy previews |
| Analytics | Own `events` table + Supabase views | Exhibitor stats without a third-party tool |

`TODO(decision)`: OTP/SMS provider for phone verification (needs a provider that delivers reliably in Uganda; compare cost and delivery rate before choosing). Alternative for MVP: require phone verification only for voucher/prize claims, not for coins.

---

## 5. Repository layout

```
lugo-lugo/
├── PLAN.md
├── README.md
├── .env.example
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   └── maps/<event-slug>/        # tilemap atlas + map.json per event
├── src/
│   ├── app/
│   │   ├── (visitor)/
│   │   │   ├── e/[eventSlug]/page.tsx           # map screen
│   │   │   ├── e/[eventSlug]/leaderboard/page.tsx
│   │   │   ├── e/[eventSlug]/me/page.tsx        # profile, coins, vouchers
│   │   │   └── scan/page.tsx                    # QR scanner
│   │   ├── (exhibitor)/dashboard/page.tsx
│   │   ├── (admin)/admin/...                    # events, stalls, QR sheets
│   │   └── api/
│   │       ├── checkin/route.ts
│   │       ├── claim/route.ts
│   │       ├── track/route.ts                   # tap / whatsapp click events
│   │       └── leaderboard/route.ts
│   ├── components/
│   │   ├── map/ (MapCanvas, StallMarker, FilterBar)
│   │   ├── drawer/ (VendorDrawer)
│   │   ├── scan/ (Scanner)
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase/ (client.ts, server.ts)
│   │   ├── qr.ts                # sign/verify tokens
│   │   ├── rate-limit.ts
│   │   ├── geo.ts               # optional, post-MVP
│   │   └── i18n/en.ts
│   ├── types/
│   └── styles/
├── supabase/
│   ├── migrations/              # SQL files, numbered
│   ├── seed.sql
│   └── config.toml
├── scripts/
│   ├── import-stalls.ts         # CSV -> stalls
│   ├── generate-qr-sheet.ts     # PDF of stall QR codes
│   └── build-map-assets.ts      # floor plan -> tile atlas + map.json
└── tests/
    ├── unit/
    └── e2e/
```

---

## 6. Setup (day 1 commands)

```bash
# 1. Scaffold
npx create-next-app@latest lugo-lugo --typescript --tailwind --app --src-dir --eslint
cd lugo-lugo

# 2. Dependencies
npm i @supabase/supabase-js @supabase/ssr zod pixi.js pixi-viewport html5-qrcode framer-motion qrcode
npm i -D vitest @playwright/test supabase tsx @types/qrcode

# 3. Supabase local dev
npx supabase init
npx supabase start          # needs Docker
npx supabase migration new init_schema

# 4. Env
cp .env.example .env.local
```

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never exposed to the client
QR_SIGNING_SECRET=                # 32+ random bytes, server only
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 7. Data model

Put this in `supabase/migrations/0001_init_schema.sql`.

```sql
create extension if not exists "pgcrypto";

-- Events (multi-event from day one)
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  map_config jsonb not null default '{}'::jsonb,  -- width, height, tile size, asset paths, zones
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Zones (halls/fields) used for fog-of-war progress
create table zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  map_bounds jsonb not null,           -- {x, y, w, h} in map pixels
  unique (event_id, name)
);

-- Stalls
create table stalls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  zone_id uuid references zones(id),
  stall_number text not null,
  title text not null,
  category text not null check (category in ('Luxury','Food','Drinks','Science','Farming','Tech','Other')),
  description text,
  whatsapp_number text,                -- E.164, e.g. +256...
  map_x int not null,
  map_y int not null,
  is_featured boolean not null default false,
  media jsonb not null default '[]'::jsonb,
  products jsonb not null default '[]'::jsonb,
  qr_secret text not null default encode(gen_random_bytes(16), 'hex'),
  owner_id uuid references auth.users(id),  -- exhibitor login
  unique (event_id, stall_number)
);
create index on stalls (event_id, category);

-- Visitor profiles (anonymous auth first, phone verified later)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Explorer',
  phone_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Per-event progress
create table event_progress (
  profile_id uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  coins int not null default 0,
  stalls_visited int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, event_id)
);

-- Check-ins (one per profile per stall)
create table checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  stall_id uuid not null references stalls(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, stall_id)
);

-- Rewards defined by exhibitors/admin
create table rewards (
  id uuid primary key default gen_random_uuid(),
  stall_id uuid not null references stalls(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('coins','voucher','prize')),
  coin_value int not null default 0,
  claim_limit int not null default 100,
  claims_count int not null default 0,
  requires_verified_phone boolean not null default false,
  is_active boolean not null default true
);

-- Claims
create table claims (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  code text not null default encode(gen_random_bytes(6), 'hex'),  -- shown at the stall
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reward_id, profile_id)
);

-- Analytics events for the exhibitor dashboard
create table track_events (
  id bigint generated always as identity primary key,
  event_id uuid not null references events(id) on delete cascade,
  stall_id uuid references stalls(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('stall_tap','whatsapp_click','checkin','claim','filter_use')),
  created_at timestamptz not null default now()
);
create index on track_events (stall_id, kind, created_at);
```

### 7.1 Row-level security (summary of rules)

- Enable RLS on every table.
- **Public read:** published `events`, `zones`, `stalls` (excluding `qr_secret`; expose via a view or a column-level select), active `rewards`.
- **Profiles / progress / claims:** a user reads and writes only their own rows. Writes to `checkins`, `event_progress`, and `claims` go through API routes using the service role, never directly from the client.
- **Exhibitors:** read `track_events` and `claims` for stalls where `owner_id = auth.uid()`; update only their own stall's content fields.
- **Admin:** role in `app_metadata`; full access through admin routes only.
- `qr_secret` must never be returned to the client. Make a `stalls_public` view without it.

### 7.2 Leaderboard view

```sql
create view leaderboard as
select p.username, ep.event_id, ep.stalls_visited, ep.coins,
       rank() over (partition by ep.event_id order by ep.stalls_visited desc, ep.coins desc) as rank
from event_progress ep join profiles p on p.id = ep.profile_id;
```

---

## 8. Core logic

### 8.1 QR tokens

Each stall QR encodes a URL: `https://<app>/scan?t=<token>`

Token format: `base64url(stallId).window.base64url(hmac)`

- `window` = the number of 6-hour windows since epoch (QR rotates, so a screenshot posted online dies quickly).
- The server accepts the current and previous window to tolerate boundary cases.
- `hmac = HMAC_SHA256(QR_SIGNING_SECRET + stall.qr_secret, stallId + "." + window)`

```ts
// src/lib/qr.ts
import { createHmac, timingSafeEqual } from "crypto";

const WINDOW_MS = 6 * 60 * 60 * 1000;
const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function signToken(stallId: string, stallSecret: string, now = Date.now()) {
  const win = Math.floor(now / WINDOW_MS);
  const mac = createHmac("sha256", process.env.QR_SIGNING_SECRET! + stallSecret)
    .update(`${stallId}.${win}`).digest("base64url");
  return `${b64(stallId)}.${win}.${mac}`;
}

export function verifyToken(token: string, getSecret: (stallId: string) => string, now = Date.now()) {
  const [idB64, winStr, mac] = token.split(".");
  if (!idB64 || !winStr || !mac) return null;
  const stallId = Buffer.from(idB64, "base64url").toString();
  const win = Number(winStr);
  const current = Math.floor(now / WINDOW_MS);
  if (!Number.isInteger(win) || win < current - 1 || win > current) return null;
  const expected = createHmac("sha256", process.env.QR_SIGNING_SECRET! + getSecret(stallId))
    .update(`${stallId}.${win}`).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? stallId : null;
}
```

Printed QR codes must not change during the event. Resolve this one way:

- **Option A (recommended for MVP):** print a *static* stall code (`/s/<stallId>.<hmac>`) and add the rotating window via a short-lived code the visitor sees on the **exhibitor's screen/dashboard** only for prize claims.
- **Option B:** stall staff open a rotating QR on their phone (dashboard), and visitors scan that.

`TODO(decision)`: choose A or B. A is simpler and fine for coins; B is stronger for high-value prizes. Rotating tokens only make sense with B, so if you pick A, drop the window from the token and rely on one-check-in-per-stall, phone verification, and claim limits.

### 8.2 Check-in endpoint (`POST /api/checkin`)

1. Require an authenticated user (anonymous Supabase auth is fine).
2. Validate the body with Zod: `{ token: string }`.
3. Verify the token, resolve the stall.
4. Rate limit: max 10 check-ins per profile per 10 minutes, and per IP.
5. In one transaction (use a Postgres function / RPC):
   - insert into `checkins` (unique constraint blocks repeats)
   - upsert `event_progress` (increment `stalls_visited`, add reward coins)
   - insert a `track_events` row
6. Return `{ stall, coinsAwarded, stallsVisited, zoneProgress, voucherAvailable }`.

### 8.3 Claim endpoint (`POST /api/claim`)

1. Require a prior check-in at that stall.
2. If `requires_verified_phone`, require `profiles.phone_verified = true`.
3. Atomic increment: `update rewards set claims_count = claims_count + 1 where id = $1 and claims_count < claim_limit returning *`. If no row returned, the reward is sold out.
4. Insert into `claims` (unique per reward and profile).
5. Return a short claim code to show at the stall; exhibitor marks it redeemed from the dashboard.

### 8.4 Fog of war

Progress per zone = visited stalls in that zone ÷ total stalls in that zone. Render uncleared zones with a dim overlay on the map; clear them as the percentage rises. Pure client-side rendering from API data.

---

## 9. Map pipeline

1. **Source:** organizer floor plan (PDF/image). Outdoor outlines may supplement from OpenStreetMap.
2. **Normalize:** pick a fixed map size (for example 2048×2048 logical pixels at 16 px per tile = 128×128 tiles).
3. **Author:** draw the pixel-art map in Tiled (or Aseprite), export a PNG atlas and a `map.json` (tile layers, zone rectangles, stall anchor points).
4. **Import stalls:** CSV with `stall_number,title,category,whatsapp_number,website_url,zone,map_x,map_y` → `scripts/import-stalls.ts`. Map coordinates remain the source of truth for indoor placement.
5. **Optimize:** compress PNGs, keep total initial payload under 2.5 MB, generate a lower-res preview for first paint.
6. **Cache:** service worker precaches the atlas and `map.json` for the event.

Budget the map art as its own work item. It is the largest unknown in M1 and repeats for every new venue.

`TODO(decision)`: draw it yourself, commission a pixel artist, or auto-generate a simplified tilemap from the floor plan for MVP and polish later.

---

## 9.1 Vendor onboarding procedure

Run the first pilot as invite-and-review onboarding: vendors can submit and maintain drafts, but an organizer verifies ownership and publishes each profile. Do not let an unverified signup claim an existing stall number or publish directly.

### Vendor journey

1. Organizer invites a vendor and confirms the event, stall number, and primary contact from the exhibitor list.
2. Vendor signs in using a recoverable vendor account (passwordless email link is the initial recommendation; keep visitor anonymous auth separate).
3. Vendor completes a draft profile: business/display name, category, description, WhatsApp number, optional website, and stall location on the event map.
4. Vendor optionally uploads or takes photos on a phone, confirms permission to publish them, and previews the public listing.
5. Vendor optionally proposes a limited gift/voucher: visitor-facing description and terms, quantity/claim limit, and whether phone verification is required. The offer is not visible or claimable until approved.
6. Organizer reviews vendor ownership, listing details, map location, photo consent/content, and gift terms; returns incomplete submissions or approves/rejects them.
7. Approved listing and offer become public. Generate the signed stall QR only for the verified stall, provide it to the vendor, and record approval/QR issuance.
8. Vendor can request edits later; changes to stall identity, ownership, location, photos, or gift terms return to review when they affect visitor trust or existing claims.

### Implementation decisions and safeguards

- **Identity and ownership:** add explicit vendor accounts and an audited event/stall membership relationship. Use organizer-issued invitations or assignment; never infer ownership from a typed stall number or WhatsApp address.
- **Review lifecycle:** model draft, submitted, needs-changes, approved/published, and rejected states with reviewer, timestamps, and reason. Public map queries must include approved/published records only.
- **Profile fields:** add `website_url`; keep validated phone/WhatsApp separate from the vendor login email. Store photos in a private upload flow with size/type limits, then expose only approved images via public storage paths or controlled image delivery. Vendor photo consent is required.
- **Location:** require a pin/coordinates on the event floor plan (existing `map_x`/`map_y`, scoped to event map dimensions). Provide organizer correction and preview. Do not use visitor GPS as check-in proof.
- **Optional outdoor GPS:** if needed, add nullable WGS84 latitude/longitude for a stall, collected only for outdoor placements or entrance guidance. State its public use, validate ranges, and keep it independent of floor-plan coordinates. Indoor GPS and live visitor tracking remain out of scope.
- **Gifts:** reuse `rewards` and the atomic claim path, including the configured quantity/claim limit and one claim per visitor. Do not allow vendors to alter a reward after claims exist without review. Redemption still needs authenticated exhibitor tooling; for the first pilot, document any manual redemption procedure. Decide phone-verification policy per offer; OTP is a prerequisite only where a reward requires verified phone.
- **QR security:** only organizers issue signed QR codes after stall ownership/location approval. Vendor profile edits must never expose `qr_secret` or grant access to QR-signing credentials.
- **Pilot operations:** while self-service is built, organizers may collect the same form fields through a controlled form/spreadsheet and enter/review profiles themselves. This enables early vendor onboarding without granting unreviewed database access.

### Delivery order

1. Pilot checklist and organizer/vendor intake form; verify field requirements with a small vendor cohort.
2. Schema, migration, vendor authentication/invitations, stall assignment, and RLS/authorization tests.
3. Draft submission/editing UI with map pin, website/contact validation, and photo upload.
4. Organizer review/publish queue and audit trail; ensure public event API filters unpublished profiles.
5. Gift offer configuration and approval, connected to claim limits; then exhibitor redemption workflow.
6. Vendor QR issuance, setup guide, and end-to-end pilot test on vendor and visitor phones.
7. Optional outdoor GPS fields and map affordances only after confirming an outdoor navigation use case and device accuracy.

---

## 10. Milestones in detail

### M1: Scaffold + spike (week 1)

- [x] Repo, TypeScript, and local lint/build scaffold are in place (`npm run build` passes)
- [x] Supabase schema/RLS migration and UMA sample seed data are authored in `supabase/`
- [ ] Supabase local running; migration applied and seed loaded (requires Docker + Supabase CLI)
- [x] Anonymous auth sign-in on first load is implemented (requires Supabase environment and anonymous sign-in enabled)
- [x] Initial visitor browse shell is live: map, category filters, vendor drawer, and profile/leaderboard views are wired up locally
- [x] PixiJS pixel-art map prototype renders venue zones, paths, booths, and supports stall selection, drag, and zoom
- [ ] **Map spike:** render a 2048×2048 tilemap with `pixi-viewport` (pan, pinch, clamp), 60 stall markers
- [ ] Test the spike on at least two low-end Android phones over throttled 3G (Chrome DevTools throttling plus a real device)
- [ ] Benchmark PixiJS vs Leaflet fallback on target devices and record the final decision in `docs/adr/0001-renderer.md`

**Exit gate:** map is smooth (target 30+ FPS on the low-end phone; record the actual number) and first load is acceptable on throttled 3G. If not, switch to the fallback renderer before continuing.

### M2: Browse experience (weeks 2 to 3)

- [ ] `MapCanvas` component with viewport, zoom limits, marker layer
- [ ] Stall markers by category (distinct icon/colour), tap target at least 44 px
- [ ] `FilterBar` chips; non-matching stalls dim, matching animate
- [ ] `VendorDrawer` (slide-up, swipe to close): media carousel, description, price list
- [ ] Display approved vendor photos and optional website in the vendor listing/drawer
- [ ] "Chat on WhatsApp" using `https://wa.me/<number>?text=<prefilled message>`; log `whatsapp_click`
- [ ] Search by stall name/number
- [ ] PWA manifest, icons, service worker, offline map shell
- [ ] Event landing route `/e/[slug]` and entrance QR points here
- [ ] Track `stall_tap` events (batched, `navigator.sendBeacon`)

**Exit gate:** a visitor can open the entrance QR, browse, filter, open a vendor, and message them on WhatsApp, all on throttled 3G, and the map works after going offline.

### M3: Passport game (weeks 4 to 5)

- [x] Scanner page with camera permission handling and a manual-code lookup fallback
- [x] `/api/checkin` with static HMAC QR verification, auth check, and an atomic Postgres RPC
- [x] Coin reward animation/toast and per-zone progress summaries
- [x] Map fog-of-war marker reveal/dim behavior
- [x] Supabase-backed leaderboard view on the event and leaderboard pages (still needs cache policy)
- [x] Profile screen: persisted coins, check-ins, and reward inventory
- [x] Profile username editing
- [ ] Phone verification flow (OTP) for prize claims
- [x] `/api/claim` with atomic claim limits (`0002_claim_reward.sql`; apply to hosted Supabase before enabling claims)
- [x] Postgres-based check-in rate limiting (10 per visitor and 30 per IP per 10 minutes)
- [x] Unit tests for static QR signing/verification; check-in API input/auth/config tests
- [ ] Database integration tests for check-in and claim
- [ ] Apply and concurrency-test the reward claim migration against local/hosted Postgres

**Abuse test (must pass):**
- [ ] Same QR scanned twice → one check-in only
- [ ] Forged/edited token → rejected
- [ ] 50 parallel claim requests on a reward with limit 10 → exactly 10 succeed
- [ ] Script hammering `/api/checkin` → rate-limited
- [ ] Unverified user cannot claim a verified-only reward

**Exit gate:** full loop works on a real phone: scan, earn, appear on leaderboard, claim, exhibitor redeems.

### M4: Exhibitor and admin tools (week 6)

- [x] Pilot vendor application intake form stores pending applications and photos privately for manual organizer review (apply migration 0004 before use)
- [ ] Vendor invite and recoverable exhibitor login, separate from visitor anonymous sessions
- [ ] Verified event/stall assignment; vendor cannot claim a stall by entering its number
- [ ] Vendor onboarding/edit form for business name, category, description, WhatsApp, optional website, and map pin
- [ ] Photo upload/camera capture with file limits, preview, publication consent, and approved public media
- [ ] Draft/submitted/needs-changes/approved/rejected workflow with organizer review and audit history
- [ ] Public event/map queries include approved profiles only; unapproved edits do not alter published data
- [ ] Optional vendor gift/voucher setup with terms and quantity; organizer approval and atomic claim limits
- [x] Floating map coin marks a stall with an active, approved gift; QR scan awards the usual check-in coins and the visitor claims the gift separately
- [ ] Generate and issue signed stall QR only after stall ownership and profile approval
- [ ] Dashboard: taps, check-ins, WhatsApp clicks, claims, by day/hour; CSV export
- [ ] Exhibitor can edit approved listing fields and see/redeem claim codes, without access to QR secrets
- [ ] Admin: create event, upload map assets, import stalls CSV, assign vendors, review/publish listings and offers
- [ ] `generate-qr-sheet.ts`: printable PDF with one QR per stall (stall number and name under each) plus entrance standee QR
- [ ] Featured pin flag shows an animated pixel logo on the map

**Exit gate:** an invited vendor can submit a profile, photos, map position and optional gift; an organizer can review and publish it; the listing appears publicly only after approval; and an exhibitor can read stats and redeem an eligible claim.

### M5: Hardening and pilot (week 7)

- [ ] Load test (k6): simulate your realistic peak concurrent users; watch API latency and DB connections
- [ ] Supabase: connection pooling on, indexes verified with `EXPLAIN` on hot queries
- [ ] Error monitoring (Sentry free tier) and uptime check
- [ ] Privacy basics: short privacy notice, minimal data (username, phone only if verified), data deletion on request, retention period after the event. Check Uganda's Data Protection and Privacy Act requirements for phone numbers and consent.
- [ ] Vendor data policy: photo publication consent, contact/website visibility, optional outdoor-coordinate visibility, and retention/deletion process
- [ ] Accessibility pass: contrast, tap targets, text scaling, no flashing animations
- [ ] Data-saver mode: skip animations and reduce asset quality on slow connections
- [ ] Staff briefing sheet for stall owners (how to scan, redeem, troubleshoot)
- [ ] Rollback plan and a status contact on the day of the event

**Pilot go/no-go checklist:** all abuse tests pass, load test passes at the target, floor plan stalls match the live event, at least 70% of pilot stalls have complete profiles, entrance QR standees printed and tested, support contact staffed during event hours.

---

## 11. Testing strategy

| Level | Tools | Focus |
| --- | --- | --- |
| Unit | Vitest | QR signing, claim logic, fog-of-war math, rate limiter |
| Integration | Vitest + local Supabase | RLS policies, RPC transactions, concurrent claims |
| E2E | Playwright (mobile viewports) | Browse → scan (mocked camera) → claim → leaderboard |
| Device | Real low-end Android + iPhone | Map FPS, camera scanning, PWA install |
| Network | Chrome throttling (3G), offline mode | First load, cached map, request retries |
| Security | Manual + scripts | RLS bypass attempts, token forgery, replay, rate-limit evasion |

Write RLS tests first: the most dangerous bug is a client reading `qr_secret` or writing its own coins.

---

## 12. Deployment

- **Environments:** local (Supabase CLI), staging (Vercel preview + Supabase project), production (separate Supabase project).
- **Migrations:** only through `supabase/migrations`, applied by CI to staging first.
- **Secrets:** Vercel environment variables; service role and QR secret server-only.
- **Domain:** a short, easy-to-type URL for the QR fallback (for example a custom domain), since QR scanning will fail for some visitors.
- **Backups:** enable Supabase point-in-time or daily backups before the pilot.
- **Event day:** freeze deploys the day before; keep the previous deployment ready for instant rollback.

---

## 13. Risk register (build-time)

| Risk | Likelihood | Impact | Response |
| --- | --- | --- | --- |
| Floor plan late or inaccurate | High | High | Start with approximate zones, correct positions after a site walk, keep stall coordinates editable in admin |
| Map art takes longer than coding | High | Medium | Time-box; ship a simplified tilemap for the pilot |
| Camera scanning fails on some phones | Medium | High | Manual code entry fallback, short URL, staff assist |
| Venue network congestion | High | High | Aggressive caching, tiny API payloads, offline-tolerant check-in queue (retry when online) |
| Prize farming | Medium | High | Phone verification, claim limits, manual redemption, monitoring dashboard |
| SMS OTP cost or delivery | Medium | Medium | Compare providers, verify only for prize claims |
| Exhibitors do not update profiles | High | Medium | Admin bulk import, staff onboarding session before the event |
| Solo capacity | High | High | Cut scope at M2 gate, never add features before the pilot |

---

## 14. Decision log (fill in as you go)

| # | Decision | Options | Chosen | Date |
| --- | --- | --- | --- | --- |
| 1 | Renderer | PixiJS / Leaflet CRS.Simple | | |
| 2 | QR strategy | A static + claim codes / B rotating on staff phone | | |
| 3 | OTP provider | | | |
| 4 | Map art source | self / commission / auto-generated | | |
| 5 | Pilot event | | | |

---

## Appendix A: First 10 tasks to do tomorrow

1. Email UMA/organizer requesting floor plan and pilot permission.
2. Make a one-page exhibitor offer (free listing, paid featured pin / sponsored drop; price placeholders) and a clickable prototype.
3. Schedule the GPS walk test at the venue (or at any large venue as a proxy).
4. `create-next-app`, commit, set up CI.
5. Start Supabase locally and apply the schema.
6. Write seed data: 1 event, 3 zones, 30 stalls.
7. Build the PixiJS map spike with 60 markers.
8. Test on a low-end Android over throttled 3G; record FPS and load time.
9. Write `qr.ts` with unit tests.
10. Create `docs/adr/0001-renderer.md` with the spike results.

## Appendix B: API summary

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/events/:slug` | public | Event, zones, public stalls |
| POST | `/api/checkin` | user | Validate token, record check-in, award coins |
| POST | `/api/claim` | user | Claim reward for a checked-in stall |
| POST | `/api/track` | user/anon | Batch analytics events |
| GET | `/api/leaderboard?event=` | public | Top N + caller's rank |
| POST | `/api/exhibitor/redeem` | exhibitor | Mark claim code redeemed |
| POST | `/api/admin/import-stalls` | admin | CSV import |

## Appendix C: Definition of done (per feature)

- Works on a low-end Android over throttled 3G
- Has unit or integration tests for its logic
- RLS reviewed if it touches data
- Tracked in analytics if exhibitors care about it
- Documented in this file (update checkboxes and the decision log)

## Appendix D: GPS accuracy logger (for the M0 test)

Open on each phone, walk a fixed route, then export the log.

```html
<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1">
<button id="start">Start</button> <button id="dl">Download CSV</button>
<pre id="out"></pre>
<script>
  const rows = [["time","lat","lng","accuracy_m"]];
  let id;
  start.onclick = () => {
    id = navigator.geolocation.watchPosition(p => {
      const r = [new Date(p.timestamp).toISOString(), p.coords.latitude, p.coords.longitude, p.coords.accuracy];
      rows.push(r); out.textContent = r.join(", ") + "\n" + out.textContent.slice(0, 2000);
    }, e => out.textContent = e.message, { enableHighAccuracy: true, maximumAge: 0 });
  };
  dl.onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], {type: "text/csv"}));
    a.download = "gps-log.csv"; a.click();
  };
</script>
```

Compute the median and 90th percentile of `accuracy_m` per area. These numbers drive the GPS kill decision.
