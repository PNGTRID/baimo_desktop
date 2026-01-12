/**
 * Tauri API 封装
 * 用于调用 Rust 后端命令
 */

import { invoke } from '@tauri-apps/api/core';

// Tauri 窗口类型扩展
interface TauriWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

// 检测是否在 Tauri 环境中（Tauri 2.0 兼容）
export const isTauri = () => {
  if (typeof window === 'undefined') return false;

  const tauriWindow = window as TauriWindow;

  // Tauri 2.0: 检查 __TAURI_INTERNALS__
  if (typeof tauriWindow.__TAURI_INTERNALS__ !== 'undefined') {
    console.log('[Tauri环境] 检测到 __TAURI_INTERNALS__');
    return true;
  }

  // Tauri 1.x: 检查 __TAURI__
  if ('__TAURI__' in window) {
    console.log('[Tauri环境] 检测到 __TAURI__');
    return true;
  }

  console.warn('[Tauri环境] 未检测到 Tauri 对象');
  console.log('[调试] window 对象键:', Object.keys(window).filter(k => k.includes('TAURI')));
  return false;
};

// 安全的 invoke 包装器
async function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Browser环境] 跳过 Tauri 命令: ${command}`);
    throw new Error('Tauri API 仅在桌面应用中可用');
  }
  try {
    console.log(`[Tauri调用] ${command}`, args);
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[Tauri命令失败] ${command}:`, error);
    throw error;
  }
}
import type {
  AppConfig,
  ColorPreset,
  CompanyFinancialOverview,
  CreateColorPresetRequest,
  CreateColorRequest,
  CreateCustomerRequest,
  CreateFinancialRecordRequest,
  CreateFolderRequest,
  CreateOrderRequest,
  CreatePatternFromTiffRequest,
  CreatePatternRequest,
  Customer,
  CustomerDebt,
  CustomerDebtParams,
  DashboardStats,
  FinancialRecord,
  FinancialRecordParams,
  FolderScanResult,
  FolderTreeNode,
  Order,
  PaginatedFinancialRecords,
  PaginatedSystemLogs,
  Pattern,
  PatternColor,
  PatternFolder,
  ProductionStats,
  ScanFolderRequest,
  SystemLog,
  SystemLogParams,
  TiffMetadata,
  UpdateColorPresetRequest,
  UpdateColorRequest,
  UpdateConfigRequest,
  UpdateCustomerRequest,
  UpdateFolderRequest,
  UpdateOrderRequest,
  UpdateOrderFullRequest,
} from '@/types';

// ============ TIFF 相关 ============
export const TiffApi = {
  /**
   * 解析 TIFF 文件元数据
   */
  async parseTiff(filePath: string): Promise<TiffMetadata> {
    return await safeInvoke<TiffMetadata>('parse_tiff_file', { filePath });
  },
};

