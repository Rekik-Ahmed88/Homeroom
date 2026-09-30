use tauri::Manager;

mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
    // The QR-pairing barcode scanner only exists on mobile targets.
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    builder
        .manage(sync::SyncState::default())
        .invoke_handler(tauri::generate_handler![
            sync::sync_host_start,
            sync::sync_host_stop,
            sync::sync_host_send,
            sync::sync_connect,
            sync::sync_send,
            sync::sync_close,
        ])
        .setup(|app| {
            // The window starts hidden (tauri.conf.json "visible": false) so
            // no white frame shows before the webview paints. The frontend
            // shows it after first paint; this thread is the safety net in
            // case that JS never runs.
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(5));
                    if window.is_visible().unwrap_or(false) {
                        return;
                    }
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
