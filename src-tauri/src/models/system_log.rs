// ============================================================
// SystemLog - 系统日志数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemLog {
    pub id: String,
    pub level: String, // INFO, WARNING, ERROR
    pub message: String,
    pub metadata: Option<String>,
    pub operator_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSystemLogRequest {
    pub level: String,
    pub message: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemLogParams {
    pub level: Option<String>,
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedSystemLogs {
    pub data: Vec<SystemLog>,
    pub total: i32,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}
