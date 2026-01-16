// ============================================================
// Financial - 财务记录数据模型
// ============================================================

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialRecord {
    pub id: String,
    pub record_type: String, // PAYMENT, REFUND, ADJUSTMENT
    pub amount: f64,
    pub description: String,
    pub order_id: Option<String>,
    pub order_item_id: Option<String>,
    pub customer_id: String,
    pub customer_name: String,
    pub balance_before: f64,
    pub balance_after: f64,
    pub operator_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFinancialRecordRequest {
    pub record_type: String,
    pub amount: f64,
    pub description: String,
    pub customer_id: String,
    pub order_id: Option<String>,
    pub order_item_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerDebt {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub credit_limit: f64,
    pub available_credit: f64,
    pub debt_ratio: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanyFinancialOverview {
    pub total_balance: f64,
    pub positive_balance: f64,
    pub negative_balance: f64,
    pub customer_count: i32,
    pub positive_count: i32,
    pub negative_count: i32,
    pub zero_count: i32,
    pub avg_balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionStats {
    pub total_area: f64,
    pub total_revenue: f64,
    pub order_count: i32,
    pub total_quantity: i32, // 合计个数（订单项数量总和）
    pub avg_price: f64,
    pub daily_breakdown: Vec<DailyStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStats {
    pub date: String,
    pub area: f64,
    pub revenue: f64,
    pub order_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialRecordParams {
    pub customer_id: Option<String>,
    pub record_type: Option<String>,
    pub page: Option<i32>,
    pub page_size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerDebtParams {
    pub min_debt: Option<f64>,
    pub max_debt: Option<f64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedFinancialRecords {
    pub data: Vec<FinancialRecord>,
    pub total: i32,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}
