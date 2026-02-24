import { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Alert, Progress, Typography, App } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const { Text, Title } = Typography;

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

export default function UpdateChecker() {
  const { message, modal } = App.useApp();
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion] = useState(() => {
    // 从 package.json 或环境变量获取当前版本
    return '2.2.0';
  });
  // 用于追踪下载进度
  const downloadTrackerRef = useRef({ downloaded: 0, total: 0 });

  /**
   * 检查更新
   */
  const checkForUpdates = async () => {
    setChecking(true);
    setUpdateAvailable(false);
    setUpdateInfo(null);

    try {
      const update = await check();

      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date || '未知',
          body: update.body || '无更新说明',
        });

        message.success(`发现新版本 ${update.version}！`);
      } else {
        message.info('当前已是最新版本');
      }
    } catch (error) {
      console.error('[更新检查失败]', error);
      message.error(`检查更新失败: ${error}`);
    } finally {
      setChecking(false);
    }
  };

  // 组件挂载时自动检查更新
  useEffect(() => {
    // 延迟 2 秒后检查，避免影响页面加载
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * 下载并安装更新
   */
  const downloadAndInstall = async () => {
    try {
      const update = await check();

      if (!update?.available) {
        message.info('没有可用更新');
        return;
      }

      modal.confirm({
        title: '确认更新',
        content: (
          <div>
            <p>确定要更新到版本 <strong>{update.version}</strong> 吗？</p>
            <p style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
              更新完成后应用将自动重启
            </p>
          </div>
        ),
        onOk: async () => {
          setDownloading(true);
          setDownloadProgress(0);
          downloadTrackerRef.current = { downloaded: 0, total: 0 };

          try {
            // 下载并安装更新
            await update.downloadAndInstall((event) => {
              switch (event.event) {
                case 'Started':
                  console.log('[更新] 开始下载...');
                  downloadTrackerRef.current.total = event.data.contentLength || 0;
                  break;
                case 'Progress':
                  downloadTrackerRef.current.downloaded += event.data.chunkLength;
                  if (downloadTrackerRef.current.total > 0) {
                    const progress = Math.round((downloadTrackerRef.current.downloaded / downloadTrackerRef.current.total) * 100);
                    setDownloadProgress(progress);
                    console.log(`[更新] 下载进度: ${progress}%`);
                  }
                  break;
                case 'Finished':
                  console.log('[更新] 下载完成');
                  setDownloadProgress(100);
                  break;
              }
            });

            message.success('更新安装完成，即将重启应用...');

            // 等待 1 秒后重启
            setTimeout(async () => {
              await relaunch();
            }, 1000);

          } catch (error) {
            console.error('[更新安装失败]', error);
            message.error(`更新失败: ${error}`);
            setDownloading(false);
            setDownloadProgress(0);
          }
        },
      });

    } catch (error) {
      console.error('[更新检查失败]', error);
      message.error(`检查更新失败: ${error}`);
    }
  };

  return (
    <Card
      title={
        <Space>
          <CloudDownloadOutlined />
          <span>系统更新</span>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={checkForUpdates}
          loading={checking}
          disabled={downloading}
        >
          检查更新
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 当前版本信息 */}
        <Alert
          message="当前版本"
          description={
            <Text strong style={{ fontSize: 16 }}>
              v{currentVersion}
            </Text>
          }
          type="info"
          icon={<CheckCircleOutlined />}
          showIcon
        />

        {/* 更新可用提示 */}
        {updateAvailable && updateInfo && (
          <Alert
            message={`新版本可用: v${updateInfo.version}`}
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">发布时间: {updateInfo.date}</Text>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Title level={5}>更新内容:</Title>
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto'
                  }}>
                    {updateInfo.body}
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={downloadAndInstall}
                  loading={downloading}
                  size="large"
                  style={{ marginTop: 12 }}
                >
                  {downloading ? '下载中...' : '立即更新'}
                </Button>
              </Space>
            }
            type="success"
            showIcon
          />
        )}

        {/* 下载进度 */}
        {downloading && downloadProgress > 0 && (
          <div>
            <Text type="secondary">下载进度:</Text>
            <Progress
              percent={downloadProgress}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        )}

        {/* 使用说明 */}
        <Alert
          message="更新说明"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>点击"检查更新"按钮查找新版本</li>
              <li>发现新版本后，点击"立即更新"开始下载</li>
              <li>下载完成后应用将自动重启以完成更新</li>
              <li>更新过程中请勿关闭应用</li>
            </ul>
          }
          type="warning"
          showIcon
        />
      </Space>
    </Card>
  );
}
