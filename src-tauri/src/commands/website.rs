use crate::services::Database;
use tauri::State;

/// 打开网站
#[tauri::command]
pub async fn open_website(db: State<'_, Database>) -> Result<(), String> {
    // 从配置读取网站URL，如果不存在则使用默认值
    let url = db.sqlite().query_row(
        "SELECT value FROM app_configs WHERE key = ?1",
        &[&"company_website" as &dyn rusqlite::ToSql],
        |row| row.get::<_, String>(0),
    ).ok().flatten().unwrap_or_else(|| "https://www.pngtrid.com".to_string());

    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|e| format!("打开网站失败: {:?}", e))
}
