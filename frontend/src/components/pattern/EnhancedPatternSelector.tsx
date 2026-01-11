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
} from 'antd';
import {
  SearchOutlined,
  FormatPainterOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { PatternColorApi } from '@/services/tauriApi';
import type { Pattern, PatternColor, PricingMode } from '@/types';

const { Search } = Input;
const { Text } = Typography;

// 扩展的 Pattern 类型，包含颜色变体
interface PatternWithVariants extends Pattern {
  colorVariants: PatternColor[];
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
  patterns: Pattern[];
  currentPatternId?: string;
  currentColorVariantId?: string;
  mode: PricingMode;
  isMobile?: boolean;
  customerUnitPrice?: number;
  customerId?: string;
  customerName?: string;
}

const EnhancedPatternSelector: React.FC<EnhancedPatternSelectorProps> = ({
  visible,
  onCancel,
  onConfirm,
  patterns,
  currentPatternId,
  currentColorVariantId,
  mode,
  isMobile = false,
  customerUnitPrice = 18,
}) => {
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<PatternWithVariants | null>(null);
  const [selectedColorVariant, setSelectedColorVariant] = useState<PatternColor | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [area, setArea] = useState<number>(0);
  const [internalMode, setInternalMode] = useState<PricingMode>(mode);
  const [patternsLoading, setPatternsLoading] = useState(false);

  // 加载带颜色变体的图案数据
  const [patternsWithVariants, setPatternsWithVariants] = useState<PatternWithVariants[]>([]);

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
  };

  // 获取筛选后的图案列表
  const getFilteredPatterns = () => {
    if (!patterns || !Array.isArray(patterns)) {
      return [];
    }

    let filtered = [...patternsWithVariants];

    // 搜索筛选
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (pattern) =>
          pattern.name.toLowerCase().includes(searchLower) ||
          pattern.code.toLowerCase().includes(searchLower)
      );
    }

    // 排序：激活的在前
    return filtered.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return 0;
    });
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
    setSelectedPattern(pattern);
    // 选择默认颜色变体
    const defaultVariant = pattern.colorVariants.find((cv) => cv.isDefault) || pattern.colorVariants[0];
    setSelectedColorVariant(defaultVariant || null);
  };

  // 处理确认选择
  const handleConfirm = () => {
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
  };

  // 计算价格
  const calculatePrice = () => {
    if (!selectedPattern) return 0;

    // 印花行业价格公式: 单价 = 客户单价 / ((实际高度 + 出血高度) / 1000 / 每行个数)
    const denominator = (selectedPattern.actualHeight + selectedPattern.bleedHeight) / 1000 / selectedPattern.unitsPerRow;
    const unitPrice = customerUnitPrice / denominator;

    if (internalMode === 'QUANTITY') {
      return unitPrice * quantity;
    } else {
      return customerUnitPrice * area;
    }
  };

  const filteredPatterns = getFilteredPatterns();

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
                <Tag color={pattern.isActive ? 'green' : 'default'} style={{ fontSize: 9, padding: '0 4px', margin: 0 }}>
                  {pattern.isActive ? '启用' : '禁用'}
                </Tag>
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

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>选择图案</span>
          {customerName && <span style={{ fontSize: '14px', color: '#1890ff', fontWeight: 'normal' }}>客户: {customerName}</span>}
        </div>
      }
      open={visible}
      onCancel={() => {
        onCancel();
        resetSelection();
      }}
      width={isMobile ? '95vw' : '90vw'}
      style={{ maxWidth: isMobile ? '400px' : '1200px', top: 20 }}
      footer={null}
    >
      <div style={{ maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索图案名称或编号..."
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 12 }}
            prefix={<SearchOutlined />}
          />
        </div>

        {/* 图案列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {patternsLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" tip="加载图案中..." />
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
    </Modal>
  );
};

export default EnhancedPatternSelector;
