/**
 * 添加产品到订单弹窗组件
 * 用于将产品（如衣服、辅料等）添加到订单中
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  InputNumber,
  App,
  Space,
  Tag,
  Button,
  Typography,
  Select,
} from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';
import { ProductApi, OrderApi, CustomerApi } from '@/services/tauriApi';
import type { Product, Order, Customer } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface AddProductToOrderModalProps {
  visible: boolean;
  customerId?: string; // 可选：预选的客户ID
  onSuccess: () => void;
  onCancel: () => void;
}

interface ProductWithQuantity {
  product: Product;
  quantity: number;
}

export default function AddProductToOrderModal({
  visible,
  customerId,
  onSuccess,
  onCancel,
}: AddProductToOrderModalProps) {
  const { message } = App.useApp();

  // 数据状态
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 表单状态
  const [orderMode, setOrderMode] = useState<'existing' | 'new'>('existing');
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(customerId);
  const [productQuantities, setProductQuantities] = useState<Map<string, ProductWithQuantity>>(new Map());

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!visible) return;

      setLoading(true);
      try {
        // 1. 加载产品列表
        const allProducts = await ProductApi.getAll();
        setProducts(allProducts);

        // 2. 加载客户列表
        const allCustomers = await CustomerApi.getAll();
        setCustomers(allCustomers);

        // 设置默认客户ID
        if (customerId) {
          setSelectedCustomerId(customerId);
        }

        // 3. 加载该客户的未确认订单
        if (customerId) {
          const allOrders = await OrderApi.getAll();
          const customerOrders = allOrders.filter(
            (o) => o.customerId === customerId && !o.isConfirmed
          );
          setOrders(customerOrders);
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
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [visible, customerId, message]);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setOrderMode('existing');
      setSelectedOrderId(undefined);
      setSelectedCustomerId(customerId);
      setProductQuantities(new Map());
    }
  }, [visible, customerId]);

  // 当客户ID变化时，加载该客户的订单
  useEffect(() => {
    const loadCustomerOrders = async () => {
      if (!selectedCustomerId) {
        setOrders([]);
        return;
      }

      try {
        const allOrders = await OrderApi.getAll();
        const customerOrders = allOrders.filter(
          (o) => o.customerId === selectedCustomerId && !o.isConfirmed
        );
        setOrders(customerOrders);
        if (customerOrders.length > 0) {
          setSelectedOrderId(customerOrders[0].id);
          setOrderMode('existing');
        } else {
          setOrderMode('new');
        }
      } catch (error) {
        console.error('加载订单失败:', error);
      }
    };

    loadCustomerOrders();
  }, [selectedCustomerId]);

  // 更新产品数量
  const updateProductQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setProductQuantities(prev => {
      const newMap = new Map(prev);
      if (quantity > 0) {
        newMap.set(productId, { product, quantity });
      } else {
        newMap.delete(productId);
      }
      return newMap;
    });
  };

  // 计算小计
  const calculateSubtotal = (price: number, quantity: number) => {
    return price * quantity;
  };

  // 提交
  const handleSubmit = async () => {
    const itemsToAdd = Array.from(productQuantities.values()).filter(item => item.quantity > 0);

    if (itemsToAdd.length === 0) {
      message.error('请至少选择一个产品并设置数量');
      return;
    }

    if (!selectedCustomerId) {
      message.error('请选择客户');
      return;
    }

    if (orderMode === 'existing' && !selectedOrderId) {
      message.error('请选择要添加的订单');
      return;
    }

    setSubmitting(true);
    try {
      // 调用后端 API 添加产品到订单
      const productItems = itemsToAdd.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      await ProductApi.addProductsToOrder({
        orderId: orderMode === 'existing' ? selectedOrderId : undefined,
        customerId: selectedCustomerId,
        productItems,
      });

      message.success('产品已添加到订单');
      onSuccess();
      handleCancel();
    } catch (error) {
      console.error('添加产品失败:', error);
      message.error('操作失败: ' + error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOrderMode('existing');
    setSelectedOrderId(undefined);
    setSelectedCustomerId(customerId);
    setProductQuantities(new Map());
    onCancel();
  };

  // 表格列定义
  const columns = [
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price: number) => (
        <Text strong>¥{price.toFixed(2)}</Text>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      render: (unit: string) => <Tag>{unit}</Tag>,
    },
    {
      title: '数量',
      key: 'quantity',
      width: 120,
      render: (_: unknown, record: Product) => {
        const item = productQuantities.get(record.id);
        const quantity = item?.quantity || 0;
        return (
          <InputNumber
            min={0}
            value={quantity}
            onChange={(value) => updateProductQuantity(record.id, value || 0)}
            style={{ width: '100%' }}
            placeholder={`最大${record.unit}`}
          />
        );
      },
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 100,
      render: (_: unknown, record: Product) => {
        const item = productQuantities.get(record.id);
        const quantity = item?.quantity || 0;
        const subtotal = calculateSubtotal(record.price, quantity);
        return quantity > 0 ? (
          <Text strong type="success">¥{subtotal.toFixed(2)}</Text>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
  ];

  // 计算总金额
  const totalAmount = Array.from(productQuantities.values()).reduce(
    (sum, item) => sum + calculateSubtotal(item.product.price, item.quantity),
    0
  );

  return (
    <Modal
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      width={800}
      title={
        <Space>
          <ShoppingOutlined />
          添加产品到订单
        </Space>
      }
      okText="确定添加"
      cancelText="取消"
    >
      {/* 客户选择 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text>客户：</Text>
          <Select
            style={{ width: 250 }}
            placeholder="请选择客户"
            value={selectedCustomerId}
            onChange={(value) => setSelectedCustomerId(value)}
            showSearch
            allowClear
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={customers.map(c => ({ label: c.name, value: c.id }))}
          />
        </Space>
      </div>

      {/* 订单选择 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text>添加到：</Text>
          <Button
            type={orderMode === 'existing' ? 'primary' : 'default'}
            onClick={() => setOrderMode('existing')}
            disabled={orders.length === 0}
          >
            现有订单 ({orders.length}个)
          </Button>
          <Button
            type={orderMode === 'new' ? 'primary' : 'default'}
            onClick={() => setOrderMode('new')}
          >
            新建订单
          </Button>
        </Space>

        {orderMode === 'existing' && orders.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
            <Text type="secondary">选择订单：</Text>
            <Space wrap style={{ marginTop: 4 }}>
              {orders.map(order => (
                <Tag
                  key={order.id}
                  color={selectedOrderId === order.id ? 'blue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  {order.orderNumber} ({dayjs(order.createdAt).format('MM-DD')})
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </div>

      {/* 产品列表 */}
      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无产品，请先到产品管理中添加产品' }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <Text strong>合计</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} />
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3}>
              <Text>
                {Array.from(productQuantities.values()).reduce((sum, item) => sum + item.quantity, 0)} 件
              </Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4}>
              <Text strong type="success" style={{ fontSize: 16 }}>
                ¥{totalAmount.toFixed(2)}
              </Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
    </Modal>
  );
}
