// ============================================================
// AppConfig - 应用配置数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub id: String,
    pub key: String,
    pub value: String,
    pub description: Option<String>,
    pub category: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfigRequest {
    pub key: String,
    pub value: String,
}
