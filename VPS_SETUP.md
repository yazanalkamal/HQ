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
- Caddy on the VPS (§4 covers both "already have it" and "install fresh").

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

```bash
docker compose up -d postgres
docker compose run --rm migrate       # applies drizzle/ migrations
docker compose up -d --build app
docker compose logs -f app            # expect "Ready" from next start
```

The app listens on **127.0.0.1:3100** only — nothing is internet-reachable
until Caddy fronts it.

## 4. Caddy vhost (HTTPS)

Snippet lives in `deploy/Caddyfile.snippet`.

**If Caddy is already installed** (host service): append the snippet to
`/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy`.

**If not yet installed:**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudflare.com/keys/caddy-stable.asc' >/dev/null 2>&1 # (use official docs if key URL changed)
# official: https://caddyserver.com/docs/install#debian-ubuntu-raspbian
sudo apt install -y caddy
sudo ufw allow 80,443/tcp
cat deploy/Caddyfile.snippet | sudo tee -a /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Then open https://hq.al-kamal.net → sign in with Google → you're in.
Any other Google account gets `denied` (and lands in the /admin audit log).

## 5. Updating (every deploy)

```bash
cd ~/hq
git pull origin main
docker compose build app
docker compose run --rm migrate     # only if the change added a migration
docker compose up -d app
docker compose logs -f app
```

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
