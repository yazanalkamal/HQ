@AGENTS.md

# CLAUDE.md — HQ (المقر)

Personal life-HQ web app for exactly ONE user (Yazan). Arabic UI, RTL, at
**https://hq.al-kamal.net**. Sections:

- **اليوم** (home): greeting + Gregorian/Hijri date, today's tasks, روتين
  اليوم checkboxes, upcoming subscription renewals, quick-add.
- **المهام**: week strip of real days (`?d=YYYY-MM-DD`, `?view=undated|done`)
  → day board with progress bar; task cards with hover quick-actions;
  quick-add on top + ghost add-row under lists.
- **المالية**: subscriptions (auto-rolled renewals) + commitments + income →
  free-to-spend + "أقدر أشتريه؟", SAR.
- **الخطط**: "خارطة الزمن" — 12-week RTL time canvas (`src/lib/timeline.ts`).
  Plans are bars; `kind: project` (milestone ◆ diamonds, mandatory next-step,
  متعثرة flag when empty) or `kind: routine` (cadence N×/week ribbon fed by
  `routine_checks`). One level of sub-plans (`plans.parent_id`); tasks can
  belong to a plan (`tasks.plan_id`, count toward bar progress). Ideas
  capture strip + Ctrl+K "فكرة" feed the canvas; مراجعة أسبوعية sheet.
  Row click = inline expansion (daily management); the sheet is only
  "تحرير كامل". PLAN_COLORS (timeline.ts) ≠ AREA_COLORS (areas.ts).
- **الإدارة**: sessions with revoke, audit log.

A notes section existed and was REMOVED by explicit decision (2026-07-02) —
don't re-add it. UI redesigns need a visual mockup approved BEFORE building
(publish an Artifact) — Yazan rejects text-only design proposals.

**Roles here: Senior UI/UX Designer + Senior Software Engineer. UX is the top
priority** — quick-add flows, keyboard-first, zero clutter.

## Stack

Next.js 16 (App Router, Turbopack, **standalone output**) · TypeScript ·
Tailwind v4 (CSS-first config in `src/app/globals.css`) · shadcn/ui-style
components (`src/components/ui`, added manually or via `npx shadcn add`) ·
Drizzle ORM + Postgres · Arctic (Google OAuth) · Docker Compose on the VPS.

⚠️ Next.js 16 gotchas already hit: middleware file is `src/proxy.ts` (exports
`proxy`), `cookies()`/`headers()`/`searchParams` are async, and component
functions (e.g. lucide icons) can NOT be passed from server → client
components as props — the client module must import them itself.

## Design system — the rules

- **Tokens only.** All colors/radii/fonts are CSS variables in
  `src/app/globals.css`. NEVER hardcode a color in a component. White canvas,
  dark-gray ink (`--foreground` oklch(0.269 0 0)), one gray scale; red is
  reserved for overdue/destructive ONLY.
- **Type:** Thmanyah (self-hosted, `src/fonts/`, loaded via `next/font/local`
  in `src/fonts/index.ts`). `font-sans` (Thmanyah Sans) for UI/body,
  `.font-display` (Serif Display) ONLY for section headings, `.font-serif`
  (Serif Text) for long-form note reading.
- **Thmanyah typography rules** (from دليل جماليات خط ثمانية — the PDF in
  `assets/`; violating these makes the font look wrong):
  - **Kashida "ـ"**: typing tatweel gives the slanted kashida automatically
    (rlig). Place it ONLY at the last joint of a word (between the final
    letter and the one before it), once per word, never stretched to max,
    sparingly per screen, NEVER in running/body text. Headings: المهـــام،
    الماليـــة، الخطـــط، اليـــوم، المقـــر.
  - **الأحرف المرسلة** (`.tarsil` = font-feature-settings "salt"): flowing
    final-letter tails. Single display words only (wordmark, PageHeader
    titles) — never two adjacent words, never running text.
  - **Serif Text** is for long-form reading; currently loaded but unused
    (its home was the removed notes view) — use it if long-form ever returns.
  - **Riyal**: the font ships the NEW official symbol on U+FDFC — use
    `formatSAR()`/`RIYAL` from `src/lib/currency.ts` in text; the SVG
    `<RiyalSymbol />` only where Thmanyah isn't guaranteed.
  `PageHeader` (`src/components/page-header.tsx`) is the one place Serif
  Display appears.
- **Layout:** content is CENTERED (`mx-auto`) in the space beside the sidebar,
  `max-w-6xl` with generous padding (`px-6 py-12 md:px-14 md:py-20`) — margin
  from the walls is a hard requirement, and Yazan explicitly asked for
  centered + wide (not anchored to the sidebar, not narrow). Sidebar is fixed
  on the START (right) side; always use logical properties (`ms-`, `start-`,
  `border-e`) — never left/right.
