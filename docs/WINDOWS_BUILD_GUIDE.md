# Windows 打包操作手册

> PNG部落记账系统桌面版 - Windows 打包完整指南

## 📋 目录

1. [环境准备](#环境准备)
2. [打包步骤](#打包步骤)
3. [打包产物说明](#打包产物说明)
4. [安装与测试](#安装与测试)
5. [常见问题](#常见问题)
6. [代码签名配置](#代码签名配置)

---

## 🔧 环境准备

### 1. 必需软件

| 软件 | 版本要求 | 下载地址 | 用途 |
|------|----------|----------|------|
| **Rust** | 1.70+ | https://rustup.rs/ | 编译后端代码 |
| **Node.js** | 18+ | https://nodejs.org/ | 前端构建工具 |
| **Git** | 最新版 | https://git-scm.com/ | 版本控制 |
| **Visual Studio** | 2022 | https://visualstudio.microsoft.com/ | C++ 编译器 |
| **WiX Toolset** | v3.11+ | 通过 Visual Studio Installer | MSI 安装包 |

### 2. Visual Studio 安装组件

在安装 Visual Studio 2022 时，需要勾选：

```
✅ 使用 C++ 的桌面开发
   ✅ MSVC v143 - VS 2022 C++ x64/x86 生成工具
   ✅ Windows 10 SDK (或 Windows 11 SDK)
```

### 3. WiX Toolset 安装

1. 打开 **Visual Studio Installer**
2. 点击 **修改** Visual Studio 2022
3. 在 **单个组件** 选项卡中搜索并安装：
   ```
   ✅ WiX Toolset v3.11
   ✅ WiX Toolset Visual Studio Extension (v3.11)
   ```

### 4. 验证环境

打开 **PowerShell** 或 **命令提示符**，运行：

```powershell
# 检查 Rust
rustc --version
# 应输出: rustc 1.xx.x

# 检查 Node.js
node --version
# 应输出: v18.x.x 或更高

# 检查 Git
git --version
# 应输出: git version 2.x.x

# 检查 Visual Studio C++ 编译器
cl
# 应输出: Microsoft (R) C/C++ Optimizing Compiler Version 19.xx.xxxxx

# 检查 WiX
candle
# 应输出: Windows Installer XML Toolset Compiler version 3.11.x
```

---

## 📦 打包步骤

### 方法一：在 Windows 上直接打包（推荐）

#### 1. 克隆项目

```powershell
# 进入工作目录
cd D:\Projects

# 克隆项目（如果还没有）
git clone <项目仓库地址> baimo_desktop
cd baimo_desktop
```

#### 2. 安装依赖

```powershell
# 安装前端依赖
cd frontend
npm install

# 返回项目根目录
cd ..
```

#### 3. 执行打包命令

```powershell
# 从项目根目录运行
npm run tauri:build
```

### 方法二：在 macOS 上交叉编译（不推荐）

> ⚠️ 不推荐交叉编译，建议直接在 Windows 上打包。

如果必须在 macOS 上为 Windows 打包，需要安装交叉编译工具链：

```bash
# 安装 Windows 交叉编译工具
rustup target add x86_64-pc-windows-msvc

# 这通常无法成功，不推荐
```

---

## 📂 打包产物说明

打包成功后，产物位于以下位置：

```
src-tauri/target/release/bundle/
├── msi/                              # MSI 安装包（推荐分发）
│   └── PNG部落记账_0.1.0_x64_zh-CN.msi
├── nsis/                             # NSIS 安装包（传统安装程序）
│   └── PNG部落记账_0.1.0_x64-setup.exe
└── release/                          # 绿色版（免安装）
    └── baimo-desktop.exe             # 可执行文件（需要依赖文件）
```

### 推荐分发的安装包

| 文件类型 | 优点 | 缺点 | 推荐度 |
|---------|------|------|--------|
| **MSI** | 现代化、支持企业部署、支持静默安装 | 需要 Windows 8+ | ⭐⭐⭐⭐⭐ |
| **NSIS** | 兼容性好、支持自定义安装界面 | 较老的技术 | ⭐⭐⭐⭐ |
| **绿色版** | 无需安装、即开即用 | 需要手动处理依赖 | ⭐⭐⭐ |

---

## 🚀 安装与测试

### 1. 本地测试

```powershell
# 双击运行 MSI 安装包
PNG部落记账_0.1.0_x64_zh-CN.msi

# 或双击运行 NSIS 安装包
PNG部落记账_0.1.0_x64-setup.exe
```

### 2. 静默安装（企业部署）

```powershell
# MSI 静默安装
msiexec /i "PNG部落记账_0.1.0_x64_zh-CN.msi" /qn

# 指定安装目录
msiexec /i "PNG部落记账_0.1.0_x64_zh-CN.msi" /qn INSTALLDIR="D:\Program Files\PNG部落记账"

# 静默卸载
msiexec /x "PNG部落记账_0.1.0_x64_zh-CN.msi" /qn
```

### 3. 数据库位置

Windows 上的应用数据目录：

```
%LOCALAPPDATA%\com.pngtribe.ledger\baimo.db
# 实际路径示例:
# C:\Users\用户名\AppData\Local\com.pngtribe.ledger\baimo.db
```

---

## ❓ 常见问题

### Q1: 编译时提示 "link.exe not found"

**原因**: Visual Studio C++ 构建工具未正确安装

**解决方法**:
```powershell
# 1. 打开 Visual Studio Installer
# 2. 点击"修改" → "单个组件"
# 3. 搜索并安装:
#    - MSVC v143 - VS 2022 C++ x64/x86 生成工具
#    - Windows 10 SDK

# 或使用命令行安装（管理员权限）
winget install Microsoft.VisualStudio.2022.BuildTools --override "/passive /wait"
```

### Q2: WiX 工具错误 "candle.exe not found"

**原因**: WiX Toolset 未安装

**解决方法**:
```powershell
# 1. 打开 Visual Studio Installer
# 2. 点击"修改" → "单个组件"
# 3. 搜索 "WiX Toolset"
# 4. 安装 "WiX Toolset v3.11" 及其扩展
```

### Q3: 打包失败 "failed to build app"

**原因**: 通常是前端构建失败

**解决方法**:
```powershell
# 1. 先单独测试前端构建
cd frontend
npm run build

# 2. 如果前端构建成功，再尝试完整打包
cd ..
npm run tauri:build
```

### Q4: 应用启动后崩溃

**可能原因**:
- 数据库文件缺失
- Visual C++ 运行时未安装

**解决方法**:
```powershell
# 1. 安装 Visual C++ 运行时
# 下载: https://aka.ms/vs/17/release/vc_redist.x64.exe

# 2. 查看应用日志
# 日志位置: %LOCALAPPDATA%\com.pngtribe.ledger\logs\
```

### Q5: Windows Defender 警告

**原因**: 未签名的应用被标记为可疑

**解决方法**:
- 见下方 [代码签名配置](#代码签名配置) 章节

---

## 🔐 代码签名配置（可选）

### 为什么需要代码签名？

- ✅ 消除 Windows Defender 警告
- ✅ 提升用户信任度
- ✅ 减少安装时的安全提示

### 获取代码签名证书

1. **购买证书**（推荐机构）:
   - DigiCert
   - Sectigo
   - GlobalSign
   - 国内: 天威诚信、沃通等

2. **证书类型选择**:
   - **EV 代码签名证书**（推荐）：立即获得 Microsoft SmartScreen 信任
   - **普通代码签名证书**：需要一段时间积累信誉

### 配置签名

在 `src-tauri/tauri.conf.json` 中添加：

```json
{
  "bundle": {
    "publisher": "你的公司名称",
    "signCommand": "signtool sign /f /path/to/certificate.pfx /p /password /fd sha256 \"$FILE\""
  }
}
```

### 使用证书签名

```powershell
# 方法1: 使用 signtool（Windows SDK 自带）
signtool sign /f certificate.pfx /p 密码 /fd sha256 /tr http://timestamp.digicert.com baimo-desktop.exe

# 方法2: 配置在 tauri.conf.json 中自动签名
```

---

## 📝 打包配置优化

### 修改 `src-tauri/tauri.conf.json`

```json
{
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/256x256.png", "icons/512x512.png"],
    "publisher": "PNG部落",
    "category": "Business",
    "shortDescription": "PNG部落记账系统桌面版",
    "longDescription": "专为印花行业打造的本地记账管理软件",
    "windows": {
      "certificateThumbprint": "证书指纹（可选）",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

---

## 🎯 快速打包检查清单

打包前检查：

- [ ] Rust 已安装 (`rustc --version`)
- [ ] Node.js 已安装 (`node --version`)
- [ ] Visual Studio 2022 已安装，包含 C++ 构建工具
- [ ] WiX Toolset v3.11+ 已安装
- [ ] 前端依赖已安装 (`cd frontend && npm install`)
- [ ] 开发数据库存在 (`prisma/dev.db`)
- [ ] 图标文件完整 (`src-tauri/icons/`)

打包步骤：

```powershell
# 1. 清理旧的构建产物
npm run clean

# 2. 执行打包
npm run tauri:build

# 3. 检查产物
dir src-tauri\target\release\bundle\
```

---

## 📞 技术支持

如遇到问题，请提供以下信息：

1. **Windows 版本**: Win 10 / Win 11（具体版本号）
2. **错误信息**: 完整的错误堆栈
3. **构建日志**: `npm run tauri:build` 的完整输出
4. **环境信息**:
   ```powershell
   rustc --version
   node --version
   cl
   candle
   ```

---

**更新时间**: 2026-01-13
**适用版本**: PNG部落记账 v0.1.0
**维护者**: 老王技术团队
