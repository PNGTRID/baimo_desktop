// ============================================================
// 数据库服务 - 统一数据库访问层
// ============================================================

use crate::services::SqliteDatabase;
use std::path::PathBuf;
use std::sync::Arc;

/// 数据库服务 - 单例模式
#[derive(Clone)]
pub struct Database {
    sqlite: Arc<SqliteDatabase>,
}

impl Database {
    /// 创建新的数据库服务实例
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let sqlite = SqliteDatabase::new(db_path).map_err(|e| {
            format!("Failed to create database: {:?}", e)
        })?;

        Ok(Self {
            sqlite: Arc::new(sqlite),
        })
    }

    /// 获取 SQLite 数据库引用
    pub fn sqlite(&self) -> &SqliteDatabase {
        &self.sqlite
    }
}
