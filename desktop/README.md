# HQ Desktop — الصدفة المكتبية

Tiny Tauri tray app for Windows: **Ctrl+Shift+A** anywhere summons the
quick-add bar (the real `/capture` page from the web app in a frameless
transparent window); the tray icon opens full HQ as a desktop window.
Idles at ~15 MB because it rides the WebView2 engine already in Windows.

Built **locally on the dev PC only** — never in CI, never on the VPS.

## One-time setup

- Rust (rustup) + VS Build Tools 2022 with the C++ workload
- `npm install` inside `desktop/`

## Build

```powershell
cd desktop
npm run build                     # → src-tauri/target/release/hq-desktop.exe (+ NSIS installer in target/release/bundle/nsis)
```

Dev build against the local dev server:

```powershell
$env:HQ_BASE_URL = "http://localhost:3000"; npm run build
```

`HQ_BASE_URL` is compiled in (defaults to `https://hq.al-kamal.net`).

## Linking (first run)

The app has no Google OAuth (Google blocks webviews). Instead:
المقر → الإدارة → **«إنشاء رمز ربط»** → paste the code into the link
window (tray menu ← ربط الجهاز). That mints a normal revocable session,
visible in /admin as «تطبيق المقر».

## Behavior map

- `Ctrl+Shift+A` — toggle the quick-add bar (Esc / click-away hides it;
  it reloads itself in the background after hiding so the next summon is
  both instant and fresh)
- Tray left-click / «فتح المقر» — full HQ window
- «التشغيل مع الويندوز» — autostart toggle (on by default, first run)
- The capture window navigating to `/signin` means no session: the shell
  hides it and opens the link window instead — nobody gets stranded on a
  Google button inside a frameless webview.
