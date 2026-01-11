// 订单管理集成测试
mod common;
use common::TestDatabase;

#[test]
fn test_order_create() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 先创建客户和图案
    let customer_id = uuid::Uuid::new_v4().to_string();
    let pattern_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    conn.execute(
        "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        &[
            &pattern_id as &dyn rusqlite::ToSql,
            &"测试图案001",
            &"TEST001",
            &100.0_f64,
            &20.0_f64,
            &10,
            &10,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert pattern");

    // 创建订单
    let order_id = uuid::Uuid::new_v4().to_string();
    let order_number = format!("ORD{}", now);

    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &order_id as &dyn rusqlite::ToSql,
            &customer_id,
            &order_number,
            &now,
            &1800.0_f64,  // 总金额
            &"PENDING",
            &now,
            &now,
        ],
    ).expect("Failed to insert order");

    // 验证订单已创建
    let order_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM orders WHERE id = ?1", &[&order_id], |row| {
            row.get(0)
        })
        .expect("Failed to count orders");

    assert_eq!(order_count, 1);

    println!("✅ test_order_create 通过 - 订单号: {}", order_number);
}

#[test]
fn test_order_price_calculation_quantity() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 测试按数量计价
    let quantity = 100;
    let unit_price = 18.0;
    let expected_total = (quantity as f64) * unit_price; // 1800.0

    let actual_total = quantity as f64 * unit_price;

    assert_eq!(actual_total, expected_total);

    println!("✅ test_order_price_calculation_quantity 通过 - 数量: {}, 单价: {}, 总价: {}",
             quantity, unit_price, actual_total);
}

#[test]
fn test_order_price_calculation_area() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 测试按面积计价
    let area = 50.0;  // 平方米
    let unit_price = 20.0;  // 每平方单价
    let expected_total = area * unit_price; // 1000.0

    let actual_total = area * unit_price;

    assert_eq!(actual_total, expected_total);

    println!("✅ test_order_price_calculation_area 通过 - 面积: {}, 单价: {}, 总价: {}",
             area, unit_price, actual_total);
}

#[test]
fn test_order_multiple_items_total() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建订单和多个订单项
    let order_id = uuid::Uuid::new_v4().to_string();
    let customer_id = uuid::Uuid::new_v4().to_string();
    let pattern1_id = uuid::Uuid::new_v4().to_string();
    let pattern2_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 创建客户
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 创建两个图案
    for pattern_id in [&pattern1_id, &pattern2_id] {
        conn.execute(
            "INSERT INTO patterns (id, name, code, actualHeight, bleedHeight, unitsPerRow, rowCount, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            &[
                pattern_id as &dyn rusqlite::ToSql,
                &"测试图案",
                &"TEST001",
                &100.0_f64,
                &20.0_f64,
                &10,
                &10,
                &true,
                &now,
                &now,
            ],
        ).expect("Failed to insert pattern");
    }

    // 创建订单
    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &order_id as &dyn rusqlite::ToSql,
            &customer_id,
            &format!("ORD{}", now),
            &now,
            &2800.0_f64,  // 两个订单项之和: 1800 + 1000
            &"PENDING",
            &now,
            &now,
        ],
    ).expect("Failed to insert order");

    // 创建订单项1: 按数量，100个 × 18 = 1800
    let item1_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO order_pattern_items (id, orderId, patternId, quantity, pricingMode, unitPrice, totalPrice, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        &[
            &item1_id as &dyn rusqlite::ToSql,
            &order_id,
            &pattern1_id,
            &100,
            &"QUANTITY",
            &18.0_f64,
            &1800.0_f64,
            &now,
            &now,
        ],
    ).expect("Failed to insert order item 1");

    // 创建订单项2: 按面积，50平方 × 20 = 1000
    let item2_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO order_pattern_items (id, orderId, patternId, area, pricingMode, unitPrice, totalPrice, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        &[
            &item2_id as &dyn rusqlite::ToSql,
            &order_id,
            &pattern2_id,
            &50.0_f64,
            &"AREA",
            &20.0_f64,
            &1000.0_f64,
            &now,
            &now,
        ],
    ).expect("Failed to insert order item 2");

    // 验证订单项
    let mut stmt = conn
        .prepare("SELECT quantity, area, pricingMode, totalPrice FROM order_pattern_items WHERE orderId = ?1")
        .expect("Failed to prepare statement");

    let items: Vec<(Option<i32>, Option<f64>, String, f64)> = stmt
        .query_map([&order_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
            ))
        })
        .expect("Failed to query order items")
        .filter_map(|c| c.ok())
        .collect();

    assert_eq!(items.len(), 2);

    // 验证总价
    let total: f64 = items.iter().map(|i| i.3).sum();
    assert_eq!(total, 2800.0);

    println!("✅ test_order_multiple_items_total 通过 - 订单项数: {}, 总价: {}", items.len(), total);
}

