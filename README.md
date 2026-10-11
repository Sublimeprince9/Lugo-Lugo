# Lugo-Lugo

Lugo-Lugo is a mobile-first PWA for event discovery at large venues like UMA Showgrounds (Lugogo, Kampala). It combines a pixel-art visitor map, stall filters, QR check-ins, a stall passport, and a basic leaderboard experience to make large exhibitions easier to navigate.

## Current status

This repo now contains a visitor-facing prototype with a Supabase-backed check-in path:

- mobile-first pixel-art event map rendered with PixiJS and published Supabase stalls
- category filters and tappable stall markers
- stall drawer with WhatsApp deep links and price info
- camera QR scanning, signed static stall QR verification, and manual stall-ID lookup
- anonymous Supabase visitor sessions, check-in persistence, coin progress, and duplicate/rate-limit protection
- cookie-backed Supabase SSR sessions refreshed by Next.js middleware
- Supabase-backed visitor profile with persisted coins, check-ins, and available rewards
- Supabase-backed public leaderboard
- atomic voucher/prize claims with per-reward limits and visitor-owned claim codes
- installable PWA metadata

Manual stall IDs only look up stalls; a signed stall QR is required to check in. Supabase must be configured and seeded before event browsing, profiles, rankings, and check-ins are available.
Phone-verified rewards stay unavailable until a phone verification flow is configured. Claim codes are visitor-scoped and are not yet redeemable through an exhibitor dashboard.

The full product and delivery plan is tracked in [PLAN.md](./PLAN.md).

Visitor auth is managed with `@supabase/ssr` cookies. The middleware refreshes sessions, and the check-in API validates the visitor from the request cookies; do not pass auth tokens in client request headers.

## Local development

Prerequisites: Node.js 20+, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
npx supabase start
cp .env.example .env.local
```

Copy the local Supabase API URL, anon key, and service-role key printed by `supabase start` into `.env.local`. Set `QR_SIGNING_SECRET` to a private random value of at least 32 bytes (for example, `openssl rand -hex 32`). Do not expose or commit the service-role key or QR signing secret.

For a hosted Supabase project, add the project URL, anon/public key, service-role key, and a private QR signing secret to `.env.local` using the same variable names as in `.env.example`. Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for local development. Set `ORGANIZER_EMAILS` to a comma-separated list of organizer email addresses. Create those accounts in Supabase Auth first, enable email OTP/magic-link sign-in, and add each app origin with `/organizer` to Supabase Auth's allowed redirect URLs. The service-role key, organizer allowlist, and QR signing secret must remain server-only and must never be pasted into chat or committed.

Apply the migrations and sample UMA event data:

```bash
npx supabase db reset
```

Anonymous sign-in is enabled for the local stack in `supabase/config.toml`. For a hosted project, apply the SQL migrations in numbered order (`0001_init_schema.sql` through `0006_organizer_vendor_review.sql`) before deploying the corresponding app code, then run `supabase/seed.sql` once. In the Supabase Dashboard, enable anonymous sign-ins for visitors and email OTP for organizers. Vendor applications and submitted photos remain private until an authorized organizer reviews them. Migration 0004 enables the public intake form; migration 0006 adds the organizer review API and `/organizer` dashboard. The organizer should verify stall ownership and map placement before approving. Approval creates the public stall listing and, when proposed, an active limited voucher reward with its terms; migration 0005 exposes only a gift-present flag to the public map. Visitor photos remain private previews for review and are not yet published on stall profiles. Visitors still receive the usual check-in coins on QR scan and claim the gift separately in their passport. Run the seed only once; it inserts fixed sample IDs. A disabled anonymous provider returns “Anonymous sign-ins are disabled” when the visitor session starts. Restart the Next.js server after changing `.env.local`.

Start the app:

```bash
npm run dev
```

Open http://localhost:3000. After a real vendor application has been approved in `/organizer`, generate that vendor's QR and print sheet using its application ID (shown in the organizer review queue or on the vendor's submission confirmation):

```bash
npm run qr:generate -- uma-fair-2026 --application <approved-application-id>
```

The approved application ID is required so sample or unregistered event stalls cannot accidentally receive vendor print sheets. The individual vendor SVG and A4 print sheet are written under `public/qr/uma-fair-2026/<stall-number>/` and ignored by git. Print and give only that vendor's sheet to them. Regenerate it if the event or signing secret changes.

For QR codes intended for the hosted app, `QR_SIGNING_SECRET` in the local generator environment must exactly match the deployed app's `QR_SIGNING_SECRET`, and `NEXT_PUBLIC_APP_URL` must be set to the hosted origin. For example:

```bash
NEXT_PUBLIC_APP_URL=https://lugo-lugo.vercel.app npm run qr:generate -- uma-fair-2026
```

Changing the signing secret invalidates previously printed codes; regenerate and redistribute those codes after rotating it.

## Production validation

```bash
npm run build
npm test
```
