// ============================================================
// Settings - 系统设置命令
// ============================================================

use crate::models::{
    AppConfig, UpdateConfigRequest,
    ColorPreset, UpdateColorPresetRequest,
    SystemLog, CreateSystemLogRequest, SystemLogParams, PaginatedSystemLogs,
};
use crate::services::Database;
use tauri::State;

// ============================================================
// 应用配置管理
// ============================================================

/// 获取所有配置
#[tauri::command]
pub async fn get_all_configs(db: State<'_, Database>) -> Result<Vec<AppConfig>, String> {
    db.sqlite().query_map(
        "SELECT id, key, value, description, category, created_at, updated_at
         FROM app_configs ORDER BY category ASC, key ASC",
        &[],
        |row| {
            Ok(AppConfig {
                id: row.get(0)?,
                key: row.get(1)?,
                value: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                created_at: row.get::<_, i64>(5)?.to_string(),
                updated_at: row.get::<_, i64>(6)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch configs: {}", e))
}

/// 获取单个配置
#[tauri::command]
pub async fn get_config(
    key: String,
    db: State<'_, Database>,
) -> Result<Option<AppConfig>, String> {
    db.sqlite().query_row(
        "SELECT id, key, value, description, category, created_at, updated_at
         FROM app_configs WHERE key = ?1",
        &[&key as &dyn rusqlite::ToSql],
        |row| {
            Ok(AppConfig {
                id: row.get(0)?,
                key: row.get(1)?,
                value: row.get(2)?,
                description: row.get(3)?,
                category: row.get(4)?,
                created_at: row.get::<_, i64>(5)?.to_string(),
                updated_at: row.get::<_, i64>(6)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch config: {}", e))
}

/// 更新或创建配置
#[tauri::command]
pub async fn upsert_config(
    request: UpdateConfigRequest,
    db: State<'_, Database>,
) -> Result<AppConfig, String> {
    let now = chrono::Utc::now().timestamp();

    let existing = get_config(request.key.clone(), db.clone()).await?;

    match existing {
        Some(_config) => {
            db.sqlite().execute(
                "UPDATE app_configs SET value = ?1, updated_at = ?2 WHERE key = ?3",
                &[&request.value as &dyn rusqlite::ToSql, &now, &request.key],
            ).map_err(|e| format!("Failed to update config: {}", e))?;
            get_config(request.key, db).await?.ok_or_else(|| "Failed to retrieve updated config".to_string())
        },
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            db.sqlite().execute(
                "INSERT INTO app_configs (id, key, value, category, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                &[
                    &id as &dyn rusqlite::ToSql,
                    &request.key,
                    &request.value,
                    &"GENERAL",
                    &now,
                    &now,
                ],
            ).map_err(|e| format!("Failed to create config: {}", e))?;
            get_config(request.key, db).await?.ok_or_else(|| "Failed to retrieve created config".to_string())
        }
    }
}

/// 批量更新配置
#[tauri::command]
pub async fn batch_update_configs(
    configs: Vec<UpdateConfigRequest>,
    db: State<'_, Database>,
) -> Result<Vec<AppConfig>, String> {
    let mut results = vec![];

    for config in configs {
        let result = upsert_config(config, db.clone()).await?;
        results.push(result);
    }

    Ok(results)
}

/// 删除配置
#[tauri::command]
pub async fn delete_config(
    key: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    db.sqlite().execute(
        "DELETE FROM app_configs WHERE key = ?1",
        &[&key as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete config: {}", e))?;
    Ok(true)
}

// ============================================================
// 颜色预设管理
// ============================================================

/// 获取所有颜色预设
#[tauri::command]
pub async fn get_color_presets(db: State<'_, Database>) -> Result<Vec<ColorPreset>, String> {
    db.sqlite().query_map(
        "SELECT id, name, display_name, color, sort_order, is_active, created_at, updated_at
         FROM color_presets WHERE is_active = 1 ORDER BY sort_order ASC",
        &[],
        |row| {
            Ok(ColorPreset {
                id: row.get(0)?,
                name: row.get(1)?,
                display_name: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
                is_active: row.get(5)?,
                created_at: row.get::<_, i64>(6)?.to_string(),
                updated_at: row.get::<_, i64>(7)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch color presets: {}", e))
}

/// 创建颜色预设
#[tauri::command]
pub async fn create_color_preset(
    name: String,
    display_name: Option<String>,
    color: String,
    sort_order: Option<i32>,
    db: State<'_, Database>,
) -> Result<ColorPreset, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let exists: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM color_presets WHERE name = ?1",
        &[&name as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check name: {}", e))?
    .unwrap_or(0);

    if exists > 0 {
        return Err("Color preset with this name already exists".to_string());
    }

    let max_sort: i32 = match sort_order {
        Some(sort) => sort,
        None => {
            db.sqlite().query_row(
                "SELECT COALESCE(MAX(sort_order), -1) FROM color_presets",
                &[],
                |row| row.get::<_, i32>(0),
            ).map_err(|e| format!("Failed to get max sort: {}", e))?
            .unwrap_or(-1) + 1
        }
    };

    db.sqlite().execute(
        "INSERT INTO color_presets (id, name, display_name, color, sort_order, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &id as &dyn rusqlite::ToSql,
            &name,
            &display_name,
            &color,
            &max_sort,
            &true,
            &now,
            &now,
        ],
    ).map_err(|e| format!("Failed to create color preset: {}", e))?;

    get_color_preset_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve created preset".to_string())
}

/// 根据 ID 获取颜色预设
#[tauri::command]
pub async fn get_color_preset_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<ColorPreset>, String> {
    db.sqlite().query_row(
        "SELECT id, name, display_name, color, sort_order, is_active, created_at, updated_at
         FROM color_presets WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| {
            Ok(ColorPreset {
                id: row.get(0)?,
                name: row.get(1)?,
                display_name: row.get(2)?,
                color: row.get(3)?,
                sort_order: row.get(4)?,
                is_active: row.get(5)?,
                created_at: row.get::<_, i64>(6)?.to_string(),
                updated_at: row.get::<_, i64>(7)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch color preset: {}", e))
}

/// 更新颜色预设
#[tauri::command]
pub async fn update_color_preset(
    id: String,
    request: UpdateColorPresetRequest,
    db: State<'_, Database>,
) -> Result<Option<ColorPreset>, String> {
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref name) = request.name {
        updates.push("name = ?".to_string());
        params.push(name.clone());
    }
    if let Some(ref display_name) = request.display_name {
        updates.push("display_name = ?".to_string());
        params.push(display_name.clone());
    }
    if let Some(ref color) = request.color {
        updates.push("color = ?".to_string());
        params.push(color.clone());
    }
    if let Some(sort_order) = request.sort_order {
        updates.push("sort_order = ?".to_string());
        params.push(sort_order.to_string());
    }
    if let Some(is_active) = request.is_active {
        updates.push("is_active = ?".to_string());
        params.push(if is_active { "1" } else { "0" }.to_string());
    }

    if updates.is_empty() {
        return get_color_preset_by_id(id, db).await;
    }

    updates.push("updated_at = ?".to_string());
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE color_presets SET {} WHERE id = ?", updates.join(", "));

    // 使用块确保 guard 在离开作用域时被释放
    {
        let guard = db.sqlite().connection().lock().unwrap();

        let mut sql_params: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
        sql_params.push(id.as_str());

        guard.prepare(&sql)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?
            .execute(rusqlite::params_from_iter(sql_params.iter()))
            .map_err(|e| format!("Failed to update color preset: {}", e))?;
    } // guard 在此处释放

    get_color_preset_by_id(id, db).await
}

/// 删除颜色预设
#[tauri::command]
pub async fn delete_color_preset(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    db.sqlite().execute(
        "DELETE FROM color_presets WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete color preset: {}", e))?;
    Ok(true)
}

// ============================================================
// 系统日志管理
// ============================================================

/// 获取系统日志列表（分页）
#[tauri::command]
pub async fn get_system_logs(
    params: SystemLogParams,
    db: State<'_, Database>,
) -> Result<PaginatedSystemLogs, String> {
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(50);
    let offset = (page - 1) * page_size;

    let where_clause = match &params.level {
        Some(level) => format!("WHERE level = '{}'", level),
        None => String::new(),
    };

    let total: i32 = db.sqlite().query_row(
        &format!("SELECT COUNT(*) FROM system_logs {}", where_clause),
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to count logs: {}", e))?
    .unwrap_or(0);

    let data = db.sqlite().query_map(
        &format!(
            "SELECT id, level, message, metadata, operator_name, created_at
             FROM system_logs
             {}
             ORDER BY created_at DESC
             LIMIT ?1 OFFSET ?2",
            where_clause
        ),
        &[&page_size as &dyn rusqlite::ToSql, &offset],
        |row| {
            Ok(SystemLog {
                id: row.get(0)?,
                level: row.get(1)?,
                message: row.get(2)?,
                metadata: row.get(3)?,
                operator_name: row.get(4)?,
                created_at: row.get::<_, i64>(5)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch logs: {}", e))?;

    let total_pages = (total as f64 / page_size as f64).ceil() as i32;

    Ok(PaginatedSystemLogs {
        data,
        total,
        page,
        page_size,
        total_pages,
    })
}

/// 创建系统日志
#[tauri::command]
pub async fn create_system_log(
    request: CreateSystemLogRequest,
    db: State<'_, Database>,
) -> Result<SystemLog, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    match request.level.as_str() {
        "INFO" | "WARNING" | "ERROR" => {},
        _ => return Err("Invalid log level. Must be INFO, WARNING, or ERROR".to_string()),
    }

    db.sqlite().execute(
        "INSERT INTO system_logs (id, level, message, metadata, operator_name, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.level,
            &request.message,
            &request.metadata,
            &"System",
            &now,
        ],
    ).map_err(|e| format!("Failed to create log: {}", e))?;

    get_system_log_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve created log".to_string())
}

/// 根据 ID 获取系统日志
#[tauri::command]
pub async fn get_system_log_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<SystemLog>, String> {
    db.sqlite().query_row(
        "SELECT id, level, message, metadata, operator_name, created_at
         FROM system_logs WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| {
            Ok(SystemLog {
                id: row.get(0)?,
                level: row.get(1)?,
                message: row.get(2)?,
                metadata: row.get(3)?,
                operator_name: row.get(4)?,
                created_at: row.get::<_, i64>(5)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch system log: {}", e))
}

/// 清理旧日志
#[tauri::command]
pub async fn cleanup_old_logs(
    days: i32,
    db: State<'_, Database>,
) -> Result<i32, String> {
    let cutoff_time = chrono::Utc::now() - chrono::Duration::days(days as i64);

    let deleted = db.sqlite().execute(
        "DELETE FROM system_logs WHERE created_at < ?1",
        &[&cutoff_time.timestamp() as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to cleanup logs: {}", e))?;

    Ok(deleted as i32)
}

/// 获取日志统计
#[tauri::command]
pub async fn get_log_stats(
    days: Option<i32>,
    db: State<'_, Database>,
) -> Result<serde_json::Value, String> {
    let days = days.unwrap_or(30);
    let cutoff_time = chrono::Utc::now() - chrono::Duration::days(days as i64);

    let stats = db.sqlite().query_map(
        "SELECT level, COUNT(*) as count
         FROM system_logs
         WHERE created_at >= ?1
         GROUP BY level",
        &[&cutoff_time.timestamp() as &dyn rusqlite::ToSql],
        |row| {
            Ok(serde_json::json!({
                "level": row.get::<_, String>(0)?,
                "count": row.get::<_, i32>(1)?,
            }))
        },
    ).map_err(|e| format!("Failed to fetch log stats: {}", e))?;

    Ok(serde_json::json!({
        "period_days": days,
        "stats": stats,
    }))
}
