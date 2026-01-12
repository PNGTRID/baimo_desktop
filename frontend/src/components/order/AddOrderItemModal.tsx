/**
 * 添加订单项弹窗组件
 * 用于快捷下单功能：选择添加到现有订单或创建新订单
 * 支持选择颜色变体、设置数量等参数
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Radio,
  App,
  Space,
  Tag,
  Select,
  InputNumber,
  Typography,
  Empty,
  Spin,
  Image,
} from 'antd';
import { ShoppingCartOutlined, FileImageOutlined } from '@ant-design/icons';
import { OrderApi, PatternApi, CustomerApi, PatternColorApi } from '@/services/tauriApi';
import type { Order, Pattern, PatternColor, PricingMode, Customer } from '@/types';
import { PatternPreviewPopover } from '@/components/pattern/PatternPreviewPopover';
import dayjs from 'dayjs';

const { Text } = Typography;

interface AddOrderItemModalProps {
  visible: boolean;
  preselectedPattern: Pattern | null; // 预选的图案
  onSuccess: () => void;
  onCancel: () => void;
}

interface ColorVariantWithQuantity {
  colorVariant: PatternColor;
  quantity: number;
  area: number;
  pricingMode: PricingMode;
}

export default function AddOrderItemModal({
  visible,
  preselectedPattern,
  onSuccess,
  onCancel,
}: AddOrderItemModalProps) {
  const { message } = App.useApp();

  // 数据状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]); // 客户列表
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>(''); // 图案预览图
  const [previewLoading, setPreviewLoading] = useState(false);

  // 表单状态
  const [orderMode, setOrderMode] = useState<'existing' | 'new'>('existing');
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined); // 创建新订单时选择的客户
  const [variantQuantities, setVariantQuantities] = useState<Map<string, ColorVariantWithQuantity>>(new Map());

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!visible || !preselectedPattern) {
        return;
      }

      setLoading(true);
      setPreviewLoading(true);
      try {
        // 1. 加载图案详情（包含颜色变体）
        const patternData = await PatternApi.getById(preselectedPattern.id);
        if (!patternData) {
          message.error('图案不存在');
          onCancel();
          return;
        }
        setPattern(patternData);

        // 加载预览图
        try {
          let imageUrl = '';
          if (patternData.previewImage) {
            imageUrl = patternData.previewImage;
          } else if (patternData.localFilePath) {
            imageUrl = await PatternApi.getPatternImage(patternData.localFilePath);
          }
          setPreviewImage(imageUrl);
        } catch (err) {
          console.error('加载预览图失败:', err);
          setPreviewImage('');
        } finally {
          setPreviewLoading(false);
        }

        // 2. 加载客户列表
        const allCustomers = await CustomerApi.getAll();
        setCustomers(allCustomers);

        // 3. 加载并设置客户名称，同时设置默认选中的客户ID
        if (patternData.customerId) {
          const customer = await CustomerApi.getById(patternData.customerId);
          if (customer) {
            setCustomerName(customer.name);
          }
          // 设置默认选中的客户ID为图案的所属客户
          setSelectedCustomerId(patternData.customerId);
        } else {
          setCustomerName('');
          setSelectedCustomerId(undefined);
        }

        // 4. 加载该客户的未确认订单
        if (patternData.customerId) {
          const allOrders = await OrderApi.getAll();
          const customerOrders = allOrders.filter(
            (o) => o.customerId === patternData.customerId && !o.isConfirmed
          );
          setOrders(customerOrders);

          // 如果有未确认订单，默认选择最新的一个
          if (customerOrders.length > 0) {
            setSelectedOrderId(customerOrders[0].id);
            setOrderMode('existing');
          } else {
            setOrderMode('new');
          }
        } else {
          setOrders([]);
          setOrderMode('new');
        }

        // 5. 加载颜色变体（直接尝试加载）
        try {
          const variants = await PatternColorApi.getByPatternId(preselectedPattern.id);
          if (variants.length > 0) {
            // 初始化颜色变体的数量（默认为0）
            const initialQuantities = new Map<string, ColorVariantWithQuantity>();
            variants.forEach((v) => {
              initialQuantities.set(v.id, {
                colorVariant: v,
                quantity: 0,
                area: 0,
                pricingMode: 'QUANTITY',
              });
            });
            setVariantQuantities(initialQuantities);
          } else {
            // 没有颜色变体，添加一个默认的图案项
            const defaultQuantities = new Map<string, ColorVariantWithQuantity>();
            defaultQuantities.set('default', {
              colorVariant: {
                id: '',
                patternId: preselectedPattern.id,
                name: '默认',
                color: '',
                isDefault: true,
                isActive: true,
                createdAt: '',
                updatedAt: '',
              },
              quantity: 0,
              area: 0,
              pricingMode: 'QUANTITY',
            });
            setVariantQuantities(defaultQuantities);
          }
        } catch (error) {
          console.log('该图案暂无颜色变体');
          // 没有颜色变体，添加一个默认的图案项
          const defaultQuantities = new Map<string, ColorVariantWithQuantity>();
          defaultQuantities.set('default', {
            colorVariant: {
              id: '',
              patternId: preselectedPattern.id,
              name: '默认',
              color: '',
              isDefault: true,
              isActive: true,
              createdAt: '',
              updatedAt: '',
            },
            quantity: 0,
            area: 0,
            pricingMode: 'QUANTITY',
          });
          setVariantQuantities(defaultQuantities);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败: ' + error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [visible, preselectedPattern, message, onCancel]);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setOrderMode('existing');
      setSelectedOrderId(undefined);
      setSelectedCustomerId(undefined);
      setVariantQuantities(new Map());
      setPreviewImage('');
      setPreviewLoading(false);
    }
  }, [visible]);

  // 更新颜色变体的数量
  const updateVariantQuantity = (variantId: string, field: 'quantity' | 'area' | 'pricingMode', value: number | PricingMode) => {
    setVariantQuantities((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(variantId);
      if (current) {
        newMap.set(variantId, { ...current, [field]: value });
      }
      return newMap;
    });
  };

  // 提交添加订单项
  const handleSubmit = async () => {
    // 过滤出有数量的颜色变体
    const variantsToAdd = Array.from(variantQuantities.values()).filter(
      (v) => (v.pricingMode === 'QUANTITY' && v.quantity > 0) || (v.pricingMode === 'AREA' && v.area > 0)
    );

    if (variantsToAdd.length === 0) {
      message.error('请至少选择一个颜色并设置数量');
      return;
    }

    if (orderMode === 'existing' && !selectedOrderId) {
      message.error('请选择要添加的订单');
      return;
    }

    setSubmitting(true);
    try {
      if (orderMode === 'existing') {
        // 添加到现有订单 - 使用 updateFull
        const existingOrder = await OrderApi.getById(selectedOrderId!);
        if (!existingOrder) {
          message.error('订单不存在');
          return;
        }

        // 获取现有订单项并添加新的
        const newItems = variantsToAdd.map((variant) => ({
          patternId: preselectedPattern!.id,
          colorVariantId: variant.colorVariant.id || undefined, // 空字符串转为 undefined
          quantity: variant.quantity,
          area: variant.area,
          pricingMode: variant.pricingMode,
        }));

        // 合并现有订单项和新订单项
        const existingItems = existingOrder.items.map(item => ({
          patternId: item.patternId,
          colorVariantId: item.colorVariantId,
          quantity: item.quantity,
          area: item.area,
          pricingMode: item.pricingMode,
        }));

        await OrderApi.updateFull({
          id: selectedOrderId!,
          customerId: existingOrder.customerId,
          items: [...existingItems, ...newItems],
          notes: existingOrder.notes || '',
        });
        message.success(`成功添加 ${variantsToAdd.length} 个订单项`);
      } else {
        // 创建新订单
        if (!selectedCustomerId) {
          message.error('请选择客户');
          return;
        }

        const items = variantsToAdd.map((variant) => ({
          patternId: preselectedPattern!.id,
          colorVariantId: variant.colorVariant.id || undefined, // 空字符串转为 undefined
          quantity: variant.quantity,
          area: variant.area,
          pricingMode: variant.pricingMode,
        }));

        await OrderApi.create({
          customerId: selectedCustomerId,
          items,
          notes: '',
        });
        message.success('订单创建成功');
      }

      onSuccess();
      handleCancel();
    } catch (error) {
      console.error('添加订单项失败:', error);
      message.error('操作失败: ' + error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOrderMode('existing');
    setSelectedOrderId(undefined);
    setSelectedCustomerId(undefined);
    setVariantQuantities(new Map());
    onCancel();
  };

  if (loading) {
    return (
      <Modal
        open={visible}
        onCancel={handleCancel}
        footer={null}
        width={700}
        title="添加订单项"
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>加载数据中...</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      width={650}
      title="添加订单项"
      okText="确定添加"
      cancelText="取消"
    >
      <div style={{ padding: '8px 0' }}>
        {/* 顶部信息栏 - 图案预览 + 图案信息 + 客户 */}
        {pattern && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {/* 预览图 */}
            <div
              style={{
                width: 100,
                height: 100,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {previewLoading ? (
                <Spin size="small" />
              ) : previewImage ? (
                <Image
                  src={previewImage}
                  alt={pattern.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  preview={{
                    src: previewImage,
                  }}
                />
              ) : (
                <FileImageOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
              )}
            </div>

            {/* 图案信息和客户 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <PatternPreviewPopover patternId={pattern.id} patternName={pattern.name}>
                <Text strong style={{ cursor: 'pointer', color: '#1890ff', fontSize: 15 }}>
                  {pattern.name}
                </Text>
              </PatternPreviewPopover>
              <Tag style={{ marginLeft: 8, fontFamily: 'Monaco, Consolas, monospace', fontSize: 11 }}>
                {pattern.code}
              </Tag>
              {selectedCustomerId && (
                <Tag icon={<ShoppingCartOutlined />} color="blue" style={{ fontSize: 12, marginTop: 4 }}>
                  {customers.find(c => c.id === selectedCustomerId)?.name || customerName}
                </Tag>
              )}
            </div>
          </div>
        )}

        {/* 订单选择和颜色变体并排布局 */}
        <div style={{ display: 'flex', gap: 12 }}>
          {/* 左侧：订单选择 */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
              订单选择
            </div>
            <Radio.Group
              value={orderMode}
              onChange={(e) => setOrderMode(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
              size="small"
            >
              <Space direction="vertical" size="small">
                <Radio value="existing" disabled={orders.length === 0}>
                  添加到现有订单
                </Radio>
                <Radio value="new">
                  创建新订单
                </Radio>
              </Space>
            </Radio.Group>

            {orderMode === 'existing' ? (
              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  padding: 8,
                  background: '#fafafa',
                }}
              >
                {orders.length === 0 ? (
                  <Empty
                    description="暂无进行中的订单"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '20px 0' }}
                  />
                ) : (
                  <Radio.Group
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    style={{ width: '100%' }}
                    size="small"
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {orders.map((order) => (
                        <Radio key={order.id} value={order.id} style={{ width: '100%' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 12,
                              padding: '4px 0',
                            }}
                          >
                            <Text strong style={{ fontSize: 12 }}>{order.orderNumber}</Text>
                            <Space size="small">
                              <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                                {order.items.length} 项
                              </Tag>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {dayjs(order.createdAt).format('MM-DD HH:mm')}
                              </Text>
                            </Space>
                          </div>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  background: '#fafafa',
                }}
              >
                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                  选择客户
                </div>
                <Select
                  value={selectedCustomerId}
                  onChange={setSelectedCustomerId}
                  placeholder="请选择客户"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={customers.map(c => ({ label: c.name, value: c.id }))}
                  style={{ width: '100%' }}
                  size="small"
                />
                {selectedCustomerId && (
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
                    将为客户「{customers.find(c => c.id === selectedCustomerId)?.name || '未知'}」创建新订单
                  </Text>
                )}
              </div>
            )}
          </div>

          {/* 右侧：颜色变体 */}
          {variantQuantities.size > 0 && (
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
                颜色变体
              </div>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  padding: 8,
                  background: '#fafafa',
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {Array.from(variantQuantities.entries()).map(([key, variantData]) => {
                    const variant = variantData.colorVariant;
                    return (
                      <div
                        key={key}
                        style={{
                          background: '#fff',
                          border: '1px solid #e8e8e8',
                          borderRadius: 6,
                          padding: 10,
                        }}
                      >
                        {/* 颜色名称 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {variant.color && (
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 4,
                                backgroundColor: variant.color,
                                border: '1px solid #d9d9d9',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Text strong style={{ fontSize: 13 }}>{variant.name}</Text>
                        </div>

                        {/* 计价模式和数量输入 */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Radio.Group
                            value={variantData.pricingMode}
                            onChange={(e) => updateVariantQuantity(key, 'pricingMode', e.target.value)}
                            size="small"
                          >
                            <Radio.Button value="QUANTITY" style={{ fontSize: 12 }}>数量</Radio.Button>
                            <Radio.Button value="AREA" style={{ fontSize: 12 }}>面积</Radio.Button>
                          </Radio.Group>

                          <InputNumber
                            min={0}
                            step={variantData.pricingMode === 'AREA' ? 0.1 : 1}
                            value={variantData.pricingMode === 'QUANTITY' ? variantData.quantity : variantData.area}
                            onChange={(value) => {
                              const numValue = value || 0;
                              if (variantData.pricingMode === 'QUANTITY') {
                                updateVariantQuantity(key, 'quantity', numValue);
                              } else {
                                updateVariantQuantity(key, 'area', numValue);
                              }
                            }}
                            style={{ flex: 1, fontSize: 12 }}
                            size="small"
                            placeholder={variantData.pricingMode === 'QUANTITY' ? '数量' : '面积(m²)'}
                          />
                        </div>
                      </div>
                    );
                  })}
                </Space>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
