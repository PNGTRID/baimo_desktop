import React, { useState, useRef, useCallback } from 'react';
import { Popover, Spin, Typography, Space } from 'antd';
import { FileImageOutlined, WarningOutlined } from '@ant-design/icons';
import { PatternApi } from '../../services/tauriApi';
import { useStore } from '../../store/useStore';

const { Text } = Typography;

const LOG_PREFIX = '[PREVIEW]';

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

  // 使用全局缓存
  const { getPatternImage, setPatternImage: cachePatternImage } = useStore();
  const loadingRef = useRef(false); // 防止重复加载

  /**
   * 加载图案预览图
   */
  const loadPreview = useCallback(async () => {
    const requestId = `${patternId}_${Date.now()}`;
    const loadStart = performance.now();

    console.log(`${LOG_PREFIX} [${requestId}] 开始加载预览: patternId=${patternId}`);

    // 如果正在加载,直接返回
    if (loadingRef.current) {
      console.log(`${LOG_PREFIX} [${requestId}] 已在加载中，跳过`);
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 1. 获取图案详情
      console.log(`${LOG_PREFIX} [${requestId}] 步骤1: 获取图案详情`);
      const pattern = await PatternApi.getById(patternId);
      if (!pattern) {
        throw new Error('图案不存在');
      }
      console.log(`${LOG_PREFIX} [${requestId}] 图案详情: name=${pattern.name}, hasPreviewImage=${!!pattern.previewImage}, hasLocalFilePath=${!!pattern.localFilePath}`);

      let imageUrl: string | null = null;

      // 2. 优先使用 previewImage
      if (pattern.previewImage) {
        console.log(`${LOG_PREFIX} [${requestId}] 步骤2a: 使用预置预览图: size=${pattern.previewImage.length} bytes`);
        imageUrl = pattern.previewImage;
      }
      // 3. 备用: 使用 localFilePath 动态加载（使用全局缓存）
      else if (pattern.localFilePath) {
        // 检查全局缓存
        const cached = getPatternImage(pattern.localFilePath);
        if (cached) {
          console.log(`${LOG_PREFIX} [${requestId}] 全局缓存命中: size=${cached.length} bytes`);
          imageUrl = cached;
        } else {
          console.log(`${LOG_PREFIX} [${requestId}] 步骤2b: 动态生成预览图: path=${pattern.localFilePath}`);
          const genStart = performance.now();
          try {
            imageUrl = await PatternApi.getPatternImage(pattern.localFilePath);
            const genElapsed = performance.now() - genStart;
            console.log(`${LOG_PREFIX} [${requestId}] 动态预览生成成功: 耗时=${genElapsed.toFixed(0)}ms, size=${imageUrl.length} bytes`);
            // 存入全局缓存
            if (imageUrl) {
              cachePatternImage(pattern.localFilePath, imageUrl);
            }
          } catch (err) {
            const genElapsed = performance.now() - genStart;
            console.error(`${LOG_PREFIX} [${requestId}] 动态预览生成失败: 耗时=${genElapsed.toFixed(0)}ms, error=`, err);
          }
        }
      }

      if (imageUrl) {
        setPreviewImage(imageUrl);
        const totalElapsed = performance.now() - loadStart;
        console.log(`${LOG_PREFIX} [${requestId}] 预览加载成功: 总耗时=${totalElapsed.toFixed(0)}ms`);
      } else {
        const totalElapsed = performance.now() - loadStart;
        console.warn(`${LOG_PREFIX} [${requestId}] 无可用预览图: 总耗时=${totalElapsed.toFixed(0)}ms`);
        setError('无预览图');
      }
    } catch (err) {
      const totalElapsed = performance.now() - loadStart;
      console.error(`${LOG_PREFIX} [${requestId}] 加载失败: 总耗时=${totalElapsed.toFixed(0)}ms, error=`, err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [patternId, getPatternImage, cachePatternImage]);

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
              width: 400,
              height: 400,
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
            width: 400,
            height: 400,
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
        <div style={{ padding: 12 }}>
          <img
            src={previewImage}
            alt={patternName}
            style={{
              maxWidth: 400,     // 增大到 400px
              maxHeight: 400,    // 增大到 400px
              width: 'auto',     // 保持原始宽高比
              height: 'auto',    // 保持原始宽高比
              objectFit: 'contain', // 完整显示图片，不裁切
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
          width: 400,
          height: 400,
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
