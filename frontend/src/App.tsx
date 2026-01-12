import { useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/layout/Layout';
import { antdTheme } from './styles/theme';
import { useStore } from './store/useStore';
import './styles/global.css';

/**
 * 白墨记账系统 - 应用根组件
 * 使用新东方主义美学设计语言
 */
function App() {
  const { loadConfig } = useStore();

  // 应用启动时加载配置
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={antdTheme}
    >
      <AntdApp>
        <Layout />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
