// ============================================================
// 价格计算服务
// ============================================================
//
// 印花行业价格计算公式：
// 单价 = 客户单价 / (总高度 / 每行个数)
//
// 其中：
// - 客户单价：Customer.unitPrice（每平方单价）
// - 总高度：Pattern.actualHeight（图案实际高度，毫米）
// - 每行个数：Pattern.unitsPerRow
//

use serde::{Deserialize, Serialize};

/// 图案价格计算参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternPricingParams {
    /// 客户单价（每平方单价）
    pub customer_unit_price: f64,
    /// 图案实际高度（毫米）
    pub actual_height: f64,
    /// 每行个数
    pub units_per_row: i32,
    /// 数量
    pub quantity: i32,
    /// 面积（平方米，可选）
    pub area: Option<f64>,
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
    /// 总高度（毫米）
    pub total_height: f64,
    /// 每行个数
    pub units_per_row: i32,
    /// 分母（总高度 / 每行个数）
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
///     units_per_row: 2,
///     quantity: 100,
///     area: None,
/// });
/// ```
///
/// # 公式说明
/// - 单价 = 客户单价 / (总高度 / 每行个数)
/// - 总价 = 单价 × 数量
pub fn calculate_pattern_price(params: PatternPricingParams) -> Result<PricingResult, PricingError> {
    // 验证输入参数
    if params.customer_unit_price <= 0.0 {
        return Err(PricingError::InvalidCustomerUnitPrice);
    }
    if params.actual_height <= 0.0 {
        return Err(PricingError::InvalidActualHeight);
    }
    if params.units_per_row <= 0 {
        return Err(PricingError::InvalidUnitsPerRow);
    }
    if params.quantity <= 0 {
        return Err(PricingError::InvalidQuantity);
    }

    // 核心计算公式
    // 单价 = 客户单价 / (总高度 / 每行个数)
    let denominator = params.actual_height / params.units_per_row as f64;
    let unit_price = params.customer_unit_price / denominator;
    let total_price = unit_price * params.quantity as f64;

    // 构建计算详情
    let calculation = PricingCalculation {
        customer_unit_price: params.customer_unit_price,
        total_height: params.actual_height,
        units_per_row: params.units_per_row,
        denominator,
        quantity: params.quantity,
        area: params.area,
        formula: format!(
            "单价 = {} / ({} / {}) = {:.2}，总价 = {:.2} × {} = {:.2}",
            params.customer_unit_price,
            params.actual_height,
            params.units_per_row,
            unit_price,
            unit_price,
            params.quantity,
            total_price
        ),
    };

    Ok(PricingResult {
        unit_price,
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
pub fn calculate_order_item_price(
    customer_unit_price: f64,
    actual_height: f64,
    units_per_row: i32,
    quantity: i32,
) -> Result<(f64, f64), PricingError> {
    let result = calculate_pattern_price(PatternPricingParams {
        customer_unit_price,
        actual_height,
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
            units_per_row: 2,
            quantity: 100,
            area: None,
        }).unwrap();

        // 单价 = 100 / (500 / 2) = 100 / 250 = 0.4
        // 总价 = 0.4 * 100 = 40
        assert!((result.unit_price - 0.4).abs() < 0.01);
        assert!((result.total_price - 40.0).abs() < 0.01);
    }

    #[test]
    fn test_invalid_customer_unit_price() {
        let result = calculate_pattern_price(PatternPricingParams {
            customer_unit_price: 0.0,
            actual_height: 500.0,
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

        assert!((unit_price - 0.4).abs() < 0.01);
        assert!((total_price - 40.0).abs() < 0.01);
    }
}
