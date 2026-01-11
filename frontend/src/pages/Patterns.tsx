import { useState, useEffect } from 'react';
import {
  Button,
  Table,
  App,
  Card,
  Typography,
  Modal,
  Form,
  InputNumber,
  Input,
  Space,
  Popconfirm,
  Switch,
  Image,
  Spin,
  Empty,
  Descriptions,
  Select,
  Tree,
  Tag,
  Row,
  Col,
  Tooltip,
  Alert,
  Progress,
  Result,
  Statistic,
  List,
} from 'antd';
import {
  FileImageOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FolderOutlined,
  FolderAddOutlined,
  CopyOutlined,
  CheckOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import { PatternApi, TiffApi, PatternFolderApi, PatternColorApi, FileDialogApi } from '@/services/tauriApi';
import type { Pattern, FolderTreeNode, PatternColor, FolderScanResult, ScanProgress } from '@/types';
import { useMemo } from 'react';
import ColorPresetSelector from '@/components/pattern/ColorPresetSelector';
import ColorVariantUploader from '@/components/pattern/ColorVariantUploader';

const { Text } = Typography;

export default function Patterns() {
  const { message } = App.useApp();
  // ========== 状态管理 ==========
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [folderTree, setFolderTree] = useState<FolderTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [form] = Form.useForm();

  // 视图模式和客户数据
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);

  // 预览功能状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentPattern, setCurrentPattern] = useState<Pattern | null>(null);

  // 颜色变体状态
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [colors, setColors] = useState<PatternColor[]>([]);
  const [colorForm] = Form.useForm();
  const [loadingColors, setLoadingColors] = useState(false);

  // 编辑表单的颜色变体状态
  const [newColorVariants, setNewColorVariants] = useState<any[]>([]);
  const [originalColorVariants, setOriginalColorVariants] = useState<any[]>([]);

  // 文件夹管理状态
  const [folderModalVisible, setFolderModalVisible] = useState(false);
  const [folderForm] = Form.useForm();
  const [editingFolder, setEditingFolder] = useState<FolderTreeNode | null>(null);

  // 批量扫描状态
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<FolderScanResult | null>(null);

  // 搜索筛选状态
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // ========== 数据加载 ==========
  const loadPatterns = async () => {
    try {
      setLoading(true);
      const data = await PatternApi.getAll();
      setPatterns(data);
    } catch (error) {
      message.error('加载图案失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolderTree = async () => {
    try {
      const tree = await PatternFolderApi.getFolderTree();
      setFolderTree(tree);
    } catch (error) {
      console.error('加载文件夹树失败:', error);
    }
  };

  const loadColors = async (patternId: string) => {
    try {
      setLoadingColors(true);
      const data = await PatternColorApi.getByPatternId(patternId);
      setColors(data);
    } catch (error) {
      message.error('加载颜色变体失败: ' + error);
    } finally {
      setLoadingColors(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { CustomerApi } = await import('@/services/tauriApi');
      const data = await CustomerApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('加载客户列表失败:', error);
    }
  };

  // 获取中文拼音首字母
  const getChineseInitials = (text: string): string => {
    const pinyinMap: Record<string, string> = {
      '安': 'A', '艾': 'A', '敖': 'A', '白': 'B', '柏': 'B', '包': 'B', '鲍': 'B', '贝': 'B', '毕': 'B', '边': 'B', '卜': 'B', '薄': 'B', '蔡': 'C', '曹': 'C', '岑': 'C', '柴': 'C', '昌': 'C', '常': 'C', '车': 'C', '成': 'C', '陈': 'C', '程': 'C', '迟': 'C', '池': 'C', '楚': 'C', '褚': 'C', '崔': 'C', '代': 'D', '戴': 'D', '邓': 'D', '狄': 'D', '丁': 'D', '董': 'D', '杜': 'D', '段': 'D', '鄂': 'E', '鄂': 'E', '樊': 'F', '范': 'F', '方': 'F', '费': 'F', '冯': 'F', '傅': 'F', '傅': 'F', '甘': 'G', '高': 'G', '郜': 'G', '耿': 'G', '宫': 'G', '龚': 'G', '辜': 'G', '古': 'G', '谷': 'G', '顾': 'G', '关': 'G', '管': 'G', '桂': 'G', '郭': 'G', '韩': 'H', '杭': 'H', '郝': 'H', '和': 'H', '何': 'H', '贺': 'H', '洪': 'H', '侯': 'H', '胡': 'H', '华': 'H', '黄': 'H', '霍': 'H', '姬': 'J', '吉': 'J', '季': 'J', '纪': 'J', '贾': 'J', '简': 'J', '江': 'J', '姜': 'J', '蒋': 'J', '焦': 'J', '金': 'J', '靳': 'J', '景': 'J', '荆': 'J', '柯': 'K', '孔': 'K', '寇': 'K', '匡': 'K', '邝': 'K', '况': 'K', '赖': 'L', '蓝': 'L', '郎': 'L', '乐': 'L', '雷': 'L', '黎': 'L', '李': 'L', '廖': 'L', '林': 'L', '凌': 'L', '刘': 'L', '柳': 'L', '龙': 'L', '卢': 'L', '陆': 'L', '鲁': 'L', '路': 'L', '吕': 'L', '罗': 'L', '骆': 'L', '麻': 'M', '马': 'M', '梅': 'M', '孟': 'M', '苗': 'M', '闵': 'M', '莫': 'M', '穆': 'M', '倪': 'N', '牛': 'N', '农': 'N', '欧阳': 'O', '潘': 'P', '彭': 'P', '蒲': 'P', '普': 'P', '蒲': 'P', '戚': 'Q', '齐': 'Q', '钱': 'Q', '秦': 'Q', '邱': 'Q', '裘': 'Q', '屈': 'Q', '瞿': 'Q', '任': 'R', '荣': 'R', '阮': 'R', '商': 'S', '邵': 'S', '沈': 'S', '盛': 'S', '施': 'S', '石': 'S', '时': 'S', '史': 'S', '司': 'S', '宋': 'S', '苏': 'S', '孙': 'S', '汤': 'T', '唐': 'T', '陶': 'T', '田': 'T', '童': 'T', '万': 'W', '汪': 'W', '王': 'W', '魏': 'W', '温': 'W', '文': 'W', '闻': 'W', '翁': 'W', '吴': 'W', '伍': 'W', '武': 'W', '夏': 'X', '向': 'X', '项': 'X', '肖': 'X', '谢': 'X', '辛': 'X', '邢': 'X', '熊': 'X', '徐': 'X', '许': 'X', '薛': 'S', '喜': 'X', '严': 'Y', '颜': 'Y', '杨': 'Y', '姚': 'Y', '叶': 'Y', '易': 'Y', '殷': 'Y', '尹': 'Y', '应': 'Y', '游': 'Y', '于': 'Y', '余': 'Y', '虞': 'Y', '元': 'Y', '袁': 'Y', '岳': 'Y', '詹': 'Z', '张': 'Z', '章': 'Z', '赵': 'Z', '甄': 'Z', '郑': 'Z', '钟': 'Z', '周': 'Z', '朱': 'Z', '诸': 'Z', '祝': 'Z', '庄': 'Z', '宗': 'Z', '邹': 'Z', '左': 'Z'
    };

    const getFallbackPinyin = (char: string): string => {
      console.warn(`未找到字符 "${char}" 的拼音映射，使用默认映射`);
      const code = char.charCodeAt(0);
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const index = code % letters.length;
      return letters[index];
    };

    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const twoChar = text.substring(i, i + 2);
      if (pinyinMap[twoChar]) {
        result += pinyinMap[twoChar];
        i++;
        continue;
      }

      if (pinyinMap[char]) {
        result += pinyinMap[char];
      } else if (/[A-Z]/.test(char)) {
        result += char;
      } else if (/[a-z]/.test(char)) {
        result += char.toUpperCase();
      } else if (/[\u4e00-\u9fff]/.test(char)) {
        result += getFallbackPinyin(char);
      }

      if (result.length >= 2) break;
    }

    return result || 'AA';
  };

  // 生成自动编号
  const generateAutoCode = async (customerId?: string): Promise<string> => {
    try {
      let targetPatterns: Pattern[] = [];

      if (customerId) {
        // 客户图案：查询该客户的图案
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return '';

        // 从已加载的patterns中筛选
        targetPatterns = patterns.filter(p => p.customerId === customerId);
      } else {
        // 共享图案：查询没有customerId的图案
        targetPatterns = patterns.filter(p => !p.customerId);
      }

      let maxNumber = 0;

      // 分析现有编号
      targetPatterns.forEach((pattern) => {
        if (pattern.code) {
          let number = 0;

          if (!customerId) {
            // 共享图案：GX开头+数字编号
            if (pattern.code.startsWith('GX')) {
              const numberPart = pattern.code.substring(2);
              number = parseInt(numberPart, 10);
            } else if (pattern.code.match(/^\d+$/)) {
              number = parseInt(pattern.code, 10);
            }
          } else {
            // 客户图案：查找客户首字母开头的编号
            const customer = customers.find(c => c.id === customerId);
            if (customer) {
              const initials = getChineseInitials(customer.name);
              if (pattern.code.startsWith(initials)) {
                const numberPart = pattern.code.substring(initials.length);
                number = parseInt(numberPart, 10);
              }
            }
          }

          if (!isNaN(number) && number > maxNumber) {
            maxNumber = number;
          }
        }
      });

      // 生成新编号
      const newNumber = maxNumber + 1;
      let newCode: string;

      if (!customerId) {
        // 共享图案：GX开头+数字编号
        newCode = `GX${newNumber.toString().padStart(3, '0')}`;
      } else {
        // 客户图案：客户首字母+数字
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
          const initials = getChineseInitials(customer.name);
          newCode = `${initials}${newNumber.toString().padStart(3, '0')}`;
        } else {
          newCode = newNumber.toString();
        }
      }

      console.log('生成新编号:', newCode, '基于最大编号:', maxNumber);
      return newCode;
    } catch (error) {
      console.error('生成自动编号失败:', error);
      return '01';
    }
  };

  // 客户选择变更处理
  const handlePatternCustomerChange = async (customerId: string) => {
    if (!customerId) return;

    // 每次切换客户都重新生成编号
    const autoCode = await generateAutoCode(customerId);
    if (autoCode) {
      form.setFieldsValue({ code: autoCode });
      console.log('客户切换，自动生成编号:', autoCode);
    }
  };

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    loadPatterns();
    loadFolderTree();
    loadCustomers();
  }, []);

  // ========== 数据处理 ==========
  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      // 状态筛选
      if (statusFilter === 'active' && !pattern.isActive) return false;
      if (statusFilter === 'inactive' && pattern.isActive) return false;

      // 文件夹筛选
      if (selectedFolderId) {
        // TODO: 需要在 Pattern 模型中添加 folderId 字段
        // 暂时跳过文件夹筛选
      }

      // 文本搜索
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        return (
          pattern.name.toLowerCase().includes(searchLower) ||
          pattern.code.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [patterns, searchText, statusFilter, selectedFolderId]);

  // 将文件夹树转换为 Ant Design Tree 组件格式
  const convertFolderTree = (nodes: FolderTreeNode[]): TreeDataNode[] => {
    return nodes.map((node) => ({
      key: node.id,
      title: (
        <span>
          <FolderOutlined />
          {' '}
          {node.name}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            ({node.patternCount})
          </Text>
        </span>
      ),
      children: node.children ? convertFolderTree(node.children) : undefined,
    }));
  };

  const treeData: TreeDataNode[] = [
    {
      key: 'all',
      title: (
        <span>
          <FolderOutlined />
          {' '}
          全部图案
          <Text type="secondary" style={{ marginLeft: 8 }}>
            ({patterns.length})
          </Text>
        </span>
      ),
    },
    ...convertFolderTree(folderTree),
  ];

  // ========== 事件处理 ==========
  const handleFolderSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0] as string;
    setSelectedFolderId(key === 'all' ? undefined : key);
  };

  // 从 TIFF 文件创建
  const handleSelectTiff = async () => {
    try {
      const selected = await FileDialogApi.openFile({
        title: '选择 TIFF 文件',
        filters: [
          {
            name: 'TIFF Files',
            extensions: ['tif', 'tiff'],
          },
        ],
      });

      if (!selected) return;

      setLoading(true);

      // 解析 TIFF 文件
      const metadata = await TiffApi.parseTiff(selected);

      // 从 TIFF 创建图案
      await PatternApi.createFromTiff({
        name: metadata.fileName.replace(/\.tiff?$/i, ''),
        localFilePath: metadata.filePath,
        actualHeight: Math.round(metadata.heightCm * 10) / 10,
      });

      message.success('图案创建成功');
      loadPatterns();
    } catch (error) {
      message.error('操作失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPattern(null);
    form.resetFields();
    setNewColorVariants([]);
    setOriginalColorVariants([]);
    setModalVisible(true);
  };

  const handleEdit = async (pattern: Pattern) => {
    setEditingPattern(pattern);
    form.setFieldsValue(pattern);

    // 加载颜色变体
    try {
      const variants = await PatternColorApi.getByPatternId(pattern.id);
      const variantsData = Array.isArray(variants) ? variants : [];
      setNewColorVariants([...variantsData]);
      setOriginalColorVariants([...variantsData]);
    } catch (error) {
      console.error('加载颜色变体失败:', error);
      setNewColorVariants([]);
      setOriginalColorVariants([]);
    }

    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await PatternApi.delete(id);
      message.success('删除成功');
      loadPatterns();
    } catch (error) {
      message.error('删除失败: ' + error);
    }
  };

  const handlePreview = async (pattern: Pattern) => {
    if (!pattern.localFilePath) {
      message.warning('该图案没有关联图片文件');
      return;
    }

    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    if (!isTauri) {
      message.warning('图片预览功能仅在桌面应用中可用');
      return;
    }

    try {
      setPreviewLoading(true);
      setCurrentPattern(pattern);
      const imageData = await PatternApi.getPatternImage(pattern.localFilePath);
      setPreviewImage(imageData);
      setPreviewVisible(true);
    } catch (error) {
      message.error('加载图片失败: ' + error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 卡片渲染函数
  const renderPatternCard = (pattern: Pattern) => (
    <Card
      key={pattern.id}
      hoverable
      style={{
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ height: '120px', position: 'relative', overflow: 'hidden', backgroundColor: '#f8f9fa' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => handlePreview(pattern)}
        >
          <FileImageOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          <Tag color={pattern.isActive ? 'success' : 'default'}>{pattern.isActive ? '启用' : '禁用'}</Tag>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pattern.name}
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
          {pattern.code}
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
          {pattern.unitsPerRow}个/行 × {pattern.actualHeight}mm
        </div>
        <Space size="small" style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(pattern)}>
            编辑
          </Button>
          <Popconfirm title="确认删除" onConfirm={() => handleDelete(pattern.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );

  // 列表渲染函数
  const renderPatternListItem = (pattern: Pattern) => (
    <div
      key={pattern.id}
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => handleEdit(pattern)}
    >
      <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileImageOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pattern.name}
        </div>
        <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>
          {pattern.code}
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          {pattern.unitsPerRow}个/行 × {pattern.actualHeight}mm
        </div>
      </div>
      <Space direction="vertical" size="small">
        <Tag color={pattern.isActive ? 'success' : 'default'}>{pattern.isActive ? '启用' : '禁用'}</Tag>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(pattern); }}>
          编辑
        </Button>
        <Popconfirm title="确认删除" onConfirm={() => handleDelete(pattern.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingPattern) {
        await PatternApi.update(
          editingPattern.id,
          values.name,
          values.actualHeight,
          values.bleedHeight,
          values.unitsPerRow,
          values.rowCount,
          values.isActive,
        );
        message.success('更新成功');
      } else {
        await PatternApi.create({
          name: values.name,
          code: values.code,
          actualHeight: values.actualHeight,
          bleedHeight: values.bleedHeight,
          unitsPerRow: values.unitsPerRow,
          rowCount: values.rowCount,
        });
        message.success('创建成功');
      }

      setModalVisible(false);
      loadPatterns();
    } catch (error) {
      message.error('操作失败: ' + error);
    }
  };

  // ========== 颜色变体管理 ==========
  const handleManageColors = async (pattern: Pattern) => {
    setCurrentPattern(pattern);
    await loadColors(pattern.id);
    setColorModalVisible(true);
  };

  const handleAddColor = async () => {
    try {
      const values = await colorForm.validateFields();
      await PatternColorApi.create({
        patternId: currentPattern!.id,
        name: values.name,
        color: values.color,
        image: values.image,
      });
      message.success('颜色变体添加成功');
      colorForm.resetFields();
      await loadColors(currentPattern!.id);
    } catch (error) {
      message.error('添加失败: ' + error);
    }
  };

  const handleSetDefaultColor = async (colorId: string) => {
    try {
      await PatternColorApi.setDefault(colorId);
      message.success('已设为默认颜色');
      await loadColors(currentPattern!.id);
    } catch (error) {
      message.error('操作失败: ' + error);
    }
  };

  const handleDuplicateColor = async (color: PatternColor) => {
    try {
      await PatternColorApi.duplicate(color.id, `${color.name} (副本)`);
      message.success('复制成功');
      await loadColors(currentPattern!.id);
    } catch (error) {
      message.error('复制失败: ' + error);
    }
  };

  const handleDeleteColor = async (colorId: string) => {
    try {
      await PatternColorApi.delete(colorId);
      message.success('删除成功');
      await loadColors(currentPattern!.id);
    } catch (error) {
      message.error('删除失败: ' + error);
    }
  };

  // ========== 批量扫描功能 ==========
  const handleBatchScan = async () => {
    try {
      const selected = await FileDialogApi.openFolder({
        title: '选择图案文件夹',
      });

      if (!selected) return;

      setScanModalVisible(true);
      setScanProgress({
        stage: 'scanning',
        current: 0,
        total: 0,
        message: '正在扫描文件夹...',
      });

      const result = await PatternApi.scanFolder({
        folderPath: selected,
      });

      setScanResult(result);
      setScanProgress({
        stage: 'completed',
        current: result.totalFound,
        total: result.totalFound,
        message: '扫描完成',
      });

      message.success(`导入完成: 成功 ${result.imported} 个, 跳过 ${result.skipped} 个`);
      loadPatterns();
      loadFolderTree();
    } catch (error) {
      message.error('批量扫描失败: ' + error);
      setScanProgress(null);
    }
  };

  // ========== 文件夹管理 ==========
  const handleAddFolder = () => {
    setEditingFolder(null);
    folderForm.resetFields();
    folderForm.setFieldValue('parentId', selectedFolderId);
    setFolderModalVisible(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditFolder = (folder: FolderTreeNode) => {
    setEditingFolder(folder);
    folderForm.setFieldsValue({
      name: folder.name,
      parentId: folder.parentId,
    });
    setFolderModalVisible(true);
  };

  const handleSubmitFolder = async () => {
    try {
      const values = await folderForm.validateFields();

      if (editingFolder) {
        await PatternFolderApi.update(editingFolder.id, {
          name: values.name,
        });
        message.success('文件夹更新成功');
      } else {
        await PatternFolderApi.create({
          name: values.name,
          parentId: values.parentId,
        });
        message.success('文件夹创建成功');
      }

      setFolderModalVisible(false);
      loadFolderTree();
    } catch (error) {
      message.error('操作失败: ' + error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteFolder = async (folderId: string) => {
    try {
      await PatternFolderApi.delete(folderId);
      message.success('文件夹删除成功');
      loadFolderTree();
    } catch (error) {
      message.error('删除失败: ' + error);
    }
  };

  // ========== 表格列定义 ==========
  return (
    <div>
      <Row gutter={16} style={{ height: 'calc(100vh - 180px)' }}>
        {/* 左侧文件夹树 */}
        <Col span={5}>
          <Card
            title="文件夹"
            extra={
              <Button
                type="text"
                icon={<FolderAddOutlined />}
                onClick={handleAddFolder}
              />
            }
            styles={{ body: { padding: '12px', height: 'calc(100% - 57px)', overflow: 'auto' } }}
          >
            <Tree
              showIcon
              defaultExpandAll
              selectedKeys={selectedFolderId ? [selectedFolderId] : ['all']}
              onSelect={handleFolderSelect}
              treeData={treeData}
              style={{ fontSize: '13px' }}
            />
          </Card>
        </Col>

        {/* 右侧图案列表 */}
        <Col span={19}>
          <Space style={{ marginBottom: 16, width: '100%' }} vertical>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<FileImageOutlined />}
                  onClick={handleSelectTiff}
                  loading={loading}
                >
                  从 TIFF 创建
                </Button>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleBatchScan}
                  loading={loading}
                >
                  批量导入文件夹
                </Button>
                <Button icon={<PlusOutlined />} onClick={handleCreate}>
                  手动创建
                </Button>
                <Button onClick={loadPatterns} loading={loading}>
                  刷新
                </Button>
                <Button.Group>
                  <Button
                    icon={<AppstoreOutlined />}
                    type={viewMode === 'grid' ? 'primary' : 'default'}
                    onClick={() => setViewMode('grid')}
                  />
                  <Button
                    icon={<UnorderedListOutlined />}
                    type={viewMode === 'list' ? 'primary' : 'default'}
                    onClick={() => setViewMode('list')}
                  />
                </Button.Group>
              </Space>
            </Space>

            <Space style={{ width: '100%' }}>
              <Input
                placeholder="搜索图案名称或编号"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '启用', value: 'active' },
                  { label: '禁用', value: 'inactive' },
                ]}
              />
              <Text type="secondary">共 {filteredPatterns.length} 条结果</Text>
            </Space>
          </Space>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" tip="加载中..." />
            </div>
          ) : filteredPatterns.length === 0 ? (
            <Empty description="暂无图案" style={{ marginTop: 40 }} />
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              paddingBottom: 24,
            }}>
              {filteredPatterns.map(renderPatternCard)}
            </div>
          ) : (
            <div style={{ paddingBottom: 24 }}>
              {filteredPatterns.map(renderPatternListItem)}
            </div>
          )}
        </Col>
      </Row>

      {/* 创建/编辑图案模态框 */}
      <Modal
        title={editingPattern ? '编辑图案' : '创建图案'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            actualHeight: 100,
            bleedHeight: 20,
            unitsPerRow: 10,
            rowCount: 10,
            isActive: true,
          }}
        >
          {/* 隐藏的 rowCount 字段，保留用于后端兼容 */}
          <Form.Item name="rowCount" hidden>
            <InputNumber />
          </Form.Item>
          <Form.Item
            label="图案编号"
            name="code"
            rules={!editingPattern ? [{ required: true, message: '请输入图案编号' }] : []}
          >
            <Input placeholder="留空自动生成" disabled={!!editingPattern} />
          </Form.Item>

          <Form.Item
            label="图案名称"
            name="name"
            rules={[{ required: true, message: '请输入图案名称' }]}
          >
            <Input placeholder="例如：花卉图案001" />
          </Form.Item>

          <Form.Item
            label="所属客户"
            name="customerId"
            help="留空表示共享图案（不属于任何客户）"
          >
            <Select
              placeholder="请选择所属客户"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={handlePatternCustomerChange}
              options={customers.map(c => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="实际高度 (mm)"
                name="actualHeight"
                rules={[{ required: true, message: '请输入实际高度' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="出血高度 (mm)"
                name="bleedHeight"
                rules={[{ required: true, message: '请输入出血高度' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="每行个数"
                name="unitsPerRow"
                rules={[{ required: true, message: '请输入每行个数' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {editingPattern && (
            <Form.Item label="状态" name="isActive" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}

          {/* 颜色变体管理区域 */}
          {editingPattern && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#262626' }}>
                🎨 颜色变体管理
              </div>
              {newColorVariants.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#8c8c8c' }}>
                  暂无颜色变体，请通过颜色变体管理模块添加
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newColorVariants.map((variant: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 8,
                        backgroundColor: '#fff',
                        borderRadius: 4,
                        border: '1px solid #e8e8e8',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: variant.color,
                          border: '1px solid #d9d9d9',
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{variant.name}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{variant.color}</div>
                      </div>
                      {variant.isDefault && (
                        <Tag color="blue" icon={<StarFilled />}>
                          默认
                        </Tag>
                      )}
                      <Space size="small">
                        {!variant.isDefault && (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => {
                              const updated = newColorVariants.map((v: any, i: number) => ({
                                ...v,
                                isDefault: i === index,
                              }));
                              setNewColorVariants(updated);
                            }}
                          >
                            设为默认
                          </Button>
                        )}
                        <Popconfirm
                          title="确认删除"
                          description="确定要删除这个颜色变体吗？"
                          onConfirm={() => {
                            const updated = newColorVariants.filter((_: any, i: number) => i !== index);
                            setNewColorVariants(updated);
                          }}
                        >
                          <Button size="small" danger type="link" icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Form>
      </Modal>

      {/* 图案预览模态框 */}
      <Modal
        title={currentPattern ? `图案预览 - ${currentPattern.name}` : '图案预览'}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewImage('');
          setCurrentPattern(null);
        }}
        footer={null}
        width={800}
        centered
      >
        <div style={{ textAlign: 'center' }}>
          {previewLoading ? (
            <Spin size="large" tip="加载图片中..." />
          ) : previewImage ? (
            <Image
              src={previewImage}
              alt="图案预览"
              style={{ maxWidth: '100%', maxHeight: '600px' }}
            />
          ) : (
            <Empty description="无法加载图片" />
          )}
          {currentPattern && (
            <div style={{ marginTop: 16 }}>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="图案编号">{currentPattern.code}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {currentPattern.isActive ? '启用' : '禁用'}
                </Descriptions.Item>
                <Descriptions.Item label="实际高度">
                  {currentPattern.actualHeight} mm
                </Descriptions.Item>
                <Descriptions.Item label="出血高度">
                  {currentPattern.bleedHeight} mm
                </Descriptions.Item>
                <Descriptions.Item label="每行个数">
                  {currentPattern.unitsPerRow}
                </Descriptions.Item>
                <Descriptions.Item label="行数">{currentPattern.rowCount}</Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </div>
      </Modal>

      {/* 颜色变体管理模态框 */}
      <Modal
        title={`颜色变体 - ${currentPattern?.name}`}
        open={colorModalVisible}
        onCancel={() => {
          setColorModalVisible(false);
          setColors([]);
          setCurrentPattern(null);
          colorForm.resetFields();
        }}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Form form={colorForm} layout="inline" style={{ width: '100%' }}>
              <Form.Item
                name="name"
                rules={[{ required: true, message: '请输入颜色名称' }]}
                style={{ width: 200 }}
              >
                <Input placeholder="颜色名称" />
              </Form.Item>
              <Form.Item
                name="color"
                rules={[{ required: true, message: '请选择颜色' }]}
              >
                <ColorPresetSelector allowCustom placeholder="选择或输入颜色" />
              </Form.Item>
              <Form.Item name="image">
                <ColorVariantUploader />
              </Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddColor}>
                添加
              </Button>
            </Form>
          </Space>
        </div>

        <Table
          dataSource={colors}
          loading={loadingColors}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: '预览',
              dataIndex: 'color',
              key: 'color',
              width: 80,
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
            { title: '名称', dataIndex: 'name', key: 'name' },
            {
              title: '颜色值',
              dataIndex: 'color',
              key: 'colorValue',
              render: (color: string) => (
                <Text code copyable={{ text: color }}>
                  {color}
                </Text>
              ),
            },
            {
              title: '默认',
              dataIndex: 'isDefault',
              key: 'isDefault',
              width: 80,
              render: (isDefault: boolean, record: PatternColor) => (
                isDefault ? (
                  <Tag icon={<CheckOutlined />} color="success">默认</Tag>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleSetDefaultColor(record.id)}
                  >
                    设为默认
                  </Button>
                )
              ),
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_: unknown, record: PatternColor) => (
                <Space size="small">
                  <Tooltip title="复制">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleDuplicateColor(record)}
                    />
                  </Tooltip>
                  {!record.isDefault && (
                    <Popconfirm
                      title="确认删除"
                      description="确定要删除这个颜色变体吗？"
                      onConfirm={() => handleDeleteColor(record.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* 文件夹管理模态框 */}
      <Modal
        title={editingFolder ? '编辑文件夹' : '创建文件夹'}
        open={folderModalVisible}
        onOk={handleSubmitFolder}
        onCancel={() => setFolderModalVisible(false)}
        width={500}
      >
        <Form
          form={folderForm}
          layout="vertical"
        >
          <Form.Item
            label="文件夹名称"
            name="name"
            rules={[{ required: true, message: '请输入文件夹名称' }]}
          >
            <Input placeholder="例如：花卉图案" />
          </Form.Item>

          <Form.Item label="父文件夹" name="parentId">
            <Select
              placeholder="选择父文件夹（留空为根文件夹）"
              allowClear
              treeNodeFilterProp="title"
              showSearch
              options={[
                { label: '根文件夹', value: null },
                ...flattenFolderTree(folderTree),
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量扫描进度模态框 */}
      <Modal
        title="批量导入图案"
        open={scanModalVisible}
        onCancel={() => {
          setScanModalVisible(false);
          setScanProgress(null);
          setScanResult(null);
        }}
        footer={[
          <Button key="close" onClick={() => setScanModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {scanProgress && scanProgress.stage !== 'completed' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>{scanProgress.message}</Text>
              {scanProgress.total > 0 && (
                <Progress
                  percent={Math.round((scanProgress.current / scanProgress.total) * 100)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </div>
        )}

        {scanProgress?.stage === 'completed' && scanResult && (
          <div>
            <Result
              status="success"
              title="批量导入完成"
              subTitle={`共发现 ${scanResult.totalFound} 个 TIFF 文件`}
            />

            <Row gutter={16} style={{ marginTop: 24 }}>
              <Col span={6}>
                <Statistic title="发现总数" value={scanResult.totalFound} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="成功导入"
                  value={scanResult.imported}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已存在(跳过)"
                  value={scanResult.skipped}
                  styles={{ content: { color: '#faad14' } }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="失败"
                  value={scanResult.failed}
                  styles={{ content: { color: '#cf1322' } }}
                />
              </Col>
            </Row>

            {scanResult.errors.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Text strong>错误详情:</Text>
                <List
                  size="small"
                  style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}
                  dataSource={scanResult.errors}
                  renderItem={(item) => (
                    <List.Item>
                      <Text type="danger" ellipsis={{ tooltip: item.filePath }}>
                        {item.filePath}
                      </Text>
                      <Text type="secondary"> - {item.error}</Text>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}

        {!scanProgress && (
          <Alert
            message="说明"
            description="将自动扫描所选文件夹中的所有 TIFF 文件，并根据文件夹结构创建对应的分类文件夹。已存在的图案将被自动跳过。"
            type="info"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
}

// 辅助函数：将文件夹树展平为选择器选项
function flattenFolderTree(
  nodes: FolderTreeNode[],
  prefix = '',
): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = [];

  for (const node of nodes) {
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    result.push({ label, value: node.id });

    if (node.children && node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, label));
    }
  }

  return result;
}
