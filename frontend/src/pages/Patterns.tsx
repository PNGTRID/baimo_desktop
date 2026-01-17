import { useState, useEffect, useRef } from 'react';
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
  Badge,
} from 'antd';
import {
  FileImageOutlined,
  FormatPainterOutlined,
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
  StarFilled,
  ShoppingOutlined,
} from '@ant-design/icons';
import type { TreeDataNode } from 'antd';
import { PatternApi, TiffApi, PatternFolderApi, PatternColorApi, FileDialogApi, isTauri } from '@/services/tauriApi';
import type { Pattern, FolderTreeNode, PatternColor, FolderScanResult, ScanProgress } from '@/types';
import { useMemo } from 'react';
import ColorPresetSelector from '@/components/pattern/ColorPresetSelector';
import ColorVariantUploader from '@/components/pattern/ColorVariantUploader';
import { useStore } from '@/store/useStore';
import type { MenuKey } from '@/components/layout/Layout';

const { Text } = Typography;

// Props 类型
interface PatternsProps {
  onNavigate?: (key: MenuKey) => void;
}

// 颜色变体类型
interface ColorVariant {
  name: string;
  color: string;
  isDefault?: boolean;
  image?: string;
}

export default function Patterns({ onNavigate }: PatternsProps) {
  const { message } = App.useApp();
  const { setPendingPatternForOrder, setPatternImage, getPatternImage, loadPatternImageCacheFromDisk } = useStore();
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

  // 编辑模态框预览状态
  const [editPreviewImage, setEditPreviewImage] = useState<string>('');
  const [editPreviewLoading, setEditPreviewLoading] = useState(false);

  // 颜色变体状态
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [colors, setColors] = useState<PatternColor[]>([]);
  const [colorForm] = Form.useForm();
  const [loadingColors, setLoadingColors] = useState(false);

  // 所有图案的颜色变体数量映射
  const [patternColorCounts, setPatternColorCounts] = useState<Map<string, number>>(new Map());

  // 编辑表单的颜色变体状态
  const [newColorVariants, setNewColorVariants] = useState<ColorVariant[]>([]);

  // 快速添加颜色变体状态
  const [colorPresets, setColorPresets] = useState<Array<{ id: string; name: string; displayName?: string; color: string }>>([]);

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

  // 全局加载管理器（防止重复加载）
  const imageLoadingPromises = useRef<Map<string, {
    promise: Promise<string>;
    resolve: (value: string) => void;
  }>>(new Map());

  // 获取或创建图片加载 Promise
  const getOrLoadImage = (filePath: string): Promise<string> => {
    // 检查是否已有正在进行的加载
    const existing = imageLoadingPromises.current.get(filePath);
    if (existing) {
      return existing.promise;
    }

    // 创建新的加载 Promise
    let resolve: (value: string) => void;
    const promise = new Promise<string>((res) => {
      resolve = res;
    });

    // 保存 Promise 和 resolve 函数
    imageLoadingPromises.current.set(filePath, { promise, resolve: resolve! });

    // 开始加载
    PatternApi.getPatternImage(filePath)
      .then((imageUrl) => {
        resolve!(imageUrl);
        return imageUrl;
      })
      .finally(() => {
        // 加载完成后清理
        imageLoadingPromises.current.delete(filePath);
      });

    return promise;
  };

  // 图片懒加载组件（使用全局加载管理器）
  const PatternImage: React.FC<{
    pattern: Pattern;
  }> = ({ pattern }) => {
    const [imageSrc, setImageSrc] = useState<string | undefined>(pattern.previewImage);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      // 如果已有预览图，直接使用
      if (pattern.previewImage) {
        setImageSrc(pattern.previewImage);
        return;
      }

      // 如果没有 localFilePath，显示占位图
      if (!pattern.localFilePath) {
        return;
      }

      // 检查缓存（使用 localFilePath 作为 key，让相同文件的 pattern 共享缓存）
      const cacheKey = pattern.localFilePath;
      const cached = getPatternImage(cacheKey);
      if (cached) {
        setImageSrc(cached);
        return;
      }

      // 使用全局加载管理器加载图片
      setLoading(true);
      getOrLoadImage(pattern.localFilePath)
        .then((imageUrl) => {
          setImageSrc(imageUrl);
          setPatternImage(cacheKey, imageUrl);
        })
        .catch((error) => {
          console.error('加载图片失败:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }, [pattern.localFilePath]); // 依赖 localFilePath 而不是 pattern.id

    if (loading) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Spin size="small" />
        </div>
      );
    }

    if (imageSrc) {
      return (
        <img
          src={imageSrc}
          alt={pattern.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'transform 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />
      );
    }

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <FileImageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
      </div>
    );
  };

  // ========== 数据加载 ==========
  const loadPatterns = async () => {
    try {
      setLoading(true);
      const data = await PatternApi.getAll();
      setPatterns(data);

      // 加载每个图案的颜色变体数量
      const colorCountMap = new Map<string, number>();
      await Promise.all(
        data.map(async (pattern) => {
          try {
            const variants = await PatternColorApi.getByPatternId(pattern.id);
            colorCountMap.set(pattern.id, variants.length);
          } catch (error) {
            console.error(`加载图案 ${pattern.id} 的颜色变体失败:`, error);
            colorCountMap.set(pattern.id, 0);
          }
        })
      );
      setPatternColorCounts(colorCountMap);

      // 预加载所有图片缓存到内存（避免重启后重新生成）
      const filePaths = data
        .map(p => p.localFilePath)
        .filter((path): path is string => !!path);

      if (filePaths.length > 0) {
        await loadPatternImageCacheFromDisk(filePaths);
      }
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
      '安': 'A', '艾': 'A', '敖': 'A', '白': 'B', '柏': 'B', '包': 'B', '鲍': 'B', '贝': 'B', '毕': 'B', '边': 'B', '卜': 'B', '薄': 'B', '蔡': 'C', '曹': 'C', '岑': 'C', '柴': 'C', '昌': 'C', '常': 'C', '车': 'C', '成': 'C', '陈': 'C', '程': 'C', '迟': 'C', '池': 'C', '楚': 'C', '褚': 'C', '崔': 'C', '代': 'D', '戴': 'D', '邓': 'D', '狄': 'D', '丁': 'D', '董': 'D', '杜': 'D', '段': 'D', '鄂': 'E', '樊': 'F', '范': 'F', '方': 'F', '费': 'F', '冯': 'F', '傅': 'F', '甘': 'G', '高': 'G', '郜': 'G', '耿': 'G', '宫': 'G', '龚': 'G', '辜': 'G', '古': 'G', '谷': 'G', '顾': 'G', '关': 'G', '管': 'G', '桂': 'G', '郭': 'G', '韩': 'H', '杭': 'H', '郝': 'H', '和': 'H', '何': 'H', '贺': 'H', '洪': 'H', '侯': 'H', '胡': 'H', '华': 'H', '黄': 'H', '霍': 'H', '姬': 'J', '吉': 'J', '季': 'J', '纪': 'J', '贾': 'J', '简': 'J', '江': 'J', '姜': 'J', '蒋': 'J', '焦': 'J', '金': 'J', '靳': 'J', '景': 'J', '荆': 'J', '柯': 'K', '孔': 'K', '寇': 'K', '匡': 'K', '邝': 'K', '况': 'K', '赖': 'L', '蓝': 'L', '郎': 'L', '乐': 'L', '雷': 'L', '黎': 'L', '李': 'L', '廖': 'L', '林': 'L', '凌': 'L', '刘': 'L', '柳': 'L', '龙': 'L', '卢': 'L', '陆': 'L', '鲁': 'L', '路': 'L', '吕': 'L', '罗': 'L', '骆': 'L', '麻': 'M', '马': 'M', '梅': 'M', '孟': 'M', '苗': 'M', '闵': 'M', '莫': 'M', '穆': 'M', '倪': 'N', '牛': 'N', '农': 'N', '欧阳': 'O', '潘': 'P', '彭': 'P', '蒲': 'P', '普': 'P', '戚': 'Q', '齐': 'Q', '钱': 'Q', '秦': 'Q', '邱': 'Q', '裘': 'Q', '屈': 'Q', '瞿': 'Q', '任': 'R', '荣': 'R', '阮': 'R', '商': 'S', '邵': 'S', '沈': 'S', '盛': 'S', '施': 'S', '石': 'S', '时': 'S', '史': 'S', '司': 'S', '宋': 'S', '苏': 'S', '孙': 'S', '汤': 'T', '唐': 'T', '陶': 'T', '田': 'T', '童': 'T', '万': 'W', '汪': 'W', '王': 'W', '魏': 'W', '温': 'W', '文': 'W', '闻': 'W', '翁': 'W', '吴': 'W', '伍': 'W', '武': 'W', '夏': 'X', '向': 'X', '项': 'X', '肖': 'X', '谢': 'X', '辛': 'X', '邢': 'X', '熊': 'X', '徐': 'X', '许': 'X', '薛': 'X', '喜': 'X', '严': 'Y', '颜': 'Y', '杨': 'Y', '姚': 'Y', '叶': 'Y', '易': 'Y', '殷': 'Y', '尹': 'Y', '应': 'Y', '游': 'Y', '于': 'Y', '余': 'Y', '虞': 'Y', '元': 'Y', '袁': 'Y', '岳': 'Y', '詹': 'Z', '张': 'Z', '章': 'Z', '赵': 'Z', '甄': 'Z', '郑': 'Z', '钟': 'Z', '周': 'Z', '朱': 'Z', '诸': 'Z', '祝': 'Z', '庄': 'Z', '宗': 'Z', '邹': 'Z', '左': 'Z'
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

  useEffect(() => {
    loadPatterns();
    loadFolderTree();
    loadCustomers();
    loadColorPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== 数据处理 ==========
  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      // 文件夹筛选
      if (selectedFolderId) {
        if (pattern.folderId !== selectedFolderId) return false;
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
  }, [patterns, searchText, selectedFolderId]);

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

  // ========== 辅助函数 ==========
  // 获取选中文件夹对应的客户ID
  const getSelectedCustomerId = (): string | undefined => {
    if (!selectedFolderId) return undefined;

    // 递归查找文件夹
    const findFolder = (nodes: FolderTreeNode[], targetId: string): FolderTreeNode | undefined => {
      for (const node of nodes) {
        if (node.id === targetId) return node;
        if (node.children.length > 0) {
          const found = findFolder(node.children, targetId);
          if (found) return found;
        }
      }
      return undefined;
    };

    const folder = findFolder(folderTree, selectedFolderId);
    return folder?.customerId;
  };

  // ========== 事件处理 ==========
  const handleFolderSelect = (selectedKeys: React.Key[]) => {
    const key = selectedKeys[0] as string;

    if (key === 'all') {
      // 全部图案
      setSelectedFolderId(undefined);
    } else {
      // 文件夹筛选
      setSelectedFolderId(key);
    }
  };

  // 从图片文件创建（支持多种格式）
  const handleSelectImage = async () => {
    try {
      const selected = await FileDialogApi.openFile({
        title: '选择图片文件',
        filters: [
          {
            name: '图片文件',
            extensions: ['tif', 'tiff', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'psd'],
          },
        ],
      });

      if (!selected) return;

      setLoading(true);
      message.loading('正在解析图片文件...', 0);

      // 解析图片文件（支持多种格式）
      const metadata = await TiffApi.parseTiff(selected);
      message.destroy();

      // 获取选中的客户并生成图案编号
      const customerId = getSelectedCustomerId();
      let patternCode: string | undefined;

      if (customerId) {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
          // 计算该客户的当前图案数量
          const customerPatternCount = patterns.filter(p => p.customerId === customerId).length;
          // 生成图案编号：客户名_序号
          patternCode = `${customer.name}_${customerPatternCount + 1}`;
        }
      }

      // 从图片文件创建图案（快速创建，不生成缩略图）
      const newPattern = await PatternApi.createFromTiff({
        name: metadata.fileName.replace(/\.(tif|tiff|jpg|jpeg|png|webp|bmp|gif|psd)$/i, ''),
        localFilePath: metadata.filePath,
        actualHeight: Math.round(metadata.heightCm * 10) / 10,
        customerId: getSelectedCustomerId(),
        code: patternCode,  // 传入生成的图案编号
      });

      // 直接将新图案添加到列表中，而不是重新加载所有图案
      setPatterns(prev => [newPattern, ...prev]);
      setPatternColorCounts(prev => new Map(prev).set(newPattern.id, 0));

      message.success('图案创建成功，正在打开编辑窗口');

      // 自动打开编辑窗口
      handleEdit(newPattern);
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

    // 如果选中了客户文件夹，自动填充客户和生成默认图案编号
    const customerId = getSelectedCustomerId();
    if (customerId) {
      form.setFieldValue('customerId', customerId);

      // 获取客户信息并生成默认图案编号
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        // 计算该客户的当前图案数量
        const customerPatternCount = patterns.filter(p => p.customerId === customerId).length;
        const defaultCode = `${customer.name}${customerPatternCount + 1}`;
        form.setFieldValue('code', defaultCode);
      }
    } else {
      form.setFieldValue('customerId', undefined);
    }

    setModalVisible(true);
  };

  const handleEdit = async (pattern: Pattern) => {
    setEditingPattern(pattern);
    form.setFieldsValue(pattern);

    // 加载编辑预览图
    setEditPreviewLoading(true);
    setEditPreviewImage('');
    try {
      let imageUrl = '';
      if (pattern.previewImage) {
        imageUrl = pattern.previewImage;
      } else if (pattern.localFilePath) {
        // 使用全局缓存
        const cached = getPatternImage(pattern.localFilePath);
        if (cached) {
          imageUrl = cached;
        } else {
          try {
            imageUrl = await PatternApi.getPatternImage(pattern.localFilePath);
            if (imageUrl) {
              setPatternImage(pattern.localFilePath, imageUrl);
            }
          } catch (err) {
            console.error('加载编辑预览图失败:', err);
          }
        }
      }
      setEditPreviewImage(imageUrl);
    } catch (error) {
      console.error('加载编辑预览图失败:', error);
    } finally {
      setEditPreviewLoading(false);
    }

    // 加载颜色变体
    try {
      const variants = await PatternColorApi.getByPatternId(pattern.id);
      const variantsData = Array.isArray(variants) ? variants : [];
      setNewColorVariants([...variantsData]);
    } catch (error) {
      console.error('加载颜色变体失败:', error);
      setNewColorVariants([]);
    }

    setModalVisible(true);
  };

  const handleOpenColorModal = async (pattern: Pattern) => {
    setCurrentPattern(pattern);
    setColorModalVisible(true);
    await loadColors(pattern.id);
  };

  const handleCloseColorModal = async () => {
    setColorModalVisible(false);
    // 同步更新编辑模态框中的颜色变体列表
    if (editingPattern) {
      try {
        const variants = await PatternColorApi.getByPatternId(editingPattern.id);
        const variantsData = Array.isArray(variants) ? variants : [];
        setNewColorVariants([...variantsData]);
      } catch (error) {
        console.error('同步颜色变体失败:', error);
      }
    }
    setColors([]);
    setCurrentPattern(null);
    colorForm.resetFields();
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

    if (!isTauri()) {
      message.warning('图片预览功能仅在桌面应用中可用');
      return;
    }

    try {
      setPreviewLoading(true);
      setCurrentPattern(pattern);

      // 使用全局缓存
      let imageData = '';
      const cached = getPatternImage(pattern.localFilePath);
      if (cached) {
        imageData = cached;
      } else {
        imageData = await PatternApi.getPatternImage(pattern.localFilePath);
        if (imageData) {
          setPatternImage(pattern.localFilePath, imageData);
        }
      }

      setPreviewImage(imageData);
      setPreviewVisible(true);
    } catch (error) {
      message.error('加载图片失败: ' + error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 快捷下单处理函数
  const handleQuickOrder = (pattern: Pattern, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发卡片点击
    setPendingPatternForOrder(pattern);
    const customerMsg = pattern.customerId
      ? `，客户：${customers.find(c => c.id === pattern.customerId)?.name || '未知'}`
      : '';
    message.success(`已选择图案「${pattern.name}」${customerMsg}，正在跳转到订单页...`);
    onNavigate?.('orders');
  };

  // 辅助函数：从 folderTree 中查找文件夹名称
  const findFolderName = (folderId: string): string | null => {
    const searchInTree = (nodes: FolderTreeNode[]): string | null => {
      for (const node of nodes) {
        if (node.id === folderId) return node.name;
        if (node.children) {
          const found = searchInTree(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return searchInTree(folderTree);
  };

  // 卡片渲染函数
  const renderPatternCard = (pattern: Pattern) => {
    // 获取图案的颜色变体数量
    const colorVariantsCount = patternColorCounts.get(pattern.id) || 0;

    const folderName = pattern.folderId ? findFolderName(pattern.folderId) : null;

    return (
      <Card
        key={pattern.id}
        hoverable
        style={{
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* 图片预览区 */}
        <div
          style={{
            height: '140px',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#fafafa',
            cursor: 'pointer',
          }}
          onClick={() => handlePreview(pattern)}
        >
          <PatternImage pattern={pattern} />
        </div>

        {/* 内容区 */}
        <div style={{ padding: '10px 12px' }}>
          {/* 第一行：图标 + 名称 · 代码 · 文件夹 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span style={{
              color: '#1a1a1a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
            }}>
              {pattern.name}
            </span>
            <span style={{ color: '#b0b0b0', flexShrink: 0 }}>·</span>
            <span style={{
              color: '#8c8c8c',
              fontFamily: 'Monaco, Consolas, monospace',
              background: '#f5f5f5',
              padding: '2px 6px',
              borderRadius: 4,
              flexShrink: 0,
              fontSize: 11,
            }}>
              {pattern.code}
            </span>
            {folderName && (
              <>
                <span style={{ color: '#b0b0b0', flexShrink: 0 }}>·</span>
                <span style={{
                  color: '#13c2c2',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 1,
                  minWidth: 0,
                  fontSize: 12,
                }}>
                  📁 {folderName}
                </span>
              </>
            )}
          </div>

          {/* 第二行：规格信息（包含颜色数） */}
          <div style={{
            display: 'flex',
            gap: 8,
            fontSize: 11,
            color: '#666',
            marginBottom: 10,
            padding: '4px 8px',
            background: '#fafafa',
            borderRadius: 4,
          }}>
            <span>{pattern.unitsPerRow} 个/行</span>
            <span>·</span>
            <span>{pattern.actualHeight} cm</span>
            {colorVariantsCount > 0 && (
              <>
                <span>·</span>
                <span>🎨 {colorVariantsCount} 色</span>
              </>
            )}
          </div>

          {/* 操作按钮区 */}
          <div
            style={{
              display: 'flex',
              gap: 6,
            }}
          >
            <Button
              type="primary"
              size="small"
              icon={<ShoppingOutlined />}
              onClick={(e) => handleQuickOrder(pattern, e)}
              style={{
                flex: 1,
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              下单
            </Button>
            <Button
              type="default"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(pattern)}
              style={{ borderRadius: 6 }}
            />
            <Popconfirm
              title="确认删除"
              description="确定要删除这个图案吗？"
              onConfirm={() => handleDelete(pattern.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="default"
                size="small"
                danger
                icon={<DeleteOutlined />}
                style={{ borderRadius: 6 }}
              />
            </Popconfirm>
          </div>
        </div>
      </Card>
    );
  };

  // 列表渲染函数
  const renderPatternListItem = (pattern: Pattern) => {
    // 获取图案的颜色变体数量
    const colorVariantsCount = patternColorCounts.get(pattern.id) || 0;

    const customerName = pattern.customerId
      ? customers.find(c => c.id === pattern.customerId)?.name || '未知客户'
      : null;

    const folderName = pattern.folderId ? findFolderName(pattern.folderId) : null;

    return (
      <div
        key={pattern.id}
        style={{
          backgroundColor: '#fff',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          transition: 'all 0.2s',
          cursor: 'default',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#d9d9d9';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e8e8e8';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* 缩略图 */}
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
            backgroundColor: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid #f0f0f0',
          }}
          onClick={() => handlePreview(pattern)}
        >
          {pattern.previewImage ? (
            <img
              src={pattern.previewImage}
              alt={pattern.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <FileImageOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
          )}
        </div>

        {/* 信息区 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 标题行：图案名称 + 编号 + 状态标签 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#1a1a1a',
                }}
              >
                {pattern.name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#8c8c8c',
                  fontFamily: 'Monaco, Consolas, monospace',
                  background: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              >
                {pattern.code}
              </span>
            </div>
          </div>

          {/* 左右布局：左侧信息 + 右侧属性 */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 10 }}>
            {/* 左侧：所属客户、颜色数量 */}
            <div style={{ flex: 1 }}>
              {/* 所属客户 */}
              {customerName && (
                <div style={{ marginBottom: 8 }}>
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    👤 {customerName}
                  </Tag>
                </div>
              )}

              {/* 颜色变体数量 */}
              {colorVariantsCount > 0 && (
                <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>🎨</span>
                  <Badge count={colorVariantsCount} size="small" offset={[4, 0]} />
                </div>
              )}
            </div>

            {/* 右侧：文件夹和规格 */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              {/* 所属文件夹 */}
              {folderName && (
                <div style={{ marginBottom: 6 }}>
                  <Tag
                    icon={<FolderOutlined />}
                    color="cyan"
                    style={{ margin: 0, fontSize: 11 }}
                  >
                    {folderName}
                  </Tag>
                </div>
              )}

              {/* 规格信息 */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Tag style={{ margin: 0, fontSize: 11 }}>
                  {pattern.unitsPerRow} 个/行
                </Tag>
                <span style={{ color: '#d9d9d9', fontSize: 12 }}>×</span>
                <Tag style={{ margin: 0, fontSize: 11 }}>
                  {pattern.actualHeight} cm
                </Tag>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <Button
            type="primary"
            size="small"
            icon={<ShoppingOutlined />}
            onClick={(e) => handleQuickOrder(pattern, e)}
            style={{ borderRadius: 6, fontWeight: 500 }}
          >
            下单
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(pattern)}
            style={{ borderRadius: 6 }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个图案吗？"
            onConfirm={() => handleDelete(pattern.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="default"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 6 }}
            />
          </Popconfirm>
        </div>
      </div>
    );
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 保存当前表单中的客户ID（用于创建后保持选中状态）
      const submittedCustomerId = values.customerId;

      if (editingPattern) {
        await PatternApi.update(
          editingPattern.id,
          values.name,
          values.code,
          values.actualHeight,
          values.bleedHeight,
          values.unitsPerRow,
          values.rowCount,
          values.customerId ?? null,  // 传递 null 表示清除客户
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
          customerId: values.customerId,
        });
        message.success('创建成功');
      }

      setModalVisible(false);
      await loadPatterns();

      // 如果创建图案时选择了客户，保持文件夹树的选中状态
      if (submittedCustomerId && !editingPattern) {
        setSelectedFolderId(`customer-${submittedCustomerId}`);
      }
    } catch (error) {
      message.error('操作失败: ' + error);
    }
  };

  // ========== 颜色变体管理 ==========
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

      // 更新颜色数量映射
      if (currentPattern) {
        setPatternColorCounts(prev => {
          const newMap = new Map(prev);
          const currentCount = newMap.get(currentPattern.id) || 0;
          newMap.set(currentPattern.id, Math.max(0, currentCount - 1));
          return newMap;
        });
      }

      await loadColors(currentPattern!.id);
    } catch (error) {
      message.error('删除失败: ' + error);
    }
  };

  // 快速添加预设颜色变体
  const handleQuickAddPresetVariant = async (preset: { name: string; displayName?: string; color: string }) => {
    if (!editingPattern) {
      message.warning('请先选择要编辑的图案');
      return;
    }

    const variantName = preset.displayName || preset.name || '未命名颜色';

    // 检查是否已存在相同名称的颜色变体
    const exists = newColorVariants.some(v => v.name === variantName);
    if (exists) {
      message.warning(`颜色变体"${variantName}"已存在`);
      return;
    }

    try {
      // 调用 API 创建颜色变体
      const newColor = await PatternColorApi.create({
        patternId: editingPattern.id,
        name: variantName,
        color: preset.color,
      });

      message.success(`已添加颜色变体: ${variantName}`);

      // 更新本地状态
      setNewColorVariants([...newColorVariants, newColor]);

      // 更新颜色数量映射
      setPatternColorCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(editingPattern.id, (newMap.get(editingPattern.id) || 0) + 1);
        return newMap;
      });
    } catch (error) {
      message.error('添加失败: ' + error);
    }
  };

  // 加载颜色预设
  const loadColorPresets = async () => {
    try {
      const { ColorPresetApi } = await import('@/services/tauriApi');
      const data = await ColorPresetApi.getAll();
      // 只显示激活的预设，按排序字段排序
      setColorPresets(data.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (error) {
      console.error('加载颜色预设失败:', error);
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
        customerId: getSelectedCustomerId(),
        parentFolderId: selectedFolderId,
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

  // ========== 表格列定义 ==========
  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          图案管理
        </h2>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          管理印花图案库、TIFF 文件和颜色变体
        </p>
      </div>

      <Row gutter={16} style={{ height: 'calc(100vh - 180px)' }}>
        {/* 左侧文件夹树 */}
        <Col span={4}>
          <Card
            title={<span style={{ fontSize: 14, fontWeight: 600 }}>文件夹</span>}
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
        <Col span={20}>
          <Space style={{ marginBottom: 16, width: '100%' }} vertical>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<FileImageOutlined />}
                  onClick={handleSelectImage}
                  loading={loading}
                >
                  从图片创建
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
                <Space.Compact>
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
                </Space.Compact>
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
              <Text type="secondary">共 {filteredPatterns.length} 条结果</Text>
            </Space>
          </Space>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" tip="加载中...">
                <div style={{ minHeight: 100 }} />
              </Spin>
            </div>
          ) : filteredPatterns.length === 0 ? (
            <Empty description="暂无图案" style={{ marginTop: 40 }} />
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
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
        onCancel={() => setModalVisible(false)}
        width={700}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" onClick={handleSubmit}>
              确认
            </Button>
            {editingPattern && (
              <Button
                type="primary"
                icon={<ShoppingOutlined />}
                onClick={async () => {
                  try {
                    const values = await form.validateFields();

                    // 保存当前表单中的客户ID
                    const submittedCustomerId = values.customerId;

                    // 先保存图案
                    await PatternApi.update(
                      editingPattern.id,
                      values.name,
                      values.code,
                      values.actualHeight,
                      values.bleedHeight,
                      values.unitsPerRow,
                      values.rowCount,
                      values.customerId ?? null,
                    );

                    message.success('保存成功，正在跳转到订单页...');
                    setModalVisible(false);

                    // 刷新图案列表
                    await loadPatterns();

                    // 保持文件夹树的选中状态
                    if (submittedCustomerId) {
                      setSelectedFolderId(`customer-${submittedCustomerId}`);
                    }

                    // 然后打开快捷下单
                    setPendingPatternForOrder(editingPattern);
                    const customerMsg = editingPattern.customerId
                      ? `，客户：${customers.find(c => c.id === editingPattern.customerId)?.name || '未知'}`
                      : '';
                    message.success(`已选择图案「${editingPattern.name}」${customerMsg}，正在跳转到订单页...`);
                    onNavigate?.('orders');
                  } catch (error: any) {
                    // 表单验证失败或保存失败，不做处理
                    if (error.errorFields) {
                      // 表单验证错误，不显示消息
                    } else {
                      message.error('保存失败: ' + error);
                    }
                  }
                }}
                style={{ backgroundColor: '#52c41a' }}
              >
                保存并下单
              </Button>
            )}
          </div>
        }
      >
        {/* 编辑预览区域 */}
        {editingPattern && (
          <div style={{
            marginBottom: 16,
            padding: 12,
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #e8e8e8'
          }}>
            <div style={{
              fontSize: 12,
              color: '#666',
              marginBottom: 8,
              fontWeight: 500
            }}>
              图案预览
            </div>
            {editPreviewLoading ? (
              <div style={{
                height: 150,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                borderRadius: 4
              }}>
                <Spin tip="加载预览..." />
              </div>
            ) : editPreviewImage ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                background: '#fff',
                padding: 8,
                borderRadius: 4
              }}>
                <Image
                  src={editPreviewImage}
                  alt="图案预览"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 150,
                    objectFit: 'contain'
                  }}
                  preview={{
                    src: editPreviewImage,
                  }}
                />
              </div>
            ) : (
              <div style={{
                height: 150,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                borderRadius: 4,
                color: '#bfbfbf'
              }}>
                <FileImageOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>无预览图</Text>
              </div>
            )}
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            actualHeight: 10,   // 默认 10cm
            bleedHeight: 2,     // 默认 2cm
            unitsPerRow: 2,     // 默认 2 个/行
            rowCount: 10,
          }}
        >
          {/* 隐藏的 rowCount 字段，保留用于后端兼容 */}
          <Form.Item name="rowCount" hidden>
            <InputNumber />
          </Form.Item>

          {/* 第一排：图案编号、图案名称、所属客户 */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="图案编号"
                name="code"
                rules={[{ required: true, message: '请输入图案编号' }]}
              >
                <Input placeholder="留空自动生成" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="图案名称"
                name="name"
                rules={[{ required: true, message: '请输入图案名称' }]}
              >
                <Input placeholder="例如：花卉图案001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="所属客户"
                name="customerId"
                help="留空表示共享图案"
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
            </Col>
          </Row>

          {/* 第二排：实际高度、每行个数、出血高度 */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="实际高度 (cm)"
                name="actualHeight"
                rules={[{ required: true, message: '请输入实际高度' }]}
              >
                <InputNumber min={0.1} step={0.1} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="每行个数"
                name="unitsPerRow"
                rules={[{ required: true, message: '请输入每行个数' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="出血高度 (cm)"
                name="bleedHeight"
                rules={[{ required: true, message: '请输入出血高度' }]}
              >
                <InputNumber min={0} step={0.1} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* 颜色变体管理区域 */}
          {editingPattern && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 'bold', color: '#262626' }}>
                  🎨 颜色变体管理
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<FormatPainterOutlined />}
                  onClick={() => handleOpenColorModal(editingPattern)}
                >
                  高级管理
                </Button>
              </div>

              {/* 快速添加颜色预设 */}
              {colorPresets.length > 0 && (
                <div style={{ marginBottom: 12, padding: 10, backgroundColor: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff' }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    marginBottom: 8,
                    color: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    ⚡ 快速添加：
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {colorPresets.slice(0, 10).map((preset) => (
                      <Button
                        key={preset.id}
                        size="small"
                        onClick={() => handleQuickAddPresetVariant(preset)}
                        style={{
                          height: '28px',
                          fontSize: '12px',
                          padding: '0 10px',
                          backgroundColor: '#ffffff',
                          borderColor: '#d9d9d9',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease',
                          fontWeight: 500
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = preset.color + '20';
                          e.currentTarget.style.borderColor = preset.color;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = `0 2px 4px ${preset.color}40`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                          e.currentTarget.style.borderColor = '#d9d9d9';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {preset.displayName || preset.name}
                      </Button>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
                    💡 提示：点击按钮快速添加预设颜色，或点击"高级管理"进行更多操作
                  </div>
                </div>
              )}

              {newColorVariants.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#8c8c8c' }}>
                  暂无颜色变体，点击上方按钮快速添加
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newColorVariants.map((variant, index) => (
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
                              const updated = newColorVariants.map((v, i) => ({
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
                            const updated = newColorVariants.filter((_, i) => i !== index);
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
            <Spin size="large" tip="加载图片中...">
              <div style={{ minHeight: 200 }} />
            </Spin>
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
                <Descriptions.Item label="实际高度">
                  {currentPattern.actualHeight} cm
                </Descriptions.Item>
                <Descriptions.Item label="出血高度">
                  {currentPattern.bleedHeight} cm
                </Descriptions.Item>
                <Descriptions.Item label="每行个数">
                  {currentPattern.unitsPerRow}
                </Descriptions.Item>
                <Descriptions.Item label="行数" span={2}>
                  {currentPattern.rowCount}
                </Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </div>
      </Modal>

      {/* 颜色变体管理模态框 */}
      <Modal
        title={`颜色变体 - ${currentPattern?.name}`}
        open={colorModalVisible}
        onCancel={handleCloseColorModal}
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
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
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

