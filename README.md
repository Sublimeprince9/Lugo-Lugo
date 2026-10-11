# Lugo-Lugo

Lugo-Lugo is a mobile-first PWA for event discovery at large venues like UMA Showgrounds (Lugogo, Kampala). It combines a pixel-art visitor map, stall filters, QR check-ins, a stall passport, and a basic leaderboard experience to make large exhibitions easier to navigate.

## Current status

This repo now contains a visitor-facing prototype with a Supabase-backed check-in path:

- mobile-first pixel-art map prototype rendered with PixiJS
- category filters and tappable stall markers
- stall drawer with WhatsApp deep links and price info
- camera QR scanning, signed static stall QR verification, and manual stall-ID lookup
- anonymous Supabase visitor sessions, check-in persistence, coin progress, and duplicate/rate-limit protection
- cookie-backed Supabase SSR sessions refreshed by Next.js middleware
- profile and leaderboard pages
- installable PWA metadata

Manual stall IDs only look up sample stalls; a signed stall QR is required to check in. Supabase must be configured and seeded before check-ins can be recorded. The event UI still uses sample browse and leaderboard data.

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

For a hosted Supabase project, add the project URL, anon/public key, service-role key, and a private QR signing secret to `.env.local` using the same variable names as in `.env.example`. Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for local development. The service-role key and QR signing secret must remain server-only and must never be pasted into chat or committed.

Apply the migrations and sample UMA event data:

```bash
npx supabase db reset
```

Enable anonymous sign-in is already set in `supabase/config.toml`. If using a hosted Supabase project instead of the local stack, apply the migration and `supabase/seed.sql` in order and enable anonymous sign-ins in the project Auth settings.

Start the app:

```bash
npm run dev
```

Open http://localhost:3000. To create printable static QR SVGs for the seeded fair:

```bash
npm run qr:generate -- uma-fair-2026
```

The SVGs are written to `public/qr/uma-fair-2026/` and ignored by git. Regenerate them only when the event or signing secret changes.

## Production validation

```bash
npm run build
npm test
```
