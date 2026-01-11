use crate::models::{CreateOrderRequest, Order, OrderPatternItem, UpdateOrderRequest, UpdateOrderFullRequest};
use crate::services::{Database, pricing::calculate_order_item_price};
use tauri::State;

// 生成唯一 ID
fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// 生成订单号
fn generate_order_number() -> String {
    let datetime = chrono::Utc::now();
    format!("ORD{}", datetime.format("%Y%m%d%H%M%S"))
}

// 获取所有订单
#[tauri::command]
pub async fn get_orders(db: State<'_, Database>) -> Result<Vec<Order>, String> {
    // 1. 查询所有订单（JOIN customer）
    let orders = db.sqlite().query_map(
        "SELECT
            o.id, o.customerId, c.name as customer_name,
            o.totalAmount, o.status, o.notes, o.createdAt, o.updatedAt
        FROM orders o
        LEFT JOIN customers c ON o.customerId = c.id
        ORDER BY o.createdAt DESC",
        &[],
        |row: &rusqlite::Row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, i64>(6)?.to_string(),
                row.get::<_, i64>(7)?.to_string(),
            ))
        },
    ).map_err(|e| format!("Failed to fetch orders: {:?}", e))?;

    // 2. 为每个订单加载图案项
    let mut result = Vec::new();

    for (order_id, customer_id, customer_name, total_amount, status, notes, created_at, updated_at) in orders {
        // 获取订单的图案项
        let items = db.sqlite().query_map(
            "SELECT
                opi.id, opi.patternId, p.name as pattern_name,
                opi.quantity, opi.area, opi.pricingMode, opi.unitPrice, opi.totalPrice
            FROM order_pattern_items opi
            LEFT JOIN patterns p ON opi.patternId = p.id
            WHERE opi.orderId = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row: &rusqlite::Row| {
                Ok(OrderPatternItem {
                    id: row.get(0)?,
                    pattern_id: row.get(1)?,
                    pattern_name: row.get(2)?,
                    quantity: row.get(3)?,
                    area: row.get(4)?,
                    pricing_mode: row.get(5)?,
                    unit_price: row.get(6)?,
                    total_price: row.get(7)?,
                })
            },
        ).map_err(|e| format!("Failed to fetch order items: {:?}", e))?;

        result.push(Order {
            id: order_id.clone(),
            order_number: format!("ORD-{}", &order_id.chars().take(8).collect::<String>()),
            customer_id,
            customer_name,
            total_amount,
            status,
            notes,
            created_at,
            updated_at,
            items,
        });
    }

    Ok(result)
}

// 根据 ID 获取订单
#[tauri::command]
pub async fn get_order_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Order>, String> {
    // 查询订单
    let order = db.sqlite().query_row(
        "SELECT
            o.id, o.customerId, c.name as customer_name,
            o.totalAmount, o.status, o.notes, o.createdAt, o.updatedAt
        FROM orders o
        LEFT JOIN customers c ON o.customerId = c.id
        WHERE o.id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row: &rusqlite::Row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, i64>(6)?.to_string(),
                row.get::<_, i64>(7)?.to_string(),
            ))
        },
    );

    match order {
        Ok(Some((order_id, customer_id, customer_name, total_amount, status, notes, created_at, updated_at))) => {
            // 获取订单的图案项
            let items = db.sqlite().query_map(
                "SELECT
                    opi.id, opi.patternId, p.name as pattern_name,
                    opi.quantity, opi.area, opi.pricingMode, opi.unitPrice, opi.totalPrice
                FROM order_pattern_items opi
                LEFT JOIN patterns p ON opi.patternId = p.id
                WHERE opi.orderId = ?1",
                &[&order_id as &dyn rusqlite::ToSql],
                |row: &rusqlite::Row| {
                    Ok(OrderPatternItem {
                        id: row.get(0)?,
                        pattern_id: row.get(1)?,
                        pattern_name: row.get(2)?,
                        quantity: row.get(3)?,
                        area: row.get(4)?,
                        pricing_mode: row.get(5)?,
                        unit_price: row.get(6)?,
                        total_price: row.get(7)?,
                    })
                },
            ).map_err(|e| format!("Failed to fetch order items: {:?}", e))?;

            Ok(Some(Order {
                id: order_id.clone(),
                order_number: format!("ORD-{}", &order_id.chars().take(8).collect::<String>()),
                customer_id,
                customer_name,
                total_amount,
                status,
                notes,
                created_at,
                updated_at,
                items,
            }))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to fetch order: {:?}", e)),
    }
}

