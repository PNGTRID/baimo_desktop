use crate::models::product::{CreateProductRequest, Product, UpdateProductRequest};
use crate::models::{
    AddProductsToOrderRequest, Order, OrderProductItem,
};
use crate::services::Database;
use tauri::State;

// 获取所有产品
#[tauri::command]
pub async fn get_products(db: State<'_, Database>) -> Result<Vec<Product>, String> {
    db.sqlite().query_map(
        "SELECT id, name, price, unit, created_at, updated_at FROM products ORDER BY name ASC",
        &[],
        |row: &rusqlite::Row| {
            let created_at_ts: i64 = row.get(4)?;
            let updated_at_ts: i64 = row.get(5)?;
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                price: row.get(2)?,
                unit: row.get(3)?,
                created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
                updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
            })
        },
    )
    .map_err(|e| format!("Failed to fetch products: {:?}", e))
}

// 根据 ID 获取产品
#[tauri::command]
pub async fn get_product_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Product>, String> {
    db.sqlite().query_row(
        "SELECT id, name, price, unit, created_at, updated_at FROM products WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row: &rusqlite::Row| {
            let created_at_ts: i64 = row.get(4)?;
            let updated_at_ts: i64 = row.get(5)?;
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                price: row.get(2)?,
                unit: row.get(3)?,
                created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
                updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339(),
            })
        },
    )
    .map_err(|e| format!("Failed to fetch product: {:?}", e))
}

