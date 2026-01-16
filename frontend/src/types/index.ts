/**
 * 数据类型定义
 * 复用自旧项目 .baimo_web
 */

// ============ 客户相关 ============
export interface Customer {
  id: string;
  name: string;
  balance: number;
  creditLimit: number;
  unitPrice: number; // 每平方单价
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  balance?: number;
  creditLimit?: number;
  unitPrice?: number;
  notes?: string;
}

export interface UpdateCustomerRequest {
  id: string;
  name?: string;
  balance?: number;
  creditLimit?: number;
  unitPrice?: number;
  notes?: string;
  isActive?: boolean;
}

// ============ 图案相关 ============
export interface Pattern {
  id: string;
  name: string;
  code: string;
  actualHeight: number; // 实际高度（毫米）
  bleedHeight: number; // 出血高度（毫米）
  unitsPerRow: number; // 每行个数
  rowCount: number; // 行数
  previewImage?: string;
  localFilePath?: string; // 本地 TIFF 文件路径
  customerId?: string;
  folderId?: string; // 所属文件夹
  colorType?: string; // 颜色类型：SINGLE（单色）或 MULTI（多色）
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatternRequest {
  name: string;
  code?: string;
  actualHeight?: number;
  bleedHeight?: number;
  unitsPerRow?: number;
  rowCount?: number;
  localFilePath?: string;
  customerId?: string;
}

export interface CreatePatternFromTiffRequest {
  name: string;
  localFilePath: string;
  actualHeight: number;
  customerId?: string;
  code?: string;
}

// ============ 订单相关 ============
export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  isConfirmed: boolean; // 是否已确认并生产
  confirmedAt?: string; // 确认并生产时间（ISO 8601）
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderPatternItem[];
}

export interface OrderPatternItem {
  id: string;
  patternId: string;
  patternName: string;
  quantity: number;
  area?: number;
  pricingMode: PricingMode;
  unitPrice: number;
  totalPrice: number;
  colorVariantId?: string; // 颜色变体 ID
  colorVariantName?: string; // 颜色变体名称（用于显示）
}

export type PricingMode = 'QUANTITY' | 'AREA'; // 按数量 / 按面积

export interface CreateOrderRequest {
  customerId: string;
  items: CreateOrderItemRequest[];
  notes?: string;
}

export interface CreateOrderItemRequest {
  patternId: string;
  quantity: number;
  area?: number;
  pricingMode: PricingMode;
  colorVariantId?: string; // 颜色变体 ID
}

export interface UpdateOrderRequest {
  id: string;
  notes?: string;
}

export interface UpdateOrderFullRequest {
  id: string;
  customerId: string;
  items: CreateOrderItemRequest[];
  notes?: string;
}

// ============ TIFF 文件相关 ============
export interface TiffMetadata {
  filePath: string;
  fileName: string;
  width: number;
  height: number;
  heightCm: number;
  dpi?: number;
  colorType: string;
  fileSize: number;
}

// ============ API 响应类型 ============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ============ 价格计算相关 ============
export interface PatternPricingParams {
  customerUnitPrice: number;
  actualHeight: number;
  bleedHeight?: number;
  unitsPerRow: number;
}

export interface PricingResult {
  unitPrice: number;
  calculation: {
    customerUnitPrice: number;
    totalHeight: number;
    unitsPerRow: number;
    denominator: number;
    formula: string;
  };
}

// ============ 仪表盘统计相关 ============
export interface DashboardStats {
  customersCount: number;
  patternsCount: number;
  ordersCount: number;
  monthlyRevenue: number;
}

// ============ 财务概览相关 ============
export interface CompanyFinancialOverview {
  totalBalance: number;
  positiveBalance: number;
  negativeBalance: number;
  customerCount: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  avgBalance: number;
}

// ============ 生产统计相关 ============
export interface ProductionStats {
  totalArea: number;
  totalRevenue: number;
  orderCount: number;
  totalQuantity: number; // 合计个数（订单项数量总和）
  avgPrice: number;
  dailyBreakdown: DailyStats[];
}

export interface DailyStats {
  date: string;
  area: number;
  revenue: number;
  orderCount: number;
}

// 图表数据类型
export interface MonthlyRevenueData {
  month: string;
  revenue: number;
}

export interface TopCustomerData {
  name: string;
  value: number;
}

export interface PatternUsageData {
  name: string;
  count: number;
}

// ============ 图案文件夹相关 ============
export interface PatternFolder {
  id: string;
  name: string;
  parentId?: string;
  level: number;
  path: string;
  sortOrder: number;
  customerId?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string;
  customerId?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  parentId?: string;
  level: number;
  path: string;
  customerId?: string;
  patternCount: number;
  children: FolderTreeNode[];
}

// ============ 图案颜色变体相关 ============
export interface PatternColor {
  id: string;
  patternId: string;
  name: string;
  color: string;
  image?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColorRequest {
  patternId: string;
  name: string;
  color: string;
  image?: string;
}

export interface UpdateColorRequest {
  name?: string;
  color?: string;
  image?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

// ============ 财务管理相关 ============
export interface FinancialRecord {
  id: string;
  recordType: string; // PAYMENT, REFUND, ADJUSTMENT
  amount: number;
  description: string;
  orderId?: string;
  orderItemId?: string;
  customerId: string;
  customerName: string;
  balanceBefore: number;
  balanceAfter: number;
  operatorName: string;
  createdAt: string;
}

export interface CreateFinancialRecordRequest {
  recordType: string;
  amount: number;
  description: string;
  customerId: string;
  orderId?: string;
  orderItemId?: string;
}

export interface CustomerDebt {
  id: string;
  name: string;
  balance: number;
  creditLimit: number;
  availableCredit: number;
  debtRatio: number;
  notes?: string;
  // 新增：订单统计
  orderCount?: number;
  totalArea?: number;
  totalQuantity?: number;
}

/// 客户订单统计
export interface CustomerOrderStats {
  totalArea: number;
  totalQuantity: number;
  orderCount: number;
}

export interface FinancialRecordParams {
  customerId?: string;
  recordType?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerDebtParams {
  minDebt?: number;
  maxDebt?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginatedFinancialRecords {
  data: FinancialRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ 应用配置相关 ============
export interface AppConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateConfigRequest {
  key: string;
  value: string;
}

// ============ 颜色预设相关 ============
export interface ColorPreset {
  id: string;
  name: string;
  displayName?: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColorPresetRequest {
  name: string;
  displayName?: string;
  color: string;
  sortOrder?: number;
}

export interface UpdateColorPresetRequest {
  name?: string;
  displayName?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// ============ 系统日志相关 ============
export interface SystemLog {
  id: string;
  level: string; // INFO, WARNING, ERROR
  message: string;
  metadata?: string;
  operatorName?: string;
  createdAt: string;
}

export interface SystemLogParams {
  level?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSystemLogs {
  data: SystemLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ 批量扫描相关 ============
export interface ScanFolderRequest {
  folderPath: string;
  customerId?: string;
  parentFolderId?: string;
}

export interface FolderScanResult {
  totalFound: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: ScanError[];
}

export interface ScanError {
  filePath: string;
  error: string;
}

export interface ScanProgress {
  stage: 'scanning' | 'importing' | 'completed';
  current: number;
  total: number;
  message: string;
}