- **Numbers:** Arabic UI with **Latin digits** — format via `src/lib/format.ts`
  (`ar-u-nu-latn`); tag numeric spans with `data-numeric` (tabular figures).
  Date/week math lives in `src/lib/dates.ts` (pinned to Asia/Riyadh, weeks
  start Sunday) — never do date arithmetic inline.

## Auth — zero-trust, single user

- Google OAuth via Arctic (`/api/auth/google` → `/api/auth/callback/google`),
  PKCE + state cookies. The callback rejects any verified-email ≠
  `ALLOWED_EMAIL` (server-side; there is no signup).
- Sessions: 90-day rolling. Raw token only in the `hq_session` httpOnly
  cookie; DB stores its SHA-256 as `sessions.id` (+ user-agent, IP,
  last-seen). Validation extends expiry when <45 days remain; last-seen
  writes throttled to 5 min. Revocable from /admin.
- **Defense in depth:** `src/proxy.ts` only sniffs cookie presence (edge,
  no DB). The REAL check is `getCurrentSession()` in `(app)/layout.tsx` and
  **`requireUser()` FIRST LINE of every server action** — hiding a button is
  UX, the dependency is the control.
- **Every state-changing action must call `audit(...)`** (`src/lib/audit.ts`
  → `audit_log`, rendered in /admin).

## Commands

```powershell
npm run dev          # dev server on :3000 (needs dev Postgres, below)
npm run build        # production build — run before declaring any change done
npm run lint         # eslint
docker compose up -d postgres          # dev DB on 127.0.0.1:5433 (via git-ignored override)
npx drizzle-kit generate --name <slug> # after editing src/db/schema.ts
npx drizzle-kit migrate                # apply migrations to the dev DB
```

PowerShell note: a non-zero exit cancels every other tool call batched with
it — run verification commands solo.

## E2E verification workflow (every milestone shipped this way)

Features are verified in a REAL browser before "done": playwright-core with
`channel: "msedge"` (no browser download) against `npm run dev`.

1. Seed a smoke session: insert user `dev-seed2` / `dev@local.test` (NEVER
   the real allowed email — unique-email collision) + a `sessions` row whose
   id is sha256 of token `dev-smoke-token`; set that token as the
   `hq_session` cookie in the browser context.
2. Script the real flows with assertions (getByRole/getByPlaceholder;
   scope clicks to rows — strict mode catches ambiguity), screenshot, and
   READ the screenshots — several real bugs were only visible there.
3. Clean up after: delete test rows + the `dev-seed2` user.
4. Gotchas already hit: the quick-add chips overlay can cover the first
   row while the input is focused (press Escape first); Playwright clicks
   during revalidation can land on stale layout — wait ~1.5s after writes.

## Feature-map (where things live)

- Timeline math: `src/lib/timeline.ts` · date/week helpers: `src/lib/dates.ts`
- Queries per section: `src/lib/queries/{tasks,plans,finance}.ts`
- Server actions: `src/app/(app)/{tasks,plans,finance}/actions.ts` +
  `admin/actions.ts`, `notes` pattern removed
- Plans UI: `src/components/plans/` (plans-view = canvas + expansion,
  plan-sheet = full edit, plan-editors = shared milestone/task editors)
- Tasks UI: `src/components/tasks/` (day-strip, task-row cards, quick-add,
  add-task-row, task-panel sheet, areas)
- Shell: `src/components/shell/` (sidebar, command palette Ctrl+K, search
  button); `/api/search` feeds the palette

## Dev (Windows) vs Prod (VPS)

Dev on this Windows PC (`C:\HQ`), deploy on the Ubuntu VPS (same box as
streambot) via Docker Compose behind Caddy. Full guide: `VPS_SETUP.md`.

- `docker-compose.override.yml` (publishes dev DB port) is **git-ignored and
  must NEVER reach the VPS** — same hard rule as streambot.
- `.env` is git-ignored; `.env.example` is the documentation. Prod values
  live only in the VPS `.env`.
- Prod state (users/sessions/tasks data, audit log) lives in the VPS
  Postgres — reason about PROD STATE, not the dev checkout.

### Applying changes — end every change with the deploy block

```bash
# on the VPS, in ~/hq
git pull origin main
docker compose build app
# only if this change added a migration:
docker compose run --rm migrate
docker compose up -d app
docker compose logs -f app     # confirm clean boot
```

Migrations MUST run after `build`, before `up -d`. `.env` changes need
`docker compose down && docker compose up -d` (plain `up -d` doesn't reload
env). Never imply a change is live until the deploy block ran on the VPS.

## Working style

Senior-quality, production-ready. Map the full input space before coding
(empty/missing/None, the negative case, RTL + LTR content mixing). Match
existing idioms. `npm run build` green before "done". State residual risk
honestly — "it builds" is not "verified on the VPS".
