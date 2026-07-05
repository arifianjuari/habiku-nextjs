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

See root `package.json`: `pnpm lint`, `pnpm build`, `pnpm start`. ESLint currently reports many pre-existing issues in the repo (not introduced by env setup). Playwright E2E lives in `tests/e2e/` but is not wired in `package.json` scripts or dependencies.

### Auth / E2E seed

Full parent→child flows need a Supabase project with migrations applied and seed users (E2E spec expects `parent@habiku.id` — may not exist on a fresh project). For smoke tests without credentials: homepage, `/login`, and unauthenticated `/parent` → `/login?next=%2Fparent`.

### Performance / responsiveness

Before adding parent/child routes, tabs, data fetching, server actions, or PWA changes, read and follow `.agents/skills/habiku-performance/SKILL.md`. Verify with `docs/performance-verification.md` when touching navigation or submit flows.
