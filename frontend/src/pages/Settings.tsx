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
  ExportOutlined,
  ImportOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  UploadOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';
import type { ColorPreset, SystemLog } from '@/types';
import { SettingsApi, ColorPresetApi, SystemLogApi, FinancialApi, BackupApi, WebsiteApi, FileDialogApi } from '@/services/tauriApi';
import { useStore } from '@/store/useStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function Settings() {
  const { message } = App.useApp();
  const { loadConfig } = useStore();

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

  // ========== 收款码管理状态 ==========
  const [paymentQrcodes, setPaymentQrcodes] = useState({
    alipay: null as string | null,
    wechat: null as string | null,
  });
  const [qrcodesLoading, setQrcodesLoading] = useState(false);

  // ========== 数据加载 ==========
  const loadConfigs = async () => {
    try {
      setConfigsLoading(true);
      let data = await SettingsApi.getAllConfigs();

      // 如果没有配置数据，初始化默认配置
      if (data.length === 0) {
        console.log('[配置] 表为空，正在初始化默认配置...');
        message.loading('正在初始化默认配置...', 0);
        try {
          data = await SettingsApi.initializeDefaultConfigs();
          message.destroy();
          message.success(`已初始化 ${data.length} 个默认配置`);
        } catch (error) {
          message.destroy();
          console.error('[配置] 初始化失败:', error);
          message.warning('默认配置初始化失败');
        }
      }

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

  const loadPaymentQrcodes = async () => {
    try {
      setQrcodesLoading(true);
      const [alipay, wechat] = await Promise.all([
        SettingsApi.getPaymentQrcodeImage('alipay'),
        SettingsApi.getPaymentQrcodeImage('wechat'),
      ]);
      setPaymentQrcodes({ alipay, wechat });
    } catch (error) {
      console.error('加载收款码失败:', error);
    } finally {
      setQrcodesLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadColorPresets();
    loadLogs();
    loadLogStats();
    loadPaymentQrcodes();
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
      // 重新加载配置以更新全局状态
      loadConfig();
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

  // ========== 收款码处理 ==========
  const handleUploadQrcode = async (paymentType: 'alipay' | 'wechat') => {
    try {
      const title = paymentType === 'alipay' ? '选择支付宝收款码图片' : '选择微信收款码图片';
      const filePath = await FileDialogApi.openFile({
        title,
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (filePath) {
        message.loading('正在上传收款码...', 0);
        await SettingsApi.uploadPaymentQrcode(paymentType, filePath);
        message.destroy();
        message.success('收款码上传成功');
        loadPaymentQrcodes();
      }
    } catch (error) {
      message.destroy();
      message.error('上传失败: ' + error);
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

  // ========== 数据迁移处理 ==========
  const handleMigrateOrderRecords = async () => {
    Modal.confirm({
      title: '补充历史订单财务记录',
      content: '将为所有已确认订单创建对应的财务记录，是否继续？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.loading('正在迁移数据...', 0);
          const result = await FinancialApi.migrateOrderRecords();
          message.destroy();
          message.success(result);
          loadLogs();
        } catch (error) {
          message.destroy();
          message.error('迁移失败: ' + error);
        }
      },
    });
  };

  // ========== 打开官网 ==========
  const handleOpenWebsite = async () => {
    try {
      await WebsiteApi.openWebsite();
    } catch (error) {
      console.error('Failed to open website:', error);
    }
  };

  // ========== 数据管理处理 ==========
  const handleExportData = async () => {
    try {
      message.loading('正在导出数据...', 0);
      const jsonData = await BackupApi.exportData();
      message.destroy();

      // 使用文件对话框保存
      const filePath = await FileDialogApi.saveFile({
        title: '导出数据',
        defaultName: `baimo_backup_${dayjs().format('YYYYMMDD_HHmmss')}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        await FileDialogApi.saveTextFile(filePath, jsonData);
        message.success('数据导出成功');
      } else {
        message.info('已取消导出');
      }
    } catch (error) {
      message.destroy();
      message.error('导出失败: ' + error);
    }
  };

  const handleImportData = async () => {
    try {
      // 使用文件对话框选择文件
      const selected = await FileDialogApi.openFile({
        title: '选择要导入的数据文件',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (selected) {
        // 读取文件内容
        const contents = await FileDialogApi.readTextFile(selected);

        Modal.confirm({
          title: '确认导入',
          content: '导入数据将覆盖现有数据，是否继续？',
          okText: '确认导入',
          okButtonProps: { danger: true },
          onOk: async () => {
            try {
              message.loading('正在导入数据...', 0);
              const result = await BackupApi.importData(contents);
              message.destroy();
              message.success(result);
              // 刷新所有数据
              loadConfigs();
              loadColorPresets();
              loadLogs();
            } catch (error) {
              message.destroy();
              message.error('导入失败: ' + error);
            }
          },
        });
      }
    } catch (error) {
      message.error('选择文件失败: ' + error);
    }
  };

  const handleBackupDatabase = async () => {
    try {
      // 使用文件系统 API 保存文件
      const filePath = await BackupApi.getDatabasePath();
      message.info(`数据库位置: ${filePath}\n请手动复制文件进行备份`);
    } catch (error) {
      message.error('获取数据库路径失败: ' + error);
    }
  };

  const handleClearData = async () => {
    Modal.confirm({
      title: '⚠️ 危险操作警告',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ marginBottom: 16, fontWeight: 'bold', color: '#ff4d4f' }}>
            此操作将清空所有业务数据，包括：
          </p>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>所有客户信息</li>
            <li>所有订单和订单项</li>
            <li>所有图案和产品</li>
            <li>所有财务记录</li>
          </ul>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            此操作不可恢复！建议先备份数据。
          </p>
          <p>输入 "CLEAR" 以确认清空操作：</p>
        </div>
      ),
      okText: '确认清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          let inputText = '';
          Modal.confirm({
            title: '二次确认',
            content: (
              <div>
                <p>请输入 <code style={{ background: '#f0f0f0', padding: '2px 6px' }}>CLEAR</code> 以确认清空所有数据：</p>
                <Input
                  placeholder="请输入 CLEAR"
                  onChange={(e) => { inputText = e.target.value; }}
                  autoFocus
                />
              </div>
            ),
            okText: '确认',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: async () => {
              if (inputText !== 'CLEAR') {
                message.error('输入错误，操作已取消');
                reject();
                return;
              }

              try {
                message.loading('正在清空数据...', 0);
                const result = await BackupApi.clearAllData();
                message.destroy();
                message.success(result);
                // 刷新所有数据
                loadConfigs();
                loadColorPresets();
                loadLogs();
                resolve();
              } catch (error) {
                message.destroy();
                message.error('清空失败: ' + error);
                reject();
              }
            },
            onCancel: () => {
              reject();
            },
          });
        });
      },
    });
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
                      <Col span={8}>
                        <Form.Item
                          label="公司完整名称"
                          name="company_name"
                          extra="用于发票和报表显示"
                        >
                          <Input placeholder="请输入公司完整名称" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="公司简称"
                          name="company_short_name"
                          extra="用于界面显示"
                        >
                          <Input placeholder="请输入公司简称" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="公司英文名称"
                          name="company_english_name"
                          extra="用于英文显示"
                        >
                          <Input placeholder="请输入公司英文名称" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="默认每平方单价"
                          name="default_price_per_sq"
                          extra="单位：元/平方米，新客户的默认单价"
                        >
                          <InputNumber
                            placeholder="请输入默认单价"
                            style={{ width: '100%' }}
                            min={0}
                            precision={2}
                          />
                        </Form.Item>
                      </Col>
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
                    </Row>

                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item
                          label="默认出血高度"
                          name="default_bleed_height"
                          extra="单位：厘米"
                        >
                          <InputNumber
                            placeholder="请输入默认出血高度"
                            style={{ width: '100%' }}
                            min={0}
                            precision={1}
                            step={0.1}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item
                          label="价格公式常数"
                          name="pricing_formula_constant"
                          extra="当前值：1600（行业标准）"
                        >
                          <InputNumber
                            placeholder="请输入公式常数"
                            style={{ width: '100%' }}
                            min={1}
                            precision={0}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
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

                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Item
                          label="价格计算公式"
                          extra="图案单价 = 客户每平方单价 ÷ (价格公式常数 ÷ (实际高度 + 出血高度) × 每行个数)"
                        >
                          <Input.TextArea
                            value="单价 = 客户单价 ÷ (公式常数 ÷ (实际高度 + 出血高度) × 每行个数)"
                            readOnly
                            style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>
                </Card>

                <Card
                  title="应用信息"
                  extra={
                    <Button
                      icon={<GlobalOutlined />}
                      onClick={handleOpenWebsite}
                      style={{
                        fontWeight: 600,
                        backgroundColor: '#ff6b35',
                        borderColor: '#ff6b35',
                        color: '#fff',
                        fontSize: 18,
                        padding: '6px 20px',
                        height: 'auto',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff5722';
                        e.currentTarget.style.borderColor = '#ff5722';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff6b35';
                        e.currentTarget.style.borderColor = '#ff6b35';
                      }}
                    >
                      PNG部落，AI生成高清图案
                    </Button>
                  }
                >
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
                          value={(logStats.periodDays as number) || 30}
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
                      <Button onClick={handleMigrateOrderRecords}>补充历史订单财务记录</Button>
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
          {
            key: 'payment',
            label: '收款码设置',
            children: (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card
                      title={
                        <Space>
                          <QrcodeOutlined />
                          支付宝收款码
                        </Space>
                      }
                      extra={
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => handleUploadQrcode('alipay')}
                          loading={qrcodesLoading}
                        >
                          上传
                        </Button>
                      }
                    >
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        {paymentQrcodes.alipay ? (
                          <img
                            src={paymentQrcodes.alipay}
                            alt="支付宝收款码"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 400,
                              borderRadius: 8,
                              border: '1px solid #d9d9d9',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              padding: 60,
                              border: '2px dashed #d9d9d9',
                              borderRadius: 8,
                              color: '#999',
                            }}
                          >
                            <QrcodeOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                            <div>未上传支付宝收款码</div>
                            <div style={{ fontSize: 12, marginTop: 8 }}>
                              点击上方按钮上传
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      title={
                        <Space>
                          <QrcodeOutlined />
                          微信收款码
                        </Space>
                      }
                      extra={
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => handleUploadQrcode('wechat')}
                          loading={qrcodesLoading}
                        >
                          上传
                        </Button>
                      }
                    >
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        {paymentQrcodes.wechat ? (
                          <img
                            src={paymentQrcodes.wechat}
                            alt="微信收款码"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 400,
                              borderRadius: 8,
                              border: '1px solid #d9d9d9',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              padding: 60,
                              border: '2px dashed #d9d9d9',
                              borderRadius: 8,
                              color: '#999',
                            }}
                          >
                            <QrcodeOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                            <div>未上传微信收款码</div>
                            <div style={{ fontSize: 12, marginTop: 8 }}>
                              点击上方按钮上传
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Card
                  title="使用说明"
                  style={{ marginTop: 16 }}
                  type="inner"
                >
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    <li>点击上方"上传"按钮选择收款码图片</li>
                    <li>支持 PNG、JPG、JPEG、WEBP 格式</li>
                    <li>上传后可在当天订单组件底部显示</li>
                    <li>收款码保存在应用数据目录的 qrcodes 文件夹中</li>
                  </ol>
                </Card>
              </>
            ),
          },
          {
            key: 'data',
            label: '数据管理',
            children: (
              <>
                <Row gutter={16}>
                  <Col span={24}>
                    <Card title="数据导出" extra={<Tag color="blue">JSON 格式</Tag>}>
                      <p style={{ marginBottom: 16 }}>
                        将所有业务数据导出为 JSON 文件，可用于备份和迁移
                      </p>
                      <Button icon={<ExportOutlined />} onClick={handleExportData}>
                        导出数据 (JSON)
                      </Button>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Card title="数据导入" extra={<Tag color="orange">JSON 格式</Tag>}>
                      <p style={{ marginBottom: 16 }}>
                        从 JSON 文件导入数据（将覆盖现有数据）
                      </p>
                      <Button icon={<ImportOutlined />} onClick={handleImportData} danger>
                        导入数据 (JSON)
                      </Button>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Card title="数据库备份">
                      <p style={{ marginBottom: 16 }}>
                        直接备份 SQLite 数据库文件（.db），快速完整备份
                      </p>
                      <Button icon={<SaveOutlined />} onClick={handleBackupDatabase}>
                        查看数据库位置
                      </Button>
                    </Card>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Card
                      title="清空数据"
                      extra={<Tag color="red">危险操作</Tag>}
                      style={{ borderColor: '#ff4d4f' }}
                    >
                      <p style={{ marginBottom: 16 }}>
                        <Text type="danger">
                          清空所有业务数据（客户、订单、图案、财务记录等）
                        </Text>
                      </p>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        ⚠️ 此操作不可恢复，建议先备份数据
                      </Text>
                      <Button icon={<DeleteOutlined />} danger onClick={handleClearData}>
                        清空所有数据
                      </Button>
                    </Card>
                  </Col>
                </Row>
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
