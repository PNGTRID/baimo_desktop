import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Select,
  InputNumber,
  App,
  Card,
  Typography,
  Tag,
  Space,
  Popconfirm,
  Input,
  Row,
  Col,
  Statistic,
  DatePicker,
  Image,
  Upload,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  MinusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CameraOutlined,
  PictureOutlined,
  SearchOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { Order, Customer, CreateOrderItemRequest, PricingMode, Pattern, OrderStatus } from '@/types';
import { OrderApi, CustomerApi, PatternApi } from '@/services/tauriApi';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd';
import OrderEditModal from '@/components/order/OrderEditModal';
import CustomerDailyOrdersModal from '@/components/order/CustomerDailyOrdersModal';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface DailySummary {
  totalOrders: number;
  totalAmount: number;
  completedOrders: number;
  pendingOrders: number;
}

const orderColumns = (
  onEdit: (order: Order) => void,
  onDelete: (id: string) => void,
  onStatusChange: (id: string, status: OrderStatus) => void,
  onViewScreenshot: (order: Order) => void,
) => [
  { title: '订单号', dataIndex: 'orderNumber', key: 'orderNumber', width: 150 },
  { title: '客户名称', dataIndex: 'customerName', key: 'customerName', width: 150 },
  {
    title: '总金额',
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    width: 120,
    render: (value: number) => `¥${value.toFixed(2)}`,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 150,
    render: (status: string, record: Order) => {
      const statusMap: Record<string, { text: string; color: string }> = {
        PENDING: { text: '待确认', color: 'default' },
        CONFIRMED: { text: '已确认', color: 'blue' },
        IN_PROGRESS: { text: '进行中', color: 'processing' },
        COMPLETED: { text: '已完成', color: 'success' },
        CANCELLED: { text: '已取消', color: 'error' },
      };
      const statusInfo = statusMap[status] || { text: status, color: 'default' };
      return (
        <Select
          value={status}
          style={{ width: 120 }}
          onChange={(value) => onStatusChange(record.id, value)}
          options={Object.entries(statusMap).map(([key, { text }]) => ({
            label: text,
            value: key,
          }))}
        />
      );
    },
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    render: (_: unknown, record: Order) => (
      <Space size="small">
        <Button
          type="text"
          icon={<CameraOutlined />}
          onClick={() => onViewScreenshot(record)}
          title="查看截图"
        />
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEdit(record)}
          title="编辑"
        />
        <Popconfirm
          title="确认删除订单"
          description="删除后无法恢复，确定要删除这个订单吗？"
          onConfirm={() => onDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" danger icon={<DeleteOutlined />} title="删除" />
        </Popconfirm>
      </Space>
    ),
  },
];

const itemColumns = [
  { title: '图案名称', dataIndex: 'patternName', key: 'patternName' },
  {
    title: '数量',
    dataIndex: 'quantity',
    key: 'quantity',
    render: (value: number, record: CreateOrderItemRequest) => {
      if (record.pricingMode === 'AREA') {
        return `${value} 平方`;
      }
      return value;
    },
  },
  {
    title: '单价',
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    render: (value: number) => `¥${value.toFixed(2)}`,
  },
  {
    title: '总价',
    dataIndex: 'totalPrice',
    key: 'totalPrice',
    render: (value: number) => `¥${value.toFixed(2)}`,
  },
];

