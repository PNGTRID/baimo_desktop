/// 打开网站
#[tauri::command]
pub async fn open_website() -> Result<(), String> {
    let url = "https://www.pngtrid.com";
    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|e| format!("Failed to open website: {:?}", e))
}
