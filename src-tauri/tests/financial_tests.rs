// 财务管理集成测试
#![allow(clippy::needless_borrows_for_generic_args)]

mod common;
use common::TestDatabase;

#[test]
fn test_financial_payment() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let initial_balance = 500.0;

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &initial_balance,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 客户充值 1000
    let payment_amount = 1000.0;
    let expected_balance_after = initial_balance + payment_amount; // 1500.0

    // 创建财务记录
    let record_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[
            &record_id as &dyn rusqlite::ToSql,
            &customer_id,
            &"PAYMENT",
            &payment_amount,
            &initial_balance,
            &expected_balance_after,
            &now,
        ],
    ).expect("Failed to insert financial record");

    // 更新客户余额
    let updated_now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE customers SET balance = ?1, updatedAt = ?2 WHERE id = ?3",
        &[&expected_balance_after as &dyn rusqlite::ToSql, &updated_now, &customer_id as &dyn rusqlite::ToSql],
    ).expect("Failed to update balance");

    // 验证余额更新
    let new_balance: f64 = conn
        .query_row("SELECT balance FROM customers WHERE id = ?1", &[&customer_id], |row| {
            row.get(0)
        })
        .expect("Failed to query balance");

    assert_eq!(new_balance, expected_balance_after);

    // 验证财务记录
    let (record_type, amount): (String, f64) = conn
        .query_row(
            "SELECT type, amount FROM financial_records WHERE id = ?1",
            &[&record_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("Failed to query financial record");

    assert_eq!(record_type, "PAYMENT");
    assert_eq!(amount, payment_amount);

    println!("✅ test_financial_payment 通过 - 充值前: {}, 充值: {}, 充值后: {}",
             initial_balance, payment_amount, new_balance);
}

#[test]
fn test_financial_refund() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let initial_balance = 2000.0;

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户002",
            &initial_balance,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 客户退款 500
    let refund_amount = 500.0;
    let expected_balance_after = initial_balance - refund_amount; // 1500.0

    // 创建财务记录
    let record_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[
            &record_id as &dyn rusqlite::ToSql,
            &customer_id,
            &"REFUND",
            &refund_amount,
            &initial_balance,
            &expected_balance_after,
            &now,
        ],
    ).expect("Failed to insert financial record");

    // 更新客户余额
    let updated_now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE customers SET balance = ?1, updatedAt = ?2 WHERE id = ?3",
        &[&expected_balance_after as &dyn rusqlite::ToSql, &updated_now, &customer_id as &dyn rusqlite::ToSql],
    ).expect("Failed to update balance");

    // 验证余额更新
    let new_balance: f64 = conn
        .query_row("SELECT balance FROM customers WHERE id = ?1", &[&customer_id], |row| {
            row.get(0)
        })
        .expect("Failed to query balance");

    assert_eq!(new_balance, expected_balance_after);

    println!("✅ test_financial_refund 通过 - 退款前: {}, 退款: {}, 退款后: {}",
             initial_balance, refund_amount, new_balance);
}

#[test]
fn test_financial_balance_adjustment() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let initial_balance = 1000.0;

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户003",
            &initial_balance,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 管理员调整余额（增加）
    let adjustment_amount = 200.0;
    let expected_balance_after = initial_balance + adjustment_amount; // 1200.0

    // 创建财务记录
    let record_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[
            &record_id as &dyn rusqlite::ToSql,
            &customer_id,
            &"ADJUSTMENT",
            &adjustment_amount,
            &initial_balance,
            &expected_balance_after,
            &now,
        ],
    ).expect("Failed to insert financial record");

    // 更新客户余额
    let updated_now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE customers SET balance = ?1, updatedAt = ?2 WHERE id = ?3",
        &[&expected_balance_after as &dyn rusqlite::ToSql, &updated_now, &customer_id as &dyn rusqlite::ToSql],
    ).expect("Failed to update balance");

    // 验证余额更新
    let new_balance: f64 = conn
        .query_row("SELECT balance FROM customers WHERE id = ?1", &[&customer_id], |row| {
            row.get(0)
        })
        .expect("Failed to query balance");

    assert_eq!(new_balance, expected_balance_after);

    println!("✅ test_financial_balance_adjustment 通过 - 调整前: {}, 调整: {}, 调整后: {}",
             initial_balance, adjustment_amount, new_balance);
}

