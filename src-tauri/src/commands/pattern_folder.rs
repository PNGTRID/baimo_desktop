// ============================================================
// PatternFolder - 图案文件夹管理命令
// ============================================================

use crate::models::{PatternFolder, CreateFolderRequest, UpdateFolderRequest, FolderTreeNode};
use crate::services::Database;
use tauri::State;

/// 获取所有文件夹列表（扁平结构）
#[tauri::command]
pub async fn get_folders(db: State<'_, Database>) -> Result<Vec<PatternFolder>, String> {
    db.sqlite().query_map(
        "SELECT id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at
         FROM pattern_folders ORDER BY sort_order ASC, name ASC",
        &[],
        |row| {
            Ok(PatternFolder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                level: row.get(3)?,
                path: row.get(4)?,
                sort_order: row.get(5)?,
                customer_id: row.get(6)?,
                is_system: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get::<_, i64>(9)?.to_string(),
                updated_at: row.get::<_, i64>(10)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch folders: {:?}", e))
}

/// 获取文件夹树形结构
#[tauri::command]
pub async fn get_folder_tree(db: State<'_, Database>) -> Result<Vec<FolderTreeNode>, String> {
    // 获取所有文件夹
    let folders = get_folders(db.clone()).await?;

    // 获取每个文件夹的图案数量
    let mut pattern_counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();

    for folder in &folders {
        let count: i32 = db.sqlite().query_row(
            "SELECT COUNT(*) FROM patterns WHERE folderId = ?1 AND isActive = 1",
            &[&folder.id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to count patterns: {:?}", e))?
        .unwrap_or(0);
        pattern_counts.insert(folder.id.clone(), count);
    }

    // 构建树形结构
    fn build_tree(
        parent_id: &Option<String>,
        folders: &[PatternFolder],
        pattern_counts: &std::collections::HashMap<String, i32>,
    ) -> Vec<FolderTreeNode> {
        folders
            .iter()
            .filter(|f| &f.parent_id == parent_id && f.is_active)
            .map(|folder| {
                let count = pattern_counts.get(&folder.id).copied().unwrap_or(0);
                let children = build_tree(&Some(folder.id.clone()), folders, pattern_counts);

                FolderTreeNode {
                    id: folder.id.clone(),
                    name: folder.name.clone(),
                    parent_id: folder.parent_id.clone(),
                    level: folder.level,
                    path: folder.path.clone(),
                    pattern_count: count,
                    children,
                }
            })
            .collect()
    }

    Ok(build_tree(&None, &folders, &pattern_counts))
}

/// 根据 ID 获取文件夹
#[tauri::command]
pub async fn get_folder_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<PatternFolder>, String> {
    db.sqlite().query_row(
        "SELECT id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at
         FROM pattern_folders WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| {
            Ok(PatternFolder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                level: row.get(3)?,
                path: row.get(4)?,
                sort_order: row.get(5)?,
                customer_id: row.get(6)?,
                is_system: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get::<_, i64>(9)?.to_string(),
                updated_at: row.get::<_, i64>(10)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch folder: {:?}", e))
}

/// 创建文件夹
#[tauri::command]
pub async fn create_folder(
    request: CreateFolderRequest,
    db: State<'_, Database>,
) -> Result<PatternFolder, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 计算层级和路径
    let (level, path) = match &request.parent_id {
        Some(parent_id) => {
            let parent = get_folder_by_id(parent_id.clone(), db.clone()).await?
                .ok_or_else(|| "Parent folder not found".to_string())?;
            let level = parent.level + 1;
            let path = format!("{}/{}", parent.path, request.name);
            (level, path)
        },
        None => (0, format!("/{}", request.name)),
    };

    // 获取最大排序号
    let max_sort: i32 = db.sqlite().query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM pattern_folders",
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get max sort order: {:?}", e))?
    .unwrap_or(-1);

    db.sqlite().execute(
        "INSERT INTO pattern_folders (id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.name,
            &request.parent_id,
            &level,
            &path,
            &(max_sort + 1),
            &request.customer_id,
            &false, // is_system
            &true,  // is_active
            &now,
            &now,
        ],
    ).map_err(|e| format!("Failed to create folder: {:?}", e))?;

    get_folder_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve created folder".to_string())
}

/// 更新文件夹
#[tauri::command]
pub async fn update_folder(
    id: String,
    request: UpdateFolderRequest,
    db: State<'_, Database>,
) -> Result<Option<PatternFolder>, String> {
    // 构建动态 UPDATE 语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref name) = request.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(sort_order) = request.sort_order {
        updates.push("sort_order = ?");
        params.push(sort_order.to_string());
    }
    if let Some(is_active) = request.is_active {
        updates.push("isActive = ?");
        params.push(if is_active { "1" } else { "0" }.to_string());
    }

    if updates.is_empty() {
        return get_folder_by_id(id, db).await;
    }

    updates.push("updated_at = ?");
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE pattern_folders SET {} WHERE id = ?", updates.join(", "));

    // 使用块确保 conn 在 await 前释放
    {
        let conn = db.sqlite().connection();
        let conn = conn.lock().unwrap();

        let mut sql_params: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
        sql_params.push(&id.as_str());

        conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare statement: {:?}", e))?
            .execute(rusqlite::params_from_iter(sql_params.iter()))
            .map_err(|e| format!("Failed to update folder: {:?}", e))?;
    } // conn 在此处释放

    get_folder_by_id(id, db).await
}

/// 删除文件夹
#[tauri::command]
pub async fn delete_folder(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    // 检查是否有子文件夹
    let child_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM pattern_folders WHERE parent_id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check child folders: {:?}", e))?
    .unwrap_or(0);

    if child_count > 0 {
        return Err("Cannot delete folder with subfolders. Please delete or move subfolders first.".to_string());
    }

    // 检查是否有图案
    let pattern_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM patterns WHERE folderId = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check patterns: {:?}", e))?
    .unwrap_or(0);

    if pattern_count > 0 {
        return Err("Cannot delete folder with patterns. Please delete or move patterns first.".to_string());
    }

    // 检查是否为系统文件夹
    let folder = get_folder_by_id(id.clone(), db.clone()).await?
        .ok_or_else(|| "Folder not found".to_string())?;

    if folder.is_system {
        return Err("Cannot delete system folder.".to_string());
    }

    db.sqlite().execute(
        "DELETE FROM pattern_folders WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete folder: {:?}", e))?;

    Ok(true)
}

/// 移动文件夹到新的父文件夹
#[tauri::command]
pub async fn move_folder(
    id: String,
    new_parent_id: Option<String>,
    db: State<'_, Database>,
) -> Result<PatternFolder, String> {
    // 检查目标父文件夹是否为当前文件夹的子文件夹（防止循环）
    if let Some(ref parent_id) = new_parent_id {
        let mut current_parent = parent_id.clone();
        let mut visited = std::collections::HashSet::new();

        while let Some(folder) = get_folder_by_id(current_parent.clone(), db.clone()).await? {
            if folder.id == id {
                return Err("Cannot move folder to its own subfolder.".to_string());
            }
            if visited.contains(&folder.id) {
                return Err("Detected folder cycle.".to_string());
            }
            visited.insert(folder.id.clone());

            match folder.parent_id {
                Some(pid) => current_parent = pid,
                None => break,
            }
        }
    }

    // 获取当前文件夹
    let folder = get_folder_by_id(id.clone(), db.clone()).await?
        .ok_or_else(|| "Folder not found".to_string())?;

    // 计算新的层级和路径
    let (new_level, new_path) = match &new_parent_id {
        Some(parent_id) => {
            let parent = get_folder_by_id(parent_id.clone(), db.clone()).await?
                .ok_or_else(|| "Parent folder not found".to_string())?;
            let level = parent.level + 1;
            let path = format!("{}/{}", parent.path, folder.name);
            (level, path)
        },
        None => (0, format!("/{}", folder.name)),
    };

    // 更新文件夹
    let now = chrono::Utc::now().timestamp();
    db.sqlite().execute(
        "UPDATE pattern_folders SET parent_id = ?1, level = ?2, path = ?3, updated_at = ?4 WHERE id = ?5",
        &[
            &new_parent_id as &dyn rusqlite::ToSql,
            &new_level,
            &new_path,
            &now,
            &id,
        ],
    ).map_err(|e| format!("Failed to move folder: {:?}", e))?;

    // 递归更新所有子文件夹的层级和路径
    fn update_children_paths(
        db: &Database,
        parent_id: &str,
        parent_path: &str,
        parent_level: i32,
    ) -> Result<(), String> {
        let children = db.sqlite().query_map(
            "SELECT id, name FROM pattern_folders WHERE parent_id = ?1",
            &[&parent_id as &dyn rusqlite::ToSql],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        ).map_err(|e| format!("Failed to fetch children: {:?}", e))?;

        for (child_id, child_name) in children {
            let child_path = format!("{}/{}", parent_path, child_name);
            let child_level = parent_level + 1;
            let now = chrono::Utc::now().timestamp();

            db.sqlite().execute(
                "UPDATE pattern_folders SET level = ?1, path = ?2, updated_at = ?3 WHERE id = ?4",
                &[
                    &child_level as &dyn rusqlite::ToSql,
                    &child_path,
                    &now,
                    &child_id,
                ],
            ).map_err(|e| format!("Failed to update child folder: {:?}", e))?;

            update_children_paths(db, &child_id, &child_path, child_level)?;
        }

        Ok(())
    }

    update_children_paths(&db, &id, &new_path, new_level)?;

    get_folder_by_id(id, db).await?
        .ok_or_else(|| "Failed to retrieve moved folder".to_string())
}
