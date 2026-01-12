// ============================================================
// 价格计算服务
// ============================================================
//
// 印花行业价格计算公式（100% 复用自网页版 .baimo_web）：
// 图案单价 = 客户每平方单价 ÷ (1600 ÷ (实际高度 + 出血高度) × 每行个数)
//
// 其中：
// - 客户单价：Customer.unitPrice（每平方单价，元/平方米）
// - 实际高度：Pattern.actualHeight（图案实际高度，**厘米**，计算时转换为毫米）
// - 出血高度：Pattern.bleedHeight（出血高度，**厘米**，计算时转换为毫米）
// - 每行个数：Pattern.unitsPerRow
// - 1600：行业常数
//

use serde::{Deserialize, Serialize};

/// 图案价格计算参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternPricingParams {
    /// 客户单价（每平方单价，元/平方米）
    pub customer_unit_price: f64,
    /// 图案实际高度（厘米，计算时转换为毫米）
    pub actual_height: f64,
    /// 出血高度（厘米，默认 2cm = 20mm）
    #[serde(default = "default_bleed_height")]
    pub bleed_height: f64,
    /// 每行个数
    pub units_per_row: i32,
    /// 数量
    pub quantity: i32,
    /// 面积（平方米，可选）
    pub area: Option<f64>,
}

fn default_bleed_height() -> f64 {
    2.0  // 默认 2cm
}

/// 价格计算结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingResult {
    /// 单价
    pub unit_price: f64,
    /// 总价
    pub total_price: f64,
    /// 计算详情（用于调试和展示）
    pub calculation: PricingCalculation,
}

/// 计算详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingCalculation {
    /// 客户单价
    pub customer_unit_price: f64,
    /// 实际高度（毫米）
    pub actual_height: f64,
    /// 出血高度（毫米）
    pub bleed_height: f64,
    /// 总高度（毫米）
    pub total_height: f64,
    /// 每行个数
    pub units_per_row: i32,
    /// 分母 (1600 / 总高度 × 每行个数)
    pub denominator: f64,
    /// 计算数量
    pub quantity: i32,
    /// 计算面积
    pub area: Option<f64>,
    /// 公式描述
    pub formula: String,
}

/// 错误类型
#[derive(Debug, Serialize, Deserialize)]
#[allow(clippy::enum_variant_names)]
pub enum PricingError {
    /// 客户单价无效
    InvalidCustomerUnitPrice,
    /// 实际高度无效
    InvalidActualHeight,
    /// 每行个数无效
    InvalidUnitsPerRow,
    /// 数量无效
    InvalidQuantity,
}

impl std::fmt::Display for PricingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PricingError::InvalidCustomerUnitPrice => write!(f, "客户单价必须大于 0"),
            PricingError::InvalidActualHeight => write!(f, "实际高度必须大于 0"),
            PricingError::InvalidUnitsPerRow => write!(f, "每行个数必须大于 0"),
            PricingError::InvalidQuantity => write!(f, "数量必须大于 0"),
        }
    }
}

