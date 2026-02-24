/**
 * 当天订单统计卡片组件
 * 显示今日订单汇总统计和收款码
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Divider, Space, Typography, Spin, Empty, Table, Tag } from 'antd';
import { CalendarOutlined, QrcodeOutlined, AppstoreOutlined } from '@ant-design/icons';
import { OrderApi, SettingsApi } from '@/services/tauriApi';
import type { Order, OrderPatternItem } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TodayOrdersCardProps {
  className?: string;
}

interface DailySummary {
  totalOrders: number;
  totalAmount: number;
  completedOrders: number;
  pendingOrders: number;
  totalArea: number;
  totalQuantity: number;
}

export default function TodayOrdersCard({ className }: TodayOrdersCardProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<DailySummary>({
    totalOrders: 0,
    totalAmount: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalArea: 0,
    totalQuantity: 0,
  });
  const [qrcodes, setQrcodes] = useState({
    alipay: null as string | null,
    wechat: null as string | null,
  });
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载订单数据和收款码图片（Base64）
      const [allOrders, alipay, wechat] = await Promise.all([
        OrderApi.getAll(),
        SettingsApi.getPaymentQrcodeImage('alipay'),
        SettingsApi.getPaymentQrcodeImage('wechat'),
      ]);

      // 筛选今日订单 (使用本地时区,比较年月日)
      const today = dayjs().format('YYYY-MM-DD');
      const todayOrders = allOrders.filter((order) => {
        const orderDate = dayjs(order.createdAt).format('YYYY-MM-DD');
        return orderDate === today;
      });

      // 计算汇总数据
      const confirmedOrders = todayOrders.filter((o) => o.isConfirmed);
      let totalArea = 0;
      let totalQuantity = 0;

      confirmedOrders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.pricingMode === 'AREA') {
            totalArea += item.area || 0;
          } else {
            totalQuantity += item.quantity;
          }
        });
      });

      setSummary({
        totalOrders: todayOrders.length,
        totalAmount: confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        completedOrders: confirmedOrders.length,
        pendingOrders: todayOrders.filter((o) => !o.isConfirmed).length,
        totalArea,
        totalQuantity,
      });

      setQrcodes({ alipay, wechat });
      setTodayOrders(todayOrders);
    } catch (error) {
      console.error('加载今日数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Space>
            <CalendarOutlined />
            <span>今日订单统计</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              {dayjs().format('YYYY-MM-DD')}
            </Text>
          </Space>
        }
        className={className}
        size="small"
      >
        {/* 统计数据 */}
        <Row gutter={16} style={{ marginBottom: summary.totalOrders > 0 ? 16 : 0 }}>
          <Col span={6}>
            <Statistic
              title="总订单"
              value={summary.totalOrders}
              prefix={<AppstoreOutlined />}
              valueStyle={{ fontSize: 20, color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总金额"
              value={summary.totalAmount}
              prefix="¥"
              precision={0}
              valueStyle={{ fontSize: 20, color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总面积"
              value={summary.totalArea}
              suffix="m²"
              precision={1}
              valueStyle={{ fontSize: 20, color: '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总数量"
              value={summary.totalQuantity}
              suffix="个"
              valueStyle={{ fontSize: 20, color: '#722ed1' }}
            />
          </Col>
        </Row>

        {/* 订单状态明细 */}
        {summary.totalOrders > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">已完成</Text>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                    {summary.completedOrders}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">进行中</Text>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#faad14' }}>
                    {summary.pendingOrders}
                  </div>
                </div>
              </Col>
            </Row>
          </>
        )}

        {/* 收款码 */}
        {(qrcodes.alipay || qrcodes.wechat) && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ textAlign: 'center' }}>
              <Space direction="vertical" size="small">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <QrcodeOutlined /> 扫码支付
                </Text>
                <Space>
                  {qrcodes.alipay && (
                    <img
                      src={qrcodes.alipay}
                      alt="支付宝收款码"
                      style={{ width: 100, height: 100, borderRadius: 8 }}
                    />
                  )}
                  {qrcodes.wechat && (
                    <img
                      src={qrcodes.wechat}
                      alt="微信收款码"
                      style={{ width: 100, height: 100, borderRadius: 8 }}
                    />
                  )}
                </Space>
              </Space>
            </div>
          </>
        )}

        {/* 订单列表 */}
        {todayOrders.length > 0 && (
          <Table
            dataSource={todayOrders}
            columns={[
              {
                title: '订单号',
                dataIndex: 'orderNumber',
                key: 'orderNumber',
                width: 120,
              },
              {
                title: '客户',
                dataIndex: 'customerName',
                key: 'customerName',
              },
              {
                title: '金额',
                dataIndex: 'totalAmount',
                key: 'totalAmount',
                render: (amount: number) => (
                  <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{amount.toFixed(2)}</span>
                ),
              },
              {
                title: '状态',
                dataIndex: 'isConfirmed',
                key: 'isConfirmed',
                render: (confirmed: boolean) => (
                  <Tag color={confirmed ? 'green' : 'orange'}>
                    {confirmed ? '已完成' : '进行中'}
                  </Tag>
                ),
              },
            ]}
            rowKey="id"
            size="small"
            pagination={false}
            expandable={{
              expandedRowRender: (record: Order) => (
                <div style={{ padding: '8px 0' }}>
                  {/* 图案明细 */}
                  {record.items && record.items.length > 0 && (
                    <>
                      <Text strong style={{ fontSize: 12 }}>图案明细</Text>
                      <Table
                        dataSource={record.items}
                        columns={[
                          { title: '图案', dataIndex: 'patternName', key: 'patternName', width: 120 },
                          { title: '颜色', dataIndex: 'colorVariantName', key: 'colorVariantName', width: 60, render: (v: string) => v || '-' },
                          {
                            title: '数量',
                            dataIndex: 'quantity',
                            key: 'quantity',
                            width: 80,
                            render: (_: unknown, r: OrderPatternItem) =>
                              r.pricingMode === 'AREA' ? `${r.area || 0}㎡` : `${r.quantity}个`,
                          },
                          {
                            title: '单价',
                            dataIndex: 'unitPrice',
                            key: 'unitPrice',
                            width: 70,
                            render: (p: number) => `¥${p.toFixed(2)}`,
                          },
                          {
                            title: '小计',
                            dataIndex: 'totalPrice',
                            key: 'totalPrice',
                            width: 80,
                            render: (p: number) => `¥${p.toFixed(2)}`,
                          },
                        ]}
                        rowKey="id"
                        size="small"
                        pagination={false}
                      />
                    </>
                  )}

                  {/* 产品明细 */}
                  {record.productItems && record.productItems.length > 0 && (
                    <>
                      <div style={{ marginTop: 8 }}>
                        <Text strong style={{ fontSize: 12 }}>产品明细</Text>
                      </div>
                      <Table
                        dataSource={record.productItems}
                        columns={[
                          { title: '产品', dataIndex: 'productName', key: 'productName', width: 120 },
                          { title: '颜色', dataIndex: 'color', key: 'color', width: 60, render: () => '-' },
                          { title: '单位', dataIndex: 'productUnit', key: 'productUnit', width: 60, render: (u: string) => <Tag>{u}</Tag> },
                          { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
                          {
                            title: '单价',
                            dataIndex: 'price',
                            key: 'price',
                            width: 70,
                            render: (p: number) => `¥${p.toFixed(2)}`,
                          },
                          {
                            title: '小计',
                            dataIndex: 'subtotal',
                            key: 'subtotal',
                            width: 80,
                            render: (s: number) => <strong style={{ color: '#52c41a' }}>¥{s.toFixed(2)}</strong>,
                          },
                        ]}
                        rowKey="id"
                        size="small"
                        pagination={false}
                      />
                    </>
                  )}
                </div>
              ),
            }}
            style={{ marginTop: 16 }}
          />
        )}

        {/* 无数据提示 */}
        {summary.totalOrders === 0 && !loading && (
          <Empty
            description="今日暂无订单"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '20px 0' }}
          />
        )}
      </Card>
    </Spin>
  );
}
