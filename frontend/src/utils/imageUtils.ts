/**
 * 图片处理工具函数
 * 使用 html2canvas 将 DOM 元素转换为图片
 */

import html2canvas from 'html2canvas';

/**
 * 将指定元素转换为图片并复制到剪贴板
 * @param elementId - DOM 元素的 ID
 * @param options - html2canvas 配置选项
 * @returns 是否成功复制
 */
export async function copyElementAsImage(
  elementId: string,
  options: html2canvas.Options = {}
): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id "${elementId}" not found`);
      return false;
    }

    // 默认配置
    const defaultOptions: html2canvas.Options = {
      backgroundColor: '#ffffff',
      scale: 2, // 高清
      logging: false,
      useCORS: true,
      allowTaint: false,
      ...options,
    };

    // 生成 canvas
    const canvas = await html2canvas(element, defaultOptions);

    // 转换为 Blob
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          console.error('Failed to create blob from canvas');
          return;
        }

        try {
          // 复制到剪贴板
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          throw err;
        }
      },
      'image/png',
      1.0
    );

    return true;
  } catch (error) {
    console.error('Error copying element as image:', error);
    return false;
  }
}

/**
 * 将指定元素转换为图片并下载
 * @param elementId - DOM 元素的 ID
 * @param filename - 下载的文件名（不含扩展名）
 * @param options - html2canvas 配置选项
 * @returns 是否成功下载
 */
export async function downloadElementAsImage(
  elementId: string,
  filename = 'image',
  options: html2canvas.Options = {}
): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id "${elementId}" not found`);
      return false;
    }

    // 默认配置
    const defaultOptions: html2canvas.Options = {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: false,
      ...options,
    };

    // 生成 canvas
    const canvas = await html2canvas(element, defaultOptions);

    // 转换为 data URL
    const dataUrl = canvas.toDataURL('image/png');

    // 创建下载链接
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${filename}.png`;
    link.click();

    return true;
  } catch (error) {
    console.error('Error downloading element as image:', error);
    return false;
  }
}

/**
 * 将指定元素转换为图片的 Data URL
 * @param elementId - DOM 元素的 ID
 * @param options - html2canvas 配置选项
 * @returns 图片的 Data URL
 */
export async function elementToDataUrl(
  elementId: string,
  options: html2canvas.Options = {}
): Promise<string | null> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id "${elementId}" not found`);
      return null;
    }

    // 默认配置
    const defaultOptions: html2canvas.Options = {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: false,
      ...options,
    };

    // 生成 canvas
    const canvas = await html2canvas(element, defaultOptions);

    // 返回 data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error converting element to data URL:', error);
    return null;
  }
}

/**
 * 检查浏览器是否支持剪贴板 API
 * @returns 是否支持
 */
export function isClipboardSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    'write' in navigator.clipboard
  );
}

/**
 * 检查浏览器是否支持下载功能
 * @returns 是否支持
 */
export function isDownloadSupported(): boolean {
  return typeof document !== 'undefined' && 'createElement' in document;
}
