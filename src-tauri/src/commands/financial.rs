// ============================================================
// Financial - 财务管理命令
// ============================================================

use crate::models::{
    FinancialRecord, CreateFinancialRecordRequest, CustomerDebt,
    PaginatedFinancialRecords, FinancialRecordParams, CustomerDebtParams,
};
use crate::services::Database;
use crate::utils::logging::log_financial_operation;
use tauri::State;
use chrono::DateTime;

/// 获取财务记录列表（分页）
#[tauri::command]
pub async fn get_financial_records(
    params: FinancialRecordParams,
    db: State<'_, Database>,
) -> Result<PaginatedFinancialRecords, String> {
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut conditions = vec![];
    let mut sql_params: Vec<String> = vec![];

    if let Some(customer_id) = &params.customer_id {
        conditions.push("customer_id = ?".to_string());
        sql_params.push(customer_id.clone());
    }

    if let Some(record_type) = &params.record_type {
        conditions.push("type = ?".to_string());
        sql_params.push(record_type.clone());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let mut params_list: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    params_list.push(&page_size as &dyn rusqlite::ToSql);
    params_list.push(&offset as &dyn rusqlite::ToSql);

    let count_params: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
    let total: i32 = db.sqlite().query_row(
        &format!("SELECT COUNT(*) FROM financial_records {}", where_clause),
        &count_params[..],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to count records: {}", e))?
    .unwrap_or(0);

    let data = db.sqlite().query_map(
        &format!(
            "SELECT fr.id, fr.type, fr.amount, fr.description, fr.order_id, fr.order_item_id,
                    fr.customer_id, c.name as customer_name,
                    fr.balance_before, fr.balance_after, fr.operator_name, fr.created_at
             FROM financial_records fr
             LEFT JOIN customers c ON fr.customer_id = c.id
             {}
             ORDER BY fr.created_at DESC
             LIMIT ? OFFSET ?",
            where_clause
        ),
        &params_list[..],
        |row| {
            let timestamp: i64 = row.get(11)?;
            let created_at = DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339();
            Ok(FinancialRecord {
                id: row.get(0)?,
                record_type: row.get(1)?,
                amount: row.get(2)?,
                description: row.get(3)?,
                order_id: row.get(4)?,
                order_item_id: row.get(5)?,
                customer_id: row.get(6)?,
                customer_name: row.get(7)?,
                balance_before: row.get(8)?,
                balance_after: row.get(9)?,
                operator_name: row.get(10)?,
                created_at,
            })
        },
    ).map_err(|e| format!("Failed to fetch records: {}", e))?;

    let total_pages = (total as f64 / page_size as f64).ceil() as i32;

    Ok(PaginatedFinancialRecords {
        data,
        total,
        page,
        page_size,
        total_pages,
    })
}

/// 根据 ID 获取财务记录
#[tauri::command]
pub async fn get_financial_record_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<FinancialRecord>, String> {
    db.sqlite().query_row(
        "SELECT fr.id, fr.type, fr.amount, fr.description, fr.order_id, fr.order_item_id,
                fr.customer_id, c.name as customer_name,
                fr.balance_before, fr.balance_after, fr.operator_name, fr.created_at
         FROM financial_records fr
         LEFT JOIN customers c ON fr.customer_id = c.id
         WHERE fr.id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| {
            let timestamp: i64 = row.get(11)?;
            let created_at = DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339();
            Ok(FinancialRecord {
                id: row.get(0)?,
                record_type: row.get(1)?,
                amount: row.get(2)?,
                description: row.get(3)?,
                order_id: row.get(4)?,
                order_item_id: row.get(5)?,
                customer_id: row.get(6)?,
                customer_name: row.get(7)?,
                balance_before: row.get(8)?,
                balance_after: row.get(9)?,
                operator_name: row.get(10)?,
                created_at,
            })
        },
    ).map_err(|e| format!("Failed to fetch financial record: {}", e))
}

/// 创建财务记录
#[tauri::command]
pub async fn create_financial_record(
    request: CreateFinancialRecordRequest,
    db: State<'_, Database>,
) -> Result<FinancialRecord, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    let customer: Option<(String, f64)> = db.sqlite().query_row(
        "SELECT name, balance FROM customers WHERE id = ?1",
        &[&request.customer_id as &dyn rusqlite::ToSql],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Failed to fetch customer: {}", e))?;

    let (_customer_name, current_balance) = customer
        .ok_or_else(|| "Customer not found".to_string())?;

    let balance_before = current_balance;
    let balance_after = match request.record_type.as_str() {
        "PAYMENT" => balance_before + request.amount,  // 充值/还款：客户给钱，余额增加
        "REFUND" => balance_before - request.amount,   // 退款：退钱给客户，余额减少
        "ADJUSTMENT" => {
            return Err("Use adjust_customer_balance for ADJUSTMENT type".to_string());
        },
        _ => return Err("Invalid record type. Must be PAYMENT, REFUND, or ADJUSTMENT".to_string()),
    };

    db.sqlite().transaction(|tx| {
        tx.execute(
            "INSERT INTO financial_records (id, type, amount, description, order_id, order_item_id, customer_id, balance_before, balance_after, operator_name, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            [
                &id as &dyn rusqlite::ToSql,
                &request.record_type,
                &request.amount,
                &request.description,
                &request.order_id,
                &request.order_item_id,
                &request.customer_id,
                &balance_before,
                &balance_after,
                &"System",
                &now,
            ],
        )?;

        tx.execute(
            "UPDATE customers SET balance = ?1, updated_at = ?2 WHERE id = ?3",
            [&balance_after as &dyn rusqlite::ToSql, &now, &request.customer_id],
        )?;

        Ok(())
    }).map_err(|e| format!("Failed to create financial record: {}", e))?;

    // 记录日志
    let operation = match request.record_type.as_str() {
        "PAYMENT" => "充值",
        "REFUND" => "退款",
        _ => "操作",
    };
    log_financial_operation(
        operation,
        &request.customer_id,
        &_customer_name,
        request.amount,
        balance_before,
        balance_after,
        db.clone(),
    ).await?;

    get_financial_record_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve created record".to_string())
}

/// 获取客户欠款列表
#[tauri::command]
pub async fn get_customer_debts(
    params: CustomerDebtParams,
    db: State<'_, Database>,
) -> Result<Vec<CustomerDebt>, String> {
    let mut conditions = vec!["balance < 0".to_string()];
    let mut sql_params: Vec<String> = vec![];

    if let Some(min_debt) = params.min_debt {
        conditions.push("balance <= ?".to_string());
        sql_params.push(min_debt.to_string());
    }

    if let Some(max_debt) = params.max_debt {
        conditions.push("balance >= ?".to_string());
        sql_params.push(max_debt.to_string());
    }

    let order_by = match params.sort_by.as_deref() {
        Some("name") => "name",
        Some("balance") => "balance",
        Some("ratio") => "debt_ratio",
        _ => "balance",
    };

    let order_dir = match params.sort_order.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };

    let where_clause = format!("WHERE {}", conditions.join(" AND "));

    let params_list: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let debts = db.sqlite().query_map(
        &format!(
            "SELECT id, name, balance, credit_limit, notes
             FROM customers
             {}
             ORDER BY {} {}",
            where_clause, order_by, order_dir
        ),
        &params_list[..],
        |row| {
            let balance: f64 = row.get(2)?;
            let credit_limit: f64 = row.get(3)?;
            let available_credit = credit_limit + balance;
            let debt_ratio = if credit_limit > 0.0 {
                (balance.abs() / credit_limit * 100.0).min(100.0)
            } else {
                100.0
            };

            Ok(CustomerDebt {
                id: row.get(0)?,
                name: row.get(1)?,
                balance,
                credit_limit,
                available_credit,
                debt_ratio,
                notes: row.get(4)?,
            })
        },
    ).map_err(|e| format!("Failed to fetch debts: {}", e))?;

    Ok(debts)
}

