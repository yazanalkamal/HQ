// HQ desktop shell — tray + global quick-add. All UI is the web app
// itself (remote URLs); the only bundled page is the link-device dialog.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::ShortcutState;

/// The HQ deployment this shell fronts. Compile a dev build with:
/// `$env:HQ_BASE_URL = "http://localhost:3000"; npm run build`
const BASE_URL: &str = match option_env!("HQ_BASE_URL") {
    Some(url) => url,
    None => "https://hq.al-kamal.net",
};

/// Marks desktop sessions so /admin shows them as «تطبيق المقر».
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) HQDesktop/1.0";

const QUICK_ADD_SHORTCUT: &str = "ctrl+shift+a";

/// Set while a link code is being claimed: the next /capture navigation
/// reveals the window — the bar appearing IS the success feedback.
static LINKING: AtomicBool = AtomicBool::new(false);

/// When the quick-add window was last shown (unix ms). Showing an
/// always-on-top window from a hotkey emits a spurious Focused(false)
/// while Windows sorts out foreground rights — the blur-hide handler
/// must ignore blurs in that window or it re-hides the bar instantly.
static LAST_SHOW_MS: AtomicU64 = AtomicU64::new(0);
const BLUR_GRACE_MS: u64 = 600;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn show_capture_window(win: &WebviewWindow) {
    LAST_SHOW_MS.store(now_ms(), Ordering::SeqCst);
    let _ = win.center();
    let _ = win.show();
    let _ = win.set_focus();
    // the first set_focus can lose the foreground race — assert it again
    // once Windows has settled
    let retry = win.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(150));
        let _ = retry.set_focus();
    });
}

fn hq_url(path: &str) -> Url {
    format!("{BASE_URL}{path}").parse().expect("valid HQ url")
}

/// The quick-add window: pre-created hidden so the shortcut is instant.
fn ensure_capture(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    if let Some(win) = app.get_webview_window("capture") {
        return Ok(win);
    }
    let handle = app.clone();
    WebviewWindowBuilder::new(app, "capture", WebviewUrl::External(hq_url("/capture")))
        .title("إضافة سريعة — المقر")
        .inner_size(660.0, 500.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        // the bar paints its own CSS shadow; a native shadow would draw a
        // rectangle around the transparent window bounds
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .center()
        .user_agent(USER_AGENT)
        .on_navigation(move |nav| {
            // NEVER create/show/close windows synchronously in here — this
            // callback runs inside WebView2's navigation event, and window
            // ops re-enter the webview and abort the navigation itself.
            // Decide here, act on a fresh thread.
            let path = nav.path();
            if path == "/signin" {
                // No session (unlinked, expired, or a bad code) — never
                // strand the user on a signin page in a frameless window:
                // hide it and hand off to the link dialog.
                let code_error = nav.query().unwrap_or("").contains("error=device");
                let app = handle.clone();
                std::thread::spawn(move || {
                    if let Some(win) = app.get_webview_window("capture") {
                        let _ = win.hide();
                    }
                    let _ = open_link_window(
                        &app,
                        code_error.then_some(
                            "رمز الربط غير صالح أو انتهت مدته — أنشئ رمزًا جديدًا من الإدارة.",
                        ),
                    );
                });
            } else if path == "/capture" && LINKING.swap(false, Ordering::SeqCst) {
                // claim succeeded — show the bar, retire the link dialog
                let app = handle.clone();
                std::thread::spawn(move || {
                    if let Some(win) = app.get_webview_window("capture") {
                        show_capture_window(&win);
                    }
                    if let Some(link) = app.get_webview_window("link") {
                        let _ = link.close();
                    }
                });
            }
            true
        })
        .build()
}

fn toggle_capture(app: &AppHandle) {
    let Ok(win) = ensure_capture(app) else { return };
    let visible = win.is_visible().unwrap_or(false);
    eprintln!("[hq] toggle_capture: visible={visible}");
    if visible {
        hide_and_refresh(&win);
    } else {
        show_capture_window(&win);
    }
}

/// Hide, then reload in the background: the next summon is both instant
/// (window already alive) and fresh (today's date, current areas/plans).
fn hide_and_refresh(win: &WebviewWindow) {
    eprintln!("[hq] hide_and_refresh");
    let _ = win.hide();
    let _ = win.eval("window.location.reload()");
}

fn open_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(hq_url("/today")))
        .title("المقر")
        .inner_size(1360.0, 860.0)
        .center()
        .user_agent(USER_AGENT)
        .build();
}