#[test]
fn test_financial_records_pagination() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let customer_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer_id as &dyn rusqlite::ToSql,
            &"测试客户004",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 创建多条财务记录
    for i in 1..=15 {
        let record_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            &[
                &record_id as &dyn rusqlite::ToSql,
                &customer_id,
                &"PAYMENT",
                &(i as f64 * 100.0),
                &1000.0_f64,
                &(1000.0 + i as f64 * 100.0),
                &(now + i as i64),
            ],
        ).expect("Failed to insert financial record");
    }

    // 测试分页查询（每页10条）
    let page_size = 10;
    let mut stmt = conn
        .prepare("SELECT id, type, amount FROM financial_records ORDER BY createdAt DESC LIMIT ?1")
        .expect("Failed to prepare statement");

    let page1: Vec<(String, String, f64)> = stmt
        .query_map([&page_size], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .expect("Failed to query financial records")
        .filter_map(|c| c.ok())
        .collect();

    assert_eq!(page1.len(), 10);

    // 第二页
    let offset = 10;
    let mut stmt = conn
        .prepare("SELECT id, type, amount FROM financial_records ORDER BY createdAt DESC LIMIT ?1 OFFSET ?2")
        .expect("Failed to prepare statement");

    let page2: Vec<(String, String, f64)> = stmt
        .query_map([&page_size, &offset], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .expect("Failed to query financial records")
        .filter_map(|c| c.ok())
        .collect();

    assert_eq!(page2.len(), 5); // 剩余5条

    println!("✅ test_financial_records_pagination 通过 - 第1页: {} 条, 第2页: {} 条",
             page1.len(), page2.len());
}

#[test]
fn test_financial_customer_debts() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建多个客户，其中一些有欠款
    let now = chrono::Utc::now().timestamp();

    // 客户1：负余额（欠款）
    let customer1_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer1_id as &dyn rusqlite::ToSql,
            &"欠款客户001",
            &-500.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer 1");

    // 客户2：正余额
    let customer2_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer2_id as &dyn rusqlite::ToSql,
            &"正常客户002",
            &2000.0_f64,
            &3000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer 2");

    // 客户3：负余额（欠款）
    let customer3_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &customer3_id as &dyn rusqlite::ToSql,
            &"欠款客户003",
            &-1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer 3");

    // 查询所有欠款客户
    let mut stmt = conn
        .prepare("SELECT id, name, balance, creditLimit FROM customers WHERE balance < 0 ORDER BY balance ASC")
        .expect("Failed to prepare statement");

    let debt_customers: Vec<(String, String, f64, f64)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("Failed to query debt customers")
        .filter_map(|c| c.ok())
        .collect();

    assert_eq!(debt_customers.len(), 2);

    // 验证欠款金额
    assert_eq!(debt_customers[0].2, -1000.0); // 最多欠款
    assert_eq!(debt_customers[1].2, -500.0);

    println!("✅ test_financial_customer_debts 通过 - 欠款客户数: {}", debt_customers.len());
}

#[test]
fn test_financial_summary() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建测试数据
    let now = chrono::Utc::now().timestamp();

    // 创建多个客户
    let mut customer_ids = Vec::new();
    for i in 1..=5 {
        let customer_id = uuid::Uuid::new_v4().to_string();
        let balance = if i <= 2 { -(i as f64 * 500.0) } else { 1000.0 };

        conn.execute(
            "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            &[
                &customer_id as &dyn rusqlite::ToSql,
                &format!("客户{:03}", i),
                &balance,
                &5000.0_f64,
                &18.0_f64,
                &true,
                &now,
                &now,
            ],
        ).expect("Failed to insert customer");

        customer_ids.push(customer_id);
    }

    // 创建财务记录（使用已创建的客户ID）
    for i in 1..=10 {
        let customer_id = &customer_ids[i % customer_ids.len()]; // 循环使用已创建的客户
        let record_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            &[
                &record_id as &dyn rusqlite::ToSql,
                &customer_id,
                &if i % 2 == 0 { "PAYMENT" } else { "REFUND" },
                &(i as f64 * 100.0),
                &0.0_f64,
                &(i as f64 * 100.0),
                &(now + i as i64),
            ],
        ).expect("Failed to insert financial record");
    }

    // 统计欠款客户数
    let debt_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM customers WHERE balance < 0", [], |row| {
            row.get(0)
        })
        .expect("Failed to count debt customers");

    assert_eq!(debt_count, 2);

    // 统计总欠款金额
    let total_debt: f64 = conn
        .query_row(
            "SELECT SUM(ABS(balance)) FROM customers WHERE balance < 0",
            [],
            |row| {
                let value: Option<f64> = row.get(0)?;
                Ok(value.unwrap_or(0.0))
            },
        )
        .expect("Failed to sum debts");

    assert_eq!(total_debt, 1500.0); // 500 + 1000

    // 统计财务记录数
    let record_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM financial_records", [], |row| {
            row.get(0)
        })
        .expect("Failed to count records");

    assert_eq!(record_count, 10);

    println!("✅ test_financial_summary 通过 - 欠款客户: {}, 总欠款: {}, 财务记录: {}",
             debt_count, total_debt, record_count);
}
