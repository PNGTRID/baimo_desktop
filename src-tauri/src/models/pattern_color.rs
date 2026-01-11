// ============================================================
// PatternColor - 图案颜色变体数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternColor {
    pub id: String,
    pub pattern_id: String,
    pub name: String,
    pub color: String,
    pub image: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateColorRequest {
    pub pattern_id: String,
    pub name: String,
    pub color: String,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateColorRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub image: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}