/// 获取客户财务历史
#[tauri::command]
pub async fn get_customer_financial_history(
    customer_id: String,
    limit: Option<i32>,
    db: State<'_, Database>,
) -> Result<Vec<FinancialRecord>, String> {
    let limit = limit.unwrap_or(50);

    db.sqlite().query_map(
        "SELECT fr.id, fr.type, fr.amount, fr.description, fr.order_id, fr.order_item_id,
                fr.customer_id, c.name as customer_name,
                fr.balance_before, fr.balance_after, fr.operator_name, fr.created_at
         FROM financial_records fr
         LEFT JOIN customers c ON fr.customer_id = c.id
         WHERE fr.customer_id = ?1
         ORDER BY fr.created_at DESC
         LIMIT ?2",
        &[&customer_id as &dyn rusqlite::ToSql, &limit],
        |row| {
            let timestamp: i64 = row.get(11)?;
            let created_at = DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339();
            Ok(FinancialRecord {
                id: row.get(0)?,
                record_type: row.get(1)?,
                amount: row.get(2)?,
                description: row.get(3)?,
                order_id: row.get(4)?,
                order_item_id: row.get(5)?,
                customer_id: row.get(6)?,
                customer_name: row.get(7)?,
                balance_before: row.get(8)?,
                balance_after: row.get(9)?,
                operator_name: row.get(10)?,
                created_at,
            })
        },
    ).map_err(|e| format!("Failed to fetch customer financial history: {}", e))
}