// 创建订单
#[tauri::command]
pub async fn create_order(
    request: CreateOrderRequest,
    db: State<'_, Database>,
) -> Result<Order, String> {
    let now = chrono::Utc::now().timestamp();

    // 1. 获取客户信息（包含 unitPrice）
    let customer = db.sqlite().query_row(
        "SELECT id, name, unitPrice FROM customers WHERE id = ?1",
        &[&request.customer_id as &dyn rusqlite::ToSql],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
            ))
        },
    ).map_err(|e| format!("Failed to fetch customer: {:?}", e))?;

    let (customer_id, customer_name, customer_unit_price) = match customer {
        Some(c) => c,
        None => return Err(format!("Customer not found: {}", request.customer_id)),
    };

    // 2. 计算每个订单项的单价和总价
    let mut order_items: Vec<OrderPatternItem> = Vec::new();

    for item_request in &request.items {
        // 获取图案信息
        let pattern = db.sqlite().query_row(
            "SELECT id, name, actualHeight, unitsPerRow FROM patterns WHERE id = ?1",
            &[&item_request.pattern_id as &dyn rusqlite::ToSql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, i32>(3)?,
                ))
            },
        ).map_err(|e| format!("Failed to fetch pattern: {:?}", e))?;

        let (pattern_id, pattern_name, actual_height, units_per_row) = match pattern {
            Some(p) => p,
            None => return Err(format!("Pattern not found: {}", item_request.pattern_id)),
        };

        // 使用价格计算引擎计算单价和总价
        let (unit_price, total_price) = calculate_order_item_price(
            customer_unit_price,
            actual_height,
            units_per_row,
            item_request.quantity,
        ).map_err(|e| format!("Price calculation failed: {}", e))?;

        order_items.push(OrderPatternItem {
            id: generate_id(),
            pattern_id,
            pattern_name,
            quantity: item_request.quantity,
            area: item_request.area,
            pricing_mode: item_request.pricing_mode.clone(),
            unit_price,
            total_price,
        });
    }

    // 3. 计算总金额
    let total_amount: f64 = order_items.iter().map(|i| i.total_price).sum();

    // 4. 创建订单（使用事务）
    let order_id = db.sqlite().transaction(|tx| {
        // 插入订单
        tx.execute(
            "INSERT INTO orders (id, customerId, totalAmount, status, notes, orderDate, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            &[
                &generate_id() as &dyn rusqlite::ToSql,
                &customer_id,
                &total_amount,
                &"pending", // 默认状态
                &request.notes.as_deref().unwrap_or(""),
                &now,
                &now,
                &now,
            ],
        )?;

        // 获取最后插入的 ID
        let order_id = tx.last_insert_rowid() as i64;

        // 获取刚才插入的订单的实际 ID（UUID）
        let actual_order_id: String = tx.query_row(
            "SELECT id FROM orders WHERE rowid = ?1",
            &[&order_id],
            |row| row.get(0),
        )?;

        // 创建订单图案项
        for (item_request, order_item) in request.items.iter().zip(order_items.iter()) {
            tx.execute(
                "INSERT INTO order_pattern_items (id, orderId, patternId, quantity, area, pricingMode, unitPrice, totalPrice, createdAt, updatedAt)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                &[
                    &order_item.id as &dyn rusqlite::ToSql,
                    &actual_order_id,
                    &item_request.pattern_id,
                    &item_request.quantity,
                    &item_request.area,
                    &item_request.pricing_mode,
                    &order_item.unit_price,
                    &order_item.total_price,
                    &now,
                    &now,
                ],
            )?;
        }

        Ok::<_, rusqlite::Error>(actual_order_id)
    }).map_err(|e| format!("Failed to create order: {:?}", e))?;

    // 5. 返回完整的订单信息
    Ok(Order {
        id: order_id.clone(),
        order_number: generate_order_number(),
        customer_id,
        customer_name,
        total_amount,
        status: "pending".to_string(),
        notes: request.notes,
        created_at: now.to_string(),
        updated_at: now.to_string(),
        items: order_items,
    })
}

// 更新订单
#[tauri::command]
pub async fn update_order(
    request: UpdateOrderRequest,
    db: State<'_, Database>,
) -> Result<Option<Order>, String> {
    let id = request.id.clone();

    // 构建动态 UPDATE 语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref status) = request.status {
        updates.push("status = ?");
        params.push(status.clone());
    }

    if let Some(ref notes) = request.notes {
        updates.push("notes = ?");
        params.push(notes.clone());
    }

    if updates.is_empty() {
        return Ok(None);
    }

    updates.push("updatedAt = ?");
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE orders SET {} WHERE id = ?", updates.join(", "));

    // 执行更新
    db.sqlite().execute(
        &sql,
        &params.iter().map(|s| s as &dyn rusqlite::ToSql).chain(std::iter::once(&id as &dyn rusqlite::ToSql)).collect::<Vec<_>>(),
    ).map_err(|e| format!("Failed to update order: {:?}", e))?;

    // 返回更新后的订单
    get_order_by_id(id, db).await
}

