import { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Button,
  Space,
  Select,
  Spin,
} from 'antd';
import {
  UserOutlined,
  PictureOutlined,
  FileTextOutlined,
  DollarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DashboardStats, ProductionStats, CompanyFinancialOverview, DailyStats } from '@/types';
import { StatsApi } from '@/services/tauriApi';
import type { MenuKey } from '@/components/layout/Layout';
import dayjs from 'dayjs';

interface DashboardProps {
  onNavigate: (key: MenuKey) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    customersCount: 0,
    patternsCount: 0,
    ordersCount: 0,
    monthlyRevenue: 0,
  });
  const [financialOverview, setFinancialOverview] = useState<CompanyFinancialOverview | null>(null);
  const [productionStats, setProductionStats] = useState<ProductionStats | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // 加载基础统计数据
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await StatsApi.getDashboard();
        setStats(data);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  // 加载财务概览
  useEffect(() => {
    const loadFinancialOverview = async () => {
      try {
        const data = await StatsApi.getCompanyFinancialOverview();
        setFinancialOverview(data);
      } catch (error) {
        console.error('加载财务概览失败:', error);
      }
    };
    loadFinancialOverview();
  }, []);

  // 加载生产统计数据
  useEffect(() => {
    const loadProductionStats = async () => {
      setStatsLoading(true);
      try {
        const data = await StatsApi.getProductionStats(period);
        setProductionStats(data);
      } catch (error) {
        console.error('加载生产统计失败:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    loadProductionStats();
  }, [period]);

  // 处理每日数据，用于图表展示
  const formatDailyData = (dailyStats: DailyStats[]) => {
    return dailyStats.map((item) => ({
      date: dayjs(item.date).format('MM-DD'),
      收入: item.revenue,
      面积: Number(item.area.toFixed(2)),
      订单数: item.orderCount,
    }));
  };

  // 客户余额分布数据
  const getBalanceDistributionData = () => {
    if (!financialOverview) return [];
    return [
      { name: '正余额', value: financialOverview.positiveCount, color: '#3f8600' },
      { name: '负余额', value: financialOverview.negativeCount, color: '#cf1322' },
      { name: '零余额', value: financialOverview.zeroCount, color: '#d9d9d9' },
    ];
  };

  return (
    <div>
      {/* 欢迎标题 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          欢迎使用PNG部落记账系统
        </h2>
        <p style={{ color: '#666', margin: 0 }}>
          实时掌握您的业务数据，高效管理印花订单
        </p>
      </div>

      {/* 基础统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card className="stat-card fade-in">
            <Statistic
              title="客户总数"
              value={stats.customersCount}
              prefix={<UserOutlined style={{ color: '#1a5f4c' }} />}
              styles={{ content: { color: '#1a5f4c', fontWeight: 600 } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card fade-in fade-in-delay-1">
            <Statistic
              title="图案总数"
              value={stats.patternsCount}
              prefix={<PictureOutlined style={{ color: '#1890ff' }} />}
              styles={{ content: { color: '#1890ff', fontWeight: 600 } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card fade-in fade-in-delay-2">
            <Statistic
              title="订单总数"
              value={stats.ordersCount}
              prefix={<FileTextOutlined style={{ color: '#e07a5f' }} />}
              styles={{ content: { color: '#e07a5f', fontWeight: 600 } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card fade-in fade-in-delay-3">
            <Statistic
              title="本月收入"
              value={stats.monthlyRevenue}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              loading={loading}
              styles={{ content: { color: '#52c41a', fontWeight: 600 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 收入趋势图 */}
        <Col span={16}>
          <Card
            className="fade-in fade-in-delay-4"
            title={
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                生产统计趋势
              </span>
            }
            extra={
              <Select
                value={period}
                onChange={(value) => setPeriod(value)}
                style={{ width: 120 }}
                size="large"
              >
                <Select.Option value="week">最近一周</Select.Option>
                <Select.Option value="month">本月</Select.Option>
              </Select>
            }
          >
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin />
              </div>
            ) : productionStats && productionStats.dailyBreakdown.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={formatDailyData(productionStats.dailyBreakdown)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
                    <XAxis dataKey="date" stroke="#666" fontSize={12} />
                    <YAxis yAxisId="left" stroke="#666" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '13px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="收入"
                      stroke="#1a5f4c"
                      strokeWidth={2.5}
                      dot={{ fill: '#1a5f4c', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="订单数"
                      stroke="#e07a5f"
                      strokeWidth={2.5}
                      dot={{ fill: '#e07a5f', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>

        {/* 客户余额分布 */}
        <Col span={8}>
          <Card
            className="fade-in fade-in-delay-5"
            title={
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                客户余额分布
              </span>
            }
          >
            {financialOverview ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={getBalanceDistributionData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={75}
                    fill="#8884d8"
                    dataKey="value"
                    fontSize={12}
                  >
                    {getBalanceDistributionData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '13px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 生产面积统计 */}
      {productionStats && productionStats.dailyBreakdown.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title={
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  生产面积统计（平方米）
                </span>
              }
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={formatDailyData(productionStats.dailyBreakdown)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
                  <XAxis dataKey="date" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '13px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="面积" fill="#1a5f4c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* 快捷操作 */}
      <Card
        title={
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            快捷操作
          </span>
        }
        style={{ marginBottom: 24 }}
      >
        <Space vertical style={{ width: '100%' }} size="middle">
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            block
            onClick={() => onNavigate('orders')}
            style={{ height: 48, fontWeight: 500 }}
          >
            创建新订单
          </Button>
          <Button
            size="large"
            icon={<UserOutlined />}
            block
            onClick={() => onNavigate('customers')}
            style={{ height: 48, fontWeight: 500 }}
          >
            添加客户
          </Button>
          <Button
            size="large"
            icon={<PictureOutlined />}
            block
            onClick={() => onNavigate('patterns')}
            style={{ height: 48, fontWeight: 500 }}
          >
            添加图案
          </Button>
        </Space>
      </Card>
    </div>
  );
}
