// ============================================================
// Settings - 系统设置命令
// ============================================================

use crate::models::{
    AppConfig, UpdateConfigRequest,
    ColorPreset, UpdateColorPresetRequest,
    SystemLog, CreateSystemLogRequest, SystemLogParams, PaginatedSystemLogs,
};
use crate::services::Database;
use tauri::{State, Manager};

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

    let operation = match existing {
        Some(_) => "更新",
        None => "创建",
    };

    let (key, value) = (request.key.clone(), request.value.clone());

    let result = match existing {
        Some(_config) => {
            db.sqlite().execute(
                "UPDATE app_configs SET value = ?1, updated_at = ?2 WHERE key = ?3",
                &[&value as &dyn rusqlite::ToSql, &now, &key],
            ).map_err(|e| format!("Failed to update config: {}", e))?;
            get_config(key, db.clone()).await?.ok_or_else(|| "Failed to retrieve updated config".to_string())
        },
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            db.sqlite().execute(
                "INSERT INTO app_configs (id, key, value, category, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                &[
                    &id as &dyn rusqlite::ToSql,
                    &key,
                    &value,
                    &"GENERAL",
                    &now,
                    &now,
                ],
            ).map_err(|e| format!("Failed to create config: {}", e))?;
            get_config(key, db.clone()).await?.ok_or_else(|| "Failed to retrieve created config".to_string())
        }
    };

    // 记录配置变更日志
    let _ = create_system_log(CreateSystemLogRequest {
        level: "INFO".to_string(),
        message: format!("配置{}: {} = {}", operation, request.key, request.value),
        metadata: Some(serde_json::json!({
            "operation": operation,
            "key": request.key,
            "value": request.value,
        }).to_string()),
    }, db.clone()).await;

    result
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

// ============================================================
// 配置初始化
// ============================================================

/// 初始化默认应用配置（如果不存在）
/// 直接使用 Database 而不是 State，用于应用启动时初始化
pub fn initialize_default_configs_sync(db: &Database) -> Result<Vec<AppConfig>, String> {
    let now = chrono::Utc::now().timestamp();

    // 定义默认配置
    let default_configs = vec![
        ("company_name", "白墨印花", "公司完整名称", "GENERAL"),
        ("company_short_name", "白墨", "公司简称", "GENERAL"),
        ("company_english_name", "Baimo Printing", "公司英文名称", "GENERAL"),
        ("default_price_per_sq", "100", "默认每平方单价（元/平方米）", "PRICING"),
        ("default_credit_limit", "10000", "默认信用额度", "PRICING"),
        ("default_bleed_height", "2.0", "默认出血高度（厘米）", "PRICING"),
        ("pricing_formula_constant", "1600", "价格公式常数", "PRICING"),
        ("log_retention_days", "90", "日志保留天数", "SYSTEM"),
    ];

    let mut results = vec![];

    for (key, value, description, category) in default_configs {
        // 检查配置是否已存在
        let existing = db.sqlite().query_row(
            "SELECT id FROM app_configs WHERE key = ?1",
            &[&key as &dyn rusqlite::ToSql],
            |row| row.get::<_, String>(0),
        );

        // 如果不存在，则创建
        if existing.ok().flatten().is_none() {
            let id = uuid::Uuid::new_v4().to_string();
            db.sqlite().execute(
                "INSERT INTO app_configs (id, key, value, description, category, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                &[
                    &id as &dyn rusqlite::ToSql,
                    &key,
                    &value,
                    &description,
                    &category,
                    &now,
                    &now,
                ],
            ).map_err(|e| format!("Failed to create default config {}: {}", key, e))?;

            // 获取刚创建的配置
            let config = AppConfig {
                id,
                key: key.to_string(),
                value: value.to_string(),
                description: Some(description.to_string()),
                category: category.to_string(),
                created_at: now.to_string(),
                updated_at: now.to_string(),
            };
            results.push(config);
            println!("[配置初始化] 创建默认配置: {} = {}", key, value);
        } else {
            println!("[配置初始化] 配置已存在，跳过: {}", key);
        }
    }

    Ok(results)
}

/// 初始化默认应用配置（如果不存在）- Tauri 命令版本
#[tauri::command]
pub async fn initialize_default_configs(db: State<'_, Database>) -> Result<Vec<AppConfig>, String> {
    initialize_default_configs_sync(&db)
}

