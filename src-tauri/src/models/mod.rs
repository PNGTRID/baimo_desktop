use serde::{Deserialize, Serialize};

/// TIFF 文件元数据
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TiffMetadata {
    pub file_path: String,
    pub file_name: String,
    pub width: u32,
    pub height: u32,
    pub height_cm: f64,
    pub dpi: Option<u32>,
    pub color_type: String,
    pub file_size: u64,
}

/// 客户模型
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub credit_limit: f64,
    pub unit_price: f64,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// 创建客户请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerRequest {
    pub name: String,
    pub balance: Option<f64>,
    pub credit_limit: Option<f64>,
    pub unit_price: Option<f64>,
    pub notes: Option<String>,
}

/// 更新客户请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomerRequest {
    pub id: String,
    pub name: Option<String>,
    pub balance: Option<f64>,
    pub credit_limit: Option<f64>,
    pub unit_price: Option<f64>,
    pub notes: Option<String>,
    pub is_active: Option<bool>,
}

/// 图案模型
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pattern {
    pub id: String,
    pub name: String,
    pub code: String,
    pub actual_height: f64,
    pub bleed_height: f64,
    pub units_per_row: i32,
    pub row_count: i32,
    pub local_file_path: Option<String>,
    pub customer_id: Option<String>,
    pub folder_id: Option<String>,  // 所属文件夹
    pub preview_image: Option<String>,  // 图案预览图(Base64 或文件路径)
    pub color_type: Option<String>,  // 颜色类型：SINGLE（单色）或 MULTI（多色）
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// 创建图案请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePatternRequest {
    pub name: String,
    pub code: Option<String>,
    pub actual_height: Option<f64>,
    pub bleed_height: Option<f64>,
    pub units_per_row: Option<i32>,
    pub row_count: Option<i32>,
    pub local_file_path: Option<String>,
    pub customer_id: Option<String>,
}

/// 从 TIFF 创建图案请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePatternFromTiffRequest {
    pub name: String,
    pub local_file_path: String,
    pub actual_height: f64,
    pub customer_id: Option<String>,
}

/// 订单模型
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id: String,
    pub order_number: String,
    pub customer_id: String,
    pub customer_name: String,
    pub total_amount: f64,
    pub is_confirmed: bool,         // 是否已确认并生产
    pub confirmed_at: Option<String>, // 确认并生产时间（ISO 8601）
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub items: Vec<OrderPatternItem>,
}

/// 订单图案项
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderPatternItem {
    pub id: String,
    pub pattern_id: String,
    pub pattern_name: String,
    pub quantity: i32,
    pub area: Option<f64>,
    pub pricing_mode: String,
    pub unit_price: f64,
    pub total_price: f64,
    pub color_variant_id: Option<String>,  // 颜色变体 ID
}

/// 创建订单请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderRequest {
    pub customer_id: String,
    pub items: Vec<CreateOrderItemRequest>,
    pub notes: Option<String>,
}

/// 创建订单项请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderItemRequest {
    pub pattern_id: String,
    pub quantity: i32,
    pub area: Option<f64>,
    pub pricing_mode: String,
    pub color_variant_id: Option<String>,  // 颜色变体 ID
}

/// 更新订单请求（仅备注）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderRequest {
    pub id: String,
    pub notes: Option<String>,
}

/// 完整更新订单请求（包含订单项）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOrderFullRequest {
    pub id: String,
    pub customer_id: String,
    pub items: Vec<CreateOrderItemRequest>,
    pub notes: Option<String>,
}

/// 仪表盘统计数据
#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    #[serde(rename = "customersCount")]
    pub customers_count: i32,
    #[serde(rename = "patternsCount")]
    pub patterns_count: i32,
    #[serde(rename = "ordersCount")]
    pub orders_count: i32,
    #[serde(rename = "monthlyRevenue")]
    pub monthly_revenue: f64,
}

// ============================================================
// 新增模块导出 - 数据模型
// ============================================================

pub mod pattern_folder;
pub mod pattern_color;
pub mod financial;
pub mod system_log;
pub mod color_preset;
pub mod app_config;

// 重新导出公共结构体，便于使用
pub use pattern_folder::{
    PatternFolder,
    CreateFolderRequest,
    UpdateFolderRequest,
    FolderTreeNode,
};

pub use pattern_color::{
    PatternColor,
    CreateColorRequest,
    UpdateColorRequest,
};

pub use financial::{
    FinancialRecord,
    CreateFinancialRecordRequest,
    CustomerDebt,
    CompanyFinancialOverview,
    ProductionStats,
    DailyStats,
    FinancialRecordParams,
    CustomerDebtParams,
    PaginatedFinancialRecords,
};

pub use system_log::{
    SystemLog,
    CreateSystemLogRequest,
    SystemLogParams,
    PaginatedSystemLogs,
};

pub use color_preset::{
    ColorPreset,
    UpdateColorPresetRequest,
};

pub use app_config::{
    AppConfig,
    UpdateConfigRequest,
};

// ============================================================
// 批量扫描相关模型
// ============================================================

/// 批量扫描请求
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFolderRequest {
    pub folder_path: String,
    pub customer_id: Option<String>,
    pub parent_folder_id: Option<String>,
}

/// 批量扫描结果
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanResult {
    pub total_found: i32,
    pub imported: i32,
    pub skipped: i32,
    pub failed: i32,
    pub errors: Vec<ScanError>,
}

/// 扫描错误记录
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanError {
    pub file_path: String,
    pub error: String,
}
