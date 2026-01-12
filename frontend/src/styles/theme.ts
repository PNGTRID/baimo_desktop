/**
 * 白墨记账系统 - 主题配置
 * 设计语言：新东方主义美学
 * 色彩系统：以"墨"为主色调，搭配温暖米白底色
 */

import type { ThemeConfig } from 'antd';

// ========== 色彩系统 ==========
export const colors = {
  // 主色 - 墨绿（专业可靠）
  primary: '#1a5f4c',
  primaryHover: '#237a62',
  primaryActive: '#134838',

  // 强调色 - 珊瑚红（温暖活力）
  accent: '#e07a5f',
  accentHover: '#f08a6f',
  accentLight: '#fff0ed',

  // 中性色 - 暖灰系列
  background: '#faf9f6', // 米白色底
  surface: '#ffffff', // 纯白表面
  surfaceHover: '#f5f4f0',

  // 文字色 - 深灰系列（比纯黑柔和）
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textDisabled: '#cccccc',

  // 边框色
  border: '#e8e6e1',
  borderLight: '#f0eee9',

  // 功能色
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
};

// ========== 字体系统 ==========
export const fonts = {
  // 主体字体 - 优先使用系统字体
  family: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`,

  // 数字字体 - 等宽字体用于财务数据
  mono: `'JetBrains Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace`,

  // 标题字体 - 可选衬线字体增加品质感
  heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`,
};

// ========== 字号系统 ==========
export const fontSizes = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  lg: '16px',
  xl: '18px',
  '2xl': '20px',
  '3xl': '24px',
  '4xl': '30px',
};

// ========== 间距系统 ==========
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

// ========== 圆角系统 ==========
export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// ========== 阴影系统 ==========
export const shadows = {
  sm: '0 1px 2px 0 rgba(26, 95, 76, 0.05)',
  md: '0 4px 6px -1px rgba(26, 95, 76, 0.08), 0 2px 4px -1px rgba(26, 95, 76, 0.04)',
  lg: '0 10px 15px -3px rgba(26, 95, 76, 0.08), 0 4px 6px -2px rgba(26, 95, 76, 0.04)',
  xl: '0 20px 25px -5px rgba(26, 95, 76, 0.08), 0 10px 10px -5px rgba(26, 95, 76, 0.03)',
};

// ========== Ant Design 主题配置 ==========
export const antdTheme: ThemeConfig = {
  token: {
    // 色彩
    colorPrimary: colors.primary,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.error,
    colorInfo: colors.info,
    colorBgBase: colors.background,
    colorBgContainer: colors.surface,
    colorBgElevated: colors.surface,
    colorBorder: colors.border,
    colorBorderSecondary: colors.borderLight,
    colorText: colors.textPrimary,
    colorTextSecondary: colors.textSecondary,
    colorTextTertiary: colors.textTertiary,
    colorTextDisabled: colors.textDisabled,

    // 字体
    fontFamily: fonts.family,
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,
    borderRadiusOuter: 8,

    // 间距
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,

    // 阴影
    boxShadow: shadows.sm,
    boxShadowSecondary: shadows.md,

    // 其他
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
  },

  components: {
    // 侧边栏
    Layout: {
      headerBg: colors.surface,
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBg: colors.surface,
    },

    // 菜单 - 浅色主题
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: colors.primary,
      itemHoverBg: 'rgba(26, 95, 76, 0.08)',
      itemColor: colors.textSecondary,
      itemSelectedColor: '#ffffff',
      itemBorderRadius: 8,
    },

    // 按钮
    Button: {
      controlHeight: 38,
      controlHeightLG: 46,
      controlHeightSM: 30,
      paddingInline: 18,
      fontWeightStrong: 500,
      borderRadius: 8,
      defaultShadow: shadows.sm,
      primaryShadow: `0 2px 8px rgba(26, 95, 76, 0.2)`,
    },

    // 输入框
    Input: {
      controlHeight: 38,
      controlHeightLG: 46,
      controlHeightSM: 30,
      paddingInline: 12,
      borderRadius: 8,
      activeBorderColor: colors.primary,
      hoverBorderColor: colors.primaryHover,
    },

    // 卡片
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
    },

    // 表格
    Table: {
      borderRadiusLG: 8,
      headerBg: colors.background,
      headerColor: colors.textPrimary,
      borderColor: colors.border,
    },

    // 统计数字
    Statistic: {
      contentFontSize: 24,
      titleFontSize: 14,
    },

    // 模态框
    Modal: {
      borderRadiusLG: 16,
    },

    // 标签
    Tag: {
      borderRadiusSM: 4,
    },

    // 进度条
    Progress: {
      borderRadius: 8,
    },
  },
};

// ========== CSS 变量（供 CSS 使用）==========
export const cssVars = {
  '--color-primary': colors.primary,
  '--color-primary-hover': colors.primaryHover,
  '--color-accent': colors.accent,
  '--color-accent-light': colors.accentLight,
  '--color-background': colors.background,
  '--color-surface': colors.surface,
  '--color-text-primary': colors.textPrimary,
  '--color-text-secondary': colors.textSecondary,
  '--color-border': colors.border,
  '--font-family': fonts.family,
  '--font-mono': fonts.mono,
  '--border-radius-md': borderRadius.md,
  '--border-radius-lg': borderRadius.lg,
  '--shadow-sm': shadows.sm,
  '--shadow-md': shadows.md,
  '--shadow-lg': shadows.lg,
} as const;
