@AGENTS.md

# CLAUDE.md — HQ (المقر)

Personal life-HQ web app for exactly ONE user (Yazan). Arabic UI, RTL, at
**https://hq.al-kamal.net**. Sections:

- **اليوم** (home): greeting + Gregorian/Hijri date, then the summary strip
  (قمرة اليوم: one linked cell per section — tasks counts live HERE, not in
  the hero), then **نبض المنصات** (Twitch/Discord/X cards: headline number,
  weekly delta, 30-day sparkline, Twitch live chip, X session-health red
  state — hidden entirely until first data), today's tasks, روتين اليوم
  checkboxes, upcoming renewals, quick-add. Platform data arrives ONLY via
  `POST /api/stats/ingest` (bearer `STATS_INGEST_SECRET`, exempt in
  proxy.ts, deliberately NOT audited — machine telemetry): StreamBot pushes
  Twitch+Discord (daily snapshot 06:00 + ~3-min live ping; see
  `src/services/stats_snapshot.py` in the streambot repo), the `xsnap`
  compose service scrapes X (@POGYaz) via a logged-in browser session
  (`xsnap/`, state volume seeded once with `xsnap/login.mjs` on a desktop).
- **المهام**: week strip of real days (`?d=YYYY-MM-DD`, `?view=undated|done`)
  → day board with progress bar; task cards with hover quick-actions.
  Adding = the focused task composer (global overlay mounted in the app
  layout; `N` key or «مهمة جديدة» buttons via the `hq:composer` window
  event; Enter adds-and-chains; date/priority/area/plan controls always
  visible; default date follows the board). Inline add inputs were removed
  by explicit decision (2026-07-10) — don't re-add them.
- **المالية**: subscriptions (auto-rolled renewals) + commitments + income →
  free-to-spend + "أقدر أشتريه؟", SAR.
- **الخطط**: "قمرة القيادة" — action-first plan cards (2026-07-10 redesign
  that replaced the Gantt time canvas). Each project card leads with its
  next step: «أنجزتها» logs it to `plan_steps` (سجل الدفعات) and asks for
  the next; an empty step = متعثرة chip + inline rescue input on the card.
  Card gauge = progress fill + time tick (fill behind tick = behind
  schedule). Attention-first sorting (late milestones, then stalled).
  Card expansion = the management surface (milestones ◆, plan tasks,
  sub-plans, step log); the sheet is only "تحرير كامل". Routines get their
  own week-dots section (7 real days from `routine_checks`, past days
  clickable to fix; cadence N×/week). «الخارطة» (`?view=map`) = read-only
  12-week zoom-out (`src/lib/timeline.ts`). New plans via the plan composer
  (`P` key / `hq:plan-composer`); ideas strip + Ctrl+K "فكرة" feed it
  (فكرة → خطة prefills). One level of sub-plans (`plans.parent_id`); tasks
  can belong to a plan (`tasks.plan_id`, count toward progress).
  PLAN_COLORS (timeline.ts) ≠ AREA_COLORS (areas.ts).
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
- **Desktop sessions — «ربط الجهاز»:** Google blocks OAuth in webviews, so
  /admin mints a 5-min single-use code (`device_link_codes`, hashed like
  sessions; `src/lib/auth/device.ts`) and `GET /api/device/claim?code=`
  (proxy-exempt) exchanges it for a normal revocable session. The desktop
  shell sends UA marker `HQDesktop/` → shown as «تطبيق المقر» in /admin.

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
5. Desktop shell: launch with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=
   "--remote-debugging-port=9223"` and drive the webviews over raw CDP
   (Playwright's connectOverCDP misreads WebView2 targets). Assert window
   visibility with Win32 `IsWindowVisible`, not `document.visibilityState`.
   Synthetic SendKeys dies silently when the foreground window is elevated
   or the PC is locked — `--quick` via single-instance is the reliable
   test hook.

## Feature-map (where things live)

- Timeline math: `src/lib/timeline.ts` · date/week helpers: `src/lib/dates.ts`
- Queries per section: `src/lib/queries/{tasks,plans,finance,stats}.ts`
- اليوم strips: `src/components/today/` (summary-strip = قمرة اليوم cells,
  platform-pulse = نبض المنصات cards + server-rendered sparklines)
- Server actions: `src/app/(app)/{tasks,plans,finance}/actions.ts` +
  `admin/actions.ts`, `notes` pattern removed
- Plans UI: `src/components/plans/` (plans-view = cockpit shell + health
  strip + routines, plan-card = card + momentum loop, plan-composer = P
  overlay, plan-map = read-only zoom-out, plans-header-controls = view
  toggle + new-plan button, plan-sheet = full edit, plan-editors = shared
  milestone/task editors)
- Tasks UI: `src/components/tasks/` (day-strip, task-row cards,
  task-composer = global N overlay mounted in `(app)/layout.tsx`,
  new-task-button, task-panel sheet, areas)
- Shell: `src/components/shell/` (sidebar, command palette Ctrl+K, search
  button); `/api/search` feeds the palette
- Desktop (Windows): `desktop/` — Tauri tray shell (see `desktop/README.md`;
  built LOCALLY only, never CI/VPS). Ctrl+Shift+A (or `hq-desktop.exe
  --quick`) toggles a frameless transparent always-on-top window on
  `/capture` — the task composer in `variant="capture"` (always open, page
  transparent via `data-capture-shell`, Esc hides through the remote-IPC
  `hide_capture` command, shell reloads the page after hiding so the next
  summon is instant AND fresh). Tray click opens the full site as a window.
  Hard-won gotchas: never create/close windows inside `on_navigation`
  (WebView2 reentrancy aborts the navigation); blur-hide needs a ~600ms
  grace after show or it re-hides instantly; `document.visibilityState`
  never changes on window hide/show in WebView2.

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

**The VPS never builds** — measured 15 MB/s disk writes (healthy: 200–1000),
so a Next build there starves the box (BuildKit crashed, the live streambot
lagged). GitHub Actions builds on push to main → ghcr.io/yazanalkamal/hq-{app,
migrate,xsnap}; the VPS pulls. Never suggest `docker compose build` on the VPS.

```bash
# on the VPS, in ~/hq  (after the GitHub Actions build goes green)
git pull origin main
docker compose pull
# only if this change added a migration:
docker compose run --rm migrate
docker compose up -d
docker compose logs -f app     # confirm clean boot
```

Migrations MUST run after `pull`, before `up -d`. `.env` changes need
`docker compose down && docker compose up -d` (plain `up -d` doesn't reload
env). Never imply a change is live until the deploy block ran on the VPS.

## Working style

Senior-quality, production-ready. Map the full input space before coding
(empty/missing/None, the negative case, RTL + LTR content mixing). Match
existing idioms. `npm run build` green before "done". State residual risk
honestly — "it builds" is not "verified on the VPS".
