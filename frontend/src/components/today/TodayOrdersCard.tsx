/**
 * 当天订单统计卡片组件
 * 显示今日订单汇总统计和收款码
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Divider, Space, Typography, Spin, Empty } from 'antd';
import { CalendarOutlined, QrcodeOutlined, DollarOutlined, AppstoreOutlined, BorderOutlined } from '@ant-design/icons';
import type { Order } from '@/types';
import { OrderApi, SettingsApi } from '@/services/tauriApi';
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

      // 筛选今日订单
      const todayOrders = allOrders.filter((order) =>
        dayjs(order.createdAt).isSame(dayjs(), 'day')
      );

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
