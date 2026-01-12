use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use tauri::State;

use crate::services::Database;
use crate::utils::logging::log_data_operation;

// ============================================================
// 辅助函数
// ============================================================

/// 改进错误消息：对用户友好，对开发人员详细
fn improve_error_message(context: &str, technical_error: String) -> String {
    // 记录技术性错误到 stderr（供开发人员调试）
    eprintln!("[ERROR] {}: {:?}", context, technical_error);

    // 返回用户友好的错误消息
    match context {
        "导出配置" => "导出配置失败，请检查系统日志".to_string(),
        "导出客户" => "导出客户数据失败，请检查系统日志".to_string(),
        "导出订单" => "导出订单数据失败，请检查系统日志".to_string(),
        "导出订单图案项" => "导出订单图案项失败，请检查系统日志".to_string(),
        "导出产品" => "导出产品数据失败，请检查系统日志".to_string(),
        "导出图案" => "导出图案数据失败，请检查系统日志".to_string(),
        "导出财务记录" => "导出财务记录失败，请检查系统日志".to_string(),
        "导出颜色预设" => "导出颜色预设失败，请检查系统日志".to_string(),
        "JSON序列化" => "数据序列化失败，请检查系统日志".to_string(),
        "JSON解析" => "数据格式错误，请确保导入正确的文件".to_string(),
        "导入" => "导入数据失败，请检查文件格式和内容".to_string(),
        "备份" => "数据库备份失败，请检查文件权限".to_string(),
        "清空" => "清空数据失败，请重试或联系技术支持".to_string(),
        _ => format!("操作失败: {}", context),
    }
}

/**
 * 数据管理模块
 * 提供数据导出、导入、备份功能
 */

