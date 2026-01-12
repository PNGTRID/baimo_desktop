use rfd::FileDialog;
use std::fs;

/// 打开文件选择对话框
/// 用户取消时返回 Ok(None)，对话框打开失败时返回 Err
#[tauri::command]
pub async fn open_file_dialog(
    title: Option<String>,
    filters: Option<Vec<FileFilter>>,
) -> Result<Option<String>, String>
{
    let mut dialog = FileDialog::new();

    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }

    // 添加文件过滤器
    if let Some(filter_list) = filters {
        for filter in filter_list {
            if !filter.extensions.is_empty() {
                dialog = dialog.add_filter(&filter.name, &filter.extensions);
            }
        }
    }

    // 用户取消时返回 Ok(None)，而不是 Err
    Ok(dialog.pick_file()
        .and_then(|p| p.to_str().map(|s| s.to_string())))
}

/// 打开文件夹选择对话框
/// 用户取消时返回 Ok(None)，对话框打开失败时返回 Err
#[tauri::command]
pub async fn open_folder_dialog(
    title: Option<String>,
) -> Result<Option<String>, String>
{
    let mut dialog = FileDialog::new();

    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }

    // 用户取消时返回 Ok(None)，而不是 Err
    Ok(dialog.pick_folder()
        .and_then(|p| p.to_str().map(|s| s.to_string())))
}

/// 保存文件对话框
/// 用户取消时返回 Ok(None)，对话框打开失败时返回 Err
#[tauri::command]
pub async fn save_file_dialog(
    title: Option<String>,
    default_name: Option<String>,
    filters: Option<Vec<FileFilter>>,
) -> Result<Option<String>, String>
{
    let mut dialog = FileDialog::new();

    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    // 添加文件过滤器
    if let Some(filter_list) = filters {
        for filter in filter_list {
            if !filter.extensions.is_empty() {
                dialog = dialog.add_filter(&filter.name, &filter.extensions);
            }
        }
    }

    // 用户取消时返回 Ok(None)，而不是 Err
    Ok(dialog.save_file()
        .and_then(|p| p.to_str().map(|s| s.to_string())))
}

/// 保存文本内容到文件
#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("写入文件失败: {}", e))
}

/// 读取文本文件内容
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[derive(serde::Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}
