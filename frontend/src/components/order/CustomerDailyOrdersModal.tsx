/**
 * 客户当天订单弹窗组件
 * 显示客户信息、当天订单汇总、支持复制图片功能
 */

import { useState, useEffect, useMemo } from 'react';
import { Modal, Card, List, Tag, Button, Space, Row, Col, App, Spin, Empty, Table, Typography } from 'antd';
import { CalendarOutlined, CopyOutlined, DownloadOutlined, UserOutlined, CheckOutlined } from '@ant-design/icons';
import { CustomerApi, OrderApi, PatternApi, SettingsApi } from '@/services/tauriApi';
import type { Customer, Order, Pattern } from '@/types';
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
  const [patterns, setPatterns] = useState<Record<string, Pattern>>({}); // 图案映射表
  const [paymentQrcodes, setPaymentQrcodes] = useState({ alipay: '', wechat: '' }); // 收款码
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  const targetDate = date || dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 并行加载客户、订单、图案和收款码数据
        const [customerData, allOrders, allPatterns, alipayQr, wechatQr] = await Promise.all([
          CustomerApi.getById(customerId),
          OrderApi.getAll(),
          PatternApi.getAll(),
          SettingsApi.getPaymentQrcodeImage('alipay'),
          SettingsApi.getPaymentQrcodeImage('wechat'),
        ]);

        setCustomer(customerData);
        setPaymentQrcodes({ alipay: alipayQr || '', wechat: wechatQr || '' });
        console.log('[收款码加载] 支付宝:', alipayQr ? '已配置' : '未配置', '微信:', wechatQr ? '已配置' : '未配置');

        // 创建图案映射表（patternId -> Pattern）
        const patternMap: Record<string, Pattern> = {};
        allPatterns.forEach(p => {
          patternMap[p.id] = p;
        });
        setPatterns(patternMap);

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
        console.error('[CustomerDailyOrdersModal] 加载数据失败:', error);
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

  // 计算汇总统计（使用 useMemo，当 patterns 或 orders 变化时重新计算）
  const stats = useMemo(() => {
    console.log('=== 计算今日统计 ===');
    console.log('Patterns 数据:', patterns);
    console.log('Orders 数据:', orders);

    let totalPatternsCount = 0;
    let totalAreaCount = 0;

    orders.forEach((order) => {
      console.log(`订单 ${order.orderNumber}:`);
      order.items.forEach((item) => {
        const pattern = patterns[item.patternId];

        // 计算每平方个数：每平方个数 = (1600 / 总高度mm) × 每行个数
        const actualHeightMM = (pattern?.actualHeight || 0) * 10; // 厘米转毫米
        const bleedHeightMM = (pattern?.bleedHeight || 0) * 10;
        const totalHeightMM = actualHeightMM + bleedHeightMM;
        const unitsPerRow = pattern?.unitsPerRow || 1;
        const patternsPerSquare = totalHeightMM > 0 ? (1600 / totalHeightMM) * unitsPerRow : 1;

        console.log(`  - 图案ID: ${item.patternId}, 单位: ${item.pricingMode}, 数量: ${item.quantity}, 面积: ${item.area}, 金额: ${item.totalPrice}`);
        console.log(`    图案信息: 实际高度=${actualHeightMM}mm, 出血=${bleedHeightMM}mm, 每行个数=${unitsPerRow}, 每平方个数=${patternsPerSquare.toFixed(1)}`);

        if (item.pricingMode === 'QUANTITY') {
          totalPatternsCount += item.quantity;
        } else {
          // 按平方数下单的，面积转换为个数（取整）
          totalPatternsCount += Math.round((item.area || 0) * patternsPerSquare);
        }
      });
    });

    // 平方数 = 订单金额 / 用户单价
    totalAreaCount = customer && customer.unitPrice > 0
      ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / customer.unitPrice
      : 0;

    console.log(`最终结果: 个数=${totalPatternsCount}, 平方数=${totalAreaCount}, 订单金额=${orders.reduce((sum, order) => sum + order.totalAmount, 0)}, 用户单价=${customer?.unitPrice}`);

    return {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      totalPatterns: totalPatternsCount,
      totalArea: totalAreaCount,
    };
  }, [orders, patterns, customer]);

  // 获取当前时间（用于比较）
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month(); // 0-11

  // 计算本月和今年累计统计（使用 useMemo，当 patterns 或 allCustomerOrders 变化时重新计算）
  const monthlyStats = useMemo(() => {
    const monthlyOrders = allCustomerOrders.filter((order) => {
      const orderDate = dayjs(order.createdAt);
      return orderDate.year() === currentYear && orderDate.month() === currentMonth;
    });

    let patternsCount = 0;
    let areaCount = 0;
    const totalAmount = monthlyOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    monthlyOrders.forEach((order) => {
      order.items.forEach((item) => {
        const pattern = patterns[item.patternId];
        // 计算每平方个数
        const actualHeightMM = (pattern?.actualHeight || 0) * 10;
        const bleedHeightMM = (pattern?.bleedHeight || 0) * 10;
        const totalHeightMM = actualHeightMM + bleedHeightMM;
        const unitsPerRow = pattern?.unitsPerRow || 1;
        const patternsPerSquare = totalHeightMM > 0 ? (1600 / totalHeightMM) * unitsPerRow : 1;

        if (item.pricingMode === 'QUANTITY') {
          patternsCount += item.quantity;
        } else {
          // 按平方数下单的，面积转换为个数（取整）
          patternsCount += Math.round((item.area || 0) * patternsPerSquare);
        }
      });
    });

    // 平方数 = 订单金额 / 用户单价
    areaCount = customer && customer.unitPrice > 0
      ? totalAmount / customer.unitPrice
      : 0;

    return { orderCount: monthlyOrders.length, patterns: patternsCount, area: areaCount, amount: totalAmount };
  }, [allCustomerOrders, patterns, currentYear, currentMonth, customer]);

  // 计算今年累计统计（使用 useMemo，当 patterns 或 allCustomerOrders 变化时重新计算）
  const yearlyStats = useMemo(() => {
    const yearlyOrders = allCustomerOrders.filter((order) =>
      dayjs(order.createdAt).year() === currentYear
    );

    let patternsCount = 0;
    let areaCount = 0;
    const totalAmount = yearlyOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    yearlyOrders.forEach((order) => {
      order.items.forEach((item) => {
        const pattern = patterns[item.patternId];
        // 计算每平方个数
        const actualHeightMM = (pattern?.actualHeight || 0) * 10;
        const bleedHeightMM = (pattern?.bleedHeight || 0) * 10;
        const totalHeightMM = actualHeightMM + bleedHeightMM;
        const unitsPerRow = pattern?.unitsPerRow || 1;
        const patternsPerSquare = totalHeightMM > 0 ? (1600 / totalHeightMM) * unitsPerRow : 1;

        if (item.pricingMode === 'QUANTITY') {
          patternsCount += item.quantity;
        } else {
          // 按平方数下单的，面积转换为个数（取整）
          patternsCount += Math.round((item.area || 0) * patternsPerSquare);
        }
      });
    });

    // 平方数 = 订单金额 / 用户单价
    areaCount = customer && customer.unitPrice > 0
      ? totalAmount / customer.unitPrice
      : 0;

    return { orderCount: yearlyOrders.length, patterns: patternsCount, area: areaCount, amount: totalAmount };
  }, [allCustomerOrders, patterns, currentYear, customer]);

  // 从 monthlyStats 和 yearlyStats 中提取值
  const monthlyOrderCount = monthlyStats.orderCount;
  const monthlyPatterns = monthlyStats.patterns;
  const monthlyArea = monthlyStats.area;
  const monthlyAmount = monthlyStats.amount;
  const yearlyOrderCount = yearlyStats.orderCount;
  const yearlyPatterns = yearlyStats.patterns;
  const yearlyArea = yearlyStats.area;
  const yearlyAmount = yearlyStats.amount;

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
                <Col span={12} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {/* 第一行：客户名称 + 余额 */}
                  <Row gutter={24} style={{ marginBottom: 16 }}>
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

                  {/* 第二行：本月累计 */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>📅 本月累计</span>
                    </div>
                    <Row gutter={12}>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>订单</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>{monthlyOrderCount}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>个数</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                            {Number.isInteger(monthlyPatterns) ? monthlyPatterns : monthlyPatterns.toFixed(1)}
                          </div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>平方</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#8b5cf6' }}>{monthlyArea.toFixed(2)}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>金额</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#faad14' }}>{monthlyAmount.toFixed(0)}</div>
                        </div>
                      </Col>
                    </Row>
                  </div>

                  {/* 第三行：今年累计 */}
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 500 }}>📆 今年累计</span>
                    </div>
                    <Row gutter={12}>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>订单</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>{yearlyOrderCount}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>个数</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                            {Number.isInteger(yearlyPatterns) ? yearlyPatterns : yearlyPatterns.toFixed(1)}
                          </div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>平方</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#8b5cf6' }}>{yearlyArea.toFixed(2)}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>金额</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#faad14' }}>{yearlyAmount.toFixed(0)}</div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Col>

                {/* 右侧：今日统计 + 收款码 */}
                <Col span={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {/* 今日数据 */}
                  <div>
                    <div style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500, marginBottom: 16 }}>
                      📅 今日数据
                    </div>
                    <Row gutter={12}>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>订单数</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: '#1890ff' }}>{stats.totalOrders}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>个数</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>
                            {Number.isInteger(stats.totalPatterns) ? stats.totalPatterns : stats.totalPatterns.toFixed(1)}
                          </div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>平方数</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: '#8b5cf6' }}>
                            {stats.totalArea.toFixed(2)}
                          </div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>金额</div>
                          <div style={{ fontSize: 20, fontWeight: 600, color: '#faad14' }}>
                            {stats.totalAmount.toFixed(0)}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>

                  {/* 收款码 */}
                  {(paymentQrcodes.alipay || paymentQrcodes.wechat) && (
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 10, fontSize: 12 }}>
                        扫码支付
                      </Typography.Text>
                      <Space size={20}>
                        {paymentQrcodes.alipay && (
                          <div>
                            <img
                              src={paymentQrcodes.alipay}
                              alt="支付宝"
                              style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0', padding: 4, backgroundColor: '#fafafa' }}
                            />
                            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>支付宝</div>
                          </div>
                        )}
                        {paymentQrcodes.wechat && (
                          <div>
                            <img
                              src={paymentQrcodes.wechat}
                              alt="微信"
                              style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0', padding: 4, backgroundColor: '#fafafa' }}
                            />
                            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>微信</div>
                          </div>
                        )}
                      </Space>
                    </div>
                  )}
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

                    {/* 产品明细表格 */}
                    {order.productItems && order.productItems.length > 0 && (
                      <>
                        <Typography.Text strong style={{ fontSize: 12 }}>产品明细</Typography.Text>
                        <Table
                          columns={[
                            {
                              title: '产品名称',
                              dataIndex: 'productName',
                              key: 'productName',
                              width: 150,
                            },
                            {
                              title: '颜色',
                              dataIndex: 'color',
                              key: 'color',
                              width: 80,
                              render: () => '-',
                            },
                            {
                              title: '单位',
                              dataIndex: 'productUnit',
                              key: 'productUnit',
                              width: 60,
                              render: (unit: string) => <Tag>{unit}</Tag>,
                            },
                            {
                              title: '数量',
                              dataIndex: 'quantity',
                              key: 'quantity',
                              width: 60,
                            },
                            {
                              title: '单价(元)',
                              dataIndex: 'price',
                              key: 'price',
                              width: 80,
                              render: (value: number) => `¥${value.toFixed(2)}`,
                            },
                            {
                              title: '合计(元)',
                              dataIndex: 'subtotal',
                              key: 'subtotal',
                              width: 80,
                              render: (value: number) => (
                                <Typography.Text strong style={{ color: '#52c41a' }}>
                                  ¥{value.toFixed(2)}
                                </Typography.Text>
                              ),
                            },
                          ]}
                          dataSource={order.productItems}
                          pagination={false}
                          size="small"
                          rowKey="id"
                          style={{ marginBottom: 8 }}
                        />
                      </>
                    )}

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
