import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Tag,
  Space,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { Customer } from '@/types';
import { CustomerApi } from '@/services/tauriApi';
import dayjs from 'dayjs';
import CustomerDailyOrdersModal from '@/components/order/CustomerDailyOrdersModal';

export default function Customers() {
  const { message } = App.useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  // 当天订单弹窗状态
  const [dailyOrdersVisible, setDailyOrdersVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();

  // 加载客户列表
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await CustomerApi.getAll();
      setCustomers(data);
    } catch (error) {
      message.error('加载客户列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 打开创建/编辑模态框
  const handleOpenModal = (customer: Customer | null = null) => {
    setEditingCustomer(customer);
    if (customer) {
      form.setFieldsValue({
        name: customer.name,
        balance: customer.balance,
        creditLimit: customer.creditLimit,
        unitPrice: customer.unitPrice,
        notes: customer.notes,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ unitPrice: 18 });
    }
    setIsModalOpen(true);
  };

  // 创建或更新客户
  const handleSubmitCustomer = async () => {
    try {
      const values = await form.validateFields();

      if (editingCustomer) {
        // 更新客户
        const updated = await CustomerApi.update({
          id: editingCustomer.id,
          ...values,
        });
        if (updated) {
          setCustomers(customers.map((c) => (c.id === updated.id ? updated : c)));
          message.success('客户更新成功');
        }
      } else {
        // 创建客户（后端自动创建同名文件夹）
        const newCustomer = await CustomerApi.create(values);
        setCustomers([...customers, newCustomer]);
        message.success('客户创建成功');
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingCustomer(null);
    } catch (error) {
      message.error(editingCustomer ? '客户更新失败' : '客户创建失败');
      console.error(error);
    }
  };

  // 删除客户
  const handleDeleteCustomer = async (id: string) => {
    try {
      await CustomerApi.delete(id);
      setCustomers(customers.filter((c) => c.id !== id));
      message.success('客户删除成功');
    } catch (error) {
      message.error('客户删除失败');
      console.error(error);
    }
  };

  // 显示客户当天订单
  const handleShowDailyOrders = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setDailyOrdersVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '余额（元）',
      dataIndex: 'balance',
      key: 'balance',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '信用额度',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '每平方单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success">启用</Tag>
        ) : (
          <Tag color="default">禁用</Tag>
        ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
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
      fixed: 'right' as const,
      render: (_: unknown, record: Customer) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => handleShowDailyOrders(record.id)}
          >
            当天订单
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除此客户吗？"
            onConfirm={() => handleDeleteCustomer(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          客户管理
        </h2>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          管理客户信息、信用额度和余额
        </p>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{ fontWeight: 500 }}
          >
            新建客户
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadCustomers}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      <Table
        dataSource={customers}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: '暂无客户数据' }}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title={editingCustomer ? '编辑客户' : '新建客户'}
        open={isModalOpen}
        onOk={handleSubmitCustomer}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setEditingCustomer(null);
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="客户名称"
            name="name"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item label="余额（元）" name="balance">
            <InputNumber
              placeholder="请输入余额"
              style={{ width: '100%' }}
              precision={2}
              min={0}
            />
          </Form.Item>

          <Form.Item label="信用额度" name="creditLimit">
            <InputNumber
              placeholder="请输入信用额度"
              style={{ width: '100%' }}
              precision={2}
              min={0}
            />
          </Form.Item>

          <Form.Item
            label="每平方单价"
            name="unitPrice"
            rules={[{ required: true, message: '请输入每平方单价' }]}
          >
            <InputNumber
              placeholder="请输入每平方单价"
              style={{ width: '100%' }}
              precision={2}
              min={0}
            />
          </Form.Item>

          <Form.Item label="备注" name="notes">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 客户当天订单弹窗 */}
      {selectedCustomerId && (
        <CustomerDailyOrdersModal
          visible={dailyOrdersVisible}
          customerId={selectedCustomerId}
          onCancel={() => setDailyOrdersVisible(false)}
        />
      )}
    </div>
  );
}
