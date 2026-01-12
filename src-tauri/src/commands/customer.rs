use crate::models::{CreateCustomerRequest, Customer, UpdateCustomerRequest};
use crate::services::Database;
use tauri::State;

// ============================================================
// 辅助函数
// ============================================================

/// 从数据库获取配置值（字符串）
fn get_config_value(db: &Database, key: &str) -> Option<String> {
    db.sqlite().query_row(
        "SELECT value FROM app_configs WHERE key = ?1",
        &[&key as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).ok().flatten()
}

/// 从数据库获取配置值（浮点数）
fn get_config_f64(db: &Database, key: &str, default: f64) -> f64 {
    get_config_value(db, key)
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(default)
}

// 获取所有客户
#[tauri::command]
pub async fn get_customers(db: State<'_, Database>) -> Result<Vec<Customer>, String> {
    db.sqlite().query_map(
        "SELECT id, name, balance, creditLimit, unitPrice, notes, isActive, createdAt, updatedAt
         FROM customers ORDER BY createdAt DESC",
        &[],
        |row: &rusqlite::Row| {
            let created_at_ts: i64 = row.get(7)?;
            let updated_at_ts: i64 = row.get(8)?;
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                balance: row.get(2)?,
                credit_limit: row.get(3)?,
                unit_price: row.get(4)?,
                notes: row.get(5)?,
                is_active: row.get(6)?,
                created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
                updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
            })
        },
    ).map_err(|e| format!("Failed to fetch customers: {:?}", e))
}

// 根据 ID 获取客户
#[tauri::command]
pub async fn get_customer_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Customer>, String> {
    let result = db.sqlite().query_row(
        "SELECT id, name, balance, creditLimit, unitPrice, notes, isActive, createdAt, updatedAt
         FROM customers WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row: &rusqlite::Row| {
            let created_at_ts: i64 = row.get(7)?;
            let updated_at_ts: i64 = row.get(8)?;
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                balance: row.get(2)?,
                credit_limit: row.get(3)?,
                unit_price: row.get(4)?,
                notes: row.get(5)?,
                is_active: row.get(6)?,
                created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
                updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
            })
        },
    );

    match result {
        Ok(maybe_customer) => Ok(maybe_customer), // maybe_customer 已经是 Option<Customer>
        Err(e) => Err(format!("Failed to fetch customer: {:?}", e)),
    }
}

// 创建客户（同时自动创建同名文件夹）
#[tauri::command]
pub async fn create_customer(
    request: CreateCustomerRequest,
    db: State<'_, Database>,
) -> Result<Customer, String> {
    // 生成 UUID
    let customer_id = uuid::Uuid::new_v4().to_string();
    let folder_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 获取默认配置
    let default_price_per_sq = get_config_f64(&db, "default_price_per_sq", 0.0);
    let default_credit_limit = get_config_f64(&db, "default_credit_limit", 0.0);

    // 使用请求中的值，如果没有则使用默认配置
    let final_unit_price = request.unit_price.unwrap_or(default_price_per_sq);
    let final_credit_limit = request.credit_limit.unwrap_or(default_credit_limit);

    // 使用事务确保原子性：同时创建客户和文件夹
    {
        let conn = db.sqlite().connection();
        let conn = conn.lock().unwrap();
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to start transaction: {:?}", e))?;

        // 1. 插入客户
        tx.execute(
            "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, notes, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                &customer_id,
                &request.name,
                request.balance.unwrap_or(0.0),
                final_credit_limit,
                final_unit_price,
                request.notes.as_deref().unwrap_or(""),
                true, // isActive
                now,
                now,
            ],
        ).map_err(|e| format!("Failed to create customer: {:?}", e))?;

        // 2. 自动创建客户同名文件夹
        let folder_path = format!("/{}", request.name);
        tx.execute(
            "INSERT INTO pattern_folders (id, name, parent_id, level, path, sort_order, customer_id, is_system, isActive, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                &folder_id,
                &request.name,
                None::<String>, // parent_id 为空（根级别）
                0,              // level = 0
                &folder_path,
                0,              // sort_order
                &customer_id,   // 关联到客户
                false,          // is_system
                true,           // isActive
                now,
                now,
            ],
        ).map_err(|e| format!("Failed to create customer folder: {:?}", e))?;

        tx.commit().map_err(|e| format!("Failed to commit transaction: {:?}", e))?;
    }

    // 获取刚创建的客户
    get_customer_by_id(customer_id, db).await.map(|c| c.unwrap())
}

// 更新客户
#[tauri::command]
pub async fn update_customer(
    request: UpdateCustomerRequest,
    db: State<'_, Database>,
) -> Result<Option<Customer>, String> {
    let id = request.id.clone();

    // 使用一个闭包来完成所有同步操作
    let result = (|| -> Result<Option<Customer>, String> {
        let conn = db.sqlite().connection();
        let conn = conn.lock().unwrap();

        // 构建动态 UPDATE 语句
        let mut updates = vec![];
        let mut params: Vec<String> = vec![];

        if let Some(ref name) = request.name {
            updates.push("name = ?");
            params.push(name.clone());
        }
        if let Some(balance) = request.balance {
            updates.push("balance = ?");
            params.push(balance.to_string());
        }
        if let Some(credit_limit) = request.credit_limit {
            updates.push("creditLimit = ?");
            params.push(credit_limit.to_string());
        }
        if let Some(unit_price) = request.unit_price {
            updates.push("unitPrice = ?");
            params.push(unit_price.to_string());
        }
        if let Some(ref notes) = request.notes {
            updates.push("notes = ?");
            params.push(notes.clone());
        }
        if let Some(is_active) = request.is_active {
            updates.push("isActive = ?");
            params.push(if is_active { "1" } else { "0" }.to_string());
        }

        if updates.is_empty() {
            return Ok(None);
        }

        updates.push("updatedAt = ?");
        params.push(chrono::Utc::now().timestamp().to_string());

        let sql = format!("UPDATE customers SET {} WHERE id = ?", updates.join(", "));

        // 使用原始 SQL 执行
        let mut sql_params: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
        sql_params.push(id.as_str());

        conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare statement: {:?}", e))?
            .execute(rusqlite::params_from_iter(sql_params.iter()))
            .map_err(|e| format!("Failed to update customer: {:?}", e))?;

        // 现在获取更新后的客户
        drop(conn);

        // 使用 query_row 获取更新后的客户
        db.sqlite().query_row(
            "SELECT id, name, balance, creditLimit, unitPrice, notes, isActive, createdAt, updatedAt
             FROM customers WHERE id = ?1",
            &[&id as &dyn rusqlite::ToSql],
            |row: &rusqlite::Row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    balance: row.get(2)?,
                    credit_limit: row.get(3)?,
                    unit_price: row.get(4)?,
                    notes: row.get(5)?,
                    is_active: row.get(6)?,
                    created_at: row.get::<_, i64>(7)?.to_string(),
                    updated_at: row.get::<_, i64>(8)?.to_string(),
                })
            },
        ).map_err(|e| format!("Failed to fetch updated customer: {:?}", e))
    })()?;

    Ok(result)
}

// 删除客户
#[tauri::command]
pub async fn delete_customer(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    db.sqlite().execute("DELETE FROM customers WHERE id = ?", &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete customer: {:?}", e))?;

    Ok(true)
}
