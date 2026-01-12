import { useState, useEffect, useRef } from 'react';
import {
  Button,
  Table,
  Modal,
  App,
  Card,
  Typography,
  Space,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Image,
  Upload,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CameraOutlined,
  PictureOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Order, CreateOrderItemRequest, OrderPatternItem, Customer, Pattern } from '@/types';
import { OrderApi, CustomerApi } from '@/services/tauriApi';
import dayjs from 'dayjs';
import type { UploadFile, UploadProps } from 'antd';
import OrderEditModal from '@/components/order/OrderEditModal';
import AddOrderItemModal from '@/components/order/AddOrderItemModal';
import { PatternPreviewPopover } from '@/components/pattern/PatternPreviewPopover';
import { useStore } from '@/store/useStore';

const { Text } = Typography;

interface DailySummary {
  totalOrders: number;
  totalAmount: number;
  completedOrders: number;
  pendingOrders: number;
}

const orderColumns = (
  onEdit: (order: Order) => void,
  onDelete: (id: string) => void,
  onConfirm: (id: string) => void,
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
    dataIndex: 'isConfirmed',
    key: 'isConfirmed',
    width: 150,
    render: (isConfirmed: boolean, record: Order) => {
      if (isConfirmed) {
        return (
          <Space>
            <Text type="success">已完成</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.confirmedAt ? dayjs(record.confirmedAt).format('MM-DD HH:mm') : ''}
            </Text>
          </Space>
        );
      }
      return <Text type="warning">进行中</Text>;
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
    width: 250,
    render: (_: unknown, record: Order) => (
      <Space size="small">
        {!record.isConfirmed && (
          <Popconfirm
            title="确认并生产"
            description="确认后订单将标记为完成，会计入账单统计。确定吗？"
            onConfirm={() => onConfirm(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="primary" size="small">
              确认并生产
            </Button>
          </Popconfirm>
        )}
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
  {
    title: '图案名称',
    dataIndex: 'patternName',
    key: 'patternName',
    render: (name: string, record: OrderPatternItem) => (
      <PatternPreviewPopover
        patternId={record.patternId}
        patternName={name}
      >
        <span
          style={{
            cursor: 'pointer',
            color: '#1890ff',
            textDecoration: 'underline',
          }}
        >
          {name}
        </span>
      </PatternPreviewPopover>
    ),
  },
  {
    title: '颜色',
    dataIndex: 'colorVariantName',
    key: 'colorVariantName',
    render: (name: string | undefined, record: OrderPatternItem) => {
      if (!name) return <Text type="secondary">默认</Text>;
      return <span>{name}</span>;
    },
  },
  {
    title: '数量',
    dataIndex: 'quantity',
    key: 'quantity',
    render: (_: unknown, record: OrderPatternItem) => {
      if (record.pricingMode === 'AREA') {
        return `${record.area || 0} 平方`;
      }
      return record.quantity;
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
  const { pendingPatternForOrder, setPendingPatternForOrder } = useStore();
  const hasCheckedPendingPattern = useRef(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]); // 客户列表
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]); // 批量选中的订单 ID
  const [addItemModalVisible, setAddItemModalVisible] = useState(false); // 添加订单项模态框

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

  // 预选图案的状态（用于传递给 OrderEditModal）
  const [preselectedPattern, setPreselectedPattern] = useState<OrderPatternItem | null>(null);
  // 预选客户 ID（从快捷下单的图案中提取）
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | undefined>(undefined);
  // 预选图案（用于快捷下单）
  const [pendingPattern, setPendingPattern] = useState<Pattern | null>(null);

  // 计算当天订单汇总
  const calculateDailySummary = (orderList: Order[]): DailySummary => {
    const todayOrders = orderList.filter((order) => {
      const orderDate = dayjs(order.createdAt);
      return orderDate.isSame(dayjs(), 'day');
    });

    // 只统计已确认的订单（确认并生产后会计入账单）
    const confirmedOrders = todayOrders.filter((o) => o.isConfirmed);
    const totalAmount = confirmedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const completedOrders = confirmedOrders.length;
    const pendingOrders = todayOrders.filter((o) => !o.isConfirmed).length;

    return {
      totalOrders: todayOrders.length,
      totalAmount,
      completedOrders,
      pendingOrders,
    };
  };

  // 加载订单列表
  const loadOrders = async () => {
    console.log('[订单刷新] loadOrders 开始');
    setLoading(true);
    try {
      const [data, customersData] = await Promise.all([
        OrderApi.getAll(),
        CustomerApi.getAll(),
      ]);
      console.log('[订单刷新] 获取到订单数据:', data.length, '条');
      setOrders(data);
      setCustomers(customersData.filter((c) => c.isActive));

      // 计算当天汇总
      const summary = calculateDailySummary(data);
      setDailySummary(summary);
      console.log('[订单刷新] 订单列表更新完成');
    } catch (error) {
      console.error('[订单刷新] 加载失败:', error);
      message.error('加载订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 检查是否有预选的图案（从快捷下单功能）
  useEffect(() => {
    if (!hasCheckedPendingPattern.current && pendingPatternForOrder) {
      hasCheckedPendingPattern.current = true;

      // 保存到组件状态
      setPendingPattern(pendingPatternForOrder);

      // 打开添加订单项模态框
      setAddItemModalVisible(true);

      // 清除 store 中的预选图案
      setPendingPatternForOrder(null);

      const customerMsg = pendingPatternForOrder.customerId
        ? `，客户：${customers.find(c => c.id === pendingPatternForOrder.customerId)?.name || '未知'}`
        : '';
      message.success(`已选择图案「${pendingPatternForOrder.name}」${customerMsg}，请选择颜色和数量`);
    }
  }, [pendingPatternForOrder, setPendingPatternForOrder, message, customers]);

  // 编辑订单
  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  // 新建订单
  const handleCreate = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  // 新建或编辑成功回调
  const handleModalSuccess = async () => {
    console.log('[订单刷新] handleModalSuccess 被调用');
    setEditingOrder(null);
    console.log('[订单刷新] 开始调用 loadOrders()');
    await loadOrders();
    console.log('[订单刷新] loadOrders() 完成');
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

  // 确认并生产订单
  const handleConfirm = async (id: string) => {
    try {
      const updatedOrder = await OrderApi.confirm(id);
      setOrders(orders.map((o) => (o.id === id ? updatedOrder : o)));
      message.success('订单已确认并生产');

      // 重新计算当天汇总
      const summary = calculateDailySummary(orders.map((o) => (o.id === id ? updatedOrder : o)));
      setDailySummary(summary);
    } catch (error) {
      message.error('确认失败');
      console.error(error);
    }
  };

  // 批量删除订单
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的订单');
      return;
    }

    try {
      const count = await OrderApi.batchDelete(selectedRowKeys as string[]);
      message.success(`成功删除 ${count} 个订单`);
      setSelectedRowKeys([]);
      await loadOrders();
    } catch (error) {
      message.error('批量删除失败');
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
  const handleScreenshotChange: UploadProps['onChange'] = (info) => {
    setScreenshotFiles(info.fileList);
  };

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          订单管理
        </h2>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          管理客户订单、跟踪订单状态和生产进度
        </p>
      </div>

      {/* 当天订单汇总卡片 */}
      <Card
        className="stat-card"
        title={
          <Space>
            <SearchOutlined style={{ color: '#0ea5e9' }} />
            <span style={{ fontSize: 15, fontWeight: 600 }}>当天订单汇总</span>
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
              styles={{ content: { color: '#0ea5e9', fontWeight: 600 } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总金额"
              value={dailySummary.totalAmount}
              precision={2}
              prefix="¥"
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已完成"
              value={dailySummary.completedOrders}
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="进行中"
              value={dailySummary.pendingOrders}
              styles={{ content: { color: '#faad14', fontWeight: 600 } }}
            />
          </Col>
        </Row>
      </Card>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ fontWeight: 500 }}>
            新建订单
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadOrders} loading={loading}>
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="确认批量删除"
              description={`确定要删除选中的 ${selectedRowKeys.length} 个订单吗？此操作不可恢复。`}
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </Space>

        <Text type="secondary">共 {orders.length} 条订单</Text>
      </div>

      <Table
        dataSource={orders}
        columns={orderColumns(handleEdit, handleDelete, handleConfirm, handleViewScreenshot)}
        rowKey="id"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
        }}
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
        customerId={preselectedCustomerId}
        preselectedPattern={preselectedPattern}
        onSuccess={handleModalSuccess}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
          setPreselectedPattern(null);
          setPreselectedCustomerId(undefined);
        }}
      />

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

      {/* 添加订单项模态框（快捷下单） */}
      <AddOrderItemModal
        visible={addItemModalVisible}
        preselectedPattern={pendingPattern}
        onSuccess={async () => {
          await loadOrders();
          setAddItemModalVisible(false);
          setPendingPattern(null);
        }}
        onCancel={() => {
          setAddItemModalVisible(false);
          setPendingPattern(null);
        }}
      />
    </div>
  );
}
