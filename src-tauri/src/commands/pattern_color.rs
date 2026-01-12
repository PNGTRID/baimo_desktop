// ============================================================
// PatternColor - 图案颜色变体管理命令
// ============================================================

use crate::models::{PatternColor, CreateColorRequest, UpdateColorRequest};
use crate::services::Database;
use tauri::State;

/// 获取某个图案的所有颜色变体
#[tauri::command]
pub async fn get_pattern_colors(
    pattern_id: String,
    db: State<'_, Database>,
) -> Result<Vec<PatternColor>, String> {
    db.sqlite().query_map(
        "SELECT id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at
         FROM pattern_colors
         WHERE pattern_id = ?1
         ORDER BY is_default DESC, name ASC",
        &[&pattern_id as &dyn rusqlite::ToSql],
        |row| {
            Ok(PatternColor {
                id: row.get(0)?,
                pattern_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                image: row.get(4)?,
                is_default: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get::<_, i64>(7)?.to_string(),
                updated_at: row.get::<_, i64>(8)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch pattern colors: {}", e))
}

/// 根据 ID 获取颜色变体
#[tauri::command]
pub async fn get_color_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<PatternColor>, String> {
    db.sqlite().query_row(
        "SELECT id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at
         FROM pattern_colors WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| {
            Ok(PatternColor {
                id: row.get(0)?,
                pattern_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                image: row.get(4)?,
                is_default: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get::<_, i64>(7)?.to_string(),
                updated_at: row.get::<_, i64>(8)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch color: {}", e))
}

/// 创建颜色变体
#[tauri::command]
pub async fn create_color(
    request: CreateColorRequest,
    db: State<'_, Database>,
) -> Result<PatternColor, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let pattern_exists: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM patterns WHERE id = ?1",
        &[&request.pattern_id as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check pattern: {}", e))?
    .unwrap_or(0);

    if pattern_exists == 0 {
        return Err("Pattern not found".to_string());
    }

    let name_exists: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM pattern_colors WHERE pattern_id = ?1 AND name = ?2",
        &[&request.pattern_id as &dyn rusqlite::ToSql, &request.name],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check color name: {}", e))?
    .unwrap_or(0);

    if name_exists > 0 {
        return Err("Color with this name already exists for this pattern".to_string());
    }

    let color_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM pattern_colors WHERE pattern_id = ?1",
        &[&request.pattern_id as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to count colors: {}", e))?
    .unwrap_or(0);

    let is_default = color_count == 0;

    db.sqlite().execute(
        "INSERT INTO pattern_colors (id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        &[
            &id as &dyn rusqlite::ToSql,
            &request.pattern_id,
            &request.name,
            &request.color,
            &request.image,
            &is_default,
            &true,
            &now,
            &now,
        ],
    ).map_err(|e| format!("Failed to create color: {}", e))?;

    get_color_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve created color".to_string())
}

/// 更新颜色变体
#[tauri::command]
pub async fn update_color(
    id: String,
    request: UpdateColorRequest,
    db: State<'_, Database>,
) -> Result<Option<PatternColor>, String> {
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref name) = request.name {
        updates.push("name = ?".to_string());
        params.push(name.clone());
    }
    if let Some(ref color) = request.color {
        updates.push("color = ?".to_string());
        params.push(color.clone());
    }
    if let Some(ref image) = request.image {
        updates.push("image = ?".to_string());
        params.push(image.clone());
    }

    // 先处理需要 .await 的 is_default 逻辑
    if let Some(is_default) = request.is_default {
        updates.push("is_default = ?".to_string());
        params.push(if is_default { "1" } else { "0" }.to_string());
        if is_default {
            // 在获取任何锁之前执行 await
            let color = get_color_by_id(id.clone(), db.clone()).await?
                .ok_or_else(|| "Color not found".to_string())?;

            // 执行更新其他颜色的操作
            db.sqlite().execute(
                "UPDATE pattern_colors SET is_default = 0 WHERE pattern_id = ?1 AND id != ?2",
                &[&color.pattern_id as &dyn rusqlite::ToSql, &id],
            ).map_err(|e| format!("Failed to update other colors: {}", e))?;
        }
    }

    if let Some(is_active) = request.is_active {
        updates.push("isActive = ?".to_string());
        params.push(if is_active { "1" } else { "0" }.to_string());
    }

    if updates.is_empty() {
        return get_color_by_id(id, db).await;
    }

    updates.push("updated_at = ?".to_string());
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE pattern_colors SET {} WHERE id = ?", updates.join(", "));

    // 使用块确保 guard 在离开作用域时被释放
    {
        let guard = db.sqlite().connection().lock().unwrap();

        let mut sql_params: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
        sql_params.push(id.as_str());

        guard.prepare(&sql)
            .map_err(|e| format!("Failed to prepare statement: {}", e))?
            .execute(rusqlite::params_from_iter(sql_params.iter()))
            .map_err(|e| format!("Failed to update color: {}", e))?;
    } // guard 在此处释放

    get_color_by_id(id, db).await
}

/// 删除颜色变体
#[tauri::command]
pub async fn delete_color(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let used_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM order_pattern_items WHERE color_variant_id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check usage: {}", e))?
    .unwrap_or(0);

    if used_count > 0 {
        return Err("Cannot delete color that is used in orders. Please disable it instead.".to_string());
    }

    let color = get_color_by_id(id.clone(), db.clone()).await?
        .ok_or_else(|| "Color not found".to_string())?;

    if color.is_default {
        return Err("Cannot delete default color. Please set another color as default first.".to_string());
    }

    db.sqlite().execute(
        "DELETE FROM pattern_colors WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete color: {}", e))?;

    Ok(true)
}

/// 设置默认颜色
#[tauri::command]
pub async fn set_default_color(
    id: String,
    db: State<'_, Database>,
) -> Result<PatternColor, String> {
    let color = get_color_by_id(id.clone(), db.clone()).await?
        .ok_or_else(|| "Color not found".to_string())?;

    db.sqlite().execute(
        "UPDATE pattern_colors SET is_default = 0 WHERE pattern_id = ?1 AND id != ?2",
        &[&color.pattern_id as &dyn rusqlite::ToSql, &id],
    ).map_err(|e| format!("Failed to update other colors: {}", e))?;

    let now = chrono::Utc::now().timestamp();
    db.sqlite().execute(
        "UPDATE pattern_colors SET is_default = 1, updated_at = ?1 WHERE id = ?2",
        &[&now as &dyn rusqlite::ToSql, &id],
    ).map_err(|e| format!("Failed to set default color: {}", e))?;

    get_color_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve updated color".to_string())
}

/// 复制颜色变体
#[tauri::command]
pub async fn duplicate_color(
    id: String,
    new_name: String,
    db: State<'_, Database>,
) -> Result<PatternColor, String> {
    let original = get_color_by_id(id.clone(), db.clone()).await?
        .ok_or_else(|| "Color not found".to_string())?;

    let request = CreateColorRequest {
        pattern_id: original.pattern_id,
        name: new_name,
        color: original.color,
        image: original.image,
    };

    create_color(request, db).await
}

/// 批量创建颜色变体
#[tauri::command]
pub async fn create_colors_batch(
    colors: Vec<CreateColorRequest>,
    db: State<'_, Database>,
) -> Result<Vec<PatternColor>, String> {
    db.sqlite().transaction(|tx| {
        for color in &colors {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().timestamp();

            tx.execute(
                "INSERT INTO pattern_colors (id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                [
                    &id as &dyn rusqlite::ToSql,
                    &color.pattern_id,
                    &color.name,
                    &color.color,
                    &color.image,
                    &false,
                    &true,
                    &now,
                    &now,
                ],
            )?;
        }

        Ok(())
    }).map_err(|e| format!("Failed to create colors batch: {}", e))?;

    let mut results = vec![];
    for color in colors {
        let created = get_pattern_colors(color.pattern_id, db.clone()).await?;
        if let Some(c) = created.iter().find(|c| c.name == color.name && !c.is_default) {
            results.push(c.clone());
        }
    }

    Ok(results)
}

/// 获取图案的默认颜色
#[tauri::command]
pub async fn get_default_color(
    pattern_id: String,
    db: State<'_, Database>,
) -> Result<Option<PatternColor>, String> {
    db.sqlite().query_row(
        "SELECT id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at
         FROM pattern_colors
         WHERE pattern_id = ?1 AND is_default = 1 AND isActive = 1
         LIMIT 1",
        &[&pattern_id as &dyn rusqlite::ToSql],
        |row| {
            Ok(PatternColor {
                id: row.get(0)?,
                pattern_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
                image: row.get(4)?,
                is_default: row.get(5)?,
                is_active: row.get(6)?,
                created_at: row.get::<_, i64>(7)?.to_string(),
                updated_at: row.get::<_, i64>(8)?.to_string(),
            })
        },
    ).map_err(|e| format!("Failed to fetch default color: {}", e))
}
