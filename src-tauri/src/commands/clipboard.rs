// ============================================================
// Clipboard - 剪贴板命令
// ============================================================

use tauri::image::Image;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// 写入图片到剪贴板
#[tauri::command]
pub async fn write_image_to_clipboard(
    image_bytes: Vec<u8>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // 使用 image crate 解码 PNG 数据
    let decoded_image = image::load_from_memory(&image_bytes)
        .map_err(|e| format!("Failed to decode image: {:?}", e))?;

    // 转换为 RGBA 格式
    let rgba_image = decoded_image.to_rgba8();
    let (width, height) = rgba_image.dimensions();
    let rgba_data = rgba_image.as_raw().to_vec();

    // 创建 Tauri Image
    let image = Image::new_owned(rgba_data, width, height);

    app.clipboard()
        .write_image(&image)
        .map_err(|e| format!("Failed to write image to clipboard: {:?}", e))
}

/// 写入文本到剪贴板
#[tauri::command]
pub async fn write_text_to_clipboard(
    text: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Failed to write text to clipboard: {:?}", e))
}
