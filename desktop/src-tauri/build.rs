fn main() {
    // app_manifest lists our #[tauri::command]s so tauri-build generates
    // `allow-*` permissions for them — the remote capability needs those
    // to let the /capture page (a remote URL) invoke hide_capture.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "hide_capture",
                "link_device",
                "close_link",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