// 创建产品
#[tauri::command]
pub async fn create_product(
    request: CreateProductRequest,
    db: State<'_, Database>,
) -> Result<Product, String> {
    let product_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    db.sqlite()
        .execute(
            "INSERT INTO products (id, name, price, unit, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                &product_id,
                &request.name,
                request.price,
                &request.unit,
                now,
                now,
            ],
        )
        .map_err(|e| format!("Failed to create product: {:?}", e))?;

    // 返回创建的产品
    db.sqlite()
        .query_row(
            "SELECT id, name, price, unit, created_at, updated_at FROM products WHERE id = ?1",
            &[&product_id as &dyn rusqlite::ToSql],
            |row: &rusqlite::Row| {
                let created_at_ts: i64 = row.get(4)?;
                let updated_at_ts: i64 = row.get(5)?;
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    price: row.get(2)?,
                    unit: row.get(3)?,
                    created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                    updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created product: {:?}", e))?
        .ok_or_else(|| "Failed to retrieve created product".to_string())
}

// 更新产品
#[tauri::command]
pub async fn update_product(
    request: UpdateProductRequest,
    db: State<'_, Database>,
) -> Result<Option<Product>, String> {
    let id = request.id.clone();

    // 构建动态 UPDATE 语句
    let mut updates = vec![];
    let mut params: Vec<String> = vec![];

    if let Some(ref name) = request.name {
        updates.push("name = ?");
        params.push(name.clone());
    }
    if let Some(price) = request.price {
        updates.push("price = ?");
        params.push(price.to_string());
    }
    if let Some(ref unit) = request.unit {
        updates.push("unit = ?");
        params.push(unit.clone());
    }

    if updates.is_empty() {
        return Ok(None);
    }

    updates.push("updated_at = ?");
    params.push(chrono::Utc::now().timestamp().to_string());

    let sql = format!("UPDATE products SET {} WHERE id = ?", updates.join(", "));

    let mut sql_params: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
    sql_params.push(id.as_str());

    let conn = db.sqlite().connection();
    let conn = conn.lock().unwrap();
    conn.prepare(&sql)
        .map_err(|e| format!("Failed to prepare statement: {:?}", e))?
        .execute(rusqlite::params_from_iter(sql_params.iter()))
        .map_err(|e| format!("Failed to update product: {:?}", e))?;
    drop(conn);

    // 获取更新后的产品
    db.sqlite()
        .query_row(
            "SELECT id, name, price, unit, created_at, updated_at FROM products WHERE id = ?1",
            &[&id as &dyn rusqlite::ToSql],
            |row: &rusqlite::Row| {
                let created_at_ts: i64 = row.get(4)?;
                let updated_at_ts: i64 = row.get(5)?;
                Ok(Product {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    price: row.get(2)?,
                    unit: row.get(3)?,
                    created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                    updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                })
            },
        )
        .map_err(|e| format!("Failed to fetch updated product: {:?}", e))
}

// 删除产品
#[tauri::command]
pub async fn delete_product(id: String, db: State<'_, Database>) -> Result<bool, String> {
    // 检查产品是否被订单使用
    let usage_count: i32 = db
        .sqlite()
        .query_row(
            "SELECT COUNT(*) FROM order_items WHERE product_id = ?",
            &[&id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check product usage: {}", e))?
        .unwrap_or(0);

    if usage_count > 0 {
        return Err(format!(
            "该产品已被 {} 个订单使用，无法删除",
            usage_count
        ));
    }

    db.sqlite()
        .execute("DELETE FROM products WHERE id = ?", &[&id as &dyn rusqlite::ToSql])
        .map_err(|e| format!("Failed to delete product: {:?}", e))?;

    Ok(true)
}

// 获取订单中的所有产品项
#[tauri::command]
pub async fn get_order_product_items(
    order_id: String,
    db: State<'_, Database>,
) -> Result<Vec<OrderProductItem>, String> {
    db.sqlite().query_map(
        "SELECT oi.id, oi.product_id, p.name, p.unit, oi.quantity, oi.price, oi.subtotal
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?1",
        &[&order_id as &dyn rusqlite::ToSql],
        |row: &rusqlite::Row| {
            Ok(OrderProductItem {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                product_unit: row.get(3)?,
                quantity: row.get(4)?,
                price: row.get(5)?,
                subtotal: row.get(6)?,
            })
        },
    )
    .map_err(|e| format!("Failed to fetch order product items: {:?}", e))
}

// 添加产品到订单
#[tauri::command]
pub async fn add_products_to_order(
    request: AddProductsToOrderRequest,
    db: State<'_, Database>,
) -> Result<Order, String> {
    let now = chrono::Utc::now().timestamp();
    let order_id: String;

    // 如果指定了订单ID，则添加到现有订单
    if let Some(ref existing_order_id) = request.order_id {
        order_id = existing_order_id.clone();

        // 获取现有订单信息
        let existing_order = db
            .sqlite()
            .query_row(
                "SELECT customer_id, notes FROM orders WHERE id = ?1",
                &[&order_id as &dyn rusqlite::ToSql],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
            )
            .map_err(|e| format!("Failed to fetch existing order: {:?}", e))?
            .ok_or_else(|| "Order not found".to_string())?;

        // 验证客户ID匹配
        if existing_order.0 != request.customer_id {
            return Err("订单不属于该客户".to_string());
        }
    } else {
        // 创建新订单
        order_id = uuid::Uuid::new_v4().to_string();

        // 生成订单号
        db.sqlite()
            .execute(
                "INSERT INTO orders (id, customer_id, total_amount, is_confirmed, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    &order_id,
                    &request.customer_id,
                    0.0, // total_amount
                    false, // is_confirmed
                    request.notes.as_deref().unwrap_or(""),
                    now,
                    now,
                ],
            )
            .map_err(|e| format!("Failed to create order: {:?}", e))?;
    }

    // 插入产品订单项
    for item in &request.product_items {
        // 获取产品信息
        let product = db
            .sqlite()
            .query_row(
                "SELECT name, price, unit FROM products WHERE id = ?1",
                &[&item.product_id as &dyn rusqlite::ToSql],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, f64>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .map_err(|e| format!("Failed to fetch product: {:?}", e))?
            .ok_or_else(|| "Product not found".to_string())?;

        let subtotal = product.1 * item.quantity as f64;

        let item_id = uuid::Uuid::new_v4().to_string();
        db.sqlite()
            .execute(
                "INSERT INTO order_items (id, order_id, product_id, quantity, price, subtotal, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    &item_id,
                    &order_id,
                    &item.product_id,
                    item.quantity,
                    product.1,
                    subtotal,
                    now,
                    now,
                ],
            )
            .map_err(|e| format!("Failed to add product to order: {:?}", e))?;
    }

    // 更新订单总金额（产品订单项 + 图案订单项）
    let product_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate product total: {:?}", e))?
        .unwrap_or(0.0);

    // 同时计算图案订单项的总金额
    let pattern_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(total_price), 0) FROM order_pattern_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate pattern total: {:?}", e))?
        .unwrap_or(0.0);

    let new_total = product_total + pattern_total;

    db.sqlite()
        .execute(
            "UPDATE orders SET total_amount = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![new_total, now, &order_id],
        )
        .map_err(|e| format!("Failed to update order total: {:?}", e))?;

    // 返回更新后的订单
    let order = db
        .sqlite()
        .query_row(
            "SELECT o.id, o.customer_id, c.name, o.total_amount, o.is_confirmed, o.confirmed_at, o.notes, o.created_at, o.updated_at
             FROM orders o
             JOIN customers c ON o.customer_id = c.id
             WHERE o.id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row: &rusqlite::Row| {
                let order_id_value: String = row.get(0)?;
                let created_at_ts: i64 = row.get(7)?;
                let updated_at_ts: i64 = row.get(8)?;
                let confirmed_at_ts: Option<i64> = row.get(5)?;
                // 使用订单ID的前8位作为订单号，与原系统保持一致
                let short_id = if order_id_value.len() >= 8 { &order_id_value[..8] } else { &order_id_value };
                let order_number = format!("ORD-{}", short_id.to_uppercase());
                Ok(Order {
                    id: order_id_value,
                    order_number,
                    customer_id: row.get(1)?,
                    customer_name: row.get(2)?,
                    total_amount: row.get(3)?,
                    is_confirmed: row.get(4)?,
                    confirmed_at: confirmed_at_ts.map(|ts| {
                        chrono::DateTime::from_timestamp(ts, 0)
                            .unwrap_or_else(|| chrono::Utc::now())
                            .to_rfc3339()
                    }),
                    notes: row.get(6)?,
                    created_at: chrono::DateTime::from_timestamp(created_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                    updated_at: chrono::DateTime::from_timestamp(updated_at_ts, 0)
                        .unwrap_or_else(|| chrono::Utc::now())
                        .to_rfc3339(),
                    items: vec![], // 图案项为空，因为这里只添加了产品
                    product_items: vec![], // 创建订单时暂不包含产品项
                })
            },
        )
        .map_err(|e| format!("Failed to fetch updated order: {:?}", e))?
        .ok_or_else(|| "Order not found".to_string())?;

    Ok(order)
}

// 更新产品订单项的数量
#[tauri::command]
pub async fn update_order_product_item(
    item_id: String,
    quantity: i32,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let now = chrono::Utc::now().timestamp();

    // 获取当前产品订单项的信息，计算新小计
    let (price, order_id): (f64, String) = db
        .sqlite()
        .query_row(
            "SELECT price, order_id FROM order_items WHERE id = ?1",
            &[&item_id as &dyn rusqlite::ToSql],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to fetch product item: {:?}", e))?
        .ok_or_else(|| "Product item not found".to_string())?;

    let subtotal = price * quantity as f64;

    // 更新产品订单项
    db.sqlite()
        .execute(
            "UPDATE order_items SET quantity = ?1, subtotal = ?2, updated_at = ?3 WHERE id = ?4",
            rusqlite::params![quantity, subtotal, now, &item_id],
        )
        .map_err(|e| format!("Failed to update product item: {:?}", e))?;

    // 重新计算订单总金额
    let new_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate total: {:?}", e))?
        .unwrap_or(0.0);

    // 同时计算图案订单项的总金额
    let pattern_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(total_price), 0) FROM order_pattern_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate pattern total: {:?}", e))?
        .unwrap_or(0.0);

    let final_total = new_total + pattern_total;

    // 更新订单总金额
    db.sqlite()
        .execute(
            "UPDATE orders SET total_amount = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![final_total, now, &order_id],
        )
        .map_err(|e| format!("Failed to update order total: {:?}", e))?;

    Ok(true)
}

// 删除产品订单项
#[tauri::command]
pub async fn delete_order_product_item(
    item_id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    // 获取订单ID
    let order_id: String = db
        .sqlite()
        .query_row(
            "SELECT order_id FROM order_items WHERE id = ?1",
            &[&item_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to fetch product item: {:?}", e))?
        .ok_or_else(|| "Product item not found".to_string())?;

    // 删除产品订单项
    db.sqlite()
        .execute(
            "DELETE FROM order_items WHERE id = ?1",
            &[&item_id as &dyn rusqlite::ToSql],
        )
        .map_err(|e| format!("Failed to delete product item: {:?}", e))?;

    // 重新计算订单总金额
    let new_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate total: {:?}", e))?
        .unwrap_or(0.0);

    // 同时计算图案订单项的总金额
    let pattern_total: f64 = db
        .sqlite()
        .query_row(
            "SELECT COALESCE(SUM(total_price), 0) FROM order_pattern_items WHERE order_id = ?1",
            &[&order_id as &dyn rusqlite::ToSql],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to calculate pattern total: {:?}", e))?
        .unwrap_or(0.0);

    let final_total = new_total + pattern_total;

    // 更新订单总金额
    db.sqlite()
        .execute(
            "UPDATE orders SET total_amount = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![final_total, chrono::Utc::now().timestamp(), &order_id],
        )
        .map_err(|e| format!("Failed to update order total: {:?}", e))?;

    Ok(true)
}
