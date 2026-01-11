import { useState, useEffect } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Button,
  Space,
  Select,
  Tabs,
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

// 图表颜色配置
const COLORS = ['#3f8600', '#1890ff', '#cf1322', '#faad14', '#722ed1', '#13c2c2'];

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
      <h2>欢迎使用白墨记账系统</h2>

      {/* 基础统计卡片 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="客户总数"
              value={stats.customersCount}
              prefix={<UserOutlined />}
              styles={{ content: { color: '#3f8600' } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="图案总数"
              value={stats.patternsCount}
              prefix={<PictureOutlined />}
              styles={{ content: { color: '#1890ff' } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="订单总数"
              value={stats.ordersCount}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#cf1322' } }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月收入"
              value={stats.monthlyRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        {/* 收入趋势图 */}
        <Col span={16}>
          <Card
            title="生产统计趋势"
            extra={
              <Select
                value={period}
                onChange={(value) => setPeriod(value)}
                style={{ width: 120 }}
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
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={formatDailyData(productionStats.dailyBreakdown)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="收入"
                      stroke="#3f8600"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="订单数"
                      stroke="#1890ff"
                      strokeWidth={2}
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
          <Card title="客户余额分布">
            {financialOverview ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={getBalanceDistributionData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getBalanceDistributionData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
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
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card title="生产面积统计（平方米）">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={formatDailyData(productionStats.dailyBreakdown)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="面积" fill="#1890ff" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* 快捷操作 */}
      <Card title="快捷操作" style={{ marginTop: 24 }}>
        <Space vertical style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={() => onNavigate('orders')}
          >
            创建新订单
          </Button>
          <Button
            icon={<UserOutlined />}
            block
            onClick={() => onNavigate('customers')}
          >
            添加客户
          </Button>
          <Button
            icon={<PictureOutlined />}
            block
            onClick={() => onNavigate('patterns')}
          >
            添加图案
          </Button>
        </Space>
      </Card>
    </div>
  );
}
