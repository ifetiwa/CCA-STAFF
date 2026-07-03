// Tauri application entry point (shared by desktop main.rs and mobile).
// The frontend is the built React app in ../dist; it talks to the Django
// backend over HTTP using the URL configured in the app (see src/utils/api.js).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running the CCA Staff application");
}
