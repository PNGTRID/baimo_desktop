// ============================================================
// ColorPreset - 颜色预设数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorPreset {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub color: String,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateColorPresetRequest {
    pub name: String,
    pub display_name: Option<String>,
    pub color: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateColorPresetRequest {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}
