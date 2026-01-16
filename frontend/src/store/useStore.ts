import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Pattern } from '@/types';

/**
 * 应用配置接口
 */
interface AppConfig {
  companyName: string;        // 完整名称
  companyShortName: string;   // 简称
  companyEnglishName: string; // 英文名称
  // 定价相关配置
  defaultPricePerSq: number;  // 默认每平方单价
  defaultBleedHeight: number; // 默认出血高度（厘米）
  pricingFormulaConstant: number; // 价格公式常数
}

/**
 * 应用状态接口
 */
interface AppState {
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  loadConfig: () => Promise<void>;
  // 临时选中的图案（用于快捷下单，不持久化）
  pendingPatternForOrder: Pattern | null;
  setPendingPatternForOrder: (pattern: Pattern | null) => void;
  // 全局图片缓存（key: localFilePath, value: base64 image data）
  // 不持久化到 localStorage，使用单独的文件缓存
  patternImageCache: Map<string, string>;
  setPatternImage: (filePath: string, imageData: string) => void;
  getPatternImage: (filePath: string) => string | undefined;
  clearPatternImageCache: () => Promise<void>;
  loadPatternImageCacheFromDisk: (filePaths: string[]) => Promise<void>;
}

/**
 * 全局状态管理 Store
 * 用于管理应用级别的配置，如公司名称等
 *
 * 注意：pendingPatternForOrder 和 patternImageCache 不持久化到 localStorage
 */
export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 默认配置
      config: {
        companyName: '白墨记账系统',
        companyShortName: '白墨',
        companyEnglishName: 'BAIMO',
        defaultPricePerSq: 100,
        defaultBleedHeight: 2.0,
        pricingFormulaConstant: 1600,
      },

      // 临时选中的图案（用于快捷下单，不持久化）
      pendingPatternForOrder: null,

      // 全局图片缓存（不持久化）
      patternImageCache: new Map(),

      // 更新配置（部分更新）
      setConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),

      // 设置待下单的图案
      setPendingPatternForOrder: (pattern) =>
        set({ pendingPatternForOrder: pattern }),

      // 设置图片缓存（同时保存到磁盘）
      setPatternImage: (filePath, imageData) => {
        // 更新内存缓存
        set((state) => {
          const newCache = new Map(state.patternImageCache);
          newCache.set(filePath, imageData);
          return { patternImageCache: newCache };
        });

        // 异步保存到磁盘（不阻塞 UI）
        (async () => {
          try {
            const { PatternApi } = await import('@/services/tauriApi');
            await PatternApi.saveImageCache(filePath, imageData);
          } catch (error) {
            console.error('保存图片缓存失败:', error);
          }
        })();
      },

      // 获取图片缓存
      getPatternImage: (filePath) => {
        return get().patternImageCache.get(filePath);
      },

      // 清空图片缓存（同时清理磁盘缓存）
      clearPatternImageCache: async () => {
        set({ patternImageCache: new Map() });

        try {
          const { PatternApi } = await import('@/services/tauriApi');
          const count = await PatternApi.clearImageCache();
          console.log(`已清理 ${count} 个图片缓存文件`);
        } catch (error) {
          console.error('清理图片缓存失败:', error);
        }
      },

      // 从磁盘加载图片缓存
      loadPatternImageCacheFromDisk: async (filePaths: string[]) => {
        try {
          const { PatternApi } = await import('@/services/tauriApi');

          // 并行加载所有缓存
          const cacheEntries = await Promise.all(
            filePaths.map(async (filePath) => {
              try {
                const cached = await PatternApi.loadImageCache(filePath);
                if (cached) {
                  return [filePath, cached] as [string, string];
                }
              } catch (error) {
                // 忽略单个文件加载失败
                console.debug(`加载缓存失败: ${filePath}`, error);
              }
              return null;
            })
          );

          // 过滤掉 null 值并更新缓存
          const validEntries = cacheEntries.filter((e): e is [string, string] => e !== null);

          if (validEntries.length > 0) {
            set((state) => {
              const newCache = new Map(state.patternImageCache);
              validEntries.forEach(([filePath, imageData]) => {
                newCache.set(filePath, imageData);
              });
              return { patternImageCache: newCache };
            });
            console.log(`已从磁盘加载 ${validEntries.length} 个图片缓存`);
          }
        } catch (error) {
          console.error('加载图片缓存失败:', error);
        }
      },

      // 从后端加载配置
      loadConfig: async () => {
        try {
          const { SettingsApi } = await import('@/services/tauriApi');
          const configs = await SettingsApi.getAllConfigs();

          // 将配置数组转换为键值对
          const configMap: Record<string, string> = {};
          configs.forEach((c) => {
            configMap[c.key] = c.value;
          });

          // 更新配置
          set({
            config: {
              companyName: configMap['company_name'] || '白墨记账系统',
              companyShortName: configMap['company_short_name'] || '白墨',
              companyEnglishName: configMap['company_english_name'] || 'BAIMO',
              defaultPricePerSq: parseFloat(configMap['default_price_per_sq'] || '100'),
              defaultBleedHeight: parseFloat(configMap['default_bleed_height'] || '2.0'),
              pricingFormulaConstant: parseInt(configMap['pricing_formula_constant'] || '1600', 10),
            },
          });
        } catch (error) {
          console.error('加载配置失败:', error);
          // 加载失败时保持默认值
        }
      },
    }),
    {
      name: 'baimo-app-config', // localStorage key
      // 排除 pendingPatternForOrder 和 patternImageCache，不持久化到 localStorage
      partialize: (state) => ({ config: state.config }),
    }
  )
);
