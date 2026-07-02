@AGENTS.md

# CLAUDE.md — HQ (المقر)

Personal life-HQ web app for exactly ONE user (Yazan). Arabic UI, RTL, at
**https://hq.al-kamal.net**. Sections: المهام (tasks), الملاحظات (markdown
notes), المالية (subscriptions + budget + "can I afford it", SAR), الخطط
(now/next/later boards), الإدارة (sessions, audit log).

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
    الملاحظـــات، الماليـــة، الخطـــط، المقـــر.
  - **الأحرف المرسلة** (`.tarsil` = font-feature-settings "salt"): flowing
    final-letter tails. Single display words only (wordmark, PageHeader
    titles) — never two adjacent words, never running text.
  - **Serif Text** is for long-form reading (notes view); no kashida there.
  - **Riyal**: the font ships the NEW official symbol on U+FDFC — use
    `formatSAR()`/`RIYAL` from `src/lib/currency.ts` in text; the SVG
    `<RiyalSymbol />` only where Thmanyah isn't guaranteed.
  `PageHeader` (`src/components/page-header.tsx`) is the one place Serif
  Display appears.
- **Layout:** content sits in a centered `max-w-4xl` column with generous
  padding (`px-6 py-10 md:px-12 md:py-16`) — the "margin from the walls" is a
  hard requirement. Sidebar is fixed on the START (right) side; always use
  logical properties (`ms-`, `start-`, `border-e`) — never left/right.
- **Numbers:** Arabic UI with **Latin digits** — format via `src/lib/format.ts`
  (`ar-u-nu-latn`); tag numeric spans with `data-numeric` (tabular figures).
  Currency is SAR with the official Riyal symbol (U+20C1; verify glyph support
  before relying on it — official SVG fallback if the font lacks it).

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
