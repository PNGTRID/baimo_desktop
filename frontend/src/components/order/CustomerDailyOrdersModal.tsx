/**
 * 客户当天订单弹窗组件
 * 显示客户信息、当天订单汇总、支持复制图片功能
 */

import { useState, useEffect } from 'react';
import { Modal, Card, List, Tag, Button, Space, Row, Col, App, Spin, Empty, Table, Typography } from 'antd';
import { CalendarOutlined, CopyOutlined, DownloadOutlined, UserOutlined, CheckOutlined } from '@ant-design/icons';
import { CustomerApi, OrderApi } from '@/services/tauriApi';
import type { Customer, Order } from '@/types';
import dayjs from 'dayjs';
import { copyElementAsImage, downloadElementAsImage } from '@/utils/imageUtils';

interface CustomerDailyOrdersModalProps {
  visible: boolean;
  customerId: string;
  onCancel: () => void;
  date?: string; // YYYY-MM-DD 格式，默认当天
}

export default function CustomerDailyOrdersModal({
  visible,
  customerId,
  onCancel,
  date,
}: CustomerDailyOrdersModalProps) {
  const { message } = App.useApp();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allCustomerOrders, setAllCustomerOrders] = useState<Order[]>([]); // 所有客户订单
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  const targetDate = date || dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 并行加载客户和订单数据
        const [customerData, allOrders] = await Promise.all([
          CustomerApi.getById(customerId),
          OrderApi.getAll(),
        ]);

        setCustomer(customerData);

        // 筛选该客户的所有订单
        const customerOrders = allOrders.filter((order) => order.customerId === customerId);
        setAllCustomerOrders(customerOrders);

        // 筛选当天订单
        const todayOrders = customerOrders.filter((order) => {
          const orderDate = dayjs(order.createdAt).format('YYYY-MM-DD');
          return orderDate === targetDate;
        });

        setOrders(todayOrders);
      } catch (error) {
        message.error('加载数据失败: ' + error);
      } finally {
        setLoading(false);
      }
    };

    if (visible && customerId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, customerId, targetDate]);

  // 计算汇总统计
  const stats = {
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    // 累加每个订单项的数量
    totalPatterns: orders.reduce((sum, order) =>
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
  };

  // 获取当前时间（用于比较）
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month(); // 0-11

  // 计算本月累计图案数
  const monthlyPatterns = allCustomerOrders
    .filter((order) => {
      const orderDate = dayjs(order.createdAt);
      return orderDate.year() === currentYear && orderDate.month() === currentMonth;
    })
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  // 计算今年累计图案数
  const yearlyPatterns = allCustomerOrders
    .filter((order) => dayjs(order.createdAt).year() === currentYear)
    .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  // 获取状态标签
  const getStatusTag = (isConfirmed: boolean) => {
    return isConfirmed
      ? <Tag color="success" icon={<CheckOutlined />}>已确认</Tag>
      : <Tag color="default">待确认</Tag>;
  };

  // 复制为图片
  const handleCopyImage = async () => {
    setCopying(true);
    try {
      const success = await copyElementAsImage('daily-orders-content');
      if (success) {
        message.success('已复制到剪贴板');
      } else {
        message.error('复制失败');
      }
    } catch (error) {
      message.error('复制失败: ' + error);
    } finally {
      setCopying(false);
    }
  };

  // 下载图片
  const handleDownloadImage = async () => {
    setCopying(true);
    try {
      const filename = `${customer?.name || '客户'}_${targetDate}_订单`;
      const success = await downloadElementAsImage('daily-orders-content', filename);
      if (success) {
        message.success('下载成功');
      } else {
        message.error('下载失败');
      }
    } catch (error) {
      message.error('下载失败: ' + error);
    } finally {
      setCopying(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CalendarOutlined />
          <span>客户当天订单 - {targetDate}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
        <Button key="download" icon={<DownloadOutlined />} onClick={handleDownloadImage} loading={copying}>
          下载图片
        </Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopyImage} loading={copying}>
          复制图片
        </Button>,
      ]}
      width={800}
    >
      <Spin spinning={loading}>
        <div id="daily-orders-content" style={{ padding: '20px', backgroundColor: '#fff' }}>
          {/* 客户信息 + 汇总统计 */}
          {customer && (
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={32} align="stretch">
                {/* 左侧：客户信息 + 余额 + 累计统计 */}
                <Col span={12} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 24 }}>
                  {/* 第一行：客户名称 + 余额 */}
                  <Row gutter={24} style={{ marginBottom: 20 }}>
                    <Col span={12}>
                      <div style={{ marginBottom: 8 }}>
                        <UserOutlined style={{ marginRight: 8, color: '#1890ff', fontSize: 16 }} />
                        <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500 }}>客户名称</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 600, color: '#262626' }}>{customer.name}</div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500 }}>当前余额</span>
                      </div>
                      {customer.balance < 0 ? (
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#ff4d4f' }}>
                          -¥{Math.abs(customer.balance).toFixed(2)}
                        </div>
                      ) : (
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>
                          ¥{customer.balance.toFixed(2)}
                        </div>
                      )}
                    </Col>
                  </Row>

                  {/* 第二行：本月累计 + 今年累计 */}
                  <Row gutter={24}>
                    <Col span={12}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>📅 本月累计图案数</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#1890ff' }}>{monthlyPatterns}</div>
                    </Col>
                    <Col span={12}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>📆 今年累计图案数</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>{yearlyPatterns}</div>
                    </Col>
                  </Row>
                </Col>

                {/* 右侧：今日统计 */}
                <Col span={12}>
                  <div style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500, marginBottom: 16 }}>
                    📅 今日数据
                  </div>
                  <Row gutter={24}>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>订单数</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>{stats.totalOrders}</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>图案数</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>{stats.totalPatterns}</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>金额(元)</div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: '#faad14' }}>
                          {stats.totalAmount.toFixed(0)}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Card>
          )}

          {/* 订单列表 */}
          <Card title={`当天订单列表 (${orders.length} 个)`}>
            {orders.length === 0 ? (
              <Empty description="当天暂无订单" />
            ) : (
              <List
                dataSource={orders}
                renderItem={(order) => (
                  <List.Item key={order.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ width: '100%', marginBottom: 12 }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <span style={{ fontWeight: 'bold' }}>{order.orderNumber}</span>
                          {getStatusTag(order.isConfirmed)}
                        </Space>
                        <Space>
                          <span style={{ color: '#8c8c8c' }}>{dayjs(order.createdAt).format('HH:mm')}</span>
                          {order.notes && <span style={{ color: '#8c8c8c' }}>备注: {order.notes}</span>}
                        </Space>
                      </Space>
                    </div>

                    {/* 订单项表格 */}
                    <Table
                      columns={[
                        {
                          title: '图案名称',
                          dataIndex: 'patternName',
                          key: 'patternName',
                          width: 150,
                        },
                        {
                          title: '颜色',
                          dataIndex: 'colorVariantName',
                          key: 'colorVariantName',
                          width: 80,
                          render: (value) => value || '-',
                        },
                        {
                          title: '数量',
                          dataIndex: 'quantity',
                          key: 'quantity',
                          width: 60,
                        },
                        {
                          title: '面积(m²)',
                          dataIndex: 'area',
                          key: 'area',
                          width: 80,
                          render: (area, record) =>
                            record.pricingMode === 'AREA' ? area?.toFixed(2) : '-',
                        },
                        {
                          title: '单价(元)',
                          dataIndex: 'unitPrice',
                          key: 'unitPrice',
                          width: 80,
                          render: (value) => `¥${value.toFixed(2)}`,
                        },
                        {
                          title: '合计(元)',
                          dataIndex: 'totalPrice',
                          key: 'totalPrice',
                          width: 80,
                          render: (value) => `¥${value.toFixed(2)}`,
                        },
                      ]}
                      dataSource={order.items}
                      pagination={false}
                      size="small"
                      rowKey="id"
                      style={{ marginBottom: 8 }}
                    />

                    {/* 订单小计 */}
                    <div style={{ textAlign: 'right', marginTop: 8 }}>
                      <Space>
                        <Typography.Text strong>订单小计：</Typography.Text>
                        <Typography.Text style={{ fontSize: 18, color: '#1890ff', fontWeight: 'bold' }}>
                          ¥{order.totalAmount.toFixed(2)}
                        </Typography.Text>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>
      </Spin>
    </Modal>
  );
}