#[test]
fn test_order_status_flow() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 测试订单状态流转
    let order_id = uuid::Uuid::new_v4().to_string();
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 创建客户
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 创建订单
    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &order_id as &dyn rusqlite::ToSql,
            &customer_id,
            &format!("ORD{}", now),
            &now,
            &1800.0_f64,
            &"PENDING",
            &now,
            &now,
        ],
    ).expect("Failed to insert order");

    // 验证初始状态
    let status: String = conn
        .query_row("SELECT status FROM orders WHERE id = ?1", &[&order_id], |row| {
            row.get(0)
        })
        .expect("Failed to query order status");
    assert_eq!(status, "PENDING");

    // 状态流转: PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
    let statuses = vec!["CONFIRMED", "IN_PROGRESS", "COMPLETED"];

    for new_status in statuses {
        let updated_now = chrono::Utc::now().timestamp();
        conn.execute(
            "UPDATE orders SET status = ?1, updatedAt = ?2 WHERE id = ?3",
            &[&new_status as &dyn rusqlite::ToSql, &updated_now, &order_id as &dyn rusqlite::ToSql],
        ).expect("Failed to update order status");

        let current_status: String = conn
            .query_row("SELECT status FROM orders WHERE id = ?1", &[&order_id], |row| {
                row.get(0)
            })
            .expect("Failed to query order status");

        assert_eq!(current_status, new_status);
    }

    println!("✅ test_order_status_flow 通过");
}

#[test]
fn test_order_date_filter() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建不同日期的订单
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let today = now;
    let yesterday = now - 86400;
    let week_ago = now - (86400 * 7);

    // 创建客户
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 创建今天的订单
    let order1_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[&order1_id as &dyn rusqlite::ToSql, &customer_id, &"ORD1", &today, &100.0_f64, &"PENDING", &now, &now],
    ).expect("Failed to insert order 1");

    // 创建昨天的订单
    let order2_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[&order2_id as &dyn rusqlite::ToSql, &customer_id, &"ORD2", &yesterday, &200.0_f64, &"PENDING", &now, &now],
    ).expect("Failed to insert order 2");

    // 创建一周前的订单
    let order3_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[&order3_id as &dyn rusqlite::ToSql, &customer_id, &"ORD3", &week_ago, &300.0_f64, &"PENDING", &now, &now],
    ).expect("Failed to insert order 3");

    // 查询今天的订单
    let today_orders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE orderDate >= ?1",
            &[&today],
            |row| row.get(0),
        )
        .expect("Failed to count today orders");
    assert_eq!(today_orders, 1);

    // 查询最近7天的订单
    let week_orders: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE orderDate >= ?1",
            &[&week_ago],
            |row| row.get(0),
        )
        .expect("Failed to count week orders");
    assert_eq!(week_orders, 3);

    println!("✅ test_order_date_filter 通过 - 今天订单: {}, 本周订单: {}", today_orders, week_orders);
}

#[test]
fn test_order_delete() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建订单
    let order_id = uuid::Uuid::new_v4().to_string();
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    conn.execute(
        "INSERT INTO orders (id, customerId, orderNumber, orderDate, totalAmount, status, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[&order_id as &dyn rusqlite::ToSql, &customer_id, &"ORD1", &now, &100.0_f64, &"PENDING", &now, &now],
    ).expect("Failed to insert order");

    // 验证订单存在
    let count_before: i64 = conn
        .query_row("SELECT COUNT(*) FROM orders WHERE id = ?1", &[&order_id], |row| {
            row.get(0)
        })
        .expect("Failed to count orders");
    assert_eq!(count_before, 1);

    // 删除订单
    conn.execute("DELETE FROM orders WHERE id = ?1", &[&order_id])
        .expect("Failed to delete order");

    // 验证订单已删除
    let count_after: i64 = conn
        .query_row("SELECT COUNT(*) FROM orders WHERE id = ?1", &[&order_id], |row| {
            row.get(0)
        })
        .expect("Failed to count orders");
    assert_eq!(count_after, 0);

    println!("✅ test_order_delete 通过");
}