// ============ 客户相关 ============
export const CustomerApi = {
  /**
   * 获取所有客户
   */
  async getAll(): Promise<Customer[]> {
    return await safeInvoke<Customer[]>('get_customers');
  },

  /**
   * 根据 ID 获取客户
   */
  async getById(id: string): Promise<Customer | null> {
    const result = await safeInvoke<Customer | null>('get_customer_by_id', { id });
    return result;
  },

  /**
   * 创建客户
   */
  async create(data: CreateCustomerRequest): Promise<Customer> {
    return await safeInvoke<Customer>('create_customer', { request: data });
  },

  /**
   * 更新客户
   */
  async update(data: UpdateCustomerRequest): Promise<Customer | null> {
    const result = await safeInvoke<Customer | null>('update_customer', { request: data });
    return result;
  },

  /**
   * 删除客户
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_customer', { id });
  },
};

// ============ 图案相关 ============
export const PatternApi = {
  /**
   * 获取所有图案
   */
  async getAll(): Promise<Pattern[]> {
    return await safeInvoke<Pattern[]>('get_patterns');
  },

  /**
   * 根据 ID 获取图案
   */
  async getById(id: string): Promise<Pattern | null> {
    const result = await safeInvoke<Pattern | null>('get_pattern_by_id', { id });
    return result;
  },

  /**
   * 创建图案
   */
  async create(data: CreatePatternRequest): Promise<Pattern> {
    return await safeInvoke<Pattern>('create_pattern', { request: data });
  },

  /**
   * 从 TIFF 文件创建图案
   */
  async createFromTiff(data: CreatePatternFromTiffRequest): Promise<Pattern> {
    return await safeInvoke<Pattern>('create_pattern_from_tiff', { request: data });
  },

  /**
   * 更新图案
   */
  async update(
    id: string,
    name?: string,
    code?: string,
    actualHeight?: number,
    bleedHeight?: number,
    unitsPerRow?: number,
    rowCount?: number,
    customerId?: string | null,
  ): Promise<Pattern | null> {
    // Tauri 2.0 默认使用 camelCase 参数名（自动从 Rust 的 snake_case 转换）
    const result = await safeInvoke<Pattern | null>('update_pattern', {
      id,
      name,
      code,
      actualHeight,
      bleedHeight,
      unitsPerRow,
      rowCount,
      // 使用空字符串表示清除客户，undefined 表示不更新
      customerId: customerId === null ? '' : customerId,
    });
    return result;
  },

  /**
   * 删除图案
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_pattern', { id });
  },

  /**
   * 获取图案图片（从本地文件读取并转换为 base64）
   */
  async getPatternImage(filePath: string): Promise<string> {
    return await safeInvoke<string>('get_pattern_image', { filePath });
  },

  /**
   * 批量扫描文件夹中的 TIFF 文件
   */
  async scanFolder(request: ScanFolderRequest): Promise<FolderScanResult> {
    return await safeInvoke<FolderScanResult>('scan_folder_for_patterns', { request });
  },
};

// ============ 订单相关 ============
export const OrderApi = {
  /**
   * 获取所有订单
   */
  async getAll(): Promise<Order[]> {
    return await safeInvoke<Order[]>('get_orders');
  },

  /**
   * 根据 ID 获取订单
   */
  async getById(id: string): Promise<Order | null> {
    const result = await safeInvoke<Order | null>('get_order_by_id', { id });
    return result;
  },

  /**
   * 创建订单
   */
  async create(data: CreateOrderRequest): Promise<Order> {
    return await safeInvoke<Order>('create_order', { request: data });
  },

  /**
   * 更新订单
   */
  async update(data: UpdateOrderRequest): Promise<Order | null> {
    const result = await safeInvoke<Order | null>('update_order', { request: data });
    return result;
  },

  /**
   * 完整更新订单（包括客户、订单项、备注）
   */
  async updateFull(data: UpdateOrderFullRequest): Promise<Order | null> {
    const result = await safeInvoke<Order | null>('update_order_full', { request: data });
    return result;
  },

  /**
   * 确认并生产订单
   */
  async confirm(id: string): Promise<Order> {
    return await safeInvoke<Order>('confirm_order', { id });
  },

  /**
   * 删除订单
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_order', { id });
  },

  /**
   * 批量删除订单
   */
  async batchDelete(ids: string[]): Promise<number> {
    return await safeInvoke<number>('batch_delete_orders', { ids });
  },
};

// ============ 统计相关 ============
export const StatsApi = {
  /**
   * 获取仪表盘统计数据
   */
  async getDashboard(): Promise<DashboardStats> {
    return await safeInvoke<DashboardStats>('get_dashboard_stats');
  },

  /**
   * 获取公司财务概览
   */
  async getCompanyFinancialOverview(): Promise<CompanyFinancialOverview> {
    return await safeInvoke<CompanyFinancialOverview>('get_company_financial_overview');
  },

  /**
   * 获取生产统计数据
   * @param period 统计周期: 'week' | 'month' | 'custom'
   * @param startDate 自定义开始日期 (ISO 8601 格式)
   * @param endDate 自定义结束日期 (ISO 8601 格式)
   */
  async getProductionStats(
    period?: 'week' | 'month' | 'custom',
    startDate?: string,
    endDate?: string,
  ): Promise<ProductionStats> {
    return await safeInvoke<ProductionStats>('get_production_stats', {
      period,
      startDate,
      endDate,
    });
  },
};

