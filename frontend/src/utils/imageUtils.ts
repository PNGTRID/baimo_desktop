/**
 * 图片处理工具函数
 * 使用 html2canvas 将 DOM 元素转换为图片
 */

import html2canvas from 'html2canvas';
import { ClipboardApi } from '@/services/tauriApi';

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
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });

    if (!blob) {
      console.error('Failed to create blob from canvas');
      return false;
    }

    // 将 Blob 转换为字节数组
    const arrayBuffer = await blob.arrayBuffer();
    const imageBytes = Array.from(new Uint8Array(arrayBuffer));

    // 使用 Tauri 原生剪贴板 API
    await ClipboardApi.writeImage(imageBytes);
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

    // 转换为 Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png', 1.0);
    });

    if (!blob) {
      console.error('Failed to create blob from canvas');
      return false;
    }

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

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
