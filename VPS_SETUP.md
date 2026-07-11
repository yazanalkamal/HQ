# 🚀 HQ — VPS Setup & Deployment

Deploying **HQ (المقر)** to the same Ubuntu VPS that runs streambot.
Assumes the VPS baseline from streambot's guide is done (non-root user,
ufw with only SSH open, Docker + Compose installed).

> Committed to the repo — keep it free of IPs and secrets (those live only
> in the VPS `.env` and your DNS panel).

---

## 0. Prerequisites

- DNS: **A record `hq.al-kamal.net` → VPS IP** (if Cloudflare, gray-cloud it
  at least until the first certificate issues).
- Google OAuth client (see §2).
- HTTPS is served by streambot's caddy container (§4) — no host Caddy.

## 1. Get the code & env

```bash
cd ~
git clone https://github.com/yazanalkamal/HQ hq
cd hq
cp .env.example .env && nano .env
```

Set in `.env`:

| Key | Value |
|---|---|
| `POSTGRES_PASSWORD` | a real random password (`openssl rand -hex 24`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from §2 |
| `ALLOWED_EMAIL` | `yazan@al-kamal.net` |
| `APP_URL` | `https://hq.al-kamal.net` |
| `STATS_INGEST_SECRET` | `openssl rand -hex 32` — same value goes into streambot's `.env` as `HQ_STATS_SECRET` |
| `X_HANDLE` | `POGYaz` |

`DATABASE_URL` is NOT needed on the VPS — compose wires the internal
`postgres` hostname itself. **Do not copy `docker-compose.override.yml` to
the VPS** (it publishes the DB port; it's git-ignored, so a plain clone is
already safe).

## 2. Google OAuth client (one time)

[Google Cloud Console](https://console.cloud.google.com/) → APIs & Services →
Credentials → **Create OAuth client ID** (type: *Web application*):

- Authorized redirect URIs — add BOTH:
  - `https://hq.al-kamal.net/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/google` (Windows dev)
- OAuth consent screen: External is fine; add `yazan@al-kamal.net` as a test
  user (the app can stay in "Testing" forever — only that account signs in
  anyway; note Google may expire test-user refresh tokens, which doesn't
  matter here since HQ keeps its own 90-day sessions).

Put the client ID/secret in **both** the VPS `.env` and the Windows `.env`.

## 3. Database + first deploy

> **The VPS never builds.** Measured 2026-07-11: this box writes at
> **15 MB/s** (healthy is 200–1000). A Next.js build there starved the
> whole machine — BuildKit crashed and the live bot lagged. GitHub Actions
> (`.github/workflows/build.yml`) builds on every push to main; the VPS
> only *pulls*. Reads run at ~73 MB/s, which is fine for that.

One-time: let the VPS read from GHCR. Create a GitHub PAT (classic) with
**`read:packages`** only, then:

```bash
echo '<PAT>' | docker login ghcr.io -u yazanalkamal --password-stdin
```

Then, every deploy — including the first:

```bash
docker compose pull                   # app + xsnap + migrate images
docker compose up -d postgres
docker compose run --rm migrate       # applies drizzle/ migrations
docker compose up -d app xsnap
docker compose logs -f app            # expect "Ready" from next start
```

The app listens on **127.0.0.1:3100** only — nothing is internet-reachable
until Caddy fronts it. `xsnap` logs "no session" until §7 seeds it.

## 4. HTTPS — via streambot's caddy (this VPS's reality)

Ports 80/443 on this VPS are owned by **streambot's caddy container**, so
the `hq.al-kamal.net` vhost lives in *that* repo's `Caddyfile` (already
committed there), and the two compose projects share an external docker
network named `edge`:

```bash
docker network create edge          # once per host (errors if it exists — fine)
cd ~/streambot && git pull          # brings the vhost + edge-network compose change
docker compose up -d caddy          # recreates caddy attached to `edge`
```

HQ's `docker-compose.yml` already joins `edge` and exposes the app to
caddy as `hq-app:3000`. (`deploy/Caddyfile.snippet` stays as reference
for a future standalone-Caddy setup.)

Then open https://hq.al-kamal.net → sign in with Google → you're in.
Any other Google account gets `denied` (and lands in the /admin audit log).

## 5. Updating (every deploy)

Push to `main` → GitHub Actions builds → wait for the green check, then:

```bash
cd ~/hq
git pull origin main                # compose file / migrations
docker compose pull                 # the freshly built images
docker compose run --rm migrate     # only if the change added a migration
docker compose up -d
docker compose logs -f app
```

Never `--build` here. Roll back by pinning `HQ_TAG=<git-sha>` in `.env`
and re-running `docker compose up -d`.

`.env` edits: `docker compose down && docker compose up -d` (plain `up -d`
won't reload env).

## 6. Nightly backups

```bash
mkdir -p ~/hq/backups
crontab -e
```

```cron
30 4 * * * cd /home/<user>/hq && docker compose exec -T postgres pg_dump -U hq hq | gzip > backups/hq_$(date +\%Y\%m\%d).sql.gz && find backups -name 'hq_*.sql.gz' -mtime +14 -delete
```

(04:30 — streambot's dump runs at 04:00.) Restore:

```bash
gunzip -c backups/hq_YYYYMMDD.sql.gz | docker compose exec -T postgres psql -U hq hq
```

Run a restore drill into a throwaway DB occasionally — a backup you've never
restored isn't a backup.

## 7. Day-to-day

| Task | Command |
|---|---|
| Live logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Status | `docker compose ps` |
| DB shell | `docker compose exec postgres psql -U hq hq` |
| Sessions/audit | the /admin page in the app itself |

## 8. Common issues

| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` from Google | The prod redirect URI in §2 must be EXACTLY `https://hq.al-kamal.net/api/auth/callback/google`. |
| Sign-in loops back to /signin | `APP_URL` wrong in `.env` (cookie/redirect host mismatch), or Caddy isn't passing `X-Forwarded-*` (it does by default). |
| "هذا الحساب غير مسموح له بالدخول" | You signed in with the wrong Google account — `ALLOWED_EMAIL` gate. |
| Cert not issuing | DNS not pointed / Cloudflare proxy on during first issue / port 80 blocked by ufw. |
| App container unhealthy after `.env` edit | `docker compose down && docker compose up -d`. |
