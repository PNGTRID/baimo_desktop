import { useState } from 'react';
import { Layout as AntLayout, Menu, theme, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  PictureOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Patterns from '@/pages/Patterns';
import Orders from '@/pages/Orders';
import Financial from '@/pages/Financial';
import Settings from '@/pages/Settings';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

export type MenuKey = 'dashboard' | 'customers' | 'patterns' | 'orders' | 'financial' | 'settings';

/**
 * 白墨记账系统 - 主布局组件
 * 新东方主义美学设计语言
 */
export default function Layout() {
  const [selectedKey, setSelectedKey] = useState<MenuKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: 'customers', icon: <UserOutlined />, label: '客户管理' },
    { key: 'patterns', icon: <PictureOutlined />, label: '图案管理' },
    { key: 'orders', icon: <FileTextOutlined />, label: '订单管理' },
    { key: 'financial', icon: <DollarOutlined />, label: '财务管理' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  const currentPageTitle = menuItems.find((item) => item.key === selectedKey)?.label || '白墨记账';

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard':
        return <Dashboard onNavigate={setSelectedKey} />;
      case 'customers':
        return <Customers />;
      case 'patterns':
        return <Patterns />;
      case 'orders':
        return <Orders />;
      case 'financial':
        return <Financial />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setSelectedKey} />;
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#ffffff',
          borderRight: '1px solid #e8e6e1',
        }}
        trigger={null}
        width={200}
      >
        {/* Logo 区域 */}
        <div className="logo logo-light">
          <div className="logo-content">
            <div className="logo-icon">
              <span className="logo-text">P</span>
            </div>
            {!collapsed && (
              <div className="logo-title">
                <Text style={{ color: '#1a1a1a', fontSize: '16px', fontWeight: 600, letterSpacing: '1px' }}>
                  PNG部落
                </Text>
                <Text style={{ color: '#999', fontSize: '11px', display: 'block' }}>
                  PNG TRIBE
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key as MenuKey)}
          style={{ borderRight: 'none', background: 'transparent' }}
        />
      </Sider>

      <AntLayout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        {/* 头部 */}
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            borderBottom: '1px solid #e8e6e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              className="collapse-trigger"
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f4f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {collapsed ? <MenuUnfoldOutlined style={{ color: '#666' }} /> : <MenuFoldOutlined style={{ color: '#666' }} />}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>
                {currentPageTitle}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="header-info">
              <Text style={{ color: '#999', fontSize: 13 }}>
                {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </Text>
            </div>
          </div>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            margin: 0,
            padding: '24px',
            background: '#faf9f6',
            minHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          <div
            className="content-wrapper fade-in"
            style={{
              background: 'transparent',
              borderRadius: 0,
              padding: 0,
            }}
          >
            {renderContent()}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