// 删除订单
#[tauri::command]
pub async fn delete_order(
    id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    db.sqlite().execute(
        "DELETE FROM orders WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
    ).map_err(|e| format!("Failed to delete order: {:?}", e))?;

    Ok(true)
}

// 完整更新订单（包括客户、订单项、状态、备注）
#[tauri::command]
pub async fn update_order_full(
    request: UpdateOrderFullRequest,
    db: State<'_, Database>,
) -> Result<Order, String> {
    let now = chrono::Utc::now().timestamp();
    let order_id = request.id.clone();

    // 1. 获取新客户信息（包含 unitPrice）
    let customer = db.sqlite().query_row(
        "SELECT id, name, unitPrice FROM customers WHERE id = ?1",
        &[&request.customer_id as &dyn rusqlite::ToSql],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
            ))
        },
    ).map_err(|e| format!("Failed to fetch customer: {:?}", e))?;

    let (customer_id, customer_name, customer_unit_price) = match customer {
        Some(c) => c,
        None => return Err(format!("Customer not found: {}", request.customer_id)),
    };

    // 2. 计算每个订单项的单价和总价
    let mut order_items: Vec<OrderPatternItem> = Vec::new();

    for item_request in &request.items {
        // 获取图案信息
        let pattern = db.sqlite().query_row(
            "SELECT id, name, actualHeight, unitsPerRow FROM patterns WHERE id = ?1",
            &[&item_request.pattern_id as &dyn rusqlite::ToSql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, i32>(3)?,
                ))
            },
        ).map_err(|e| format!("Failed to fetch pattern: {:?}", e))?;

        let (pattern_id, pattern_name, actual_height, units_per_row) = match pattern {
            Some(p) => p,
            None => return Err(format!("Pattern not found: {}", item_request.pattern_id)),
        };

        // 使用价格计算引擎计算单价和总价
        let (unit_price, total_price) = calculate_order_item_price(
            customer_unit_price,
            actual_height,
            units_per_row,
            item_request.quantity,
        ).map_err(|e| format!("Price calculation failed: {}", e))?;

        order_items.push(OrderPatternItem {
            id: generate_id(),
            pattern_id,
            pattern_name,
            quantity: item_request.quantity,
            area: item_request.area,
            pricing_mode: item_request.pricing_mode.clone(),
            unit_price,
            total_price,
        });
    }

    // 3. 计算总金额
    let total_amount: f64 = order_items.iter().map(|i| i.total_price).sum();

    // 4. 使用事务更新订单和订单项
    db.sqlite().transaction(|tx| {
        // 更新订单基本信息
        tx.execute(
            "UPDATE orders SET customerId = ?1, totalAmount = ?2, status = ?3, notes = ?4, updatedAt = ?5
             WHERE id = ?6",
            &[
                &customer_id as &dyn rusqlite::ToSql,
                &total_amount,
                &request.status,
                &request.notes.as_deref().unwrap_or(""),
                &now,
                &order_id,
            ],
        )?;

        // 删除原有订单项
        tx.execute(
            "DELETE FROM order_pattern_items WHERE orderId = ?1",
            &[&order_id],
        )?;

        // 创建新的订单项
        for (item_request, order_item) in request.items.iter().zip(order_items.iter()) {
            tx.execute(
                "INSERT INTO order_pattern_items (id, orderId, patternId, quantity, area, pricingMode, unitPrice, totalPrice, createdAt, updatedAt)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                &[
                    &order_item.id as &dyn rusqlite::ToSql,
                    &order_id,
                    &item_request.pattern_id,
                    &item_request.quantity,
                    &item_request.area,
                    &item_request.pricing_mode,
                    &order_item.unit_price,
                    &order_item.total_price,
                    &now,
                    &now,
                ],
            )?;
        }

        Ok::<_, rusqlite::Error>(())
    }).map_err(|e| format!("Failed to update order: {:?}", e))?;

    // 5. 返回完整的订单信息
    Ok(Order {
        id: order_id.clone(),
        order_number: format!("ORD-{}", &order_id.chars().take(8).collect::<String>()),
        customer_id,
        customer_name,
        total_amount,
        status: request.status,
        notes: request.notes,
        created_at: now.to_string(), // 简化：使用当前时间
        updated_at: now.to_string(),
        items: order_items,
    })
}
