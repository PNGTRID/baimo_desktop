use rfd::FileDialog;

/// 打开文件选择对话框
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

    dialog.pick_file()
        .map(|p| p.to_str().map(|s: &str| s.to_string()))
        .ok_or_else(|| "无法打开文件选择对话框".to_string())
}

/// 打开文件夹选择对话框
#[tauri::command]
pub async fn open_folder_dialog(
    title: Option<String>,
) -> Result<Option<String>, String>
{
    let mut dialog = FileDialog::new();

    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }

    dialog.pick_folder()
        .map(|p| p.to_str().map(|s: &str| s.to_string()))
        .ok_or_else(|| "无法打开文件夹选择对话框".to_string())
}

#[derive(serde::Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}
