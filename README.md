# المقر — HQ

Personal life headquarters: tasks, notes, finance, and plans. Single-user,
Arabic, RTL, Thmanyah type. Runs at https://hq.al-kamal.net.

- Docs for development conventions: `CLAUDE.md`
- Deploy guide: `VPS_SETUP.md`

## Dev quickstart (Windows)

```powershell
docker compose up -d postgres   # dev DB on 127.0.0.1:5433
npx drizzle-kit migrate         # apply schema
npm run dev                     # http://localhost:3000
```

Copy `.env.example` → `.env` and fill the Google OAuth values first.