/// 导出所有数据为 JSON
#[tauri::command]
pub async fn export_data(db: State<'_, Database>) -> Result<String, String> {
    let mut export_data: HashMap<String, Value> = HashMap::new();
    let now = chrono::Utc::now().timestamp();

    // 导出配置
    let configs: Vec<Value> = db.sqlite().query_map(
        "SELECT id, key, value, description, category FROM app_configs",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "key": row.get::<_, String>(1)?,
            "value": row.get::<_, String>(2)?,
            "description": row.get::<_, Option<String>>(3)?,
            "category": row.get::<_, String>(4)?,
        })),
    ).map_err(|e| improve_error_message("导出配置", e.to_string()))?;
    export_data.insert("app_configs".to_string(), serde_json::json!(configs));

    // 导出客户
    let customers: Vec<Value> = db.sqlite().query_map(
        "SELECT id, name, phone, address, balance, creditLimit, createdAt, updatedAt FROM customers",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "phone": row.get::<_, Option<String>>(2)?,
            "address": row.get::<_, Option<String>>(3)?,
            "balance": row.get::<_, f64>(4)?,
            "creditLimit": row.get::<_, f64>(5)?,
            "createdAt": row.get::<_, i64>(6)?,
            "updatedAt": row.get::<_, i64>(7)?,
        })),
    ).map_err(|e| improve_error_message("导出客户", e.to_string()))?;
    export_data.insert("customers".to_string(), serde_json::json!(customers));

    // 导出订单
    let orders: Vec<Value> = db.sqlite().query_map(
        "SELECT id, customerId, orderDate, totalAmount, is_confirmed, confirmed_at, notes, createdAt, updatedAt FROM orders",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "customerId": row.get::<_, String>(1)?,
            "orderDate": row.get::<_, i64>(2)?,
            "totalAmount": row.get::<_, f64>(3)?,
            "isConfirmed": row.get::<_, bool>(4)?,
            "confirmedAt": row.get::<_, Option<i64>>(5)?,
            "notes": row.get::<_, Option<String>>(6)?,
            "createdAt": row.get::<_, i64>(7)?,
            "updatedAt": row.get::<_, i64>(8)?,
        })),
    ).map_err(|e| format!("Failed to export orders: {}", e))?;
    export_data.insert("orders".to_string(), serde_json::json!(orders));

    // 导出订单图案项（印花行业专用）
    let order_pattern_items: Vec<Value> = db.sqlite().query_map(
        "SELECT id, orderId, patternId, quantity, area, pricingMode, unitPrice, totalPrice, color_variant_id, created_at, updated_at FROM order_pattern_items",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "orderId": row.get::<_, String>(1)?,
            "patternId": row.get::<_, String>(2)?,
            "quantity": row.get::<_, i32>(3)?,
            "area": row.get::<_, Option<f64>>(4)?,
            "pricingMode": row.get::<_, String>(5)?,
            "unitPrice": row.get::<_, f64>(6)?,
            "totalPrice": row.get::<_, f64>(7)?,
            "colorVariantId": row.get::<_, Option<String>>(8)?,
            "createdAt": row.get::<_, i64>(9)?,
            "updatedAt": row.get::<_, i64>(10)?,
        })),
    ).map_err(|e| format!("Failed to export order pattern items: {}", e))?;
    export_data.insert("order_pattern_items".to_string(), serde_json::json!(order_pattern_items));

    // 导出产品
    let products: Vec<Value> = db.sqlite().query_map(
        "SELECT id, name, price, unit, createdAt, updatedAt FROM products",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "price": row.get::<_, f64>(2)?,
            "unit": row.get::<_, String>(3)?,
            "createdAt": row.get::<_, i64>(4)?,
            "updatedAt": row.get::<_, i64>(5)?,
        })),
    ).map_err(|e| format!("Failed to export products: {}", e))?;
    export_data.insert("products".to_string(), serde_json::json!(products));

    // 导出图案
    let patterns: Vec<Value> = db.sqlite().query_map(
        "SELECT id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount, localFilePath, customerId, folder_id, color_type, preview_image, createdAt, updatedAt FROM patterns",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "code": row.get::<_, String>(2)?,
            "actualHeight": row.get::<_, f64>(3)?,
            "bleedHeight": row.get::<_, f64>(4)?,
            "unitsPerRow": row.get::<_, i32>(5)?,
            "rowCount": row.get::<_, i32>(6)?,
            "localFilePath": row.get::<_, Option<String>>(7)?,
            "customerId": row.get::<_, Option<String>>(8)?,
            "folderId": row.get::<_, Option<String>>(9)?,
            "colorType": row.get::<_, String>(10)?,
            "previewImage": row.get::<_, Option<String>>(11)?,
            "isActive": true,  // 默认值，保持向后兼容
            "createdAt": row.get::<_, i64>(12)?,
            "updatedAt": row.get::<_, i64>(13)?,
        })),
    ).map_err(|e| format!("Failed to export patterns: {}", e))?;
    export_data.insert("patterns".to_string(), serde_json::json!(patterns));

    // 导出财务记录
    let financial_records: Vec<Value> = db.sqlite().query_map(
        "SELECT id, type, amount, description, order_id, order_item_id, customer_id, balance_before, balance_after, operator_name, created_at FROM financial_records",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "type": row.get::<_, String>(1)?,
            "amount": row.get::<_, f64>(2)?,
            "description": row.get::<_, String>(3)?,
            "orderId": row.get::<_, Option<String>>(4)?,
            "orderItemId": row.get::<_, Option<String>>(5)?,
            "customerId": row.get::<_, String>(6)?,
            "balanceBefore": row.get::<_, f64>(7)?,
            "balanceAfter": row.get::<_, f64>(8)?,
            "operatorName": row.get::<_, String>(9)?,
            "createdAt": row.get::<_, i64>(10)?,
        })),
    ).map_err(|e| format!("Failed to export financial records: {}", e))?;
    export_data.insert("financial_records".to_string(), serde_json::json!(financial_records));

    // 导出颜色预设
    let color_presets: Vec<Value> = db.sqlite().query_map(
        "SELECT id, name, display_name, color, sort_order, is_active, created_at, updated_at FROM color_presets",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "displayName": row.get::<_, Option<String>>(2)?,
            "color": row.get::<_, String>(3)?,
            "sortOrder": row.get::<_, i32>(4)?,
            "isActive": row.get::<_, bool>(5)?,
            "createdAt": row.get::<_, i64>(6)?,
            "updatedAt": row.get::<_, i64>(7)?,
        })),
    ).map_err(|e| format!("Failed to export color presets: {}", e))?;
    export_data.insert("color_presets".to_string(), serde_json::json!(color_presets));

    // 导出图案文件夹
    let pattern_folders: Vec<Value> = db.sqlite().query_map(
        "SELECT id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at FROM pattern_folders",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "parentId": row.get::<_, Option<String>>(2)?,
            "level": row.get::<_, i32>(3)?,
            "path": row.get::<_, String>(4)?,
            "sortOrder": row.get::<_, i32>(5)?,
            "customerId": row.get::<_, Option<String>>(6)?,
            "isSystem": row.get::<_, bool>(7)?,
            "isActive": row.get::<_, bool>(8)?,
            "createdAt": row.get::<_, i64>(9)?,
            "updatedAt": row.get::<_, i64>(10)?,
        })),
    ).map_err(|e| format!("Failed to export pattern folders: {}", e))?;
    export_data.insert("pattern_folders".to_string(), serde_json::json!(pattern_folders));

    // 导出图案颜色变体
    let pattern_colors: Vec<Value> = db.sqlite().query_map(
        "SELECT id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at FROM pattern_colors",
        &[],
        |row| Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "patternId": row.get::<_, String>(1)?,
            "name": row.get::<_, String>(2)?,
            "color": row.get::<_, String>(3)?,
            "image": row.get::<_, Option<String>>(4)?,
            "isDefault": row.get::<_, bool>(5)?,
            "isActive": row.get::<_, bool>(6)?,
            "createdAt": row.get::<_, i64>(7)?,
            "updatedAt": row.get::<_, i64>(8)?,
        })),
    ).map_err(|e| format!("Failed to export pattern colors: {}", e))?;
    export_data.insert("pattern_colors".to_string(), serde_json::json!(pattern_colors));

    // 添加导出元数据
    export_data.insert("exported_at".to_string(), serde_json::json!(now));
    export_data.insert("version".to_string(), serde_json::json!("1.0"));

    let result = serde_json::to_string_pretty(&export_data)
        .map_err(|e| improve_error_message("JSON序列化", e.to_string()))?;

    // 记录日志
    let _ = log_data_operation("导出", "导出完成", db).await;

    Ok(result)
}

