use crate::models::ColorPreset;
use crate::services::Database;
use tauri::State;

/// 初始化公司配置种子数据
#[tauri::command]
pub async fn seed_company_configs(db: State<'_, Database>) -> Result<(), String> {
    println!("[种子数据] 开始初始化公司配置...");

    // 检查是否已有公司名称配置
    let existing_count: i32 = db
        .sqlite()
        .query_row(
            "SELECT COUNT(*) FROM app_configs WHERE key IN ('company_name', 'company_short_name', 'company_english_name')",
            &[],
            |row| row.get(0)
        )
        .map_err(|e| format!("Failed to check existing configs: {}", e))?
        .unwrap_or(0);

    if existing_count >= 3 {
        println!("[种子数据] 已存在公司配置，跳过初始化");
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp();
    let configs = vec![
        ("company_name", "白墨记账系统", "公司完整名称"),
        ("company_short_name", "白墨", "公司简称"),
        ("company_english_name", "BAIMO", "公司英文名称"),
    ];

    println!("[种子数据] 准备插入 {} 条公司配置", configs.len());

    for (key, value, description) in &configs {
        let id = uuid::Uuid::new_v4().to_string();

        match db.sqlite().execute(
            "INSERT INTO app_configs (id, key, value, description, category, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            &[
                &id as &dyn rusqlite::ToSql,
                &key,
                &value,
                &description,
                &"GENERAL",
                &now,
                &now,
            ],
        ) {
            Ok(_) => {
                println!("[种子数据] ✓ 创建配置: {} = {}", key, value);
            }
            Err(e) => {
                eprintln!("[种子数据] ✗ 创建配置失败: {} - {}", key, e);
            }
        }
    }

    println!("[种子数据] 公司配置初始化完成");
    Ok(())
}

/// 初始化颜色预设种子数据
#[tauri::command]
pub async fn seed_color_presets(db: State<'_, Database>) -> Result<Vec<ColorPreset>, String> {
    println!("[种子数据] 开始初始化颜色预设...");

    // 检查是否已有数据
    let existing_count: i32 = db
        .sqlite()
        .query_row("SELECT COUNT(*) FROM color_presets", &[], |row| row.get(0))
        .map_err(|e| format!("Failed to check existing presets: {}", e))?
        .unwrap_or(0);

    if existing_count > 0 {
        println!(
            "[种子数据] 已存在 {} 条颜色预设，跳过初始化",
            existing_count
        );
        return get_all_color_presets(db).await;
    }

    // 常用颜色预设数据（印花行业常用颜色）
    let presets = vec![
        ("black", "黑色", "#000000"),
        ("white", "白色", "#FFFFFF"),
    ];

    println!("[种子数据] 准备插入 {} 条颜色预设", presets.len());

    let mut created_presets = Vec::new();

    for (index, (name, display_name, color)) in presets.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        match db.sqlite().execute(
            "INSERT INTO color_presets (id, name, display_name, color, sort_order, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            &[
                &id as &dyn rusqlite::ToSql,
                &name,
                &display_name,
                &color,
                &(index as i32),
                &true,
                &now,
                &now,
            ],
        ) {
            Ok(_) => {
                println!(
                    "[种子数据] ✓ 创建颜色预设: {} ({})",
                    display_name, color
                );
                created_presets.push(ColorPreset {
                    id,
                    name: name.to_string(),
                    display_name: Some(display_name.to_string()),
                    color: color.to_string(),
                    sort_order: index as i32,
                    is_active: true,
                    created_at: now.to_string(),
                    updated_at: now.to_string(),
                });
            }
            Err(e) => {
                eprintln!("[种子数据] ✗ 创建颜色预设失败: {} - {}", name, e);
            }
        }
    }

    println!(
        "[种子数据] 初始化完成，成功创建 {} 条颜色预设",
        created_presets.len()
    );
    Ok(created_presets)
}

async fn get_all_color_presets(db: State<'_, Database>) -> Result<Vec<ColorPreset>, String> {
    db.sqlite()
        .query_map(
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
        )
        .map_err(|e| format!("Failed to fetch color presets: {}", e))
}

/// 执行数据库迁移 - 添加缺失的 is_active 列
#[tauri::command]
pub async fn run_migrations(db: State<'_, Database>) -> Result<String, String> {
    eprintln!("[迁移] 开始执行数据库迁移...");

    let mut migrations_applied = Vec::new();

    // 尝试添加 pattern_folders.is_active 列（如果已存在会忽略）
    let folder_result = db.sqlite().execute(
        "ALTER TABLE pattern_folders ADD COLUMN is_active BOOLEAN DEFAULT 1",
        &[] as &[&dyn rusqlite::ToSql],
    );

    if folder_result.is_ok() {
        eprintln!("[迁移] 添加 pattern_folders.is_active 列");
        migrations_applied.push("pattern_folders.is_active");
    }

    // 尝试添加 pattern_colors.is_active 列
    let color_result = db.sqlite().execute(
        "ALTER TABLE pattern_colors ADD COLUMN is_active BOOLEAN DEFAULT 1",
        &[] as &[&dyn rusqlite::ToSql],
    );

    if color_result.is_ok() {
        eprintln!("[迁移] 添加 pattern_colors.is_active 列");
        migrations_applied.push("pattern_colors.is_active");
    }

    if migrations_applied.is_empty() {
        eprintln!("[迁移] 所有迁移已完成，无需执行");
        Ok("所有迁移已完成".to_string())
    } else {
        eprintln!("[迁移] 已应用 {} 个迁移", migrations_applied.len());
        Ok(format!("已应用 {} 个迁移: {}", migrations_applied.len(), migrations_applied.join(", ")))
    }
}