// ============================================================
// 收款码管理
// ============================================================

/// 上传收款码
#[tauri::command]
pub async fn upload_payment_qrcode(
    payment_type: String,
    file_path: String,
    app: tauri::AppHandle,
    db: State<'_, Database>,
) -> Result<String, String> {
    // 1. 验证支付类型
    if payment_type != "alipay" && payment_type != "wechat" {
        return Err("不支持的支付类型，仅支持 alipay（支付宝）或 wechat（微信）".to_string());
    }

    // 2. 获取应用数据目录并创建收款码文件夹
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let qrcode_dir = app_data_dir.join("qrcodes");
    std::fs::create_dir_all(&qrcode_dir)
        .map_err(|e| format!("Failed to create qrcodes directory: {}", e))?;

    // 3. 复制文件到收款码目录
    let source_path = std::path::Path::new(&file_path);
    if !source_path.exists() {
        return Err("源文件不存在".to_string());
    }

    let file_extension = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest_file_name = format!("payment_{}.{}", payment_type, file_extension);
    let dest_path = qrcode_dir.join(&dest_file_name);

    std::fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to copy qrcode file: {}", e))?;

    // 4. 保存配置到数据库
    let config_key = format!("payment_{}_qrcode", payment_type);
    let config_value = dest_path.to_string_lossy().to_string();
    let display_name = if payment_type == "alipay" {
        "支付宝收款码"
    } else {
        "微信收款码"
    };

    let now = chrono::Utc::now().timestamp();

    // 检查配置是否已存在
    let existing: Option<String> = db.sqlite().query_row(
        "SELECT id FROM app_configs WHERE key = ?1",
        &[&config_key as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).ok().flatten();

    if existing.is_some() {
        // 更新现有配置
        db.sqlite().execute(
            "UPDATE app_configs SET value = ?1, description = ?2, category = 'PAYMENT', updated_at = ?3 WHERE key = ?4",
            &[&config_value as &dyn rusqlite::ToSql, &display_name, &now, &config_key],
        ).map_err(|e| format!("Failed to update qrcode config: {}", e))?;
    } else {
        // 创建新配置
        let id = uuid::Uuid::new_v4().to_string();
        db.sqlite().execute(
            "INSERT INTO app_configs (id, key, value, description, category, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'PAYMENT', ?5, ?6)",
            &[&id as &dyn rusqlite::ToSql, &config_key, &config_value, &display_name, &now, &now],
        ).map_err(|e| format!("Failed to create qrcode config: {}", e))?;
    }

    // 5. 记录系统日志
    let _ = create_system_log(CreateSystemLogRequest {
        level: "INFO".to_string(),
        message: format!("上传{}收款码: {}", display_name, dest_path.display()),
        metadata: Some(serde_json::json!({
            "payment_type": payment_type,
            "file_path": dest_path.to_string_lossy().to_string(),
        }).to_string()),
    }, db).await;

    Ok(config_value)
}

/// 获取收款码路径
#[tauri::command]
pub async fn get_payment_qrcode(
    payment_type: String,
    db: State<'_, Database>,
) -> Result<Option<String>, String> {
    let config_key = format!("payment_{}_qrcode", payment_type);

    let result: Option<String> = db.sqlite().query_row(
        "SELECT value FROM app_configs WHERE key = ?1",
        &[&config_key as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).ok().flatten();

    Ok(result)
}

/// 获取收款码图片（Base64格式）
#[tauri::command]
pub async fn get_payment_qrcode_image(
    payment_type: String,
    db: State<'_, Database>,
) -> Result<Option<String>, String> {
    use base64::Engine;

    // 获取收款码文件路径
    let file_path = match get_payment_qrcode(payment_type, db).await? {
        Some(path) => path,
        None => return Ok(None),
    };

    // 读取图片文件
    let image_bytes = std::fs::read(&file_path)
        .map_err(|e| format!("读取收款码图片失败: {}", e))?;

    // 转换为Base64
    let base64_string = base64::engine::general_purpose::STANDARD.encode(&image_bytes);

    // 判断图片类型
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    Ok(Some(format!("data:image/{};base64,{}", ext, base64_string)))
}
