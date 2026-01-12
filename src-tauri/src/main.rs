// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;

use commands::{
    customer,
    file_dialog,
    stats,
    order,
    pattern,
    pattern_folder,
    pattern_color,
    financial,
    settings,
    seed_data,
    tiff,
};
use services::Database;
use tauri::Manager;
use std::path::PathBuf;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 初始化数据库服务
            // 注意：Tauri 工作目录是 src-tauri，所以需要使用 ../prisma/dev.db
            let db_path = PathBuf::from("../prisma/dev.db");
            let db = Database::new(db_path).expect("Failed to initialize database");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ============================================================
            // 文件对话框命令（替代 dialog 插件）
            // ============================================================
            file_dialog::open_file_dialog,
            file_dialog::open_folder_dialog,

            // ============================================================
            // 客户相关命令
            // ============================================================
            customer::get_customers,
            customer::get_customer_by_id,
            customer::create_customer,
            customer::update_customer,
            customer::delete_customer,

            // ============================================================
            // 订单相关命令
            // ============================================================
            order::get_orders,
            order::get_order_by_id,
            order::create_order,
            order::update_order,
            order::update_order_full,
            order::confirm_order,
            order::delete_order,
            order::batch_delete_orders,

            // ============================================================
            // 图案相关命令
            // ============================================================
            pattern::get_patterns,
            pattern::get_pattern_by_id,
            pattern::create_pattern,
            pattern::create_pattern_from_tiff,
            pattern::update_pattern,
            pattern::delete_pattern,
            pattern::get_pattern_image,
            pattern::scan_folder_for_patterns,

            // ============================================================
            // TIFF 文件处理命令
            // ============================================================
            tiff::parse_tiff_file,

            // ============================================================
            // Dashboard 统计命令
            // ============================================================
            stats::get_dashboard_stats,
            stats::get_company_financial_overview,
            stats::get_production_stats,

            // ============================================================
            // 图案文件夹管理命令
            // ============================================================
            pattern_folder::get_folders,
            pattern_folder::get_folder_tree,
            pattern_folder::get_folder_by_id,
            pattern_folder::create_folder,
            pattern_folder::update_folder,
            pattern_folder::delete_folder,
            pattern_folder::move_folder,

            // ============================================================
            // 图案颜色变体管理命令
            // ============================================================
            pattern_color::get_pattern_colors,
            pattern_color::get_color_by_id,
            pattern_color::get_default_color,
            pattern_color::create_color,
            pattern_color::create_colors_batch,
            pattern_color::update_color,
            pattern_color::delete_color,
            pattern_color::set_default_color,
            pattern_color::duplicate_color,

            // ============================================================
            // 财务管理命令
            // ============================================================
            financial::get_financial_records,
            financial::get_financial_record_by_id,
            financial::create_financial_record,
            financial::get_customer_debts,
            financial::get_customer_financial_history,
            financial::customer_payment,
            financial::customer_refund,
            financial::adjust_customer_balance,
            financial::get_financial_summary,

            // ============================================================
            // 系统设置命令 - 应用配置
            // ============================================================
            settings::get_all_configs,
            settings::get_config,
            settings::upsert_config,
            settings::batch_update_configs,
            settings::delete_config,

            // ============================================================
            // 系统设置命令 - 颜色预设
            // ============================================================
            settings::get_color_presets,
            settings::get_color_preset_by_id,
            settings::create_color_preset,
            settings::update_color_preset,
            settings::delete_color_preset,

            // ============================================================
            // 种子数据初始化命令
            // ============================================================
            seed_data::seed_color_presets,

            // ============================================================
            // 系统设置命令 - 系统日志
            // ============================================================
            settings::get_system_logs,
            settings::get_system_log_by_id,
            settings::create_system_log,
            settings::cleanup_old_logs,
            settings::get_log_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