/// 客户充值/还款
#[tauri::command]
pub async fn customer_payment(
    customer_id: String,
    amount: f64,
    description: Option<String>,
    order_id: Option<String>,
    db: State<'_, Database>,
) -> Result<FinancialRecord, String> {
    let description = description.unwrap_or_else(|| "客户充值".to_string());

    let request = CreateFinancialRecordRequest {
        record_type: "PAYMENT".to_string(),
        amount,
        description,
        customer_id,
        order_id,
        order_item_id: None,
    };

    create_financial_record(request, db).await
}

/// 客户退款
#[tauri::command]
pub async fn customer_refund(
    customer_id: String,
    amount: f64,
    description: Option<String>,
    order_id: Option<String>,
    order_item_id: Option<String>,
    db: State<'_, Database>,
) -> Result<FinancialRecord, String> {
    let description = description.unwrap_or_else(|| "订单退款".to_string());

    let request = CreateFinancialRecordRequest {
        record_type: "REFUND".to_string(),
        amount,
        description,
        customer_id,
        order_id,
        order_item_id,
    };

    create_financial_record(request, db).await
}

/// 余额调整（管理员操作）
#[tauri::command]
pub async fn adjust_customer_balance(
    customer_id: String,
    new_balance: f64,
    description: String,
    db: State<'_, Database>,
) -> Result<FinancialRecord, String> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    let result: Option<(String, f64)> = db.sqlite().query_row(
        "SELECT name, balance FROM customers WHERE id = ?1",
        &[&customer_id as &dyn rusqlite::ToSql],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Failed to fetch customer: {}", e))?;

    let (_customer_name, current_balance) = result
        .ok_or_else(|| "Customer not found".to_string())?;

    let amount = (new_balance - current_balance).abs();

    db.sqlite().transaction(|tx| {
        tx.execute(
            "INSERT INTO financial_records (id, type, amount, description, customer_id, balance_before, balance_after, operator_name, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            [
                &id as &dyn rusqlite::ToSql,
                &"ADJUSTMENT",
                &amount,
                &description,
                &customer_id,
                &current_balance,
                &new_balance,
                &"Admin",
                &now,
            ],
        )?;

        tx.execute(
            "UPDATE customers SET balance = ?1, updated_at = ?2 WHERE id = ?3",
            [&new_balance as &dyn rusqlite::ToSql, &now, &customer_id],
        )?;

        Ok(())
    }).map_err(|e| format!("Failed to adjust balance: {}", e))?;

    // 记录日志
    log_financial_operation(
        "余额调整",
        &customer_id,
        &_customer_name,
        amount,
        current_balance,
        new_balance,
        db.clone(),
    ).await?;

    get_financial_record_by_id(id, db).await?.ok_or_else(|| "Failed to retrieve adjustment record".to_string())
}