// ============ 图案文件夹相关 ============
export const PatternFolderApi = {
  /**
   * 获取所有文件夹列表（扁平结构）
   */
  async getAll(): Promise<PatternFolder[]> {
    return await safeInvoke<PatternFolder[]>('get_folders');
  },

  /**
   * 获取文件夹树形结构
   */
  async getFolderTree(): Promise<FolderTreeNode[]> {
    return await safeInvoke<FolderTreeNode[]>('get_folder_tree');
  },

  /**
   * 根据 ID 获取文件夹
   */
  async getById(id: string): Promise<PatternFolder | null> {
    const result = await safeInvoke<PatternFolder | null>('get_folder_by_id', { id });
    return result;
  },

  /**
   * 创建文件夹
   */
  async create(data: CreateFolderRequest): Promise<PatternFolder> {
    return await safeInvoke<PatternFolder>('create_folder', { request: data });
  },

  /**
   * 更新文件夹
   */
  async update(id: string, data: UpdateFolderRequest): Promise<PatternFolder | null> {
    const result = await safeInvoke<PatternFolder | null>('update_folder', {
      id,
      request: data,
    });
    return result;
  },

  /**
   * 删除文件夹
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_folder', { id });
  },

  /**
   * 移动文件夹到新的父文件夹
   */
  async move(id: string, newParentId?: string): Promise<PatternFolder> {
    return await safeInvoke<PatternFolder>('move_folder', {
      id,
      newParentId,
    });
  },
};

// ============ 图案颜色变体相关 ============
export const PatternColorApi = {
  /**
   * 获取某个图案的所有颜色变体
   */
  async getByPatternId(patternId: string): Promise<PatternColor[]> {
    return await safeInvoke<PatternColor[]>('get_pattern_colors', { patternId });
  },

  /**
   * 根据 ID 获取颜色变体
   */
  async getById(id: string): Promise<PatternColor | null> {
    const result = await safeInvoke<PatternColor | null>('get_color_by_id', { id });
    return result;
  },

  /**
   * 获取图案的默认颜色
   */
  async getDefaultColor(patternId: string): Promise<PatternColor | null> {
    const result = await safeInvoke<PatternColor | null>('get_default_color', {
      patternId,
    });
    return result;
  },

  /**
   * 创建颜色变体
   */
  async create(data: CreateColorRequest): Promise<PatternColor> {
    return await safeInvoke<PatternColor>('create_color', { request: data });
  },

  /**
   * 批量创建颜色变体
   */
  async createBatch(colors: CreateColorRequest[]): Promise<PatternColor[]> {
    return await safeInvoke<PatternColor[]>('create_colors_batch', { colors });
  },

  /**
   * 更新颜色变体
   */
  async update(id: string, data: UpdateColorRequest): Promise<PatternColor | null> {
    const result = await safeInvoke<PatternColor | null>('update_color', {
      id,
      request: data,
    });
    return result;
  },

  /**
   * 删除颜色变体
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_color', { id });
  },

  /**
   * 设置默认颜色
   */
  async setDefault(id: string): Promise<PatternColor> {
    return await safeInvoke<PatternColor>('set_default_color', { id });
  },

  /**
   * 复制颜色变体
   */
  async duplicate(id: string, newName: string): Promise<PatternColor> {
    return await safeInvoke<PatternColor>('duplicate_color', { id, newName });
  },
};

