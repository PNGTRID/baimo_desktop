// ============================================================
// PatternFolder - 图案文件夹数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatternFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: i32,
    pub path: String,
    pub sort_order: i32,
    pub customer_id: Option<String>,
    pub is_system: bool,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderRequest {
    pub name: String,
    pub parent_id: Option<String>,
    pub customer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFolderRequest {
    pub name: Option<String>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderTreeNode {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: i32,
    pub path: String,
    pub children: Vec<FolderTreeNode>,
    pub pattern_count: i32,
}
