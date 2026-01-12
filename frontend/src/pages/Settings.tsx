import { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Tabs,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Table,
  App,
  Tag,
  Modal,
  Popconfirm,
  Descriptions,
  Row,
  Col,
  ColorPicker,
  Statistic,
} from 'antd';
import {
  ReloadOutlined,
  SaveOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { ColorPreset, SystemLog } from '@/types';
import { SettingsApi, ColorPresetApi, SystemLogApi } from '@/services/tauriApi';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function Settings() {
  const { message } = App.useApp();
  // ========== 配置管理状态 ==========
  const [configForm] = Form.useForm();
  const [configsLoading, setConfigsLoading] = useState(false);

  // ========== 颜色预设状态 ==========
  const [colorPresets, setColorPresets] = useState<ColorPreset[]>([]);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorPreset | null>(null);
  const [colorForm] = Form.useForm();
  const [colorsLoading, setColorsLoading] = useState(false);

  // ========== 系统日志状态 ==========
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logStats, setLogStats] = useState<Record<string, unknown> | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // ========== 数据加载 ==========
  const loadConfigs = async () => {
    try {
      setConfigsLoading(true);
      const data = await SettingsApi.getAllConfigs();

      // 设置表单初始值
      const formValues: Record<string, string> = {};
      data.forEach((config) => {
        formValues[config.key] = config.value;
      });
      configForm.setFieldsValue(formValues);
    } catch (error) {
      message.error('加载配置失败: ' + error);
    } finally {
      setConfigsLoading(false);
    }
  };

  const loadColorPresets = async () => {
    try {
      setColorsLoading(true);
      let data = await ColorPresetApi.getAll();

      // 如果没有数据，自动初始化种子数据
      if (data.length === 0) {
        console.log('[颜色预设] 表为空，正在初始化种子数据...');
        message.loading('正在初始化颜色预设...', 0);

        try {
          data = await SettingsApi.seedColorPresets();
          message.destroy();
          message.success(`已初始化 ${data.length} 个常用颜色预设`);
        } catch (error) {
          message.destroy();
          console.error('[颜色预设] 初始化失败:', error);
          message.warning('颜色预设初始化失败，请手动添加');
        }
      }

      setColorPresets(data);
      console.log('[颜色预设] 加载完成，共', data.length, '条');
    } catch (error) {
      console.error('[颜色预设] 加载失败:', error);
      message.error('加载颜色预设失败: ' + error);
    } finally {
      setColorsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const result = await SystemLogApi.getLogs({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setLogs(result.data);
      setPagination({
        ...pagination,
        total: result.total,
      });
    } catch (error) {
      message.error('加载日志失败: ' + error);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadLogStats = async () => {
    try {
      const stats = await SystemLogApi.getStats(30);
      setLogStats(stats);
    } catch (error) {
      console.error('加载日志统计失败:', error);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadColorPresets();
    loadLogs();
    loadLogStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize]);

  // ========== 配置管理处理 ==========
  const handleSaveConfigs = async () => {
    try {
      const values = await configForm.validateFields();
      const configsToUpdate = Object.entries(values).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      await SettingsApi.batchUpdateConfigs(configsToUpdate);
      message.success('配置保存成功');
      loadConfigs();
    } catch (error) {
      message.error('保存配置失败: ' + error);
    }
  };

  // ========== 颜色预设处理 ==========
  const handleAddColor = () => {
    setEditingColor(null);
    colorForm.resetFields();
    setColorModalVisible(true);
  };

  const handleEditColor = (color: ColorPreset) => {
    setEditingColor(color);
    colorForm.setFieldsValue({
      name: color.name,
      displayName: color.displayName,
      color: color.color,
      sortOrder: color.sortOrder,
    });
    setColorModalVisible(true);
  };

  const handleSaveColor = async () => {
    try {
      const values = await colorForm.validateFields();

      if (editingColor) {
        await ColorPresetApi.update(editingColor.id, {
          name: values.name,
          displayName: values.displayName,
          color: values.color,
          sortOrder: values.sortOrder,
        });
        message.success('颜色预设更新成功');
      } else {
        await ColorPresetApi.create({
          name: values.name,
          displayName: values.displayName,
          color: values.color,
          sortOrder: values.sortOrder,
        });
        message.success('颜色预设创建成功');
      }

      setColorModalVisible(false);
      colorForm.resetFields();
      setEditingColor(null);
      loadColorPresets();
    } catch (error) {
      message.error('操作失败: ' + error);
    }
  };

  const handleDeleteColor = async (id: string) => {
    try {
      await ColorPresetApi.delete(id);
      message.success('删除成功');
      loadColorPresets();
    } catch (error) {
      message.error('删除失败: ' + error);
    }
  };

  // ========== 系统日志处理 ==========
  const handleCleanupLogs = async () => {
    try {
      const deleted = await SystemLogApi.cleanupOldLogs(90);
      message.success(`已清理 ${deleted} 条超过 90 天的日志`);
      loadLogs();
      loadLogStats();
    } catch (error) {
      message.error('清理日志失败: ' + error);
    }
  };

  // ========== 表格列定义 ==========
  const colorColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '显示名称', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      render: (color: string) => (
        <div
          style={{
            width: 32,
            height: 32,
            backgroundColor: color,
            border: '1px solid #d9d9d9',
            borderRadius: 4,
          }}
        />
      ),
    },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'default'}>{isActive ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: ColorPreset) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditColor(record)}
          />
          <Popconfirm
            title="确认删除"
            description="确定要删除这个颜色预设吗？"
            onConfirm={() => handleDeleteColor(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => {
        const colorMap: Record<string, string> = {
          INFO: 'blue',
          WARNING: 'orange',
          ERROR: 'red',
        };
        return <Tag color={colorMap[level] || 'default'}>{level}</Tag>;
      },
    },
    { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
    { title: '操作员', dataIndex: 'operatorName', key: 'operatorName', width: 120 },
  ];

  // ========== 渲染 ==========
  return (
    <div>
      <Title level={3}>系统设置</Title>

      <Tabs
        defaultActiveKey="general"
        items={[
          {
            key: 'general',
            label: '基本设置',
            children: (
              <>
                <Card
                  title="应用配置"
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadConfigs} loading={configsLoading}>
                        刷新
                      </Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        onClick={handleSaveConfigs}
                      >
                        保存配置
                      </Button>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Form form={configForm} layout="vertical">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="公司名称"
                          name="company_name"
                          extra="用于发票和报表显示"
                        >
                          <Input placeholder="请输入公司名称" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="默认每平方单价"
                          name="default_price_per_sq"
                          extra="单位：元/平方米"
                        >
                          <InputNumber
                            placeholder="请输入默认单价"
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="默认信用额度"
                          name="default_credit_limit"
                          extra="新客户的默认信用额度"
                        >
                          <InputNumber
                            placeholder="请输入默认信用额度"
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="日志保留天数"
                          name="log_retention_days"
                          extra="系统日志自动清理天数"
                        >
                          <InputNumber
                            placeholder="请输入保留天数"
                            style={{ width: '100%' }}
                            min={7}
                            max={365}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                </Card>

                <Card title="应用信息">
                  <Descriptions column={2} bordered>
                    <Descriptions.Item label="应用名称">白墨记账系统</Descriptions.Item>
                    <Descriptions.Item label="版本">0.1.0</Descriptions.Item>
                    <Descriptions.Item label="技术栈" span={2}>
                      Tauri 2.x + React 19 + TypeScript
                    </Descriptions.Item>
                    <Descriptions.Item label="数据库">SQLite (本地存储)</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color="green">运行中</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </>
            ),
          },
          {
            key: 'colors',
            label: '颜色预设',
            children: (
              <>
                <Card
                  title="颜色预设管理"
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadColorPresets} loading={colorsLoading}>
                        刷新
                      </Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleAddColor}>
                        添加颜色
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    dataSource={colorPresets}
                    columns={colorColumns}
                    rowKey="id"
                    loading={colorsLoading}
                    pagination={false}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'logs',
            label: '系统日志',
            children: (
              <>
                {/* 日志统计 */}
                {logStats && (
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="统计周期"
                          value={logStats.periodDays || 30}
                          suffix="天"
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="总日志数"
                          value={
                            (logStats.stats as Array<{ level: string; count: number }>)?.reduce(
                              (sum, s) => sum + s.count,
                              0,
                            ) || 0
                          }
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card>
                        <Statistic
                          title="错误数"
                          value={
                            (logStats.stats as Array<{ level: string; count: number }>)?.find(
                              (s) => s.level === 'ERROR',
                            )?.count || 0
                          }
                          styles={{ content: { color: '#cf1322' } }}
                        />
                      </Card>
                    </Col>
                  </Row>
                )}

                <Card
                  title="系统日志"
                  extra={
                    <Space>
                      <Popconfirm
                        title="确认清理"
                        description="确定要清理 90 天前的日志吗？"
                        onConfirm={handleCleanupLogs}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button icon={<ClearOutlined />}>清理旧日志</Button>
                      </Popconfirm>
                      <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={logsLoading}>
                        刷新
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    dataSource={logs}
                    columns={logColumns}
                    rowKey="id"
                    loading={logsLoading}
                    pagination={{
                      current: pagination.current,
                      pageSize: pagination.pageSize,
                      total: pagination.total,
                      onChange: (page, pageSize) =>
                        setPagination({ ...pagination, current: page, pageSize: pageSize || 20 }),
                    }}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* 颜色预设编辑模态框 */}
      <Modal
        title={editingColor ? '编辑颜色预设' : '添加颜色预设'}
        open={colorModalVisible}
        onOk={handleSaveColor}
        onCancel={() => {
          setColorModalVisible(false);
          colorForm.resetFields();
          setEditingColor(null);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form form={colorForm} layout="vertical">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
            extra="系统内部使用的唯一标识"
          >
            <Input placeholder="例如：RED_001" disabled={!!editingColor} />
          </Form.Item>

          <Form.Item label="显示名称" name="displayName">
            <Input placeholder="例如：中国红" />
          </Form.Item>

          <Form.Item
            label="颜色值"
            name="color"
            rules={[{ required: true, message: '请选择颜色' }]}
            getValueProps={(value) => ({
              value: value,
            })}
            normalize={(value) => {
              // 将 ColorPicker 对象转换为 hex 字符串
              if (value && typeof value === 'object' && 'toHexString' in value) {
                return value.toHexString();
              }
              return value;
            }}
          >
            <ColorPicker showText />
          </Form.Item>

          <Form.Item label="排序" name="sortOrder">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