// ============ 财务管理相关 ============
export const FinancialApi = {
  /**
   * 获取财务记录列表（分页）
   */
  async getRecords(params: FinancialRecordParams): Promise<PaginatedFinancialRecords> {
    return await safeInvoke<PaginatedFinancialRecords>('get_financial_records', { params });
  },

  /**
   * 根据 ID 获取财务记录
   */
  async getById(id: string): Promise<FinancialRecord | null> {
    const result = await safeInvoke<FinancialRecord | null>('get_financial_record_by_id', { id });
    return result;
  },

  /**
   * 创建财务记录
   */
  async create(data: CreateFinancialRecordRequest): Promise<FinancialRecord> {
    return await safeInvoke<FinancialRecord>('create_financial_record', { request: data });
  },

  /**
   * 获取客户欠款列表
   */
  async getCustomerDebts(params?: CustomerDebtParams): Promise<CustomerDebt[]> {
    return await safeInvoke<CustomerDebt[]>('get_customer_debts', {
      params: params || {},
    });
  },

  /**
   * 获取客户财务历史
   */
  async getCustomerHistory(customerId: string, limit?: number): Promise<FinancialRecord[]> {
    return await safeInvoke<FinancialRecord[]>('get_customer_financial_history', {
      customerId,
      limit,
    });
  },

  /**
   * 客户充值/还款
   */
  async customerPayment(
    customerId: string,
    amount: number,
    description?: string,
    orderId?: string,
  ): Promise<FinancialRecord> {
    return await safeInvoke<FinancialRecord>('customer_payment', {
      customerId,
      amount,
      description,
      orderId,
    });
  },

  /**
   * 客户退款
   */
  async customerRefund(
    customerId: string,
    amount: number,
    description?: string,
    orderId?: string,
    orderItemId?: string,
  ): Promise<FinancialRecord> {
    return await safeInvoke<FinancialRecord>('customer_refund', {
      customerId,
      amount,
      description,
      orderId,
      orderItemId,
    });
  },

  /**
   * 余额调整（管理员操作）
   */
  async adjustBalance(customerId: string, newBalance: number, description: string): Promise<FinancialRecord> {
    return await safeInvoke<FinancialRecord>('adjust_customer_balance', {
      customerId,
      newBalance,
      description,
    });
  },

  /**
   * 获取财务汇总
   */
  async getSummary(startDate?: string, endDate?: string): Promise<Record<string, unknown>> {
    return await safeInvoke<Record<string, unknown>>('get_financial_summary', {
      startDate,
      endDate,
    });
  },

  /**
   * 为历史订单补充财务记录
   */
  async migrateOrderRecords(): Promise<string> {
    return await safeInvoke<string>('migrate_order_financial_records');
  },
};

// ============ 应用设置相关 ============
export const SettingsApi = {
  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<AppConfig[]> {
    return await safeInvoke<AppConfig[]>('get_all_configs');
  },

  /**
   * 获取单个配置
   */
  async getConfig(key: string): Promise<AppConfig | null> {
    const result = await safeInvoke<AppConfig | null>('get_config', { key });
    return result;
  },

  /**
   * 更新或插入配置
   */
  async upsert(config: AppConfig): Promise<AppConfig> {
    return await safeInvoke<AppConfig>('upsert_config', config as Record<string, unknown>);
  },

  /**
   * 批量更新配置
   */
  async batchUpdateConfigs(configs: UpdateConfigRequest[]): Promise<AppConfig[]> {
    return await safeInvoke<AppConfig[]>('batch_update_configs', { configs });
  },

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_config', { key });
  },

  /**
   * 初始化默认应用配置
   */
  async initializeDefaultConfigs(): Promise<AppConfig[]> {
    return await safeInvoke<AppConfig[]>('initialize_default_configs');
  },

  /**
   * 初始化颜色预设种子数据
   */
  async seedColorPresets(): Promise<ColorPreset[]> {
    return await safeInvoke<ColorPreset[]>('seed_color_presets');
  },
};

// ============ 颜色预设管理 ============
export const ColorPresetApi = {
  /**
   * 获取所有颜色预设
   */
  async getAll(): Promise<ColorPreset[]> {
    return await safeInvoke<ColorPreset[]>('get_color_presets');
  },

  /**
   * 根据 ID 获取颜色预设
   */
  async getById(id: string): Promise<ColorPreset | null> {
    const result = await safeInvoke<ColorPreset | null>('get_color_preset_by_id', { id });
    return result;
  },

  /**
   * 创建颜色预设
   */
  async create(request: CreateColorPresetRequest): Promise<ColorPreset> {
    return await safeInvoke<ColorPreset>('create_color_preset', {
      name: request.name,
      displayName: request.displayName,
      color: request.color,
      sortOrder: request.sortOrder,
    });
  },

  /**
   * 更新颜色预设
   */
  async update(id: string, request: UpdateColorPresetRequest): Promise<ColorPreset | null> {
    const result = await safeInvoke<ColorPreset | null>('update_color_preset', {
      id,
      request,
    });
    return result;
  },

  /**
   * 删除颜色预设
   */
  async delete(id: string): Promise<boolean> {
    return await safeInvoke<boolean>('delete_color_preset', { id });
  },
};