/// 计算图案单价和总价
///
/// # 参数
/// * `params` - 价格计算参数
///
/// # 返回
/// * `Result<PricingResult, PricingError>` - 计算结果或错误
///
/// # 示例
/// ```rust
/// let result = calculate_pattern_price(PatternPricingParams {
///     customer_unit_price: 100.0,
///     actual_height: 500.0,
///     bleed_height: 20.0,
///     units_per_row: 2,
///     quantity: 100,
///     area: None,
/// });
/// ```
///
/// # 公式说明
/// - 单价 = 客户单价 ÷ (1600 ÷ (实际高度 + 出血高度) × 每行个数)
/// - 总价 = 单价 × 数量
pub fn calculate_pattern_price(params: PatternPricingParams) -> Result<PricingResult, PricingError> {
    // 验证输入参数
    if params.customer_unit_price <= 0.0 {
        return Err(PricingError::InvalidCustomerUnitPrice);
    }
    if params.actual_height <= 0.0 {
        return Err(PricingError::InvalidActualHeight);
    }
    if params.bleed_height < 0.0 {
        return Err(PricingError::InvalidActualHeight);
    }
    if params.units_per_row <= 0 {
        return Err(PricingError::InvalidUnitsPerRow);
    }
    if params.quantity <= 0 {
        return Err(PricingError::InvalidQuantity);
    }

    // 核心计算公式（100% 复用自网页版）
    // 注意：数据库中存储的是厘米，需要转换为毫米
    let actual_height_mm = params.actual_height * 10.0;
    let bleed_height_mm = params.bleed_height * 10.0;

    // 总高度（毫米）= 实际高度 + 出血高度
    let total_height_mm = actual_height_mm + bleed_height_mm;

    // 分母 = 1600 / 总高度 × 每行个数
    let denominator = (1600.0 / total_height_mm) * params.units_per_row as f64;

    // 单价 = 客户单价 / 分母
    let unit_price = params.customer_unit_price / denominator;

    // 保留两位小数
    let rounded_unit_price = (unit_price * 100.0).round() / 100.0;
    let rounded_denominator = (denominator * 100.0).round() / 100.0;

    // 总价 = 单价 × 数量
    let total_price = rounded_unit_price * params.quantity as f64;

    // 构建计算详情
    let calculation = PricingCalculation {
        customer_unit_price: params.customer_unit_price,
        actual_height: params.actual_height,
        bleed_height: params.bleed_height,
        total_height: total_height_mm,
        units_per_row: params.units_per_row,
        denominator: rounded_denominator,
        quantity: params.quantity,
        area: params.area,
        formula: format!(
            "单价 = {} ÷ (1600 ÷ {} × {}) = {}，总价 = {} × {} = {}",
            params.customer_unit_price,
            total_height_mm,
            params.units_per_row,
            rounded_unit_price,
            rounded_unit_price,
            params.quantity,
            total_price
        ),
    };

    Ok(PricingResult {
        unit_price: rounded_unit_price,
        total_price,
        calculation,
    })
}

/// 计算订单项总价（快捷方法）
///
/// # 参数
/// * `customer_unit_price` - 客户单价
/// * `actual_height` - 图案实际高度
/// * `units_per_row` - 每行个数
/// * `quantity` - 数量
///
/// # 返回
/// * `Result<(f64, f64), PricingError>` - (单价, 总价) 或错误
#[allow(dead_code)]
pub fn calculate_order_item_price(
    customer_unit_price: f64,
    actual_height: f64,
    units_per_row: i32,
    quantity: i32,
) -> Result<(f64, f64), PricingError> {
    let result = calculate_pattern_price(PatternPricingParams {
        customer_unit_price,
        actual_height,
        bleed_height: 2.0,  // 默认出血高度 2cm
        units_per_row,
        quantity,
        area: None,
    })?;

    Ok((result.unit_price, result.total_price))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_pattern_price() {
        let result = calculate_pattern_price(PatternPricingParams {
            customer_unit_price: 100.0,
            actual_height: 500.0,
            bleed_height: 20.0,
            units_per_row: 2,
            quantity: 100,
            area: None,
        }).unwrap();

        // 新公式（输入为厘米，内部转换为毫米）：
        // 总高度(mm) = (500 + 20) * 10 = 5200
        // 分母 = (1600 / 5200) * 2 ≈ 0.615
        // 单价 = 100 / 0.615 ≈ 162.5
        // 总价 = 162.5 * 100 = 16250
        assert!((result.unit_price - 162.5).abs() < 1.0);
        assert!((result.total_price - 16250.0).abs() < 100.0);
    }

    #[test]
    fn test_invalid_customer_unit_price() {
        let result = calculate_pattern_price(PatternPricingParams {
            customer_unit_price: 0.0,
            actual_height: 500.0,
            bleed_height: 20.0,
            units_per_row: 2,
            quantity: 100,
            area: None,
        });

        assert!(matches!(result, Err(PricingError::InvalidCustomerUnitPrice)));
    }

    #[test]
    fn test_calculate_order_item_price() {
        let (unit_price, total_price) = calculate_order_item_price(
            100.0,
            500.0,
            2,
            100,
        ).unwrap();

        // 新公式计算结果（厘米转毫米）
        assert!((unit_price - 162.5).abs() < 1.0);
        assert!((total_price - 16250.0).abs() < 100.0);
    }
}
