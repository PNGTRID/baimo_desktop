/**
 * 颜色变体图片上传组件
 * 支持本地文件上传（转Base64）和URL输入两种方式
 */

import { useState } from 'react';
import { Input, Upload, Button, Image, Space, App, Radio } from 'antd';
import { UploadOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';

interface ColorVariantUploaderProps {
  value?: string; // Base64 或 URL
  onChange?: (value: string | undefined) => void;
  maxSize?: number; // MB
  disabled?: boolean;
}

export default function ColorVariantUploader({
  value,
  onChange,
  maxSize = 2,
  disabled = false,
}: ColorVariantUploaderProps) {
  const { message } = App.useApp();
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 检查是否为Base64
  const isBase64 = (str: string) => str.startsWith('data:image/');

  // 检查是否为URL
  const isUrl = (str: string) => str.startsWith('http://') || str.startsWith('https://');

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    // 检查文件大小
    const isLtMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLtMaxSize) {
      message.error(`图片大小不能超过 ${maxSize}MB`);
      return false;
    }

    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return false;
    }

    // 转换为Base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onChange?.(base64);
      setFileList([
        {
          uid: '-1',
          name: file.name,
          status: 'done',
          url: base64,
        },
      ]);
    };
    reader.onerror = () => {
      message.error('文件读取失败');
    };
    reader.readAsDataURL(file);

    return false; // 阻止自动上传
  };

  // 处理URL输入
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    if (url) {
      onChange?.(url);
    } else {
      onChange?.(undefined);
    }
  };

  // 清除图片
  const handleClear = () => {
    onChange?.(undefined);
    setFileList([]);
  };

  // 切换输入模式
  const handleModeChange = (e: { target: { value: 'upload' | 'url' } }) => {
    setInputMode(e.target.value);
    // 切换模式时清除当前值
    onChange?.(undefined);
    setFileList([]);
  };

  return (
    <div style={{ width: '100%' }}>
      <Space vertical style={{ width: '100%' }} size="small">
        {/* 模式切换 */}
        <Radio.Group
          value={inputMode}
          onChange={handleModeChange}
          size="small"
          disabled={disabled}
        >
          <Radio.Button value="upload">文件上传</Radio.Button>
          <Radio.Button value="url">URL输入</Radio.Button>
        </Radio.Group>

        {/* 文件上传模式 */}
        {inputMode === 'upload' && (
          <>
            {value ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: '#fafafa',
                }}
              >
                <Image
                  src={value}
                  alt="预览"
                  style={{
                    width: '40px',
                    height: '40px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                  preview={{
                    visible: previewVisible,
                    onVisibleChange: (vis) => setPreviewVisible(vis),
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {isBase64(value) ? 'Base64图片' : value}
                  </div>
                </div>
                {!disabled && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={handleClear}
                  >
                    删除
                  </Button>
                )}
              </div>
            ) : (
              <Upload
                fileList={fileList}
                beforeUpload={handleFileUpload}
                onRemove={() => {
                  onChange?.(undefined);
                  setFileList([]);
                  return true;
                }}
                disabled={disabled}
                listType="picture"
                maxCount={1}
                accept="image/*"
              >
                <Button
                  icon={<UploadOutlined />}
                  disabled={disabled}
                  style={{ width: '100%' }}
                >
                  点击上传图片
                </Button>
              </Upload>
            )}
          </>
        )}

        {/* URL输入模式 */}
        {inputMode === 'url' && (
          <>
            <Input
              placeholder="请输入图片URL"
              value={isUrl(value) ? value : undefined}
              onChange={handleUrlChange}
              disabled={disabled}
              prefix={<PictureOutlined />}
              allowClear
            />
            {value && isUrl(value) && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: '#fafafa',
                }}
              >
                <Image
                  src={value}
                  alt="预览"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* 提示信息 */}
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {inputMode === 'upload'
            ? `支持 JPG、PNG 等格式，最大 ${maxSize}MB`
            : '请输入以 http:// 或 https:// 开头的图片地址'}
        </div>
      </Space>
    </div>
  );
}
