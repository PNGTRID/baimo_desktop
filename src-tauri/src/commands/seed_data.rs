use crate::models::ColorPreset;
use crate::services::Database;
use tauri::State;

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