// ============ 系统日志管理 ============
export const SystemLogApi = {
  /**
   * 获取系统日志列表（分页）
   */
  async getLogs(params: SystemLogParams): Promise<PaginatedSystemLogs> {
    return await safeInvoke<PaginatedSystemLogs>('get_system_logs', { params });
  },

  /**
   * 根据 ID 获取系统日志
   */
  async getById(id: string): Promise<SystemLog | null> {
    const result = await safeInvoke<SystemLog | null>('get_system_log_by_id', { id });
    return result;
  },

  /**
   * 创建系统日志
   */
  async create(
    level: string,
    message: string,
    metadata?: string,
  ): Promise<SystemLog> {
    return await safeInvoke<SystemLog>('create_system_log', {
      request: { level, message, metadata },
    });
  },

  /**
   * 清理旧日志
   */
  async cleanupOldLogs(days: number): Promise<number> {
    return await safeInvoke<number>('cleanup_old_logs', { days });
  },

  /**
   * 获取日志统计
   */
  async getStats(days?: number): Promise<Record<string, unknown>> {
    return await safeInvoke<Record<string, unknown>>('get_log_stats', { days });
  },
};

// ============ 数据管理相关 ============
export const BackupApi = {
  /**
   * 导出所有数据为 JSON
   */
  async exportData(): Promise<string> {
    return await safeInvoke<string>('export_data');
  },

  /**
   * 导入 JSON 数据
   */
  async importData(jsonData: string): Promise<string> {
    return await safeInvoke<string>('import_data', { jsonData });
  },

  /**
   * 获取数据库文件路径
   */
  async getDatabasePath(): Promise<string> {
    return await safeInvoke<string>('get_database_path');
  },

  /**
   * 备份数据库文件
   */
  async backupDatabase(backupPath: string): Promise<string> {
    return await safeInvoke<string>('backup_database', { backupPath });
  },

  /**
   * 清空所有业务数据（危险操作）
   */
  async clearAllData(): Promise<string> {
    return await safeInvoke<string>('clear_all_data');
  },
};

/**
 * 文件对话框 API（替代 dialog 插件）
 */
export const FileDialogApi = {
  /**
   * 打开文件选择对话框
   */
  async openFile(options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return await safeInvoke<string | null>('open_file_dialog', {
      title: options?.title,
      filters: options?.filters,
    });
  },

  /**
   * 打开文件夹选择对话框
   */
  async openFolder(options?: { title?: string }): Promise<string | null> {
    return await safeInvoke<string | null>('open_folder_dialog', {
      title: options?.title,
    });
  },

  /**
   * 保存文件对话框
   */
  async saveFile(options?: {
    title?: string;
    defaultName?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> {
    return await safeInvoke<string | null>('save_file_dialog', {
      title: options?.title,
      defaultName: options?.defaultName,
      filters: options?.filters,
    });
  },

  /**
   * 保存文本内容到文件
   */
  async saveTextFile(path: string, content: string): Promise<void> {
    await safeInvoke<void>('save_text_file', { path, content });
  },

  /**
   * 读取文本文件内容
   */
  async readTextFile(path: string): Promise<string> {
    return await safeInvoke<string>('read_text_file', { path });
  },
};

/**
 * 剪贴板 API（Tauri 原生）
 */
export const ClipboardApi = {
  /**
   * 写入图片到剪贴板
   * @param imageBytes PNG 图片的字节数组（base64 解码后）
   */
  async writeImage(imageBytes: number[]): Promise<void> {
    await safeInvoke<void>('write_image_to_clipboard', { imageBytes });
  },

  /**
   * 写入文本到剪贴板
   */
  async writeText(text: string): Promise<void> {
    await safeInvoke<void>('write_text_to_clipboard', { text });
  },
};

/**
 * 网站 API
 */
export const WebsiteApi = {
  /**
   * 打开官网
   */
  async openWebsite(): Promise<void> {
    await safeInvoke<void>('open_website');
  },
};
