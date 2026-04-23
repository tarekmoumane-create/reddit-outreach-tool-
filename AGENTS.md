<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Next.js 16 gotchas that break training-data assumptions

Read `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` for the full list. Key ones that WILL bite you if you trust older knowledge:

- **`middleware.ts` is gone.** It's now `proxy.ts` at the `src/` root. Export a function named `proxy` (or default). Runs Node.js runtime only — the `edge` runtime is NOT supported in `proxy`. Config flags were renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.
- **`cookies()`, `headers()`, `draftMode()` are async.** You must `await cookies()` before `.get()`/`.set()`. Synchronous access is fully removed in 16 (was deprecated in 15).
- **`params` and `searchParams` in pages/layouts/routes are Promises.** Always `await` them. Route handlers: `{ params }: { params: Promise<{ id: string }> }`.
- **Turbopack is default** for `next dev` and `next build`. No `--turbopack` flag needed. Custom webpack configs cause build failures unless you pass `--webpack`.
- **`next lint` removed.** Use `eslint` directly. `next build` no longer runs linting.
- **`serverRuntimeConfig` / `publicRuntimeConfig` removed.** Use `process.env` with `NEXT_PUBLIC_` prefix for client access.
- **`images.domains` deprecated** — use `images.remotePatterns`.
- **Parallel routes require `default.js`** for every slot or builds fail.

## Project-specific context

- **Auth**: Supabase Auth via `@supabase/ssr`. Operator-only (no public signup). Accounts are created in the Supabase dashboard.
- **Cron**: Vercel Cron hits a dispatcher endpoint which fan-outs per-client worker endpoints (fire-and-forget via `fetch`). 60-second cap per invocation.
- **Database**: Supabase Postgres with Row-Level Security ON. Migrations live in `supabase/migrations/`.
- **AI**: Anthropic SDK with prompt caching on reused system prompts. Haiku for scoring, Sonnet for comment generation.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build (Turbopack)
- `npm run lint` — ESLint
