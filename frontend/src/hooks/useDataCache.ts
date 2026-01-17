import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Customer, Pattern, Order } from '@/types';

/**
 * 数据加载器函数类型
 */
type DataLoader<T> = () => Promise<T[]>;

/**
 * 通用数据缓存 Hook
 * 自动管理数据加载和缓存，避免重复请求
 *
 * @param type - 数据类型 ('customers' | 'patterns' | 'orders')
 * @param loader - 数据加载函数
 * @param maxAge - 缓存有效期（毫秒），默认 5 分钟
 * @returns [data, loading, error, refresh]
 */
export function useDataCache<T extends Customer | Pattern | Order>(
  type: 'customers' | 'patterns' | 'orders',
  loader: DataLoader<T>,
  maxAge: number = 5 * 60 * 1000 // 默认 5 分钟
): [T[], boolean, string | null, () => Promise<void>] {
  const store = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从缓存获取数据
  const getCachedData = (): T[] => {
    return store.dataCache[type] as T[];
  };

  // 加载数据
  const loadData = async (force = false) => {
    // 如果缓存有效且不是强制刷新，直接返回缓存数据
    if (!force && store.isCacheValid(type, maxAge)) {
      console.log(`[DataCache] 使用缓存数据: ${type}`);
      return;
    }

    console.log(`[DataCache] 加载新数据: ${type}`);
    setLoading(true);
    setError(null);

    try {
      const data = await loader();

      // 更新缓存
      if (type === 'customers') {
        store.setCustomers(data as Customer[]);
      } else if (type === 'patterns') {
        store.setPatterns(data as Pattern[]);
      } else if (type === 'orders') {
        store.setOrders(data as Order[]);
      }

      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载数据失败';
      setError(errorMessage);
      setLoading(false);
      console.error(`[DataCache] 加载失败: ${type}`, err);
    }
  };

  // 手动刷新数据
  const refresh = async () => {
    await loadData(true);
  };

  // 初始加载
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [getCachedData(), loading, error, refresh];
}

/**
 * 客户数据缓存 Hook
 */
export function useCustomersCache() {
  const loader = async () => {
    const { CustomerApi } = await import('@/services/tauriApi');
    return await CustomerApi.getAll();
  };

  return useDataCache('customers', loader);
}

/**
 * 图案数据缓存 Hook
 */
export function usePatternsCache() {
  const loader = async () => {
    const { PatternApi } = await import('@/services/tauriApi');
    return await PatternApi.getAll();
  };

  return useDataCache('patterns', loader);
}

/**
 * 订单数据缓存 Hook
 */
export function useOrdersCache() {
  const loader = async () => {
    const { OrderApi } = await import('@/services/tauriApi');
    return await OrderApi.getAll();
  };

  return useDataCache('orders', loader);
}
