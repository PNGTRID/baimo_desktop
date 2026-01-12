// ============================================================
// 数据库服务 - SQLite 直接访问 (rusqlite)
// ============================================================

use rusqlite::{Connection, Result as SqliteResult, Row};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// SQLite 数据库服务
#[derive(Clone)]
pub struct SqliteDatabase {
    connection: Arc<Mutex<Connection>>,
}

impl SqliteDatabase {
    /// 创建新的数据库连接
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;

        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON;", [])?;

        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
        })
    }

    /// 获取连接引用
    pub fn connection(&self) -> &Arc<Mutex<Connection>> {
        &self.connection
    }

    /// 执行查询并返回多行
    pub fn query_map<T, F>(
        &self,
        sql: &str,
        params: &[&dyn rusqlite::ToSql],
        f: F,
    ) -> SqliteResult<Vec<T>>
    where
        F: FnMut(&Row) -> SqliteResult<T>,
    {
        let conn = self.connection.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;
        let rows: SqliteResult<Vec<T>> = stmt.query_map(params, f)?.collect();
        drop(stmt);
        drop(conn);
        rows
    }

    /// 执行查询并返回单行
    pub fn query_row<T, F>(
        &self,
        sql: &str,
        params: &[&dyn rusqlite::ToSql],
        f: F,
    ) -> SqliteResult<Option<T>>
    where
        F: FnOnce(&Row) -> SqliteResult<T>,
    {
        let conn = self.connection.lock().unwrap();
        let result = conn.query_row(sql, params, f);
        drop(conn);

        match result {
            Ok(row) => Ok(Some(row)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// 执行 SQL 语句（INSERT, UPDATE, DELETE）
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::ToSql]) -> SqliteResult<usize> {
        let conn = self.connection.lock().unwrap();
        let result = conn.execute(sql, params)?;
        drop(conn);
        Ok(result)
    }

    /// 开始事务
    pub fn transaction<F, R>(&self, f: F) -> SqliteResult<R>
    where
        F: FnOnce(&rusqlite::Transaction) -> SqliteResult<R>,
    {
        let conn = self.connection.lock().unwrap();
        let tx = conn.unchecked_transaction()?;
        let result = f(&tx);
        // 显式提交事务，这样在 tx 被 drop 时不会借用 conn
        tx.commit()?;
        drop(conn);
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_connection() {
        let db = SqliteDatabase::new("/tmp/test.db".into()).unwrap();
        let version: String = db
            .query_row("SELECT sqlite_version()", &[], |row| row.get(0))
            .unwrap()
            .unwrap();
        println!("SQLite version: {}", version);
    }
}
