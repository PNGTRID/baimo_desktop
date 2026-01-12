import React, { useState, useRef, useCallback } from 'react';
import { Popover, Spin, Typography, Space } from 'antd';
import { FileImageOutlined, WarningOutlined } from '@ant-design/icons';
import { PatternApi } from '../../services/tauriApi';

const { Text } = Typography;

interface PatternPreviewPopoverProps {
  patternId: string;         // 图案 ID
  patternName: string;       // 图案名称
  children: React.ReactNode; // 包裹的子元素(通常是图案名称文本)
}

/**
 * 图案预览 Popover 组件
 * 当鼠标悬停在图案名称上时,显示图案的预览图
 */
export const PatternPreviewPopover: React.FC<PatternPreviewPopoverProps> = ({
  patternId,
  patternName,
  children,
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 缓存已加载的预览图,避免重复请求
  const previewCache = useRef<Map<string, string>>(new Map());
  const loadingRef = useRef(false); // 防止重复加载

  /**
   * 加载图案预览图
   */
  const loadPreview = useCallback(async () => {
    // 如果正在加载或已缓存,直接返回
    if (loadingRef.current) return;
    if (previewCache.current.has(patternId)) {
      setPreviewImage(previewCache.current.get(patternId)!);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 1. 获取图案详情
      const pattern = await PatternApi.getById(patternId);
      if (!pattern) {
        throw new Error('图案不存在');
      }
      let imageUrl: string | null = null;

      // 2. 优先使用 previewImage
      if (pattern.previewImage) {
        imageUrl = pattern.previewImage;
      }
      // 3. 备用: 使用 localFilePath 动态加载
      else if (pattern.localFilePath) {
        try {
          imageUrl = await PatternApi.getPatternImage(pattern.localFilePath);
        } catch (err) {
          console.warn('加载图案文件失败:', err);
        }
      }

      if (imageUrl) {
        previewCache.current.set(patternId, imageUrl);
        setPreviewImage(imageUrl);
      } else {
        setError('无预览图');
      }
    } catch (err) {
      console.error('加载图案预览失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [patternId]);

  /**
   * Popover 打开/关闭回调
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !previewImage && !loading && !error) {
      loadPreview();
    }
  };

  /**
   * 渲染 Popover 内容
   */
  const renderContent = () => {
    // 加载中
    if (loading) {
      return (
        <Spin tip="加载中...">
          <div
            style={{
              width: 200,
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Spin>
      );
    }

    // 加载失败
    if (error) {
      return (
        <div
          style={{
            width: 200,
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bfbfbf',
          }}
        >
          <Space direction="vertical" align="center" size={8}>
            <WarningOutlined style={{ fontSize: 32 }} />
            <Text type="secondary">{error}</Text>
          </Space>
        </div>
      );
    }

    // 显示预览图
    if (previewImage) {
      return (
        <div style={{ padding: 8 }}>
          <img
            src={previewImage}
            alt={patternName}
            style={{
              maxWidth: 200,
              maxHeight: 200,
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <Text
            type="secondary"
            style={{
              display: 'block',
              marginTop: 8,
              textAlign: 'center',
              fontSize: 12,
            }}
          >
            {patternName}
          </Text>
        </div>
      );
    }

    // 占位符
    return (
      <div
        style={{
          width: 200,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bfbfbf',
        }}
      >
        <Space direction="vertical" align="center" size={8}>
          <FileImageOutlined style={{ fontSize: 32 }} />
          <Text type="secondary">无预览图</Text>
        </Space>
      </div>
    );
  };

  return (
    <Popover
      content={renderContent()}
      title={null}
      trigger="hover"
      mouseEnterDelay={0.3} // 延迟300ms,避免快速划过时触发加载
      open={isOpen}
      onOpenChange={handleOpenChange}
      placement="right"
      overlayStyle={{ maxWidth: 'none' }}
    >
      {children}
    </Popover>
  );
};