export default function Orders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<CreateOrderItemRequest[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form] = Form.useForm();

  // 统计数据状态
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    totalOrders: 0,
    totalAmount: 0,
    completedOrders: 0,
    pendingOrders: 0,
  });

  // 截图相关状态
  const [screenshotModalVisible, setScreenshotModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<UploadFile[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ]);

  // 计算当天订单汇总
  const calculateDailySummary = (orderList: Order[]): DailySummary => {
    const todayOrders = orderList.filter((order) => {
      const orderDate = dayjs(order.createdAt);
      return orderDate.isSame(dayjs(), 'day');
    });

    const totalAmount = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const completedOrders = todayOrders.filter((o) => o.status === 'COMPLETED').length;
    const pendingOrders = todayOrders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;

    return {
      totalOrders: todayOrders.length,
      totalAmount,
      completedOrders,
      pendingOrders,
    };
  };

  // 加载订单列表
  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await OrderApi.getAll();
      setOrders(data);
      setFilteredOrders(data);

      // 计算当天汇总
      const summary = calculateDailySummary(data);
      setDailySummary(summary);
    } catch (error) {
      message.error('加载订单列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 加载客户列表
  const loadCustomers = async () => {
    try {
      const data = await CustomerApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('加载客户列表失败:', error);
    }
  };

  // 加载图案列表
  const loadPatterns = async () => {
    try {
      const data = await PatternApi.getAll();
      setPatterns(data);
    } catch (error) {
      console.error('加载图案列表失败:', error);
    }
  };

  // 日期范围筛选
  useEffect(() => {
    if (dateRange) {
      const [start, end] = dateRange;
      const filtered = orders.filter((order) => {
        const orderDate = dayjs(order.createdAt);
        return orderDate.isAfter(start.subtract(1, 'second')) &&
               orderDate.isBefore(end.add(1, 'second'));
      });
      setFilteredOrders(filtered);
    }
  }, [dateRange, orders]);

  // 组件挂载时加载数据
  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadPatterns();
  }, []);

  // 打开新建订单模态框
  const handleOpenModal = () => {
    setEditingOrder(null);
    setOrderItems([]);
    form.resetFields();
    setIsModalOpen(true);
  };

  // 添加订单项
  const handleAddItem = () => {
    setOrderItems([
      ...orderItems,
      {
        patternId: '',
        quantity: 1,
        pricingMode: 'QUANTITY' as PricingMode,
      },
    ]);
  };

  // 删除订单项
  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // 更新订单项
  const handleUpdateItem = (
    index: number,
    field: keyof CreateOrderItemRequest,
    value: CreateOrderItemRequest[keyof CreateOrderItemRequest]
  ) => {
    const newItems = [...orderItems];
    (newItems[index] as CreateOrderItemRequest)[field] = value;
    setOrderItems(newItems);
  };

  // 创建或更新订单
  const handleSubmitOrder = async () => {
    try {
      const values = await form.validateFields();

      if (editingOrder) {
        // 编辑模式：只更新状态和备注
        const updatedOrder = await OrderApi.update({
          id: editingOrder.id,
          status: values.status,
          notes: values.notes,
        });

        setOrders(orders.map((o) => (o.id === updatedOrder?.id ? updatedOrder : o)));
        message.success('订单更新成功');
      } else {
        // 创建模式：原有逻辑
        if (orderItems.length === 0) {
          message.warning('请至少添加一个订单项');
          return;
        }

        // 验证订单项
        for (const item of orderItems) {
          if (!item.patternId) {
            message.warning('请选择所有订单项的图案');
            return;
          }
        }

        const newOrder = await OrderApi.create({
          customerId: values.customerId,
          items: orderItems,
          notes: values.notes,
        });

        setOrders([...orders, newOrder]);
        message.success('订单创建成功');
      }

      setIsModalOpen(false);
      form.resetFields();
      setOrderItems([]);
      setEditingOrder(null);
      await loadOrders();
    } catch (error) {
      message.error(editingOrder ? '订单更新失败' : '订单创建失败');
      console.error(error);
    }
  };

  // 编辑订单
  const handleEdit = (order: Order) => {
    setEditingOrder(order);
  };

  // 新建订单
  const handleCreate = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  // 新建或编辑成功回调
  const handleModalSuccess = async () => {
    setEditingOrder(null);
    await loadOrders();
  };

  // 当天订单弹窗状态
  const [dailyOrdersVisible, setDailyOrdersVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();

  // 显示客户当天订单
  const handleShowDailyOrders = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDailyOrdersVisible(true);
  };

  // 删除订单
  const handleDelete = async (id: string) => {
    try {
      const success = await OrderApi.delete(id);
      if (success) {
        setOrders(orders.filter((o) => o.id !== id));
        message.success('订单删除成功');
        await loadOrders();
      } else {
        message.error('订单删除失败');
      }
    } catch (error) {
      message.error('订单删除失败');
      console.error(error);
    }
  };

  // 快速更新状态
  const handleStatusChange = async (id: string, status: OrderStatus) => {
    try {
      const updatedOrder = await OrderApi.update({ id, status });
      if (updatedOrder) {
        setOrders(orders.map((o) => (o.id === id ? updatedOrder : o)));
        message.success('状态更新成功');
      }
    } catch (error) {
      message.error('状态更新失败');
      console.error(error);
    }
  };

  // 查看截图
  const handleViewScreenshot = (order: Order) => {
    setCurrentOrder(order);
    // TODO: 从后端加载订单的截图
    // const screenshots = await OrderApi.getScreenshots(order.id);
    // setScreenshotFiles(screenshots);
    setScreenshotModalVisible(true);
  };

  // 截图上传处理
  const handleScreenshotChange = (info: any) => {
    setScreenshotFiles(info.fileList);
  };

  // 订单项表格列
  const itemFormColumns = [
    {
      title: '图案',
      key: 'patternId',
      width: 200,
      render: (_: unknown, record: CreateOrderItemRequest, index: number) => (
        <Select
          placeholder="请选择图案"
          style={{ width: '100%' }}
          value={record.patternId || undefined}
          onChange={(value) => handleUpdateItem(index, 'patternId', value)}
          options={patterns.map((p) => ({ label: p.name, value: p.id }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: '计价方式',
      key: 'pricingMode',
      width: 120,
      render: (_: unknown, record: CreateOrderItemRequest, index: number) => (
        <Select
          style={{ width: '100%' }}
          value={record.pricingMode}
          onChange={(value) => handleUpdateItem(index, 'pricingMode', value)}
          options={[
            { label: '按数量', value: 'QUANTITY' },
            { label: '按面积', value: 'AREA' },
          ]}
        />
      ),
    },
    {
      title: '数量/面积',
      key: 'quantity',
      width: 120,
      render: (_: unknown, record: CreateOrderItemRequest, index: number) => (
        <InputNumber
          placeholder="请输入"
          style={{ width: '100%' }}
          value={record.quantity}
          onChange={(value) => handleUpdateItem(index, 'quantity', value || 1)}
          min={1}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: unknown, _record: CreateOrderItemRequest, index: number) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<MinusCircleOutlined />}
          onClick={() => handleRemoveItem(index)}
        />
      ),
    },
  ];

  return (
    <div>
      {/* 当天订单汇总卡片 */}
      <Card
        title={
          <Space>
            <SearchOutlined />
            当天订单汇总
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              ({dayjs().format('YYYY-MM-DD')})
            </Text>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总订单数"
              value={dailySummary.totalOrders}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总金额"
              value={dailySummary.totalAmount}
              precision={2}
              prefix="¥"
              styles={{ content: { color: '#3f8600' } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已完成"
              value={dailySummary.completedOrders}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="进行中"
              value={dailySummary.pendingOrders}
              styles={{ content: { color: '#faad14' } }}
            />
          </Col>
        </Row>
      </Card>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建订单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadOrders} loading={loading}>
            刷新
          </Button>
        </Space>

        <Space>
          <Text type="secondary">日期范围：</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            format="YYYY-MM-DD"
            allowClear={false}
          />
          <Text type="secondary">共 {filteredOrders.length} 条订单</Text>
        </Space>
      </div>

      <Table
        dataSource={filteredOrders}
        columns={orderColumns(handleEdit, handleDelete, handleStatusChange, handleViewScreenshot)}
        rowKey="id"
        loading={loading}
        expandable={{
          expandedRowRender: (record: Order) => (
            <div style={{ padding: '16px 0' }}>
              <Text strong>订单明细</Text>
              <Table
                dataSource={record.items}
                columns={itemColumns}
                pagination={false}
                rowKey="id"
                style={{ marginTop: 8 }}
              />
              {record.notes && (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">备注: {record.notes}</Text>
                </div>
              )}
            </div>
          ),
          defaultExpandAllRows: false,
        }}
        locale={{ emptyText: '暂无订单数据' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      {/* 订单编辑弹窗 */}
      <OrderEditModal
        visible={isModalOpen}
        orderId={editingOrder?.id}
        mode={editingOrder ? 'edit' : 'create'}
        onSuccess={handleModalSuccess}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
      />

      {/* 客户当天订单弹窗 */}
      {selectedCustomerId && (
        <CustomerDailyOrdersModal
          visible={dailyOrdersVisible}
          customerId={selectedCustomerId}
          onCancel={() => setDailyOrdersVisible(false)}
        />
      )}

      {/* 截图查看模态框 */}
      <Modal
        title={`订单截图 - ${currentOrder?.orderNumber || ''}`}
        open={screenshotModalVisible}
        onCancel={() => {
          setScreenshotModalVisible(false);
          setCurrentOrder(null);
          setScreenshotFiles([]);
        }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Upload
            listType="picture-card"
            fileList={screenshotFiles}
            onChange={handleScreenshotChange}
            multiple
            accept="image/*"
            // TODO: 实现上传到 Tauri 后端
            beforeUpload={() => false}
          >
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>上传截图</div>
            </div>
          </Upload>
        </div>

        <Divider />

        <div>
          <Text strong>已有截图</Text>
          {screenshotFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16, color: '#999' }}>暂无截图</div>
            </div>
          ) : (
            <Image.PreviewGroup>
              <Row gutter={[16, 16]}>
                {screenshotFiles.map((file, index) => (
                  <Col span={8} key={index}>
                    <Image
                      src={file.url || file.originFileObj?.name}
                      alt={`截图 ${index + 1}`}
                      style={{ width: '100%' }}
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>
          )}
        </div>
      </Modal>
    </div>
  );
}
