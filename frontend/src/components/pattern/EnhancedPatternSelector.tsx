/**
 * 增强版图案选择器组件
 * 从旧项目迁移并适配当前项目的API和类型
 * 支持单选/多选模式、颜色变体选择、价格预览
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Input,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Divider,
  Typography,
  Radio,
  Empty,
  Spin,
  Badge,
  Tooltip,
  InputNumber,
  App,
  Select,
  Table,
} from 'antd';
import {
  SearchOutlined,
  FormatPainterOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { PatternColorApi, CustomerApi } from '@/services/tauriApi';
import type { Pattern, PatternColor, PricingMode, Customer } from '@/types';

const { Search } = Input;
const { Text } = Typography;

// 扩展的 Pattern 类型，包含颜色变体
interface PatternWithVariants extends Pattern {
  colorVariants: PatternColor[];
}

interface ColorVariantItem {
  colorVariantId: string;
  colorVariant: PatternColor;
  pricingMode: PricingMode;
  quantity: number;
  area: number;
}

interface SelectedPatternInfo {
  pattern: PatternWithVariants;
  selectedVariants: Map<string, ColorVariantItem>;
}

interface EnhancedPatternSelectorProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (
    selectedPattern: Pattern,
    selectedColorVariant?: PatternColor,
    quantity?: number,
    area?: number
  ) => void;
  onConfirmMultiple?: (selectedPatterns: SelectedPatternInfo[]) => void;
  patterns: Pattern[];
  currentPatternId?: string;
  currentColorVariantId?: string;
  mode: PricingMode;
  isMobile?: boolean;
  customerUnitPrice?: number;
  customerName?: string;
  allowMultiple?: boolean; // 新增多选模式开关
}

const EnhancedPatternSelector: React.FC<EnhancedPatternSelectorProps> = ({
  visible,
  onCancel,
  onConfirm,
  onConfirmMultiple,
  patterns,
  currentPatternId,
  currentColorVariantId,
  mode,
  isMobile = false,
  customerUnitPrice = 18,
  customerName,
  allowMultiple = false,
}) => {
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string | undefined>(undefined);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<PatternWithVariants | null>(null);
  const [selectedColorVariant, setSelectedColorVariant] = useState<PatternColor | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [area, setArea] = useState<number>(0);
  const [internalMode, setInternalMode] = useState<PricingMode>(mode);
  const [patternsLoading, setPatternsLoading] = useState(false);

  // 加载带颜色变体的图案数据
  const [patternsWithVariants, setPatternsWithVariants] = useState<PatternWithVariants[]>([]);

  // 多选相关状态
  const [selectedPatterns, setSelectedPatterns] = useState<Map<string, SelectedPatternInfo>>(new Map());

  // 加载客户列表
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await CustomerApi.getAll();
        setCustomers(data.filter((c) => c.isActive));
      } catch (error) {
        console.error('加载客户列表失败:', error);
      }
    };
    loadCustomers();
  }, []);

  useEffect(() => {
    const loadColorVariants = async () => {
      setPatternsLoading(true);
      try {
        const variantsMap = new Map<string, PatternColor[]>();

        // 并行加载所有图案的颜色变体
        await Promise.all(
          patterns.map(async (pattern) => {
            try {
              const variants = await PatternColorApi.getByPatternId(pattern.id);
              variantsMap.set(pattern.id, variants);
            } catch (error) {
              console.error(`加载图案 ${pattern.id} 的颜色变体失败:`, error);
              variantsMap.set(pattern.id, []);
            }
          })
        );

        // 合并数据和颜色变体
        const combined = patterns.map((pattern) => ({
          ...pattern,
          colorVariants: variantsMap.get(pattern.id) || [],
        }));

        setPatternsWithVariants(combined);
      } catch (error) {
        console.error('加载颜色变体失败:', error);
        // 失败时使用原始数据，颜色变体为空
        setPatternsWithVariants(patterns.map((p) => ({ ...p, colorVariants: [] })));
      } finally {
        setPatternsLoading(false);
      }
    };

    if (visible && patterns.length > 0) {
      loadColorVariants();
    }
  }, [visible, patterns]);

  // 重置选择状态
  const resetSelection = () => {
    setSelectedPattern(null);
    setSelectedColorVariant(null);
    setQuantity(0);
    setArea(0);
    setSelectedPatterns(new Map());
  };

  // 获取筛选后的图案列表
  const getFilteredPatterns = () => {
    if (!patterns || !Array.isArray(patterns)) {
      return [];
    }

    let filtered = [...patternsWithVariants];

    // 客户筛选
    if (selectedCustomerFilter) {
      filtered = filtered.filter((pattern) => pattern.customerId === selectedCustomerFilter);
    }

    // 搜索筛选
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (pattern) =>
          pattern.name.toLowerCase().includes(searchLower) ||
          pattern.code.toLowerCase().includes(searchLower)
      );
    }

    // 移除基于 isActive 的排序（Pattern 类型已无此字段）
    return filtered;
  };

  // 设置当前选中的图案
  useEffect(() => {
    if (visible && currentPatternId && patternsWithVariants.length > 0) {
      const pattern = patternsWithVariants.find((p) => p.id === currentPatternId);
      if (pattern) {
        setSelectedPattern(pattern);
        if (currentColorVariantId) {
          const variant = pattern.colorVariants.find((cv) => cv.id === currentColorVariantId);
          setSelectedColorVariant(variant || null);
        }
      }
    }
  }, [visible, currentPatternId, currentColorVariantId, patternsWithVariants]);

  // 处理图案选择
  const handlePatternSelect = (pattern: PatternWithVariants) => {
    if (allowMultiple) {
      // 多选模式
      const newSelectedPatterns = new Map(selectedPatterns);
      if (newSelectedPatterns.has(pattern.id)) {
        // 取消选择
        newSelectedPatterns.delete(pattern.id);
      } else {
        // 添加选择，初始化所有颜色变体
        const selectedVariants = new Map<string, ColorVariantItem>();

        pattern.colorVariants.forEach((cv) => {
          selectedVariants.set(cv.id, {
            colorVariantId: cv.id,
            colorVariant: cv,
            pricingMode: cv.isDefault ? internalMode : 'QUANTITY',
            quantity: cv.isDefault && internalMode === 'QUANTITY' ? 1 : 0,
            area: cv.isDefault && internalMode === 'AREA' ? 1 : 0,
          });
        });

        newSelectedPatterns.set(pattern.id, {
          pattern,
          selectedVariants,
        });
      }
      setSelectedPatterns(newSelectedPatterns);
    } else {
      // 单选模式
      setSelectedPattern(pattern);
      // 选择默认颜色变体
      const defaultVariant = pattern.colorVariants.find((cv) => cv.isDefault) || pattern.colorVariants[0];
      setSelectedColorVariant(defaultVariant || null);
    }
  };

  // 更新颜色变体的计价模式
  const handleColorVariantPricingModeChange = (patternId: string, colorVariantId: string, pricingMode: PricingMode) => {
    const newSelectedPatterns = new Map(selectedPatterns);
    const patternInfo = newSelectedPatterns.get(patternId);
    if (patternInfo) {
      const newSelectedVariants = new Map(patternInfo.selectedVariants);
      const existingVariant = newSelectedVariants.get(colorVariantId);
      if (existingVariant) {
        newSelectedVariants.set(colorVariantId, {
          ...existingVariant,
          pricingMode,
          // 切换模式时重置数值
          quantity: pricingMode === 'QUANTITY' ? (existingVariant.quantity || 1) : 0,
          area: pricingMode === 'AREA' ? (existingVariant.area || 1) : 0,
        });
      }
      newSelectedPatterns.set(patternId, {
        ...patternInfo,
        selectedVariants: newSelectedVariants,
      });
      setSelectedPatterns(newSelectedPatterns);
    }
  };

  // 更新颜色变体的数量
  const handleColorVariantQuantityChange = (patternId: string, colorVariantId: string, quantity: number) => {
    const newSelectedPatterns = new Map(selectedPatterns);
    const patternInfo = newSelectedPatterns.get(patternId);
    if (patternInfo) {
      const newSelectedVariants = new Map(patternInfo.selectedVariants);
      const existingVariant = newSelectedVariants.get(colorVariantId);
      if (existingVariant) {
        newSelectedVariants.set(colorVariantId, {
          ...existingVariant,
          quantity,
        });
      }
      newSelectedPatterns.set(patternId, {
        ...patternInfo,
        selectedVariants: newSelectedVariants,
      });
      setSelectedPatterns(newSelectedPatterns);
    }
  };

  // 更新颜色变体的面积
  const handleColorVariantAreaChange = (patternId: string, colorVariantId: string, area: number) => {
    const newSelectedPatterns = new Map(selectedPatterns);
    const patternInfo = newSelectedPatterns.get(patternId);
    if (patternInfo) {
      const newSelectedVariants = new Map(patternInfo.selectedVariants);
      const existingVariant = newSelectedVariants.get(colorVariantId);
      if (existingVariant) {
        newSelectedVariants.set(colorVariantId, {
          ...existingVariant,
          area,
        });
      }
      newSelectedPatterns.set(patternId, {
        ...patternInfo,
        selectedVariants: newSelectedVariants,
      });
      setSelectedPatterns(newSelectedPatterns);
    }
  };

  // 处理确认选择
  const handleConfirm = () => {
    if (allowMultiple) {
      // 多选模式
      if (selectedPatterns.size === 0) {
        message.error('请选择至少一个图案');
        return;
      }

      const patternsList = Array.from(selectedPatterns.values());

      // 检查是否有有效的颜色变体（有数量或面积的）
      const hasValidItems = patternsList.some((patternInfo) =>
        Array.from(patternInfo.selectedVariants.values()).some(
          (variant) =>
            (variant.pricingMode === 'QUANTITY' && variant.quantity > 0) ||
            (variant.pricingMode === 'AREA' && variant.area > 0)
        )
      );

      if (!hasValidItems) {
        message.error('请为至少一个颜色变体设置正确的数量或面积');
        return;
      }

      onConfirmMultiple?.(patternsList);
      resetSelection();
    } else {
      // 单选模式
      if (!selectedPattern) {
        message.error('请选择图案');
        return;
      }

      const finalQuantity = internalMode === 'QUANTITY' ? quantity : 0;
      const finalArea = internalMode === 'AREA' ? area : 0;

      if ((internalMode === 'QUANTITY' && finalQuantity <= 0) || (internalMode === 'AREA' && finalArea <= 0)) {
        message.error(`请输入正确的${internalMode === 'QUANTITY' ? '数量' : '面积'}`);
        return;
      }

      onConfirm(selectedPattern, selectedColorVariant || undefined, finalQuantity, finalArea);
      resetSelection();
    }
  };

  // 计算价格（使用与后端一致的正确公式）
  const calculatePrice = () => {
    if (!selectedPattern) return 0;

    // 正确公式：单价 = 客户单价 ÷ (1600 ÷ (实际高度 + 出血高度) × 每行个数)
    // actualHeight 和 bleedHeight 数据库存储为厘米，需要转换为毫米
    const totalHeightMM = (selectedPattern.actualHeight + selectedPattern.bleedHeight) * 10;
    const denominator = (1600 / totalHeightMM) * selectedPattern.unitsPerRow;
    const unitPrice = customerUnitPrice / denominator;

    if (internalMode === 'QUANTITY') {
      return unitPrice * quantity;
    } else {
      return customerUnitPrice * area;
    }
  };

  // 渲染图案卡片
  const renderPatternCard = (pattern: PatternWithVariants) => {
    const isSelected = selectedPattern?.id === pattern.id;
    const hasVariants = pattern.colorVariants.length > 0;

    return (
      <Col xs={12} sm={8} md={6} lg={4} xl={4} key={pattern.id} style={{ marginBottom: 16 }}>
        <Card
          hoverable
          size={isMobile ? 'small' : 'default'}
          style={{
            height: isMobile ? 200 : 260,
            cursor: 'pointer',
            position: 'relative',
            border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
            borderRadius: 8,
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
          styles={{ body: { padding: isMobile ? 8 : 12 } }}
          onClick={() => handlePatternSelect(pattern)}
        >
          {/* 选中标记 */}
          {isSelected && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 20,
                height: 20,
                backgroundColor: '#1890ff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              <CheckOutlined style={{ fontSize: 12 }} />
            </div>
          )}

          {/* 图案预览区域 */}
          <div
            style={{
              height: isMobile ? 120 : 160,
              background: isSelected ? 'linear-gradient(135deg, #1890ff10, #1890ff05)' : '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            {pattern.previewImage ? (
              <img
                src={pattern.previewImage}
                alt={pattern.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80%',
                  objectFit: 'contain',
                  borderRadius: 4,
                }}
              />
            ) : (
              <div
                style={{
                  width: 60,
                  height: 60,
                  backgroundColor: '#f0f0f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FormatPainterOutlined style={{ fontSize: 24, color: '#bfbfbf' }} />
              </div>
            )}
          </div>

          {/* 图案信息 */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontWeight: '500',
                fontSize: isMobile ? 11 : 12,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pattern.name}
            </div>
            <div style={{ fontSize: isMobile ? 9 : 10, color: '#8c8c8c', marginBottom: 2 }}>
              {pattern.code}
            </div>

            {/* 技术参数 */}
            <div style={{ marginBottom: 4, fontSize: isMobile ? 8 : 9, color: '#666', lineHeight: 1.2 }}>
              <div>高: {pattern.actualHeight}mm | 排数: {pattern.unitsPerRow}</div>
              <div>
                面积: {((pattern.actualHeight * pattern.unitsPerRow * 0.001) || 0).toFixed(1)}m²
              </div>
              {pattern.bleedHeight > 0 && <div>出血: +{pattern.bleedHeight}mm</div>}
            </div>

            {/* 标签 */}
            <div style={{ marginBottom: 4 }}>
              <Space size={[4, 4]} wrap>
                {hasVariants && (
                  <Badge count={pattern.colorVariants.length} size="small">
                    <FormatPainterOutlined style={{ fontSize: 10, color: '#1890ff' }} />
                  </Badge>
                )}
              </Space>
            </div>

            {/* 颜色变体快速预览 */}
            {hasVariants && !isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                {pattern.colorVariants.slice(0, 4).map((cv) => (
                  <Tooltip title={cv.name} key={cv.id}>
                    {cv.image ? (
                      <img
                        src={cv.image}
                        alt={cv.name}
                        style={{
                          width: 16,
                          height: 16,
                          objectFit: 'cover',
                          borderRadius: 2,
                          backgroundColor: '#f0f0f0',
                          border: '1px solid #d9d9d9',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 2,
                          backgroundColor: cv.color,
                          border: '1px solid #d9d9d9',
                        }}
                      />
                    )}
                  </Tooltip>
                ))}
                {pattern.colorVariants.length > 4 && (
                  <Text style={{ fontSize: 10, color: '#8c8c8c' }}>+{pattern.colorVariants.length - 4}</Text>
                )}
              </div>
            )}
          </div>
        </Card>
      </Col>
    );
  };

  // 计算单个颜色变体的价格（使用与后端一致的正确公式）
  const calculateVariantPrice = (pattern: Pattern, variant: ColorVariantItem) => {
    // 正确公式：单价 = 客户单价 ÷ (1600 ÷ (实际高度 + 出血高度) × 每行个数)
    // actualHeight 和 bleedHeight 数据库存储为厘米，需要转换为毫米
    const totalHeightMM = (pattern.actualHeight + pattern.bleedHeight) * 10;
    const denominator = (1600 / totalHeightMM) * pattern.unitsPerRow;
    const unitPrice = customerUnitPrice / denominator;

    if (variant.pricingMode === 'QUANTITY') {
      return unitPrice * variant.quantity;
    } else {
      return customerUnitPrice * variant.area;
    }
  };

  // 计算多选模式的总价格
  const calculateTotalPrice = () => {
    let total = 0;
    selectedPatterns.forEach((patternInfo) => {
      patternInfo.selectedVariants.forEach((variant) => {
        if ((variant.pricingMode === 'QUANTITY' && variant.quantity > 0) ||
            (variant.pricingMode === 'AREA' && variant.area > 0)) {
          total += calculateVariantPrice(patternInfo.pattern, variant);
        }
      });
    });
    return total;
  };

  // 计算多选模式的总数量/面积
  const calculateTotalStats = () => {
    let totalQuantity = 0;
    let totalArea = 0;
    let totalCount = 0;

    selectedPatterns.forEach((patternInfo) => {
      patternInfo.selectedVariants.forEach((variant) => {
        if (variant.pricingMode === 'QUANTITY' && variant.quantity > 0) {
          totalQuantity += variant.quantity;
          totalCount += variant.quantity;
        } else if (variant.pricingMode === 'AREA' && variant.area > 0) {
          totalArea += variant.area;
          // 计算每平方能排多少个图案（使用正确公式）
          // actualHeight 和 bleedHeight 数据库存储为厘米，需要转换为毫米
          const totalHeightMM = (patternInfo.pattern.actualHeight + patternInfo.pattern.bleedHeight) * 10;
          const patternsPerSquare = (1600 / totalHeightMM) * patternInfo.pattern.unitsPerRow;
          totalCount += Math.round(variant.area * patternsPerSquare);
        }
      });
    });

    return { totalQuantity, totalArea, totalCount };
  };

  const filteredPatterns = getFilteredPatterns();

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{allowMultiple ? '批量选择图案' : '选择图案'}</span>
          {customerName && <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 'normal' }}>客户: {customerName}</span>}
        </div>
      }
      open={visible}
      onCancel={() => {
        onCancel();
        resetSelection();
      }}
      width={isMobile ? '95vw' : allowMultiple ? '95vw' : '90vw'}
      style={{ maxWidth: isMobile ? '400px' : allowMultiple ? '1400px' : '1200px', top: 20 }}
      footer={null}
    >
      {allowMultiple ? (
        // 多选模式：左右分栏布局
        <div style={{ display: 'flex', gap: 16, height: '75vh' }}>
          {/* 左侧：图案列表 */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
            {/* 搜索和客户筛选 */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Search
                placeholder="搜索图案名称或编号..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="选择客户"
                allowClear
                value={selectedCustomerFilter}
                onChange={setSelectedCustomerFilter}
                style={{ width: 180 }}
                options={[
                  { label: '全部客户', value: undefined },
                  ...customers.map((c) => ({ label: c.name, value: c.id }))
                ]}
              />
            </div>

            {patternsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" tip="加载图案中...">
                  <div style={{ minHeight: 100 }} />
                </Spin>
              </div>
            ) : filteredPatterns.length > 0 ? (
              <Table
                dataSource={filteredPatterns}
                rowKey="id"
                pagination={{ pageSize: 20 }}
                size="small"
                bordered
                columns={[
                  {
                    title: '图案',
                    key: 'pattern',
                    width: 80,
                    render: (_: unknown, record: PatternWithVariants) => (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {record.previewImage ? (
                          <img
                            src={record.previewImage}
                            alt={record.name}
                            style={{
                              width: 50,
                              height: 50,
                              objectFit: 'contain',
                              borderRadius: 4,
                              border: '1px solid #f0f0f0',
                              backgroundColor: '#fafafa',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 50,
                              height: 50,
                              backgroundColor: '#f0f0f0',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FormatPainterOutlined style={{ fontSize: 20, color: '#bfbfbf' }} />
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: '图案名称',
                    dataIndex: 'name',
                    key: 'name',
                    width: 150,
                    render: (name: string) => (
                      <div style={{ fontWeight: 500 }}>{name}</div>
                    ),
                  },
                  {
                    title: '图案编号',
                    dataIndex: 'code',
                    key: 'code',
                    width: 120,
                    render: (code: string) => (
                      <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{code}</Text>
                    ),
                  },
                  {
                    title: '颜色',
                    key: 'colors',
                    width: 100,
                    render: (_: unknown, record: PatternWithVariants) => {
                      const colorCount = record.colorVariants?.length || 0;
                      if (colorCount === 0) {
                        return <Text type="secondary" style={{ fontSize: 12 }}>无颜色</Text>;
                      }
                      return (
                        <Space size={2} wrap>
                          <Badge count={colorCount} size="small" style={{ backgroundColor: '#52c41a' }} />
                          <div style={{ display: 'flex', gap: 2 }}>
                            {record.colorVariants.slice(0, 3).map((cv) => (
                              <Tooltip key={cv.id} title={cv.name}>
                                {cv.image ? (
                                  <img
                                    src={cv.image}
                                    alt={cv.name}
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 2,
                                      border: '1px solid #d9d9d9',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 2,
                                      backgroundColor: cv.color,
                                      border: '1px solid #d9d9d9',
                                    }}
                                  />
                                )}
                              </Tooltip>
                            ))}
                            {colorCount > 3 && (
                              <Text style={{ fontSize: 10, color: '#8c8c8c' }}>+{colorCount - 3}</Text>
                            )}
                          </div>
                        </Space>
                      );
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 80,
                    render: (_: unknown, record: PatternWithVariants) => {
                      const isSelected = selectedPatterns.has(record.id);
                      return (
                        <Button
                          type={isSelected ? 'primary' : 'default'}
                          size="small"
                          onClick={() => handlePatternSelect(record)}
                          style={{ width: '100%' }}
                        >
                          {isSelected ? '已选择' : '选择'}
                        </Button>
                      );
                    },
                  },
                ]}
                scroll={{ y: 'calc(75vh - 200px)' }}
              />
            ) : (
              <Empty description="未找到符合条件的图案" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
            )}
          </div>

          {/* 右侧：选中图案的设置表格 */}
          <div style={{ flex: 1, overflowY: 'auto', paddingLeft: 8, borderLeft: '1px solid #e8e8e8' }}>
            {selectedPatterns.size > 0 ? (
              <div>
                <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
                  <Text style={{ fontSize: 12, color: '#52c41a' }}>
                    💡 已选择 {selectedPatterns.size} 个图案，可分别为每个颜色变体设置数量和面积
                  </Text>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                        <th style={{ padding: 8, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>图案</th>
                        <th style={{ padding: 8, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>颜色变体</th>
                        <th style={{ padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>计价模式</th>
                        <th style={{ padding: 8, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>数量/面积</th>
                        <th style={{ padding: 8, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>小计</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(selectedPatterns.values()).flatMap((patternInfo) =>
                        Array.from(patternInfo.selectedVariants.values()).map((variant) => {
                          const price = calculateVariantPrice(patternInfo.pattern, variant);
                          const hasValue = (variant.pricingMode === 'QUANTITY' && variant.quantity > 0) ||
                                         (variant.pricingMode === 'AREA' && variant.area > 0);

                          return (
                            <tr key={`${patternInfo.pattern.id}-${variant.colorVariantId}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              {/* 图案信息 */}
                              <td style={{ padding: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 12 }}>{patternInfo.pattern.name}</div>
                                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{patternInfo.pattern.code}</div>
                                </div>
                              </td>

                              {/* 颜色变体 */}
                              <td style={{ padding: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {variant.colorVariant.image ? (
                                    <img
                                      src={variant.colorVariant.image}
                                      alt={variant.colorVariant.name}
                                      style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #d9d9d9', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 4,
                                        backgroundColor: variant.colorVariant.color || '#f0f0f0',
                                        border: '1px solid #d9d9d9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {!variant.colorVariant.color && <FormatPainterOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />}
                                    </div>
                                  )}
                                  <span style={{ fontSize: 12 }}>{variant.colorVariant.name}</span>
                                  {variant.colorVariant.isDefault && <Tag color="blue" style={{ fontSize: 9, padding: '0 4px' }}>默认</Tag>}
                                </div>
                              </td>

                              {/* 计价模式 */}
                              <td style={{ padding: 8, textAlign: 'center' }}>
                                <Radio.Group
                                  value={variant.pricingMode}
                                  onChange={(e) => handleColorVariantPricingModeChange(patternInfo.pattern.id, variant.colorVariantId, e.target.value)}
                                  size="small"
                                  buttonStyle="solid"
                                >
                                  <Radio.Button value="QUANTITY" style={{ fontSize: 10, padding: '0 6px' }}>数量</Radio.Button>
                                  <Radio.Button value="AREA" style={{ fontSize: 10, padding: '0 6px' }}>面积</Radio.Button>
                                </Radio.Group>
                              </td>

                              {/* 数量/面积输入 */}
                              <td style={{ padding: 8, textAlign: 'center' }}>
                                <InputNumber
                                  size="small"
                                  min={0}
                                  step={variant.pricingMode === 'AREA' ? 0.1 : 1}
                                  value={variant.pricingMode === 'QUANTITY' ? variant.quantity : variant.area}
                                  onChange={(value) => {
                                    const numValue = value || 0;
                                    if (variant.pricingMode === 'QUANTITY') {
                                      handleColorVariantQuantityChange(patternInfo.pattern.id, variant.colorVariantId, numValue);
                                    } else {
                                      handleColorVariantAreaChange(patternInfo.pattern.id, variant.colorVariantId, numValue);
                                    }
                                  }}
                                  placeholder={variant.pricingMode === 'AREA' ? '面积' : '数量'}
                                  style={{ width: 70 }}
                                />
                              </td>

                              {/* 小计 */}
                              <td style={{ padding: 8, textAlign: 'right' }}>
                                <Text style={{ color: hasValue ? '#52c41a' : '#8c8c8c', fontWeight: hasValue ? 600 : 400, fontSize: 12 }}>
                                  {hasValue ? `¥${price.toFixed(2)}` : '-'}
                                </Text>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 总计信息 */}
                <div style={{ padding: 12, backgroundColor: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ color: '#52c41a', fontSize: 14 }}>
                      总计: ¥{calculateTotalPrice().toFixed(2)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {calculateTotalStats().totalCount} 个图案
                    </Text>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
                <FormatPainterOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16 }}>请从左侧选择图案</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // 单选模式
        <div style={{ maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 搜索区域 */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <Search
              placeholder="搜索图案名称或编号..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="选择客户"
              allowClear
              value={selectedCustomerFilter}
              onChange={setSelectedCustomerFilter}
              style={{ width: 180 }}
              options={[
                { label: '全部客户', value: undefined },
                ...customers.map((c) => ({ label: c.name, value: c.id }))
              ]}
            />
          </div>

          {/* 图案列表 */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            {patternsLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" tip="加载图案中...">
                  <div style={{ minHeight: 100 }} />
                </Spin>
              </div>
            ) : filteredPatterns.length > 0 ? (
              <Row gutter={[8, 0]}>{filteredPatterns.map(renderPatternCard)}</Row>
            ) : (
              <Empty description="未找到符合条件的图案" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
            )}
          </div>

          {/* 单选模式的设置区域 */}
          {selectedPattern && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Card
                size="small"
                title={
                  <Space>
                    <Text strong>已选择: {selectedPattern.name}</Text>
                    <Tag color="blue">{selectedPattern.code}</Tag>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                {/* 颜色变体选择 */}
                {selectedPattern.colorVariants.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ marginBottom: 8, display: 'block' }}>
                      选择颜色:
                    </Text>
                    <Radio.Group
                      value={selectedColorVariant?.id}
                      onChange={(e) => {
                        const variant = selectedPattern.colorVariants.find((cv) => cv.id === e.target.value);
                        setSelectedColorVariant(variant || null);
                      }}
                      style={{ width: '100%' }}
                    >
                      <Space vertical style={{ width: '100%' }}>
                        {selectedPattern.colorVariants.map((variant) => (
                          <Radio key={variant.id} value={variant.id}>
                            <Space>
                              {variant.image ? (
                                <img
                                  src={variant.image}
                                  alt={variant.name}
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    border: '1px solid #d9d9d9',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    backgroundColor: variant.color,
                                    border: '1px solid #d9d9d9',
                                  }}
                                />
                              )}
                              <Text>{variant.name}</Text>
                              {variant.isDefault && <Tag color="blue">默认</Tag>}
                            </Space>
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </div>
                ) : (
                  <div style={{ marginBottom: 16, color: '#8c8c8c' }}>该图案暂无颜色变体</div>
                )}

                {/* 计价模式选择 */}
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ marginBottom: 8, display: 'block' }}>
                    计价方式:
                  </Text>
                  <Radio.Group value={internalMode} onChange={(e) => setInternalMode(e.target.value)} buttonStyle="solid" size="small">
                    <Radio.Button value="QUANTITY">按数量</Radio.Button>
                    <Radio.Button value="AREA">按面积</Radio.Button>
                  </Radio.Group>
                </div>

                {/* 数量/面积输入 */}
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ marginBottom: 8, display: 'block' }}>
                    {internalMode === 'QUANTITY' ? '数量:' : '面积:'}
                  </Text>
                  <Row gutter={8} align="middle">
                    <Col flex="auto">
                      <InputNumber
                        type="number"
                        min={0}
                        step={internalMode === 'AREA' ? 0.1 : 1}
                        value={internalMode === 'QUANTITY' ? quantity : area}
                        onChange={(value) => {
                          const numValue = value || 0;
                          if (internalMode === 'QUANTITY') {
                            setQuantity(numValue);
                          } else {
                            setArea(numValue);
                          }
                        }}
                        placeholder={internalMode === 'AREA' ? '请输入面积' : '请输入数量'}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col>
                      <Space vertical size={4}>
                        <Button
                          size="small"
                          onClick={() => {
                            if (internalMode === 'QUANTITY') {
                              setQuantity(Math.max(0, quantity - 1));
                            } else {
                              setArea(Math.max(0, area - 0.5));
                            }
                          }}
                        >
                          -
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            if (internalMode === 'QUANTITY') {
                              setQuantity(quantity + 1);
                            } else {
                              setArea(area + 0.5);
                            }
                          }}
                        >
                          +
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            if (internalMode === 'QUANTITY') {
                              setQuantity(10);
                            } else {
                              setArea(5);
                            }
                          }}
                        >
                          常用值
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </div>

                {/* 价格预览 */}
                <div
                  style={{
                    padding: 12,
                    backgroundColor: '#f6ffed',
                    borderRadius: 6,
                    border: '1px solid #b7eb8f',
                  }}
                >
                  <Text strong style={{ color: '#52c41a' }}>
                    预计价格: ¥{calculatePrice().toFixed(2)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {internalMode === 'QUANTITY'
                      ? `单价 ¥${(calculatePrice() / (quantity || 1)).toFixed(2)} × ${quantity}件`
                      : `¥${customerUnitPrice}/m² × ${area}m²`}
                  </Text>
                </div>
              </Card>
            </>
          )}

          {/* 底部按钮 */}
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  onCancel();
                  resetSelection();
                }}
              >
                取消
              </Button>
              <Button type="primary" onClick={handleConfirm} disabled={!selectedPattern || (internalMode === 'QUANTITY' ? quantity <= 0 : area <= 0)}>
                确认选择
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* 多选模式底部按钮 */}
      {allowMultiple && (
        <div style={{ textAlign: 'right', marginTop: 16, borderTop: '1px solid #e8e8e8', paddingTop: 12 }}>
          <Space>
            <Button
              onClick={() => {
                onCancel();
                resetSelection();
              }}
            >
              取消
            </Button>
            <Button type="primary" onClick={handleConfirm} disabled={selectedPatterns.size === 0}>
              确认选择 ({selectedPatterns.size} 个图案)
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

// 导出类型供外部使用
export type { SelectedPatternInfo };

export default EnhancedPatternSelector;
