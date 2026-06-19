<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Services

| Service | Command | Notes |
|---------|---------|--------|
| Next.js (web) | `pnpm dev` | http://localhost:3000 — use a tmux session for long-running dev |
| Supabase | Remote project (not started in VM) | Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

There is no Docker Compose or monorepo. Optional: Supabase CLI for `supabase db push` (install separately if needed).

### Environment

`.env.local` is gitignored and not committed. Copy variables from README / PRD (`docs/prd-habiku-nextjs.md` § env) or pull from the linked Supabase project (`get_publishable_keys` via Supabase MCP). Without Supabase vars, marketing routes work but login/client Supabase calls throw; middleware skips auth when config is missing.

### Lint / test / build

See root `package.json`: `pnpm lint`, `pnpm build`, `pnpm start`. ESLint currently reports many pre-existing issues in the repo (not introduced by env setup). `pnpm build` compiles but currently FAILS the TypeScript type-check step on a pre-existing error in `components/parent/parent-savings-view.tsx` (`DEFAULT_SAVINGS_POCKET_EMOJI` is inferred as the literal `"🐷"`, so `setEditPocketEmoji(string)` is rejected). This is a source bug, not an env issue — `pnpm dev` (Turbopack) runs fine and is what the dev environment uses. Playwright E2E lives in `tests/e2e/` but is not wired in `package.json` scripts or dependencies.

### Auth / E2E seed

A linked Supabase project already exists: ref `ohnmeatnujnxeeeaaywv` (name "habiku", region ap-southeast-1) with all migrations applied and seed data. Pull `NEXT_PUBLIC_SUPABASE_URL` + anon/publishable key via the Supabase MCP (`get_project_url`, `get_publishable_keys`) into `.env.local`. Email auth is set to auto-confirm, so `sign up` returns a session immediately (no email step) — a fresh `/sign-up` → `/onboarding` (creates a family + first child) → `/parent` flow works end-to-end without pre-seeded credentials. The E2E spec's `parent@habiku.id` may still not exist on this project. For smoke tests without credentials: homepage, `/login`, and unauthenticated `/parent` → `/login?next=%2Fparent`.
