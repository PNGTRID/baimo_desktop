// 客户管理集成测试
#![allow(clippy::needless_borrows_for_generic_args)]

mod common;
use common::TestDatabase;

#[test]
fn test_customer_create() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 测试创建客户
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, notes, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        &[
            &id as &dyn rusqlite::ToSql,
            &"测试客户001",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &"测试备注",
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 验证客户已创建
    let customer: Result<String, _> = conn.query_row(
        "SELECT name FROM customers WHERE id = ?1",
        &[&id],
        |row| row.get(0),
    );

    assert!(customer.is_ok());
    assert_eq!(customer.unwrap(), "测试客户001");

    println!("✅ test_customer_create 通过");
}

#[test]
fn test_customer_query_all() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建多个测试客户
    let now = chrono::Utc::now().timestamp();

    for i in 1..=3 {
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = now + i; // 递增时间戳
        conn.execute(
            "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            &[
                &id as &dyn rusqlite::ToSql,
                &format!("测试客户{:03}", i),
                &(i as f64 * 1000.0),
                &5000.0_f64,
                &18.0_f64,
                &true,
                &timestamp,
                &timestamp,
            ],
        ).expect("Failed to insert customer");
    }

    // 查询所有客户
    let mut stmt = conn
        .prepare("SELECT id, name, balance FROM customers ORDER BY createdAt DESC")
        .expect("Failed to prepare statement");

    let customers: Vec<(String, String, f64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
            ))
        })
        .expect("Failed to query customers")
        .filter_map(|c| c.ok())
        .collect();

    assert_eq!(customers.len(), 3);
    assert_eq!(customers[0].1, "测试客户003"); // DESC 顺序，最后创建的在最前

    println!("✅ test_customer_query_all 通过 - 找到 {} 个客户", customers.len());
}

#[test]
fn test_customer_update() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &id as &dyn rusqlite::ToSql,
            &"原始客户名",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 更新客户
    let updated_now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE customers SET name = ?1, balance = ?2, updatedAt = ?3 WHERE id = ?4",
        &[&"更新后的客户名" as &dyn rusqlite::ToSql,
          &2000.0_f64,
          &updated_now,
          &id as &dyn rusqlite::ToSql],
    ).expect("Failed to update customer");

    // 验证更新
    let name: String = conn
        .query_row("SELECT name FROM customers WHERE id = ?1", &[&id], |row| {
            row.get(0)
        })
        .expect("Failed to query updated customer");

    assert_eq!(name, "更新后的客户名");

    println!("✅ test_customer_update 通过");
}

#[test]
fn test_customer_delete() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &id as &dyn rusqlite::ToSql,
            &"待删除客户",
            &1000.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 验证客户存在
    let count_before: i64 = conn
        .query_row("SELECT COUNT(*) FROM customers WHERE id = ?1", &[&id], |row| {
            row.get(0)
        })
        .expect("Failed to count customers");
    assert_eq!(count_before, 1);

    // 删除客户
    conn.execute("DELETE FROM customers WHERE id = ?1", &[&id])
        .expect("Failed to delete customer");

    // 验证客户已删除
    let count_after: i64 = conn
        .query_row("SELECT COUNT(*) FROM customers WHERE id = ?1", &[&id], |row| {
            row.get(0)
        })
        .expect("Failed to count customers");
    assert_eq!(count_after, 0);

    println!("✅ test_customer_delete 通过");
}

#[test]
fn test_customer_balance_calculation() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建客户
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &id as &dyn rusqlite::ToSql,
            &"余额测试客户",
            &500.0_f64,
            &5000.0_f64,
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 创建财务记录（充值）
    let record_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO financial_records (id, customerId, type, amount, balanceBefore, balanceAfter, createdAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[
            &record_id as &dyn rusqlite::ToSql,
            &id,
            &"PAYMENT",
            &1000.0_f64,
            &500.0_f64,
            &1500.0_f64,
            &now,
        ],
    ).expect("Failed to insert financial record");

    // 更新客户余额
    conn.execute(
        "UPDATE customers SET balance = ?1 WHERE id = ?2",
        &[&1500.0_f64 as &dyn rusqlite::ToSql, &id as &dyn rusqlite::ToSql],
    ).expect("Failed to update balance");

    // 验证余额更新
    let balance: f64 = conn
        .query_row("SELECT balance FROM customers WHERE id = ?1", &[&id], |row| {
            row.get(0)
        })
        .expect("Failed to query balance");

    assert_eq!(balance, 1500.0);

    println!("✅ test_customer_balance_calculation 通过 - 余额: {}", balance);
}

#[test]
fn test_customer_credit_limit_validation() {
    let db = TestDatabase::new();
    let conn = db.connection();

    // 创建负余额客户（欠款）
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO customers (id, name, balance, creditLimit, unitPrice, isActive, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        &[
            &id as &dyn rusqlite::ToSql,
            &"欠款客户",
            &-500.0_f64,  // 负余额
            &5000.0_f64,   // 信用额度
            &18.0_f64,
            &true,
            &now,
            &now,
        ],
    ).expect("Failed to insert customer");

    // 查询并验证
    let (balance, credit_limit): (f64, f64) = conn
        .query_row(
            "SELECT balance, creditLimit FROM customers WHERE id = ?1",
            &[&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("Failed to query customer");

    // 验证欠款情况
    assert_eq!(balance, -500.0);
    assert_eq!(credit_limit, 5000.0);

    // 可用额度 = 信用额度 + 余额（余额为负时）
    let available = credit_limit + balance;
    assert_eq!(available, 4500.0);

    println!("✅ test_customer_credit_limit_validation 通过 - 欠款: {}, 可用额度: {}", balance, available);
}