/// 导入 JSON 数据
#[tauri::command]
pub async fn import_data(
    json_data: String,
    db: State<'_, Database>,
) -> Result<String, String> {
    let import_data: HashMap<String, Value> = serde_json::from_str(&json_data)
        .map_err(|e| improve_error_message("JSON解析", e.to_string()))?;

    let mut total_count = 0;

    db.sqlite().transaction(|tx| {
        // ========== 第一阶段：导入无依赖的基础数据 ==========

        // 1. 导入配置（无外键依赖）
        if let Some(configs) = import_data.get("app_configs").and_then(|v| v.as_array()) {
            for config in configs {
                let id = config["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效配置ID")))?;
                let key = config["key"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效配置键")))?;
                let value = config["value"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效配置值")))?;
                let description = config["description"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO app_configs (id, key, value, description, category, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &key as &dyn rusqlite::ToSql,
                        &value as &dyn rusqlite::ToSql,
                        &description as &dyn rusqlite::ToSql,
                        &config["category"].as_str().unwrap_or("GENERAL") as &dyn rusqlite::ToSql,
                        &chrono::Utc::now().timestamp() as &dyn rusqlite::ToSql,
                        &chrono::Utc::now().timestamp() as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += configs.len();
        }

        // 2. 导入颜色预设（无外键依赖）
        if let Some(colors) = import_data.get("color_presets").and_then(|v| v.as_array()) {
            for color in colors {
                let id = color["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效颜色预设ID")))?;
                let name = color["name"].as_str().unwrap_or("");
                let display_name = color["displayName"].as_str();
                let color_hex = color["color"].as_str().unwrap_or("#000000");
                let created_at = color["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp());
                let updated_at = color["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp());

                tx.execute(
                    "INSERT OR REPLACE INTO color_presets (id, name, display_name, color, sort_order, is_active, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &display_name as &dyn rusqlite::ToSql,
                        &color_hex as &dyn rusqlite::ToSql,
                        &(color["sortOrder"].as_i64().unwrap_or(0) as i32) as &dyn rusqlite::ToSql,
                        &color["isActive"].as_bool().unwrap_or(true) as &dyn rusqlite::ToSql,
                        &created_at as &dyn rusqlite::ToSql,
                        &updated_at as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += colors.len();
        }

        // 3. 导入客户（无外键依赖）
        if let Some(customers) = import_data.get("customers").and_then(|v| v.as_array()) {
            for customer in customers {
                let id = customer["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效客户ID")))?;
                let name = customer["name"].as_str().unwrap_or("");
                let phone = customer["phone"].as_str();
                let address = customer["address"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO customers (id, name, phone, address, balance, creditLimit, createdAt, updatedAt)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &phone as &dyn rusqlite::ToSql,
                        &address as &dyn rusqlite::ToSql,
                        &customer["balance"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &customer["creditLimit"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &customer["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &customer["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += customers.len();
        }

        // 4. 导入产品（无外键依赖）
        if let Some(products) = import_data.get("products").and_then(|v| v.as_array()) {
            for product in products {
                let id = product["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效产品ID")))?;
                let name = product["name"].as_str().unwrap_or("");
                let unit = product["unit"].as_str().unwrap_or("件");

                tx.execute(
                    "INSERT OR REPLACE INTO products (id, name, price, unit, createdAt, updatedAt)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &product["price"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &unit as &dyn rusqlite::ToSql,
                        &product["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &product["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += products.len();
        }

        // ========== 第二阶段：导入依赖客户的数据 ==========

        // 5. 导入图案文件夹（依赖客户，客户已在第3步导入）
        if let Some(folders) = import_data.get("pattern_folders").and_then(|v| v.as_array()) {
            for folder in folders {
                let id = folder["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效文件夹ID")))?;
                let name = folder["name"].as_str().unwrap_or("");
                let path = folder["path"].as_str().unwrap_or("");
                let parent_id = folder["parentId"].as_str();
                let customer_id = folder["customerId"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO pattern_folders (id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &parent_id as &dyn rusqlite::ToSql,
                        &(folder["level"].as_i64().unwrap_or(0) as i32) as &dyn rusqlite::ToSql,
                        &path as &dyn rusqlite::ToSql,
                        &(folder["sortOrder"].as_i64().unwrap_or(0) as i32) as &dyn rusqlite::ToSql,
                        &customer_id as &dyn rusqlite::ToSql,
                        &folder["isSystem"].as_bool().unwrap_or(false) as &dyn rusqlite::ToSql,
                        &folder["isActive"].as_bool().unwrap_or(true) as &dyn rusqlite::ToSql,
                        &folder["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &folder["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += folders.len();
        }

        // 6. 导入图案（依赖客户和文件夹，都已在第3、5步导入）
        if let Some(patterns) = import_data.get("patterns").and_then(|v| v.as_array()) {
            for pattern in patterns {
                let id = pattern["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效图案ID")))?;
                let name = pattern["name"].as_str().unwrap_or("");
                let code = pattern["code"].as_str().unwrap_or("");
                let local_file_path = pattern["localFilePath"].as_str();
                let customer_id = pattern["customerId"].as_str();
                let folder_id = pattern["folderId"].as_str();
                let color_type = pattern["colorType"].as_str().unwrap_or("SINGLE");
                let preview_image = pattern["previewImage"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount, localFilePath, customerId, folder_id, color_type, preview_image, isActive, createdAt, updatedAt)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &code as &dyn rusqlite::ToSql,
                        &pattern["actualHeight"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &pattern["bleedHeight"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &(pattern["unitsPerRow"].as_i64().unwrap_or(0) as i32) as &dyn rusqlite::ToSql,
                        &(pattern["rowCount"].as_i64().unwrap_or(0) as i32) as &dyn rusqlite::ToSql,
                        &local_file_path as &dyn rusqlite::ToSql,
                        &customer_id as &dyn rusqlite::ToSql,
                        &folder_id as &dyn rusqlite::ToSql,
                        &color_type as &dyn rusqlite::ToSql,
                        &preview_image as &dyn rusqlite::ToSql,
                        &pattern["isActive"].as_bool().unwrap_or(true) as &dyn rusqlite::ToSql,
                        &pattern["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &pattern["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += patterns.len();
        }

        // 7. 导入图案颜色变体（依赖图案，图案已在第6步导入）
        if let Some(colors) = import_data.get("pattern_colors").and_then(|v| v.as_array()) {
            for color in colors {
                let id = color["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效颜色ID")))?;
                let pattern_id = color["patternId"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效图案ID")))?;
                let name = color["name"].as_str().unwrap_or("");
                let color_hex = color["color"].as_str().unwrap_or("#000000");
                let image = color["image"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO pattern_colors (id, pattern_id, name, color, image, is_default, isActive, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &pattern_id as &dyn rusqlite::ToSql,
                        &name as &dyn rusqlite::ToSql,
                        &color_hex as &dyn rusqlite::ToSql,
                        &image as &dyn rusqlite::ToSql,
                        &color["isDefault"].as_bool().unwrap_or(false) as &dyn rusqlite::ToSql,
                        &color["isActive"].as_bool().unwrap_or(true) as &dyn rusqlite::ToSql,
                        &color["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &color["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += colors.len();
        }

        // 8. 导入订单（依赖客户，客户已在第3步导入）
        if let Some(orders) = import_data.get("orders").and_then(|v| v.as_array()) {
            for order in orders {
                let id = order["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效订单ID")))?;
                let customer_id = order["customerId"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效客户ID")))?;
                let order_date = order["orderDate"].as_i64().unwrap_or(chrono::Utc::now().timestamp());
                let notes = order["notes"].as_str();
                let confirmed_at = order["confirmedAt"].as_i64();

                tx.execute(
                    "INSERT OR REPLACE INTO orders (id, customerId, orderDate, totalAmount, is_confirmed, confirmed_at, notes, createdAt, updatedAt)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &customer_id as &dyn rusqlite::ToSql,
                        &order_date as &dyn rusqlite::ToSql,
                        &order["totalAmount"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &order["isConfirmed"].as_bool().unwrap_or(false) as &dyn rusqlite::ToSql,
                        &confirmed_at as &dyn rusqlite::ToSql,
                        &notes as &dyn rusqlite::ToSql,
                        &order["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &order["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += orders.len();
        }

        // ========== 第三阶段：导入依赖订单和图案的数据 ==========

        // 9. 导入订单图案项（依赖订单、图案和颜色变体，都已在第6、7、8步导入）
        if let Some(items) = import_data.get("order_pattern_items").and_then(|v| v.as_array()) {
            for item in items {
                let id = item["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效订单项ID")))?;
                let order_id = item["orderId"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效订单ID")))?;
                let pattern_id = item["patternId"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效图案ID")))?;
                let pricing_mode = item["pricingMode"].as_str().unwrap_or("AREA");
                let color_variant_id = item["colorVariantId"].as_str();

                tx.execute(
                    "INSERT OR REPLACE INTO order_pattern_items (id, orderId, patternId, quantity, area, pricingMode, unitPrice, totalPrice, color_variant_id, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &order_id as &dyn rusqlite::ToSql,
                        &pattern_id as &dyn rusqlite::ToSql,
                        &(item["quantity"].as_i64().unwrap_or(1) as i32) as &dyn rusqlite::ToSql,
                        &item["area"].as_f64() as &dyn rusqlite::ToSql,
                        &pricing_mode as &dyn rusqlite::ToSql,
                        &item["unitPrice"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &item["totalPrice"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &color_variant_id as &dyn rusqlite::ToSql,
                        &item["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                        &item["updatedAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += items.len();
        }

        // 10. 导入财务记录（依赖客户和订单，都已在第3、8步导入）
        if let Some(records) = import_data.get("financial_records").and_then(|v| v.as_array()) {
            for record in records {
                let id = record["id"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效财务记录ID")))?;
                let record_type = record["type"].as_str().unwrap_or("PAYMENT");
                let description = record["description"].as_str().unwrap_or("");
                let order_id = record["orderId"].as_str();
                let order_item_id = record["orderItemId"].as_str();
                let customer_id = record["customerId"].as_str().ok_or_else(|| rusqlite::Error::ToSqlConversionFailure(Box::from("无效客户ID")))?;
                let operator_name = record["operatorName"].as_str().unwrap_or("System");

                tx.execute(
                    "INSERT OR REPLACE INTO financial_records
                     (id, type, amount, description, order_id, order_item_id, customer_id, balance_before, balance_after, operator_name, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    [
                        &id as &dyn rusqlite::ToSql,
                        &record_type as &dyn rusqlite::ToSql,
                        &record["amount"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &description as &dyn rusqlite::ToSql,
                        &order_id as &dyn rusqlite::ToSql,
                        &order_item_id as &dyn rusqlite::ToSql,
                        &customer_id as &dyn rusqlite::ToSql,
                        &record["balanceBefore"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &record["balanceAfter"].as_f64().unwrap_or(0.0) as &dyn rusqlite::ToSql,
                        &operator_name as &dyn rusqlite::ToSql,
                        &record["createdAt"].as_i64().unwrap_or(chrono::Utc::now().timestamp()) as &dyn rusqlite::ToSql,
                    ],
                )?;
            }
            total_count += records.len();
        }

        Ok::<_, rusqlite::Error>(())
    }).map_err(|e| improve_error_message("导入", e.to_string()))?;

    // 记录日志
    let _ = log_data_operation("导入", &format!("导入了 {} 条记录", total_count), db.clone()).await;

    Ok(format!("成功导入 {} 条记录", total_count))
}

/// 获取数据库文件路径
#[tauri::command]
pub async fn get_database_path() -> Result<String, String> {
    Ok(std::env::current_dir()
       .map_err(|e| format!("获取当前目录失败: {}", e))?
       .join("prisma/dev.db")
       .to_string_lossy()
       .to_string())
}

/// 备份数据库文件
#[tauri::command]
pub async fn backup_database(backup_path: String, db: State<'_, Database>) -> Result<String, String> {
    let db_path = std::env::current_dir()
        .map_err(|e| format!("获取当前目录失败: {}", e))?
        .join("prisma/dev.db");

    fs::copy(&db_path, &backup_path)
        .map_err(|e| improve_error_message("备份", e.to_string()))?;

    // 记录日志
    let _ = log_data_operation("备份", &format!("备份完成: {}", backup_path), db).await;

    Ok(format!("数据库已备份到: {}", backup_path))
}

/// 清空所有数据（危险操作）
#[tauri::command]
pub async fn clear_all_data(db: State<'_, Database>) -> Result<String, String> {
    db.sqlite().transaction(|tx| {
        // 按照外键依赖顺序删除数据
        // 1. 先删除子表数据（最底层）
        tx.execute("DELETE FROM financial_records", [])?;
        tx.execute("DELETE FROM order_pattern_items", [])?;
        tx.execute("DELETE FROM order_items", [])?;
        tx.execute("DELETE FROM pattern_colors", [])?;

        // 2. 删除父表数据（中间层）
        tx.execute("DELETE FROM orders", [])?;
        tx.execute("DELETE FROM patterns", [])?;
        tx.execute("DELETE FROM pattern_folders", [])?;

        // 3. 删除独立表（顶层）
        tx.execute("DELETE FROM customers", [])?;
        tx.execute("DELETE FROM products", [])?;

        // 4. 删除配置相关（可选，保留配置和种子数据）
        // tx.execute("DELETE FROM app_configs", [])?;
        // tx.execute("DELETE FROM color_presets", [])?;
        // tx.execute("DELETE FROM system_logs", [])?;
        // tx.execute("DELETE FROM pattern_folders", [])?;

        Ok::<_, rusqlite::Error>(())
    }).map_err(|e| improve_error_message("清空", e.to_string()))?;

    // 记录日志
    let _ = log_data_operation("清空", "已清空所有业务数据", db).await;

    Ok("所有业务数据已清空".to_string())
}
