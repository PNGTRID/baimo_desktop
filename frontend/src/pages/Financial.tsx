import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  App,
  Statistic,
  Tag,
  Typography,
  Progress,
  Tabs,
  DatePicker,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  TransactionOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { FinancialRecord, CustomerDebt, Customer } from '@/types';
import { FinancialApi, CustomerApi } from '@/services/tauriApi';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const recordTypeMap: Record<string, { text: string; color: string }> = {
  PAYMENT: { text: '充值/还款', color: 'green' },
  REFUND: { text: '退款', color: 'orange' },
  ADJUSTMENT: { text: '余额调整', color: 'blue' },
};

export default function Financial() {
  const { message } = App.useApp();
  // ========== 状态管理 ==========
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([]);
  const [loading, setLoading] = useState(false);

  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 模态框状态
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [paymentForm] = Form.useForm();
  const [refundForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  // 筛选状态
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [selectedRecordType, setSelectedRecordType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);

  // ========== 数据加载 ==========
  const loadRecords = async () => {
    try {
      setLoading(true);
      const result = await FinancialApi.getRecords({
        customerId: selectedCustomerId,
        recordType: selectedRecordType,
        page: pagination.current,
        pageSize: pagination.pageSize,
      });

      setRecords(result.data);
      setPagination({
        ...pagination,
        total: result.total,
      });
    } catch (error) {
      message.error('加载财务记录失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await CustomerApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('加载客户列表失败:', error);
    }
  };

  const loadCustomerDebts = async () => {
    try {
      const data = await FinancialApi.getCustomerDebts({
        sortBy: 'balance',
        sortOrder: 'asc',
      });
      setCustomerDebts(data);
    } catch (error) {
      console.error('加载客户欠款失败:', error);
    }
  };

  useEffect(() => {
    loadRecords();
    loadCustomers();
    loadCustomerDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, selectedCustomerId, selectedRecordType]);

  // ========== 事件处理 ==========
  const handlePayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      await FinancialApi.customerPayment(
        values.customerId,
        values.amount,
        values.description,
      );
      message.success('充值成功');
      setPaymentModalVisible(false);
      paymentForm.resetFields();
      loadRecords();
      loadCustomerDebts();
    } catch (error) {
      message.error('充值失败: ' + error);
    }
  };

  const handleRefund = async () => {
    try {
      const values = await refundForm.validateFields();
      await FinancialApi.customerRefund(
        values.customerId,
        values.amount,
        values.description,
      );
      message.success('退款成功');
      setRefundModalVisible(false);
      refundForm.resetFields();
      loadRecords();
      loadCustomerDebts();
    } catch (error) {
      message.error('退款失败: ' + error);
    }
  };

  const handleAdjustBalance = async () => {
    try {
      const values = await adjustForm.validateFields();
      await FinancialApi.adjustBalance(
        values.customerId,
        values.newBalance,
        values.description,
      );
      message.success('余额调整成功');
      setAdjustModalVisible(false);
      adjustForm.resetFields();
      loadRecords();
      loadCustomerDebts();
    } catch (error) {
      message.error('余额调整失败: ' + error);
    }
  };

  // ========== 表格列定义 ==========
  const recordColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '类型',
      dataIndex: 'recordType',
      key: 'recordType',
      width: 120,
      render: (type: string) => {
        const info = recordTypeMap[type] || { text: type, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number, record: FinancialRecord) => {
        const isAdd = record.recordType === 'PAYMENT';
        return (
          <Text style={{ color: isAdd ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
            {isAdd ? '+' : '-'}¥{amount.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: '余额变化',
      key: 'balanceChange',
      width: 180,
      render: (_: unknown, record: FinancialRecord) => (
        <Text>
          ¥{record.balanceBefore.toFixed(2)} → ¥{record.balanceAfter.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 100,
    },
  ];

  const debtColumns = [
    { title: '客户名称', dataIndex: 'name', key: 'name', width: 150 },
    {
      title: '当前余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 120,
      render: (balance: number) => (
        <Text style={{ color: balance < 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          ¥{balance.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '信用额度',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '可用额度',
      dataIndex: 'availableCredit',
      key: 'availableCredit',
      width: 120,
      render: (value: number) => (
        <Text style={{ color: value > 0 ? '#52c41a' : '#ff4d4f' }}>
          ¥{value.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '欠款比例',
      dataIndex: 'debtRatio',
      key: 'debtRatio',
      width: 150,
      render: (ratio: number) => {
        const percent = Math.round(ratio);
        const color = percent >= 90 ? '#ff4d4f' : percent >= 70 ? '#faad14' : '#52c41a';
        return <Progress percent={percent} size="small" strokeColor={color} />;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: CustomerDebt) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              paymentForm.setFieldValue('customerId', record.id);
              setPaymentModalVisible(true);
            }}
          >
            充值
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 渲染 ==========
  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          财务管理
        </h2>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          管理客户充值、退款、余额调整和财务记录
        </p>
      </div>

      {/* 财务概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="欠款客户数"
              value={customerDebts.length}
              prefix={<WarningOutlined />}
              styles={{ content: { color: '#e07a5f', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="总欠款金额"
              value={customerDebts.reduce((sum, d) => sum + Math.abs(d.balance), 0)}
              precision={2}
              prefix="¥"
              styles={{ content: { color: '#e07a5f', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="本月交易笔数"
              value={records.length}
              prefix={<TransactionOutlined />}
              styles={{ content: { color: '#1a5f4c', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="本月交易总额"
              value={records.reduce((sum, r) => sum + r.amount, 0)}
              precision={2}
              prefix="¥"
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 内容区域 */}
      <Tabs
        defaultActiveKey="records"
        items={[
          {
            key: 'records',
            label: '财务记录',
            children: (
              <>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setPaymentModalVisible(true)}
                    >
                      充值/还款
                    </Button>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => setRefundModalVisible(true)}
                    >
                      退款
                    </Button>
                    <Button
                      icon={<TransactionOutlined />}
                      onClick={() => setAdjustModalVisible(true)}
                    >
                      余额调整
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadRecords} loading={loading}>
                      刷新
                    </Button>
                  </Space>

                  <Space>
                    <Select
                      placeholder="筛选客户"
                      style={{ width: 150 }}
                      allowClear
                      value={selectedCustomerId}
                      onChange={setSelectedCustomerId}
                      options={customers.map((c) => ({ label: c.name, value: c.id }))}
                    />
                    <Select
                      placeholder="筛选类型"
                      style={{ width: 120 }}
                      allowClear
                      value={selectedRecordType}
                      onChange={setSelectedRecordType}
                      options={Object.entries(recordTypeMap).map(([key, { text }]) => ({
                        label: text,
                        value: key,
                      }))}
                    />
                    <RangePicker
                      value={dateRange}
                      onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                    />
                  </Space>
                </div>

                <Table
                  dataSource={records}
                  columns={recordColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    onChange: (page, pageSize) =>
                      setPagination({ ...pagination, current: page, pageSize: pageSize || 20 }),
                  }}
                />
              </>
            ),
          },
          {
            key: 'debts',
            label: '客户欠款',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button icon={<ReloadOutlined />} onClick={loadCustomerDebts}>
                    刷新
                  </Button>
                </div>

                <Table
                  dataSource={customerDebts}
                  columns={debtColumns}
                  rowKey="id"
                  pagination={false}
                  expandable={{
                    expandedRowRender: (record: CustomerDebt) => (
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="客户ID">{record.id}</Descriptions.Item>
                        <Descriptions.Item label="当前余额">
                          ¥{record.balance.toFixed(2)}
                        </Descriptions.Item>
                        <Descriptions.Item label="信用额度">
                          ¥{record.creditLimit.toFixed(2)}
                        </Descriptions.Item>
                        <Descriptions.Item label="可用额度">
                          ¥{record.availableCredit.toFixed(2)}
                        </Descriptions.Item>
                        <Descriptions.Item label="欠款比例" span={2}>
                          <Progress percent={Math.round(record.debtRatio)} />
                        </Descriptions.Item>
                        {record.notes && (
                          <Descriptions.Item label="备注" span={2}>
                            {record.notes}
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    ),
                  }}
                />
              </>
            ),
          },
        ]}
      />

      {/* 充值/还款模态框 */}
      <Modal
        title="客户充值/还款"
        open={paymentModalVisible}
        onOk={handlePayment}
        onCancel={() => {
          setPaymentModalVisible(false);
          paymentForm.resetFields();
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={paymentForm} layout="vertical">
          <Form.Item
            label="客户"
            name="customerId"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select
              placeholder="请选择客户"
              options={customers.map((c) => ({ label: `${c.name} (余额: ¥${c.balance.toFixed(2)})`, value: c.id }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="充值金额"
            name="amount"
            rules={[{ required: true, message: '请输入充值金额' }]}
          >
            <InputNumber
              placeholder="请输入充值金额"
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              prefix="¥"
            />
          </Form.Item>

          <Form.Item label="备注" name="description">
            <Input placeholder="请输入备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 退款模态框 */}
      <Modal
        title="客户退款"
        open={refundModalVisible}
        onOk={handleRefund}
        onCancel={() => {
          setRefundModalVisible(false);
          refundForm.resetFields();
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item
            label="客户"
            name="customerId"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select
              placeholder="请选择客户"
              options={customers.map((c) => ({ label: `${c.name} (余额: ¥${c.balance.toFixed(2)})`, value: c.id }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="退款金额"
            name="amount"
            rules={[{ required: true, message: '请输入退款金额' }]}
          >
            <InputNumber
              placeholder="请输入退款金额"
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              prefix="¥"
            />
          </Form.Item>

          <Form.Item label="退款原因" name="description">
            <Input.TextArea placeholder="请输入退款原因" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 余额调整模态框 */}
      <Modal
        title="余额调整（管理员操作）"
        open={adjustModalVisible}
        onOk={handleAdjustBalance}
        onCancel={() => {
          setAdjustModalVisible(false);
          adjustForm.resetFields();
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={adjustForm} layout="vertical">
          <Form.Item
            label="客户"
            name="customerId"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select
              placeholder="请选择客户"
              options={customers.map((c) => ({ label: `${c.name} (余额: ¥${c.balance.toFixed(2)})`, value: c.id }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="新余额"
            name="newBalance"
            rules={[{ required: true, message: '请输入新余额' }]}
          >
            <InputNumber
              placeholder="请输入新余额"
              style={{ width: '100%' }}
              precision={2}
              prefix="¥"
            />
          </Form.Item>

          <Form.Item
            label="调整原因"
            name="description"
            rules={[{ required: true, message: '请输入调整原因' }]}
          >
            <Input.TextArea placeholder="请输入调整原因（必填）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
