// 测试辅助模块
use rusqlite::Connection;
use std::path::PathBuf;

/// 测试数据库管理器
#[allow(dead_code)]
pub struct TestDatabase {
    path: PathBuf,
    pub conn: Option<Connection>,
}

impl TestDatabase {
    /// 创建新的测试数据库（使用内存数据库）
    pub fn new() -> Self {
        // 使用内存数据库，避免文件系统权限问题
        let conn = Connection::open_in_memory().unwrap();

        // 创建表结构
        Self::create_schema(&conn).unwrap();

        TestDatabase {
            path: PathBuf::from(":memory:"),
            conn: Some(conn),
        }
    }

    /// 创建数据库表结构
    fn create_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
        // 客户表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                balance REAL DEFAULT 0,
                creditLimit REAL DEFAULT 0,
                unitPrice REAL DEFAULT 0,
                notes TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt INTEGER,
                updatedAt INTEGER
            )",
            [],
        )?;

        // 图案表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS patterns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT,
                actualHeight REAL,
                bleedHeight REAL,
                unitsPerRow INTEGER,
                rowCount INTEGER,
                localFilePath TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt INTEGER,
                updatedAt INTEGER
            )",
            [],
        )?;

        // 订单表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customerId TEXT,
                orderNumber TEXT UNIQUE,
                orderDate INTEGER,
                totalAmount REAL DEFAULT 0,
                status TEXT DEFAULT 'PENDING',
                notes TEXT,
                createdAt INTEGER,
                updatedAt INTEGER,
                FOREIGN KEY (customerId) REFERENCES customers(id)
            )",
            [],
        )?;

        // 订单图案项表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS order_pattern_items (
                id TEXT PRIMARY KEY,
                orderId TEXT,
                patternId TEXT,
                quantity INTEGER,
                area REAL,
                pricingMode TEXT DEFAULT 'QUANTITY',
                unitPrice REAL,
                totalPrice REAL,
                createdAt INTEGER,
                updatedAt INTEGER,
                FOREIGN KEY (orderId) REFERENCES orders(id),
                FOREIGN KEY (patternId) REFERENCES patterns(id)
            )",
            [],
        )?;

        // 财务记录表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS financial_records (
                id TEXT PRIMARY KEY,
                customerId TEXT,
                type TEXT,
                amount REAL,
                balanceBefore REAL,
                balanceAfter REAL,
                notes TEXT,
                createdAt INTEGER,
                FOREIGN KEY (customerId) REFERENCES customers(id)
            )",
            [],
        )?;

        Ok(())
    }

    /// 获取连接
    pub fn connection(&self) -> &Connection {
        self.conn.as_ref().unwrap()
    }

    /// 清理测试数据库
    #[allow(dead_code)]
    pub fn cleanup(mut self) {
        self.conn = None;
        if self.path.exists() {
            std::fs::remove_file(&self.path).unwrap_or(());
        }
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        self.conn = None;
        // 内存数据库不需要删除文件
    }
}

/// 测试结果收集器
#[allow(dead_code)]
pub struct TestResults {
    pub passed: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

#[allow(dead_code)]
impl TestResults {
    pub fn new() -> Self {
        TestResults {
            passed: 0,
            failed: 0,
            errors: Vec::new(),
        }
    }

    pub fn record_pass(&mut self) {
        self.passed += 1;
    }

    pub fn record_fail(&mut self, error: String) {
        self.failed += 1;
        self.errors.push(error);
    }

    pub fn summary(&self) -> String {
        let total = self.passed + self.failed;
        let pass_rate = if total > 0 {
            (self.passed as f64 / total as f64 * 100.0) as usize
        } else {
            0
        };

        format!(
            "\n## 测试结果统计\n\
             - 总用例: {}\n\
             - 通过: {}\n\
             - 失败: {}\n\
             - 通过率: {}%\n",
            total, self.passed, self.failed, pass_rate
        )
    }
}
