import { useState } from 'react';
import { Layout as AntLayout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  PictureOutlined,
  FileTextOutlined,
  DollarOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Patterns from '@/pages/Patterns';
import Orders from '@/pages/Orders';
import Financial from '@/pages/Financial';
import Settings from '@/pages/Settings';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;

export type MenuKey = 'dashboard' | 'customers' | 'patterns' | 'orders' | 'financial' | 'settings';

export default function Layout() {
  const [selectedKey, setSelectedKey] = useState<MenuKey>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: 'customers', icon: <UserOutlined />, label: '客户管理' },
    { key: 'patterns', icon: <PictureOutlined />, label: '图案管理' },
    { key: 'orders', icon: <FileTextOutlined />, label: '订单管理' },
    { key: 'financial', icon: <DollarOutlined />, label: '财务管理' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

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
        theme="dark"
      >
        <div className="logo">
          <h1 style={{ color: '#fff', textAlign: 'center', padding: '16px 0' }}>
            {collapsed ? '白墨' : '白墨记账'}
          </h1>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key as MenuKey)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div style={{ padding: '0 24px', fontSize: '18px', fontWeight: 'bold' }}>
            {menuItems.find((item) => item.key === selectedKey)?.label}
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {renderContent()}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