fn open_link_window(app: &AppHandle, error: Option<&str>) -> tauri::Result<()> {
    let win = match app.get_webview_window("link") {
        Some(win) => win,
        None => WebviewWindowBuilder::new(app, "link", WebviewUrl::App("index.html".into()))
            .title("ربط الجهاز — المقر")
            .inner_size(460.0, 460.0)
            .resizable(false)
            .maximizable(false)
            .center()
            .build()?,
    };
    let _ = win.show();
    let _ = win.set_focus();
    if let Some(message) = error {
        // the window already existed in every error path (the claim was
        // submitted from it), so the listener is attached by now
        let _ = app.emit_to("link", "link-status", message);
    }
    Ok(())
}

#[tauri::command]
fn hide_capture(app: AppHandle) {
    if let Some(win) = app.get_webview_window("capture") {
        hide_and_refresh(&win);
    }
}

#[tauri::command]
fn link_device(app: AppHandle, code: String) -> Result<(), String> {
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err("اكتب الرمز أولًا.".into());
    }
    LINKING.store(true, Ordering::SeqCst);
    let win = ensure_capture(&app).map_err(|e| e.to_string())?;
    let mut claim = hq_url("/api/device/claim");
    claim.query_pairs_mut().append_pair("code", &code);
    win.navigate(claim).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_link(app: AppHandle) {
    if let Some(win) = app.get_webview_window("link") {
        let _ = win.close();
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "فتح المقر", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "إضافة سريعة", true, Some("Ctrl+Shift+A"))?;
    let link = MenuItem::with_id(app, "link", "ربط الجهاز", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "التشغيل مع الويندوز",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "إنهاء", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &quick,
            &PredefinedMenuItem::separator(app)?,
            &link,
            &autostart,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let autostart_item = autostart.clone();
    TrayIconBuilder::with_id("tray")
        .icon(app.default_window_icon().expect("bundled icon").clone())
        .tooltip("المقر — Ctrl+Shift+A للإضافة السريعة")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => open_main(app),
            "quick" => toggle_capture(app),
            "link" => {
                let _ = open_link_window(app, None);
            }
            "autostart" => {
                // CheckMenuItem flips itself on click — make reality match it
                let want = autostart_item.is_checked().unwrap_or(false);
                let manager = app.autolaunch();
                let _ = if want { manager.enable() } else { manager.disable() };
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // relaunching the exe routes to the running instance:
            // `--quick` summons the quick-add bar (Stream Deck friendly),
            // anything else opens the app window
            if argv.iter().any(|a| a == "--quick") {
                toggle_capture(app);
            } else {
                open_main(app);
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([QUICK_ADD_SHORTCUT])
                .expect("parse quick-add shortcut")
                .with_handler(|app, _shortcut, event| {
                    eprintln!("[hq] shortcut event: {:?}", event.state());
                    if event.state() == ShortcutState::Pressed {
                        toggle_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![hide_capture, link_device, close_link])
        .setup(|app| {
            build_tray(app)?;

            // quick-add must always be resident → autostart on by default,
            // but only once: a disable from the tray menu must stick
            let flag = app.path().app_data_dir()?.join(".autostart-set");
            if !flag.exists() {
                let _ = app.autolaunch().enable();
                if let Some(dir) = flag.parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                let _ = std::fs::write(&flag, b"1");
            } else if app.autolaunch().is_enabled().unwrap_or(false) {
                // refresh the registered path — the exe may have moved
                // (e.g. dev build → installed release)
                let _ = app.autolaunch().enable();
            }

            // pre-create the hidden quick-add window: the shortcut is instant
            let _ = ensure_capture(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // quick-add hides when it loses focus — click anywhere else and it's gone
            if window.label() == "capture" && matches!(event, WindowEvent::Focused(false)) {
                let since_show = now_ms().saturating_sub(LAST_SHOW_MS.load(Ordering::SeqCst));
                eprintln!(
                    "[hq] capture blur (visible={:?}, since_show={since_show}ms)",
                    window.is_visible()
                );
                if since_show < BLUR_GRACE_MS {
                    return; // spurious blur from the show itself
                }
                if window.is_visible().unwrap_or(false) {
                    if let Some(win) = window.app_handle().get_webview_window("capture") {
                        hide_and_refresh(&win);
                    }
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error building HQ desktop")
        .run(|_app, event| {
            // tray-resident: closing the last window must not exit the app;
            // only the tray's «إنهاء» (app.exit) does
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
