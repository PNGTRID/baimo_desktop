/**
 * 价格计算工具
 * 100% 复用自旧项目 .baimo_web
 */

import type { PatternPricingParams, PricingResult } from '@/types';

export class PricingCalculator {
  /**
   * 计算图案单价
   *
   * 公式：图案单价 = 客户每平方单价 ÷ (1600 ÷ (实际高度 + 出血高度) × 每行个数)
   *
   * @param params 计算参数
   * @returns 单价和计算详情
   */
  static calculatePatternUnitPrice(params: PatternPricingParams): PricingResult {
    const {
      customerUnitPrice,
      actualHeight,
      bleedHeight = 20,
      unitsPerRow,
    } = params;

    // 总高度（毫米）
    const totalHeight = actualHeight + bleedHeight;

    // 分母计算：1600 ÷ 总高度 × 每行个数
    const denominator = (1600 / totalHeight) * unitsPerRow;

    // 图案单价 = 客户每平方单价 ÷ 分母
    const unitPrice = customerUnitPrice / denominator;

    // 保留两位小数，四舍五入
    const roundedUnitPrice = Math.round(unitPrice * 100) / 100;

    const roundedDenominator = Math.round(denominator * 100) / 100;

    return {
      unitPrice: roundedUnitPrice,
      calculation: {
        customerUnitPrice,
        totalHeight,
        unitsPerRow,
        denominator: roundedDenominator,
        formula: `${customerUnitPrice} ÷ (1600 ÷ ${totalHeight} × ${unitsPerRow}) = ${roundedUnitPrice.toFixed(2)}元`,
      },
    };
  }

  /**
   * 计算订单项总价
   *
   * @param unitPrice 单价
   * @param quantity 数量
   * @param area 面积（可选，按面积计价时使用）
   * @param pricingMode 计价模式
   * @returns 总价
   */
  static calculateItemTotalPrice(
    unitPrice: number,
    quantity: number,
    area: number | undefined,
    pricingMode: 'QUANTITY' | 'AREA',
  ): number {
    if (pricingMode === 'AREA' && area !== undefined) {
      // 按面积计算：单价 × 面积
      return Math.round(area * unitPrice * 100) / 100;
    } else {
      // 按数量计算：单价 × 数量
      return Math.round(quantity * unitPrice * 100) / 100;
    }
  }

  /**
   * 批量计算订单项价格
   *
   * @param items 订单项数组
   * @param customer 客户信息（包含单价）
   * @param patterns 图案信息映射
   * @returns 计算后的订单项数组
   */
  static calculateOrderItems(
    items: Array<{
      patternId: string;
      quantity: number;
      area?: number;
      pricingMode: 'QUANTITY' | 'AREA';
    }>,
    customer: { unitPrice: number },
    patterns: Map<string, { actualHeight: number; bleedHeight?: number; unitsPerRow?: number }>,
  ): Array<{
    patternId: string;
    quantity: number;
    area?: number;
    pricingMode: 'QUANTITY' | 'AREA';
    unitPrice: number;
    totalPrice: number;
  }> {
    return items.map((item) => {
      const pattern = patterns.get(item.patternId);

      if (!pattern) {
        throw new Error(`图案 ${item.patternId} 不存在`);
      }

      // 计算单价
      const priceResult = this.calculatePatternUnitPrice({
        customerUnitPrice: customer.unitPrice,
        actualHeight: pattern.actualHeight,
        bleedHeight: pattern.bleedHeight || 20,
        unitsPerRow: pattern.unitsPerRow || 10,
      });

      // 计算总价
      const totalPrice = this.calculateItemTotalPrice(
        priceResult.unitPrice,
        item.quantity,
        item.area,
        item.pricingMode,
      );

      return {
        ...item,
        unitPrice: priceResult.unitPrice,
        totalPrice,
      };
    });
  }

  /**
   * 计算订单总额
   *
   * @param items 订单项数组
   * @returns 订单总额
   */
  static calculateOrderTotal(
    items: Array<{
      unitPrice: number;
      totalPrice: number;
    }>,
  ): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
}
