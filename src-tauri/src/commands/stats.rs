// ============================================================
// Stats - Dashboard 统计命令
// ============================================================

use crate::models::{DashboardStats, CompanyFinancialOverview, ProductionStats, DailyStats};
use crate::services::Database;
use tauri::State;
use chrono::Datelike;

/// 获取仪表盘统计数据
#[tauri::command]
pub async fn get_dashboard_stats(db: State<'_, Database>) -> Result<DashboardStats, String> {
    // 1. 获取客户总数
    let customers_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM customers WHERE is_active = 1",
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to fetch customers count: {:?}", e))?
    .unwrap_or(0);

    // 2. 获取图案总数
    let patterns_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM patterns WHERE is_active = 1",
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to fetch patterns count: {:?}", e))?
    .unwrap_or(0);

    // 3. 获取订单总数
    let orders_count: i32 = db.sqlite().query_row(
        "SELECT COUNT(*) FROM orders",
        &[],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to fetch orders count: {:?}", e))?
    .unwrap_or(0);

    // 4. 计算本月收入
    let now = chrono::Utc::now();
    let month_start = now.with_day(1).unwrap()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();

    let monthly_revenue: f64 = db.sqlite().query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE date(created_at, 'unixepoch') >= date(?1, 'unixepoch')",
        &[&month_start as &dyn rusqlite::ToSql],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to fetch monthly revenue: {:?}", e))?
    .unwrap_or(0.0);

    Ok(DashboardStats {
        customers_count,
        patterns_count,
        orders_count,
        monthly_revenue,
    })
}

/// 获取公司财务概览
#[tauri::command]
pub async fn get_company_financial_overview(db: State<'_, Database>) -> Result<CompanyFinancialOverview, String> {
    // 获取所有客户的余额统计
    let overview = db.sqlite().query_row(
        "SELECT
            COALESCE(SUM(balance), 0) as total_balance,
            COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as positive_balance,
            COALESCE(SUM(CASE WHEN balance < 0 THEN balance ELSE 0 END), 0) as negative_balance,
            COUNT(*) as customer_count,
            COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) as positive_count,
            COALESCE(SUM(CASE WHEN balance < 0 THEN 1 ELSE 0 END), 0) as negative_count,
            COALESCE(SUM(CASE WHEN balance = 0 THEN 1 ELSE 0 END), 0) as zero_count
         FROM customers WHERE is_active = 1",
        &[],
        |row| {
            Ok(CompanyFinancialOverview {
                total_balance: row.get(0)?,
                positive_balance: row.get(1)?,
                negative_balance: row.get(2)?,
                customer_count: row.get(3)?,
                positive_count: row.get(4)?,
                negative_count: row.get(5)?,
                zero_count: row.get(6)?,
                avg_balance: 0.0, // 稍后计算
            })
        },
    ).map_err(|e| format!("Failed to fetch financial overview: {:?}", e))?
    .ok_or_else(|| "No financial overview data found".to_string())?;

    // 计算平均余额
    let avg_balance = if overview.customer_count > 0 {
        overview.total_balance / overview.customer_count as f64
    } else {
        0.0
    };

    Ok(CompanyFinancialOverview {
        avg_balance,
        ..overview
    })
}

/// 获取生产统计数据
#[tauri::command]
pub async fn get_production_stats(
    period: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    db: State<'_, Database>,
) -> Result<ProductionStats, String> {
    // 默认查询本月
    let now = chrono::Utc::now();
    let (start_ts, end_ts) = match period.as_deref() {
        Some("week") => {
            let start = now - chrono::Duration::days(7);
            (start.timestamp(), now.timestamp())
        },
        Some("month") => {
            let start = now.with_day(1).unwrap()
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp();
            (start, now.timestamp())
        },
        Some("custom") => {
            // 解析自定义日期
            let start = start_date.and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok())
                .ok_or_else(|| "Invalid start_date format".to_string())?;
            let end = end_date.and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok())
                .ok_or_else(|| "Invalid end_date format".to_string())?;
            (start.timestamp(), end.timestamp())
        },
        _ => {
            let start = now.with_day(1).unwrap()
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc()
                .timestamp();
            (start, now.timestamp())
        }
    };

    // 获取统计数据
    // 当 area 为 0 或 NULL 时，使用印花行业公式计算：平方数 = 数量 / (160 / (actualHeight + bleedHeight) * unitsPerRow)
    // 其中 160cm 是 1平方米的边长基准
    let stats = db.sqlite().query_row(
        "SELECT
            COALESCE(SUM(
                CASE
                    WHEN opi.area > 0 THEN opi.area
                    ELSE (opi.quantity * 1.0 / (160.0 / (p.actual_height + p.bleed_height) * p.units_per_row))
                END
            ), 0) as total_area,
            COALESCE(SUM(opi.total_price), 0) as total_revenue,
            COUNT(DISTINCT opi.order_id) as order_count
         FROM order_pattern_items opi
         JOIN orders o ON opi.order_id = o.id
         JOIN patterns p ON opi.pattern_id = p.id
         WHERE date(o.created_at, 'unixepoch') >= date(?1, 'unixepoch') AND date(o.created_at, 'unixepoch') <= date(?2, 'unixepoch')",
        &[&start_ts as &dyn rusqlite::ToSql, &end_ts],
        |row| {
            Ok(ProductionStats {
                total_area: row.get(0)?,
                total_revenue: row.get(1)?,
                order_count: row.get(2)?,
                avg_price: 0.0,
                daily_breakdown: vec![],
            })
        },
    ).map_err(|e| format!("Failed to fetch production stats: {:?}", e))?
    .ok_or_else(|| "No production stats data found".to_string())?;

    // 计算平均价格
    let avg_price = if stats.order_count > 0 {
        stats.total_revenue / stats.order_count as f64
    } else {
        0.0
    };

    // 获取每日统计数据
    let daily_breakdown = db.sqlite().query_map(
        "SELECT
            date(o.created_at, 'unixepoch') as date,
            COALESCE(SUM(
                CASE
                    WHEN opi.area > 0 THEN opi.area
                    ELSE (opi.quantity * 1.0 / (160.0 / (p.actual_height + p.bleed_height) * p.units_per_row))
                END
            ), 0) as area,
            COALESCE(SUM(opi.total_price), 0) as revenue,
            COUNT(DISTINCT o.id) as order_count
         FROM order_pattern_items opi
         JOIN orders o ON opi.order_id = o.id
         JOIN patterns p ON opi.pattern_id = p.id
         WHERE date(o.created_at, 'unixepoch') >= date(?1, 'unixepoch') AND date(o.created_at, 'unixepoch') <= date(?2, 'unixepoch')
         GROUP BY date(o.created_at, 'unixepoch')
         ORDER BY date ASC",
        &[&start_ts as &dyn rusqlite::ToSql, &end_ts],
        |row| {
            Ok(DailyStats {
                date: row.get(0)?,
                area: row.get(1)?,
                revenue: row.get(2)?,
                order_count: row.get(3)?,
            })
        },
    ).map_err(|e| format!("Failed to fetch daily breakdown: {:?}", e))?;

    Ok(ProductionStats {
        avg_price,
        daily_breakdown,
        ..stats
    })
}
