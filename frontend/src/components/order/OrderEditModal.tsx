/**
 * 订单完整编辑弹窗组件
 * 支持编辑客户、订单项（添加/删除/修改图案和颜色变体）、备注
 * 订单状态通过"确认并生产"按钮控制
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Button,
  Table,
  InputNumber,
  App,
  Tag,
  Radio,
  Card,
  Row,
  Col,
  Statistic,
  Input,
  Popconfirm,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CustomerApi, OrderApi, PatternApi } from '@/services/tauriApi';
import type { Customer, Pattern, PricingMode, CreateOrderItemRequest, PatternColor } from '@/types';
import EnhancedPatternSelector, { type SelectedPatternInfo } from '@/components/pattern/EnhancedPatternSelector';

interface OrderEditModalProps {
  visible: boolean;
  orderId?: string;
  customerId?: string; // 新建订单时传入
  mode: 'create' | 'edit';
  onSuccess: () => void;
  onCancel: () => void;
}

  interface OrderItemRow extends CreateOrderItemRequest {
    key: string;
    patternName: string;
    colorVariantName?: string;
    colorVariants?: Array<{
      colorVariantId: string;
      colorVariant: PatternColor;
      quantity: number;
      area: number;
    }>;
  }

export default function OrderEditModal({
  visible,
  orderId,
  customerId: propCustomerId,
  mode,
  onSuccess,
  onCancel,
}: OrderEditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patternSelectorVisible, setPatternSelectorVisible] = useState(false);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [customersData, patternsData] = await Promise.all([
          CustomerApi.getAll(),
          PatternApi.getAll(),
        ]);
        setCustomers(customersData.filter((c) => c.isActive));
        setPatterns(patternsData.filter((p) => p.isActive));
      } catch (error) {
        message.error('加载数据失败: ' + error);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      loadData();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载订单数据（编辑模式）
  useEffect(() => {
    const loadOrderData = async () => {
      if (mode === 'edit' && orderId) {
        setLoading(true);
        try {
          const order = await OrderApi.getById(orderId);
          if (order) {
            form.setFieldsValue({
              customerId: order.customerId,
              notes: order.notes,
            });

            // 转换订单项为表格行
            const items: OrderItemRow[] = await Promise.all(
              order.items.map(async (item) => {
                return {
                  key: item.id,
                  patternId: item.patternId,
                  quantity: item.quantity,
                  area: item.area,
                  pricingMode: item.pricingMode,
                  patternName: item.patternName,
                };
              })
            );
            setOrderItems(items);
          }
        } catch (error) {
          message.error('加载订单失败: ' + error);
        } finally {
          setLoading(false);
        }
      } else if (mode === 'create' && propCustomerId) {
        // 新建模式，预设客户
        form.setFieldValue('customerId', propCustomerId);
        setOrderItems([]);
      }
    };

    if (visible && patterns.length > 0) {
      loadOrderData();
    }
  }, [visible, mode, orderId, propCustomerId, patterns]); // eslint-disable-line react-hooks/exhaustive-deps

  // 获取当前客户单价
  const currentCustomerId = Form.useWatch('customerId', form);
  const currentCustomer = customers.find((c) => c.id === currentCustomerId);
  const customerUnitPrice = currentCustomer?.unitPrice || 18;

  // 计算总金额（使用与后端一致的公式）
  const totalAmount = orderItems.reduce((sum, item) => {
    const pattern = patterns.find((p) => p.id === item.patternId);
    if (!pattern) return sum;

    // 前端数据：actualHeight 和 bleedHeight 是厘米
    // 需要转换为毫米进行计算
    const totalHeightMM = (pattern.actualHeight + pattern.bleedHeight) * 10;
    const denominator = (1600 / totalHeightMM) * pattern.unitsPerRow;
    const unitPrice = customerUnitPrice / denominator;

    if (item.pricingMode === 'QUANTITY') {
      return sum + unitPrice * item.quantity;
    } else {
      return sum + customerUnitPrice * (item.area || 0);
    }
  }, 0);

  // 添加订单项
  const handleAddOrderItem = () => {
    setPatternSelectorVisible(true);
  };

  // 从选择器确认
  const handlePatternConfirm = async (
    pattern: Pattern,
    colorVariant?: PatternColor,
    quantity?: number,
    area?: number
  ) => {
    const newItem: OrderItemRow = {
      key: Date.now().toString(),
      patternId: pattern.id,
      patternName: pattern.name,
      quantity: quantity || 1,
      area: area || 0,
      pricingMode: quantity && quantity > 0 ? 'QUANTITY' : 'AREA',
    };

    // 如果选择了颜色变体，记录颜色变体信息
    if (colorVariant) {
      newItem.colorVariantName = colorVariant.name;
      newItem.colorVariants = [{
        colorVariantId: colorVariant.id,
        colorVariant: colorVariant,
        quantity: quantity || 1,
        area: area || 0,
      }];
    }

    setOrderItems([...orderItems, newItem]);
    setPatternSelectorVisible(false);
  };

  // 删除订单项
  const handleDeleteOrderItem = (key: string) => {
    setOrderItems(orderItems.filter((item) => item.key !== key));
  };

  // 更新订单项
  const handleUpdateOrderItem = (key: string, field: string, value: string | number | PricingMode | undefined) => {
    setOrderItems(
      orderItems.map((item) =>
        item.key === key ? { ...item, [field]: value } : item
      )
    );
  };

  // 提交表单
  const handleSubmit = async () => {
    console.log('[订单提交] handleSubmit 开始执行');
    try {
      const values = await form.validateFields();
      console.log('[订单提交] 表单验证通过:', values);

      if (orderItems.length === 0) {
        message.error('请至少添加一个订单项');
        return;
      }

      setSubmitting(true);

      const createOrderRequest = {
        customerId: values.customerId,
        items: orderItems.map((item) => {
          // 从 colorVariants 数组中提取 colorVariantId
          const colorVariantId = item.colorVariants && item.colorVariants.length > 0
            ? item.colorVariants[0].colorVariantId
            : undefined;

          console.log('[订单创建] 订单项:', {
            patternId: item.patternId,
            patternName: item.patternName,
            colorVariantId,
            quantity: item.quantity,
          });

          return {
            patternId: item.patternId,
            quantity: item.quantity,
            area: item.area,
            pricingMode: item.pricingMode,
            colorVariantId, // 新增：传递颜色变体ID
          };
        }),
        notes: values.notes,
      };

      console.log('[订单创建] 完整请求:', createOrderRequest);

      if (mode === 'create') {
        console.log('[订单创建] 开始调用 OrderApi.create');
        const result = await OrderApi.create(createOrderRequest);
        console.log('[订单创建] OrderApi.create 成功，返回:', result);
        message.success('订单创建成功');
      } else {
        console.log('[订单更新] 开始调用 OrderApi.updateFull');
        const result = await OrderApi.updateFull({
          id: orderId!,
          ...createOrderRequest,
        });
        console.log('[订单更新] OrderApi.updateFull 成功，返回:', result);
        message.success('订单更新成功');
      }

      console.log('[订单提交] 准备调用 onSuccess 回调');
      onSuccess();
      console.log('[订单提交] onSuccess 回调完成');
      handleCancel();
    } catch (error) {
      console.error('[订单提交] 错误:', error);
      message.error('操作失败: ' + error);
    } finally {
      setSubmitting(false);
      console.log('[订单提交] handleSubmit 结束');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setOrderItems([]);
    onCancel();
  };

  // 订单项表格列
  const columns = [
    {
      title: '图案',
      key: 'pattern',
      width: 200,
      render: (_: unknown, record: OrderItemRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.patternName}</div>
          {record.colorVariantName && (
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              颜色: {record.colorVariantName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '计价模式',
      dataIndex: 'pricingMode',
      key: 'pricingMode',
      width: 120,
      render: (mode: PricingMode, record: OrderItemRow) => (
        <Radio.Group
          value={mode}
          size="small"
          onChange={(e) => handleUpdateOrderItem(record.key, 'pricingMode', e.target.value)}
        >
          <Radio.Button value="QUANTITY">数量</Radio.Button>
          <Radio.Button value="AREA">面积</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: '数量/面积',
      key: 'input',
      width: 150,
      render: (_: unknown, record: OrderItemRow) => (
        <InputNumber
          type="number"
          min={0}
          step={record.pricingMode === 'AREA' ? 0.1 : 1}
          value={record.pricingMode === 'QUANTITY' ? record.quantity : record.area}
          onChange={(value) => {
            const numValue = value || 0;
            if (record.pricingMode === 'QUANTITY') {
              handleUpdateOrderItem(record.key, 'quantity', numValue);
            } else {
              handleUpdateOrderItem(record.key, 'area', numValue);
            }
          }}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 100,
      render: (_: unknown, record: OrderItemRow) => {
        const pattern = patterns.find((p) => p.id === record.patternId);
        if (!pattern) return '-';

        // 使用与后端一致的价格计算公式
        const totalHeightMM = (pattern.actualHeight + pattern.bleedHeight) * 10;
        const denominator = (1600 / totalHeightMM) * pattern.unitsPerRow;
        const unitPrice = customerUnitPrice / denominator;

        const subtotal =
          record.pricingMode === 'QUANTITY'
            ? unitPrice * record.quantity
            : customerUnitPrice * (record.area || 0);

        return <Tag color="green">¥{subtotal.toFixed(2)}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: OrderItemRow) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除这个订单项吗？"
          onConfirm={() => handleDeleteOrderItem(record.key)}
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={mode === 'create' ? '新建订单' : '编辑订单'}
        open={visible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={submitting}
        loading={loading}
        width={900}
        okText={mode === 'create' ? '创建' : '保存'}
      >
        <Form form={form} layout="vertical">
          {/* 第一行：客户和状态 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="客户"
                name="customerId"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <Select
                  placeholder="请选择客户"
                  showSearch
                  optionFilterProp="children"
                  disabled={mode === 'edit'} // 编辑模式不允许修改客户
                >
                  {customers.map((customer) => (
                    <Select.Option key={customer.id} value={customer.id}>
                      {customer.name} (单价: ¥{customer.unitPrice}/m²)
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 订单项表格 */}
          <Card
            size="small"
            title="订单项"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddOrderItem}
                disabled={!currentCustomerId}
              >
                添加订单项
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={orderItems}
              columns={columns}
              rowKey="key"
              size="small"
              pagination={false}
              locale={{ emptyText: '请添加订单项' }}
            />
          </Card>

          {/* 金额汇总 */}
          {orderItems.length > 0 && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic
                  title="客户单价"
                  value={customerUnitPrice}
                  prefix="¥"
                  suffix="/m²"
                  precision={2}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="订单总额"
                  value={totalAmount}
                  prefix="¥"
                  precision={2}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
            </Row>
          )}

          {/* 备注 */}
          <Form.Item label="备注" name="notes">
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 图案选择器 - 批量选择模式 */}
      <EnhancedPatternSelector
        visible={patternSelectorVisible}
        onCancel={() => setPatternSelectorVisible(false)}
        onConfirm={handlePatternConfirm}
        onConfirmMultiple={(selectedPatterns) => {
          // 处理批量选择：将所有选中的颜色变体转换为订单项
          const newItems: OrderItemRow[] = [];

          selectedPatterns.forEach((patternInfo) => {
            // selectedVariants 是 Map<string, ColorVariantItem>
            patternInfo.selectedVariants.forEach((variant) => {
              // 只添加有数量或面积的变体
              if ((variant.pricingMode === 'QUANTITY' && variant.quantity > 0) ||
                  (variant.pricingMode === 'AREA' && variant.area > 0)) {
                newItems.push({
                  key: `${Date.now()}-${Math.random()}`,
                  patternId: patternInfo.pattern.id,
                  patternName: patternInfo.pattern.name,
                  quantity: variant.quantity,
                  area: variant.area,
                  pricingMode: variant.pricingMode,
                  colorVariantName: variant.colorVariant.name,
                  colorVariants: [{
                    colorVariantId: variant.colorVariantId,
                    colorVariant: variant.colorVariant,
                    quantity: variant.quantity,
                    area: variant.area,
                  }],
                });
              }
            });
          });

          setOrderItems([...orderItems, ...newItems]);
          setPatternSelectorVisible(false);
        }}
        patterns={patterns}
        mode={orderItems.length > 0 ? orderItems[0].pricingMode : 'QUANTITY'}
        customerUnitPrice={customerUnitPrice}
        customerId={currentCustomerId}
        customerName={currentCustomer?.name}
        allowMultiple={true}
      />
    </>
  );
}
