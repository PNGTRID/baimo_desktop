import { useState } from 'react';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/layout/Layout';

function App() {
  const [darkMode] = useState(false);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <Layout />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