/// 获取财务汇总（按类型统计）
#[tauri::command]
pub async fn get_financial_summary(
    start_date: Option<String>,
    end_date: Option<String>,
    db: State<'_, Database>,
) -> Result<serde_json::Value, String> {
    let (start_ts, end_ts) = match (start_date, end_date) {
        (Some(s), Some(e)) => {
            let start = chrono::DateTime::parse_from_rfc3339(&s)
                .map_err(|_| "Invalid start_date format".to_string())?.timestamp();
            let end = chrono::DateTime::parse_from_rfc3339(&e)
                .map_err(|_| "Invalid end_date format".to_string())?.timestamp();
            (Some(start), Some(end))
        },
        _ => {
            let now = chrono::Utc::now();
            let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
            (Some(start), None)
        }
    };

    let mut conditions = vec![];
    let mut params: Vec<i64> = vec![];

    if let Some(start) = start_ts {
        conditions.push("created_at >= ?".to_string());
        params.push(start);
    }
    if let Some(end) = end_ts {
        conditions.push("created_at <= ?".to_string());
        params.push(end);
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let params_list: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let summary = db.sqlite().query_row(
        &format!(
            "SELECT
                type,
                COUNT(*) as count,
                SUM(amount) as total_amount
             FROM financial_records
             {}
             GROUP BY type",
            where_clause
        ),
        &params_list[..],
        |row| {
            Ok(serde_json::json!({
                "type": row.get::<_, String>(0)?,
                "count": row.get::<_, i32>(1)?,
                "total_amount": row.get::<_, f64>(2)?,
            }))
        },
    );

    Ok(serde_json::json!({
        "summary": summary.ok(),
        "period": {
            "start": start_ts,
            "end": end_ts,
        }
    }))
}

/// 为历史已确认订单补充财务记录
#[tauri::command]
pub async fn migrate_order_financial_records(db: State<'_, Database>) -> Result<String, String> {
    let mut count = 0;

    // 先查询所有需要迁移的订单
    let orders_to_migrate: Vec<(String, String, String, f64, i64)> = db.sqlite().query_map(
        "SELECT o.id, o.customer_id, c.name, o.total_amount, o.confirmed_at
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.is_confirmed = 1
         AND NOT EXISTS (
             SELECT 1 FROM financial_records fr
             WHERE fr.order_id = o.id AND fr.type = 'ORDER'
         )",
        &[],
        |row| Ok((
            row.get::<_, String>(0)?, // order_id
            row.get::<_, String>(1)?, // customer_id
            row.get::<_, String>(2)?, // customer_name
            row.get::<_, f64>(3)?,    // total_amount
            row.get::<_, i64>(4)?,    // confirmed_at
        )),
    ).map_err(|e| format!("Failed to query orders: {}", e))?;

    // 对每个订单创建财务记录
    for (order_id, customer_id, customer_name, total_amount, confirmed_at) in orders_to_migrate {
        db.sqlite().transaction(|tx| {
            // 获取当前余额
            let current_balance: f64 = tx.query_row(
                "SELECT balance FROM customers WHERE id = ?1",
                &[&customer_id as &dyn rusqlite::ToSql],
                |row| row.get(0),
            )?;

            // 计算历史余额（使用当前余额反推，简化处理）
            let balance_before = current_balance + total_amount;
            let balance_after = current_balance;

            // 创建财务记录
            let financial_id = uuid::Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO financial_records
                 (id, type, amount, description, order_id, customer_id,
                  balance_before, balance_after, operator_name, created_at)
                 VALUES (?1, 'ORDER', ?2, ?3, ?4, ?5, ?6, ?7, 'Migration', ?8)",
                &[
                    &financial_id as &dyn rusqlite::ToSql,
                    &total_amount,
                    &format!("订单确认 (订单号: {})", order_id),
                    &order_id,
                    &customer_id,
                    &balance_before,
                    &balance_after,
                    &confirmed_at,
                ],
            )?;

            count += 1;
            println!("[数据迁移] 补充财务记录: order={}, customer={}", order_id, customer_name);

            Ok::<_, rusqlite::Error>(())
        }).map_err(|e| format!("Failed to create financial record for order {}: {:?}", order_id, e))?;
    }

    Ok(format!("已补充 {} 条订单财务记录", count))
}
