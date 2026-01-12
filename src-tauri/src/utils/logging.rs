use crate::models::CreateSystemLogRequest;
use crate::services::Database;
use tauri::State;

/**
 * 日志辅助模块
 * 提供统一的日志记录接口，减少代码重复
 */

/**
 * 记录订单操作日志
 *
 * # 参数
 * - operation: 操作类型（如 "创建"、"确认"、"删除"）
 * - order_id: 订单ID
 * - customer_id: 客户ID
 * - customer_name: 客户名称
 * - amount: 金额
 * - db: 数据库连接
 */
pub async fn log_order_operation(
    operation: &str,
    order_id: &str,
    customer_id: &str,
    customer_name: &str,
    amount: f64,
    db: State<'_, Database>,
) -> Result<(), String> {
    use crate::commands::settings::create_system_log;

    create_system_log(CreateSystemLogRequest {
        level: "INFO".to_string(),
        message: format!("订单{}: 客户={}, 金额=¥{}", operation, customer_name, amount),
        metadata: Some(serde_json::json!({
            "operation": operation,
            "order_id": order_id,
            "customer_id": customer_id,
            "amount": amount,
        }).to_string()),
    }, db).await.map(|_| ())
}

/**
 * 记录财务操作日志
 *
 * # 参数
 * - operation: 操作类型（如 "充值"、"退款"、"调整"）
 * - customer_id: 客户ID
 * - customer_name: 客户名称
 * - amount: 金额
 * - balance_before: 操作前余额
 * - balance_after: 操作后余额
 * - db: 数据库连接
 */
pub async fn log_financial_operation(
    operation: &str,
    customer_id: &str,
    customer_name: &str,
    amount: f64,
    balance_before: f64,
    balance_after: f64,
    db: State<'_, Database>,
) -> Result<(), String> {
    use crate::commands::settings::create_system_log;

    create_system_log(CreateSystemLogRequest {
        level: "INFO".to_string(),
        message: format!("财务{}: {} ¥{} (余额: ¥{} → ¥{})",
                        operation, customer_name, amount, balance_before, balance_after),
        metadata: Some(serde_json::json!({
            "operation": operation,
            "customer_id": customer_id,
            "amount": amount,
            "balance_before": balance_before,
            "balance_after": balance_after,
        }).to_string()),
    }, db).await.map(|_| ())
}

/**
 * 记录数据操作日志
 *
 * # 参数
 * - operation: 操作类型（如 "导出"、"导入"、"备份"）
 * - details: 操作详情
 * - db: 数据库连接
 */
pub async fn log_data_operation(
    operation: &str,
    details: &str,
    db: State<'_, Database>,
) -> Result<(), String> {
    use crate::commands::settings::create_system_log;

    create_system_log(CreateSystemLogRequest {
        level: if operation.contains("导入") { "WARNING" } else { "INFO" }.to_string(),
        message: format!("数据{}: {}", operation, details),
        metadata: Some(serde_json::json!({
            "operation": operation,
            "details": details,
        }).to_string()),
    }, db).await.map(|_| ())
}
