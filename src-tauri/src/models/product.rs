use serde::{Deserialize, Serialize};

/// 产品模型
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub name: String,
    pub price: f64,
    pub unit: String, // 单位，如：个、件、箱
    pub created_at: String,
    pub updated_at: String,
}

/// 创建产品请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductRequest {
    pub name: String,
    pub price: f64,
    pub unit: String,
}

/// 更新产品请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductRequest {
    pub id: String,
    pub name: Option<String>,
    pub price: Option<f64>,
    pub unit: Option<String>,
}
