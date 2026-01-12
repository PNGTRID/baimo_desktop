use crate::models::{CreateOrderRequest, Order, OrderPatternItem, UpdateOrderRequest, UpdateOrderFullRequest};
use crate::services::{Database, pricing::calculate_pattern_price};
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
            o.totalAmount, o.is_confirmed, o.confirmed_at, o.notes, o.createdAt, o.updatedAt
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
                row.get::<_, bool>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        },
    ).map_err(|e| format!("Failed to fetch orders: {:?}", e))?;

    // 2. 为每个订单加载图案项
    let mut result = Vec::new();

    for (order_id, customer_id, customer_name, total_amount, is_confirmed, confirmed_at_ts, notes, created_at_ts, updated_at_ts) in orders {
        // 将时间戳转换为 ISO 8601 格式
        let created_at = chrono::DateTime::from_timestamp(created_at_ts, 0)
            .unwrap_or_else(|| chrono::Utc::now())
            .to_rfc3339();
        let updated_at = chrono::DateTime::from_timestamp(updated_at_ts, 0)
            .unwrap_or_else(|| chrono::Utc::now())
            .to_rfc3339();

        // 处理确认时间
        let confirmed_at = confirmed_at_ts.and_then(|ts| {
            chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.to_rfc3339())
        });

        // 获取订单的图案项
        let items = db.sqlite().query_map(
            "SELECT
                opi.id, opi.patternId, p.name as pattern_name,
                opi.quantity, opi.area, opi.pricingMode, opi.unitPrice, opi.totalPrice,
                opi.color_variant_id
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
                    color_variant_id: row.get(8)?,
                })
            },
        ).map_err(|e| format!("Failed to fetch order items: {:?}", e))?;

        result.push(Order {
            id: order_id.clone(),
            order_number: format!("ORD-{}", &order_id.chars().take(8).collect::<String>()),
            customer_id,
            customer_name,
            total_amount,
            is_confirmed,
            confirmed_at,
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
            o.totalAmount, o.is_confirmed, o.confirmed_at, o.notes, o.createdAt, o.updatedAt
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
                row.get::<_, bool>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        },
    );

    match order {
        Ok(Some((order_id, customer_id, customer_name, total_amount, is_confirmed, confirmed_at_ts, notes, created_at_ts, updated_at_ts))) => {
            // 将时间戳转换为 ISO 8601 格式
            let created_at = chrono::DateTime::from_timestamp(created_at_ts, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339();
            let updated_at = chrono::DateTime::from_timestamp(updated_at_ts, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339();

            // 处理确认时间
            let confirmed_at = confirmed_at_ts.and_then(|ts| {
                chrono::DateTime::from_timestamp(ts, 0)
                    .map(|dt| dt.to_rfc3339())
            });

            // 获取订单的图案项
            let items = db.sqlite().query_map(
                "SELECT
                    opi.id, opi.patternId, p.name as pattern_name,
                    opi.quantity, opi.area, opi.pricingMode, opi.unitPrice, opi.totalPrice,
                    opi.color_variant_id
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
                        color_variant_id: row.get(8)?,
                    })
                },
            ).map_err(|e| format!("Failed to fetch order items: {:?}", e))?;

            Ok(Some(Order {
                id: order_id.clone(),
                order_number: format!("ORD-{}", &order_id.chars().take(8).collect::<String>()),
                customer_id,
                customer_name,
                total_amount,
                is_confirmed,
                confirmed_at,
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
    let now_datetime = chrono::Utc::now();
    let now = now_datetime.timestamp();
    let now_iso = now_datetime.to_rfc3339();

    println!("[订单创建] ========== 开始创建订单 ==========");
    println!("[订单创建] 收到请求: customer_id={}, items={}",
             request.customer_id, request.items.len());
    for (idx, item) in request.items.iter().enumerate() {
        println!("[订单创建] 订单项[{}]: pattern_id={}, color_variant_id={:?}, quantity={}, pricing_mode={}",
                 idx, item.pattern_id, item.color_variant_id, item.quantity, item.pricing_mode);
    }

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

    println!("[订单创建] 客户信息: id={}, name={}, unitPrice={}", customer_id, customer_name, customer_unit_price);

    // 2. 计算每个订单项的单价和总价
    let mut order_items: Vec<OrderPatternItem> = Vec::new();

    for item_request in &request.items {
        // 获取图案信息（包含 bleedHeight）
        let pattern = db.sqlite().query_row(
            "SELECT id, name, actualHeight, bleedHeight, unitsPerRow FROM patterns WHERE id = ?1",
            &[&item_request.pattern_id as &dyn rusqlite::ToSql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, i32>(4)?,
                ))
            },
        ).map_err(|e| format!("Failed to fetch pattern: {:?}", e))?;

        let (pattern_id, pattern_name, actual_height, bleed_height, units_per_row) = match pattern {
            Some(p) => p,
            None => return Err(format!("Pattern not found: {}", item_request.pattern_id)),
        };

        println!("[订单创建] 图案信息: id={}, name={}, actualHeight={}cm, bleedHeight={}cm, unitsPerRow={}",
                 pattern_id, pattern_name, actual_height, bleed_height, units_per_row);

        // 根据计价模式计算单价和总价
        let (unit_price, total_price) = if item_request.pricing_mode == "AREA" {
            // 面积模式：直接使用客户单价 × 面积
            let area = item_request.area.unwrap_or(0.0);
            if area <= 0.0 {
                return Err(format!("Price calculation failed: 面积必须大于 0"));
            }
            let up = customer_unit_price;
            let tp = customer_unit_price * area;
            println!("[订单创建] 面积模式计价: customer_unit_price={}, area={}m²", customer_unit_price, area);
            (up, tp)
        } else {
            // 数量模式：使用价格计算引擎
            let pricing_result = calculate_pattern_price(
                crate::services::pricing::PatternPricingParams {
                    customer_unit_price,
                    actual_height,
                    bleed_height,
                    units_per_row,
                    quantity: item_request.quantity,
                    area: item_request.area,
                }
            ).map_err(|e| format!("Price calculation failed: {}", e))?;
            println!("[订单创建] 数量模式计价: customer_unit_price={}, actual_height={}cm, units_per_row={}, quantity={}",
                     customer_unit_price, actual_height, units_per_row, item_request.quantity);
            (pricing_result.unit_price, pricing_result.total_price)
        };

        println!("[订单创建] 单价={}, 总价={}", unit_price, total_price);

        order_items.push(OrderPatternItem {
            id: generate_id(),
            pattern_id,
            pattern_name,
            quantity: item_request.quantity,
            area: item_request.area,
            pricing_mode: item_request.pricing_mode.clone(),
            unit_price,
            total_price,
            color_variant_id: item_request.color_variant_id.clone(),
        });
    }

    // 3. 计算总金额
    let total_amount: f64 = order_items.iter().map(|i| i.total_price).sum();

    println!("[订单创建] 订单总金额: {}", total_amount);

    // 4. 创建订单（使用事务）
    println!("[订单创建] 开始事务，准备插入数据库...");

    let order_id = db.sqlite().transaction(|tx| {
        // 插入订单（默认未确认）
        tx.execute(
            "INSERT INTO orders (id, customerId, totalAmount, is_confirmed, notes, orderDate, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            [
                &generate_id() as &dyn rusqlite::ToSql,
                &customer_id,
                &total_amount,
                &false, // 默认未确认
                &request.notes.as_deref().unwrap_or(""),
                &now,
                &now,
                &now,
            ],
        )?;

        // 获取最后插入的 ID
        let order_id = tx.last_insert_rowid();

        // 获取刚才插入的订单的实际 ID（UUID）
        let actual_order_id: String = tx.query_row(
            "SELECT id FROM orders WHERE rowid = ?1",
            [&order_id],
            |row| row.get(0),
        )?;

        println!("[订单创建] 订单主表插入成功: order_id={}", actual_order_id);

        // 创建订单图案项
        for (item_request, order_item) in request.items.iter().zip(order_items.iter()) {
            println!("[订单创建] 插入订单项: patternId={}, color_variant_id={:?}, unitPrice={}, totalPrice={}",
                     item_request.pattern_id, item_request.color_variant_id, order_item.unit_price, order_item.total_price);

            tx.execute(
                "INSERT INTO order_pattern_items (id, orderId, patternId, color_variant_id, quantity, area, pricingMode, unitPrice, totalPrice, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                [
                    &order_item.id as &dyn rusqlite::ToSql,
                    &actual_order_id,
                    &item_request.pattern_id,
                    &item_request.color_variant_id,
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

        println!("[订单创建] 所有订单项插入成功");

        Ok::<_, rusqlite::Error>(actual_order_id)
    }).map_err(|e| {
        println!("[订单创建] 事务失败: {:?}", e);
        format!("Failed to create order: {:?}", e)
    })?;

    // 5. 返回完整的订单信息
    println!("[订单创建] ========== 订单创建成功 ==========");
    println!("[订单创建] 订单ID: {}, 订单号: {}, 总金额: {}", order_id, format!("ORD-{}", &order_id.chars().take(8).collect::<String>()), total_amount);

    Ok(Order {
        id: order_id.clone(),
        order_number: generate_order_number(),
        customer_id,
        customer_name,
        total_amount,
        is_confirmed: false,
        confirmed_at: None,
        notes: request.notes,
        created_at: now_iso.clone(),
        updated_at: now_iso,
        items: order_items,
    })
}

// 更新订单备注
#[tauri::command]
pub async fn update_order(
    request: UpdateOrderRequest,
    db: State<'_, Database>,
) -> Result<Option<Order>, String> {
    let id = request.id.clone();

    // 只更新备注
    if let Some(notes) = request.notes {
        db.sqlite().execute(
            "UPDATE orders SET notes = ?1, updatedAt = ?2 WHERE id = ?3",
            &[
                &notes as &dyn rusqlite::ToSql,
                &chrono::Utc::now().timestamp(),
                &id,
            ],
        ).map_err(|e| format!("Failed to update order: {:?}", e))?;

        // 返回更新后的订单
        return get_order_by_id(id, db).await;
    }

    Ok(None)
}

// 确认并生产订单
#[tauri::command]
pub async fn confirm_order(
    id: String,
    db: State<'_, Database>,
) -> Result<Order, String> {
    let now = chrono::Utc::now().timestamp();

    // 更新订单为已确认状态
    db.sqlite().execute(
        "UPDATE orders SET is_confirmed = ?1, confirmed_at = ?2, updatedAt = ?3 WHERE id = ?4",
        &[
            &true as &dyn rusqlite::ToSql,
            &now,
            &now,
            &id,
        ],
    ).map_err(|e| format!("Failed to confirm order: {:?}", e))?;

    // 返回更新后的订单
    get_order_by_id(id, db).await?.ok_or_else(|| "Order not found".to_string())
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

// 批量删除订单
#[tauri::command]
pub async fn batch_delete_orders(
    ids: Vec<String>,
    db: State<'_, Database>,
) -> Result<usize, String> {
    let mut count = 0;
    for id in &ids {
        db.sqlite().execute(
            "DELETE FROM orders WHERE id = ?1",
            &[&id as &dyn rusqlite::ToSql],
        ).map_err(|e| format!("Failed to delete order {:?}: {:?}", id, e))?;
        count += 1;
    }
    Ok(count)
}

// 完整更新订单（包括客户、订单项、备注）
#[tauri::command]
pub async fn update_order_full(
    request: UpdateOrderFullRequest,
    db: State<'_, Database>,
) -> Result<Order, String> {
    let now_datetime = chrono::Utc::now();
    let now = now_datetime.timestamp();
    let now_iso = now_datetime.to_rfc3339();
    let order_id = request.id.clone();

    // 获取现有订单的确认状态（需要保留）
    let existing_order = db.sqlite().query_row(
        "SELECT is_confirmed, confirmed_at FROM orders WHERE id = ?1",
        &[&order_id as &dyn rusqlite::ToSql],
        |row| {
            Ok((
                row.get::<_, bool>(0)?,
                row.get::<_, Option<i64>>(1)?,
            ))
        },
    ).map_err(|e| format!("Failed to fetch existing order: {:?}", e))?;

    let (is_confirmed, confirmed_at_ts) = match existing_order {
        Some(o) => o,
        None => return Err(format!("Order not found: {}", order_id)),
    };

    // 处理确认时间
    let confirmed_at = confirmed_at_ts.and_then(|ts| {
        chrono::DateTime::from_timestamp(ts, 0)
            .map(|dt| dt.to_rfc3339())
    });

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
        // 获取图案信息（包含 bleedHeight）
        let pattern = db.sqlite().query_row(
            "SELECT id, name, actualHeight, bleedHeight, unitsPerRow FROM patterns WHERE id = ?1",
            &[&item_request.pattern_id as &dyn rusqlite::ToSql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, i32>(4)?,
                ))
            },
        ).map_err(|e| format!("Failed to fetch pattern: {:?}", e))?;

        let (pattern_id, pattern_name, actual_height, bleed_height, units_per_row) = match pattern {
            Some(p) => p,
            None => return Err(format!("Pattern not found: {}", item_request.pattern_id)),
        };

        // 根据计价模式计算单价和总价
        let (unit_price, total_price) = if item_request.pricing_mode == "AREA" {
            // 面积模式：直接使用客户单价 × 面积
            let area = item_request.area.unwrap_or(0.0);
            if area <= 0.0 {
                return Err(format!("Price calculation failed: 面积必须大于 0"));
            }
            let up = customer_unit_price;
            let tp = customer_unit_price * area;
            println!("[订单更新] 面积模式计价: customer_unit_price={}, area={}m²", customer_unit_price, area);
            (up, tp)
        } else {
            // 数量模式：使用价格计算引擎
            let pricing_result = calculate_pattern_price(
                crate::services::pricing::PatternPricingParams {
                    customer_unit_price,
                    actual_height,
                    bleed_height,
                    units_per_row,
                    quantity: item_request.quantity,
                    area: item_request.area,
                }
            ).map_err(|e| format!("Price calculation failed: {}", e))?;
            println!("[订单更新] 数量模式计价: customer_unit_price={}, actual_height={}cm, units_per_row={}, quantity={}",
                     customer_unit_price, actual_height, units_per_row, item_request.quantity);
            (pricing_result.unit_price, pricing_result.total_price)
        };

        println!("[订单更新] 单价={}, 总价={}", unit_price, total_price);

        order_items.push(OrderPatternItem {
            id: generate_id(),
            pattern_id,
            pattern_name,
            quantity: item_request.quantity,
            area: item_request.area,
            pricing_mode: item_request.pricing_mode.clone(),
            unit_price,
            total_price,
            color_variant_id: item_request.color_variant_id.clone(),
        });
    }

    // 3. 计算总金额
    let total_amount: f64 = order_items.iter().map(|i| i.total_price).sum();

    // 4. 使用事务更新订单和订单项
    db.sqlite().transaction(|tx| {
        // 更新订单基本信息（不修改确认状态）
        tx.execute(
            "UPDATE orders SET customerId = ?1, totalAmount = ?2, notes = ?3, updatedAt = ?4
             WHERE id = ?5",
            [
                &customer_id as &dyn rusqlite::ToSql,
                &total_amount,
                &request.notes.as_deref().unwrap_or(""),
                &now,
                &order_id,
            ],
        )?;

        // 删除原有订单项
        tx.execute(
            "DELETE FROM order_pattern_items WHERE orderId = ?1",
            [&order_id],
        )?;

        // 创建新的订单项
        for (item_request, order_item) in request.items.iter().zip(order_items.iter()) {
            println!("[订单更新] 插入订单项: patternId={}, color_variant_id={:?}",
                     item_request.pattern_id, item_request.color_variant_id);

            tx.execute(
                "INSERT INTO order_pattern_items (id, orderId, patternId, color_variant_id, quantity, area, pricingMode, unitPrice, totalPrice, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                [
                    &order_item.id as &dyn rusqlite::ToSql,
                    &order_id,
                    &item_request.pattern_id,
                    &item_request.color_variant_id,
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
        is_confirmed,
        confirmed_at,
        notes: request.notes,
        created_at: now_iso.clone(), // 简化：使用当前时间
        updated_at: now_iso,
        items: order_items,
    })
}
