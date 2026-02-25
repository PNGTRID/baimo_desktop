// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

use commands::{
    customer,
    product,
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
    clipboard,
    backup,
    website,
};
use services::Database;
use tauri::Manager;
use std::path::PathBuf;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 初始化数据库服务
            // 获取应用数据目录
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            // 确保数据目录存在
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            let db_path = app_data_dir.join("baimo.db");

            // 如果数据库不存在，尝试从开发环境复制
            if !db_path.exists() {
                // 尝试多个可能的路径查找开发数据库
                let possible_paths = vec![
                    PathBuf::from("../prisma/dev.db"),
                    PathBuf::from("../../prisma/dev.db"),
                    PathBuf::from("prisma/dev.db"),
                    // 绝对路径（开发环境）
                    PathBuf::from("c:/Users/Administrator/Desktop/AI_DEV/baimo_desktop/prisma/dev.db"),
                ];

                let mut copied = false;
                for dev_db_path in possible_paths {
                    if dev_db_path.exists() {
                        match std::fs::copy(&dev_db_path, &db_path) {
                            Ok(_) => {
                                println!("[启动] 已从开发环境复制数据库: {}", dev_db_path.display());
                                copied = true;
                                break;
                            }
                            Err(e) => {
                                eprintln!("[启动] 复制数据库失败: {}", e);
                            }
                        }
                    }
                }

                if !copied {
                    println!("[启动] 警告: 未找到开发数据库，新数据库将被创建（可能缺少表结构）");
                    println!("[启动] 如果出现 'no such table' 错误，请运行数据库迁移");
                }
            }

            let db = Database::new(db_path).expect("Failed to initialize database");
            app.manage(db.clone());

            // 打印数据库路径用于调试
            println!("[启动] 数据库路径: {}", db.path().display());

            // 检查数据库是否已初始化（检查关键表是否存在）
            let table_exists: Result<Option<bool>, _> = db.sqlite().query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='customers'",
                &[],
                |row| row.get(0)
            );

            let is_initialized = table_exists.is_ok() && table_exists.unwrap().unwrap_or(false);
            if !is_initialized {
                println!("[启动] 数据库未初始化，正在执行初始化脚本...");

                // 执行内嵌的初始化SQL（如果文件存在）
                let init_sql_opt = include_str!("../../prisma/init_schema.sql");
                let init_sql: &str = &init_sql_opt;

                // 分割SQL语句并逐条执行
                for sql in init_sql.split(";") {
                    let sql: &str = sql.trim();
                    if !sql.is_empty() {
                        match db.sqlite().execute(sql, &[]) {
                            Ok(_) => {},
                            Err(e) => {
                                eprintln!("[启动] SQL执行警告: {} (SQL: {})", e, &sql[..sql.len().min(50)]);
                            }
                        }
                    }
                }

                println!("[启动] 数据库初始化完成!");
            }

            // 初始化默认配置（如果不存在）
            println!("[启动] 正在初始化默认配置...");
            match settings::initialize_default_configs_sync(&db) {
                Ok(configs) => {
                    if !configs.is_empty() {
                        println!("[启动] 已初始化 {} 个默认配置", configs.len());
                    } else {
                        println!("[启动] 配置已存在，跳过初始化");
                    }
                }
                Err(e) => {
                    // 如果表不存在，这是首次运行
                    if e.contains("no such table") {
                        println!("[启动] 首次运行，数据库已准备就绪");
                    } else {
                        eprintln!("[启动] 初始化配置失败: {}", e);
                    }
                }
            }
            println!("[启动] 默认配置初始化完成");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ============================================================
            // 文件对话框命令（替代 dialog 插件）
            // ============================================================
            file_dialog::open_file_dialog,
            file_dialog::open_folder_dialog,
            file_dialog::save_file_dialog,
            file_dialog::save_text_file,
            file_dialog::read_text_file,

            // ============================================================
            // 剪贴板命令
            // ============================================================
            clipboard::write_image_to_clipboard,
            clipboard::write_text_to_clipboard,

            // ============================================================
            // 客户相关命令
            // ============================================================
            customer::get_customers,
            customer::get_customer_by_id,
            customer::create_customer,
            customer::update_customer,
            customer::delete_customer,

            // ============================================================
            // 产品相关命令
            // ============================================================
            product::get_products,
            product::get_product_by_id,
            product::create_product,
            product::update_product,
            product::delete_product,
            product::get_order_product_items,
            product::add_products_to_order,
            product::update_order_product_item,
            product::delete_order_product_item,

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
            pattern::save_pattern_image_cache,
            pattern::load_pattern_image_cache,
            pattern::clear_pattern_image_cache,

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
            stats::get_customer_order_stats,

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
            financial::migrate_order_financial_records,

            // ============================================================
            // 系统设置命令 - 应用配置
            // ============================================================
            settings::get_all_configs,
            settings::get_config,
            settings::upsert_config,
            settings::batch_update_configs,
            settings::delete_config,
            settings::initialize_default_configs,

            // ============================================================
            // 系统设置命令 - 颜色预设
            // ============================================================
            settings::get_color_presets,
            settings::get_color_preset_by_id,
            settings::create_color_preset,
            settings::update_color_preset,
            settings::delete_color_preset,

            // ============================================================
            // 系统设置命令 - 收款码管理
            // ============================================================
            settings::upload_payment_qrcode,
            settings::get_payment_qrcode,
            settings::get_payment_qrcode_image,

            // ============================================================
            // 种子数据初始化命令
            // ============================================================
            seed_data::seed_company_configs,
            seed_data::seed_color_presets,

            // ============================================================
            // 系统设置命令 - 系统日志
            // ============================================================
            settings::get_system_logs,
            settings::get_system_log_by_id,
            settings::create_system_log,
            settings::cleanup_old_logs,
            settings::get_log_stats,

            // ============================================================
            // 数据管理命令
            // ============================================================
            backup::export_data,
            backup::import_data,
            backup::get_database_path,
            backup::backup_database,
            backup::clear_all_data,

            // ============================================================
            // 网站操作命令
            // ============================================================
            website::open_website,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
