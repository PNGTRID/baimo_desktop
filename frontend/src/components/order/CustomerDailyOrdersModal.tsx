/**
 * 客户当天订单弹窗组件
 * 显示客户信息、当天订单汇总、支持复制图片功能
 */

import { useState, useEffect } from 'react';
import { Modal, Descriptions, Card, List, Tag, Button, Space, Statistic, Row, Col, App, Spin, Empty } from 'antd';
import { CalendarOutlined, CopyOutlined, DownloadOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons';
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

        // 筛选当天订单
        const todayOrders = allOrders.filter((order) => {
          const orderDate = dayjs(order.createdAt).format('YYYY-MM-DD');
          return order.customerId === customerId && orderDate === targetDate;
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
    completedOrders: orders.filter((o) => o.status === 'COMPLETED').length,
    pendingOrders: orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'default', text: '待确认' },
      CONFIRMED: { color: 'blue', text: '已确认' },
      IN_PROGRESS: { color: 'processing', text: '进行中' },
      COMPLETED: { color: 'success', text: '已完成' },
      CANCELLED: { color: 'error', text: '已取消' },
    };
    const info = statusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
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
          {/* 客户信息 */}
          {customer && (
            <Card style={{ marginBottom: 16 }}>
              <Descriptions title={<><UserOutlined /> 客户信息</>} column={2} size="small">
                <Descriptions.Item label="客户名称">{customer.name}</Descriptions.Item>
                <Descriptions.Item label="当前余额">
                  {customer.balance >= 0 ? (
                    <Tag color="green">¥{customer.balance.toFixed(2)}</Tag>
                  ) : (
                    <Tag color="red">-¥{Math.abs(customer.balance).toFixed(2)}</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="信用额度">¥{customer.creditLimit.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="每平方单价">¥{customer.unitPrice.toFixed(2)}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* 汇总统计 */}
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="订单总数" value={stats.totalOrders} prefix={<CalendarOutlined />} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="总金额"
                  value={stats.totalAmount}
                  prefix={<DollarOutlined />}
                  precision={2}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="已完成" value={stats.completedOrders} styles={{ content: { color: '#52c41a' } }} />
              </Col>
              <Col span={6}>
                <Statistic title="进行中" value={stats.pendingOrders} styles={{ content: { color: '#1890ff' } }} />
              </Col>
            </Row>
          </Card>

          {/* 订单列表 */}
          <Card title={`当天订单列表 (${orders.length} 个)`}>
            {orders.length === 0 ? (
              <Empty description="当天暂无订单" />
            ) : (
              <List
                dataSource={orders}
                renderItem={(order) => (
                  <List.Item key={order.id}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{order.orderNumber}</span>
                          {getStatusTag(order.status)}
                        </Space>
                      }
                      description={
                        <div>
                          <div>创建时间: {dayjs(order.createdAt).format('HH:mm')}</div>
                          <div>
                            订单项:{' '}
                            {order.items.map((item) => (
                              <Tag key={item.id} style={{ margin: '2px' }}>
                                {item.patternName} × {item.quantity}
                              </Tag>
                            ))}
                          </div>
                          {order.notes && <div style={{ color: '#8c8c8c', marginTop: 4 }}>备注: {order.notes}</div>}
                        </div>
                      }
                    />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#3f8600' }}>
                        ¥{order.totalAmount.toFixed(2)}
                      </div>
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
