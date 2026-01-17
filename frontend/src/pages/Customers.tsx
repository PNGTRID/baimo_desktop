import { useState } from 'react';
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
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { Customer } from '@/types';
import { CustomerApi } from '@/services/tauriApi';
import dayjs from 'dayjs';
import CustomerDailyOrdersModal from '@/components/order/CustomerDailyOrdersModal';
import { useCustomersCache } from '@/hooks/useDataCache';

export default function Customers() {
  const { message } = App.useApp();
  const [customers, loading, error, refreshCustomers] = useCustomersCache();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  // 当天订单弹窗状态
  const [dailyOrdersVisible, setDailyOrdersVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  // 显示加载错误
  if (error) {
    message.error(error);
  }

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
        await CustomerApi.update({
          id: editingCustomer.id,
          ...values,
        });
        message.success('客户更新成功');
      } else {
        // 创建客户（后端自动创建同名文件夹）
        await CustomerApi.create(values);
        message.success('客户创建成功');
      }

      // 刷新缓存
      await refreshCustomers();

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
      message.success('客户删除成功');

      // 刷新缓存
      await refreshCustomers();
    } catch (error) {
      message.error('客户删除失败');
      console.error(error);
    }
  };

  // 显示客户订单（指定日期）
  const handleShowDailyOrders = (customerId: string, date?: string) => {
    setSelectedCustomerId(customerId);
    setSelectedDate(date);
    setDailyOrdersVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 100,
      render: (value: number) => (
        <span style={{
          color: value < 0 ? '#ff4d4f' : '#52c41a',
          fontWeight: value < 0 ? 'bold' : 'normal',
        }}>
          ¥{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: '信用额度',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      width: 100,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 90,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 70,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success">启用</Tag>
        ) : (
          <Tag color="default">禁用</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      render: (_: unknown, record: Customer) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CalendarOutlined />}
            onClick={() => handleShowDailyOrders(record.id, dayjs().format('YYYY-MM-DD'))}
          >
            当天订单
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'yesterday',
                  label: '昨天',
                  onClick: () => handleShowDailyOrders(record.id, dayjs().subtract(1, 'day').format('YYYY-MM-DD')),
                },
                {
                  key: '7days',
                  label: '近7天',
                  onClick: () => handleShowDailyOrders(record.id, dayjs().format('YYYY-MM-DD')),
                },
                {
                  key: '30days',
                  label: '近30天',
                  onClick: () => handleShowDailyOrders(record.id, dayjs().format('YYYY-MM-DD')),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="link" size="small" icon={<CalendarOutlined />}>
              历史查询 <DownOutlined />
            </Button>
          </Dropdown>
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
            onClick={refreshCustomers}
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
          date={selectedDate}
        />
      )}
    </div>
  );
}
