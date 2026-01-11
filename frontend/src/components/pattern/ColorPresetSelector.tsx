/**
 * 颜色预设选择器组件
 * 从后端加载颜色预设，支持色块选择和自定义颜色
 */

import { useState, useEffect } from 'react';
import { ColorPicker, Input, Space, Tooltip, Spin, Empty } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { ColorPresetApi } from '@/services/tauriApi';
import type { ColorPreset } from '@/types';

interface ColorPresetSelectorProps {
  value?: string;
  onChange?: (color: string) => void;
  disabled?: boolean;
  allowCustom?: boolean; // 是否允许自定义颜色
  placeholder?: string;
}

export default function ColorPresetSelector({
  value,
  onChange,
  disabled = false,
  allowCustom = true,
  placeholder = '选择颜色预设',
}: ColorPresetSelectorProps) {
  const [presets, setPresets] = useState<ColorPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 加载颜色预设
  useEffect(() => {
    const loadPresets = async () => {
      setLoading(true);
      try {
        const data = await ColorPresetApi.getAll();
        // 只显示激活的预设，按排序字段排序
        setPresets(data.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
      } catch (error) {
        console.error('加载颜色预设失败:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPresets();
  }, []);

  // 筛选后的预设
  const filteredPresets = presets.filter((p) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      p.name.toLowerCase().includes(searchLower) ||
      (p.displayName?.toLowerCase().includes(searchLower))
    );
  });

  // 处理颜色选择
  const handleColorSelect = (color: string) => {
    onChange?.(color);
  };

  return (
    <div style={{ width: '100%' }}>
      <Space vertical style={{ width: '100%' }} size="small">
        {/* 颜色预设网格 */}
        <div>
          <Input
            placeholder={placeholder}
            prefix={<span style={{ fontSize: '12px' }}>🔍</span>}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ marginBottom: 8 }}
            allowClear
            size="small"
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin indicator={<LoadingOutlined spin />} />
            </div>
          ) : filteredPresets.length === 0 ? (
            <Empty
              description={searchText ? '未找到匹配的颜色预设' : '暂无颜色预设'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '20px 0' }}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))',
                gap: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '4px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                backgroundColor: '#fafafa',
              }}
            >
              {filteredPresets.map((preset) => (
                <Tooltip
                  key={preset.id}
                  title={preset.displayName || preset.name}
                >
                  <div
                    onClick={() => !disabled && handleColorSelect(preset.color)}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: preset.color,
                      border: value === preset.color ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '4px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {value === preset.color && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textShadow: '0 0 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        {/* 自定义颜色选择器 */}
        {allowCustom && (
          <div>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
              自定义颜色:
            </div>
            <ColorPicker
              value={value}
              onChange={(color) => {
                const hexColor = color.toHexString();
                onChange?.(hexColor);
              }}
              disabled={disabled}
              showText
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          </div>
        )}
      </Space>
    </div>
  );
}
