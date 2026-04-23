# Reddit Outreach Tool

Internal, multi-client Reddit marketing opportunity finder. For each active client,
the tool finds fresh Reddit posts where a helpful, on-brand comment could naturally
fit — and pre-writes the comment. Operator-facing dashboard + CSV export.

Stack: **Next.js 16**, Supabase (Postgres + Auth), Anthropic Claude API, Vercel Cron, Tailwind.

> ⚠️ **Next.js 16** has breaking changes. See `AGENTS.md` for the gotchas that bite
> if you rely on older Next.js knowledge. TL;DR: `middleware.ts` is now `proxy.ts`,
> `cookies()` / `headers()` / `params` are async, Turbopack is default, `next lint`
> is gone.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

- Go to [supabase.com](https://supabase.com), create a new project (free tier is fine).
- In the project dashboard, open **SQL Editor** and run the contents of
  `supabase/migrations/0001_initial_schema.sql`.
- Still in the Supabase dashboard, go to **Authentication → Users → Add user** and
  create an operator account (email + password). Mark email as confirmed.

### 3. Fill `.env.local`

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase
  → Project Settings → API.
- `SUPABASE_SERVICE_ROLE_KEY` — same page, **service_role** key. Server-side only.
  Never commit, never expose to the browser.
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com).
- `CRON_SECRET` — any long random string (e.g. `openssl rand -hex 32`). Protects the
  cron endpoints.
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` in dev, your deployed URL in prod.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should be redirected to
`/login`. Sign in with the operator account you created above → land on an empty
dashboard.

## Deploy to Vercel (later)

1. Push this repo to GitHub.
2. Import in Vercel. Add all the `.env.local` variables as Vercel environment
   variables.
3. Vercel Cron will be wired up via `vercel.json` in Phase 3 (not yet added —
   deployment instructions will be updated then).

## Project layout

```
src/
  app/
    login/              # Operator sign-in
    dashboard/          # Protected area
    auth/sign-out/      # POST endpoint to log out
  lib/supabase/
    client.ts           # Browser-side Supabase client
    server.ts           # Server-side client (reads cookies for auth)
    admin.ts            # Service-role client — cron only
    proxy.ts            # Session refresh helper used by src/proxy.ts
  proxy.ts              # Next.js 16 proxy (formerly middleware.ts) — auth gate
supabase/migrations/    # SQL migrations
```

## Phase status

- **Phase 1** ✅ Scaffold, auth, empty dashboard. Compiles clean, auth redirects verified.
- **Phase 2** ⏳ Client management UI (next up).
- **Phase 3** ⏳ Daily cron + Reddit scraper + Claude scoring + comments.
- **Phase 4** ⏳ Dashboard opportunity views + CSV export.

## Picking up tomorrow

Before Phase 2 can start, fill in real credentials. Checklist:

- [ ] Create a Supabase project at [supabase.com](https://supabase.com) (free tier).
- [ ] In Supabase → **SQL Editor**, paste and run `supabase/migrations/0001_initial_schema.sql`.
- [ ] In Supabase → **Authentication → Users → Add user**: create an operator account (email + password, tick "Auto Confirm User").
- [ ] Copy URL + anon key + service-role key from Supabase → **Project Settings → API**.
- [ ] Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com).
- [ ] Open `.env.local` and replace the `placeholder_*` values with the real ones above.
- [ ] Run `npm run dev`, open the URL it prints (probably `http://localhost:3001` since 3000 is in use), sign in.

Once sign-in works, start a new Claude Code session in this folder and ask it to **"start Phase 2"** — it'll pick up the client-management UI work.
