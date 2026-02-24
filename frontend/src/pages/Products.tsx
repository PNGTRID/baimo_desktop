import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Space,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { Product, CreateProductRequest, UpdateProductRequest } from '@/types';
import { ProductApi } from '@/services/tauriApi';

export default function Products() {
  const { message } = App.useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();

  // 加载产品列表
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ProductApi.getAll();
      setProducts(data);
    } catch (error) {
      message.error('加载产品失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // 打开创建/编辑模态框
  const handleOpenModal = (product: Product | null = null) => {
    setEditingProduct(product);
    if (product) {
      form.setFieldsValue({
        name: product.name,
        price: product.price,
        unit: product.unit,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ unit: '件' });
    }
    setIsModalOpen(true);
  };

  // 创建或更新产品
  const handleSubmitProduct = async () => {
    try {
      const values = await form.validateFields();

      if (editingProduct) {
        // 更新产品
        const request: UpdateProductRequest = {
          id: editingProduct.id,
          ...values,
        };
        await ProductApi.update(request);
        message.success('产品更新成功');
      } else {
        // 创建产品
        const request: CreateProductRequest = {
          name: values.name,
          price: values.price,
          unit: values.unit,
        };
        await ProductApi.create(request);
        message.success('产品创建成功');
      }

      // 刷新列表
      await loadProducts();

      setIsModalOpen(false);
      form.resetFields();
      setEditingProduct(null);
    } catch (error) {
      message.error(editingProduct ? '产品更新失败' : '产品创建失败');
      console.error(error);
    }
  };

  // 删除产品
  const handleDeleteProduct = async (id: string) => {
    try {
      await ProductApi.delete(id);
      message.success('产品删除成功');
      await loadProducts();
    } catch (error) {
      message.error('产品删除失败');
      console.error(error);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '产品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (value: number) => (
        <span style={{ fontWeight: 'bold' }}>¥{value.toFixed(2)}</span>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Product) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此产品？"
            onConfirm={() => handleDeleteProduct(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题和操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>产品管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadProducts}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal(null)}
          >
            新增产品
          </Button>
        </Space>
      </div>

      {/* 产品列表 */}
      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 个产品`,
        }}
      />

      {/* 创建/编辑产品模态框 */}
      <Modal
        title={editingProduct ? '编辑产品' : '新增产品'}
        open={isModalOpen}
        onOk={handleSubmitProduct}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setEditingProduct(null);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="产品名称"
            rules={[{ required: true, message: '请输入产品名称' }]}
          >
            <Input placeholder="例如：T恤、辅料、包装盒" />
          </Form.Item>

          <Form.Item
            name="price"
            label="单价"
            rules={[{ required: true, message: '请输入单价' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入单价"
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
            rules={[{ required: true, message: '请输入单位' }]}
          >
            <Input placeholder="例如：件、个、箱" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
