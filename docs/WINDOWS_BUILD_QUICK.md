# Windows 打包快速指南

> 📄 30 秒了解 Windows 打包流程

## 🚀 快速开始

### 1. 安装必需软件

```powershell
# 1. 安装 Rust
# 访问: https://rustup.rs/
# 下载并运行 rustup-init.exe

# 2. 安装 Node.js
# 访问: https://nodejs.org/
# 下载 LTS 版本安装

# 3. 安装 Visual Studio 2022 Community（免费）
# 访问: https://visualstudio.microsoft.com/
# 安装时勾选: ✅ 使用 C++ 的桌面开发
```

### 2. 安装 WiX Toolset

```powershell
# 打开 Visual Studio Installer
# 点击"修改" → "单个组件"
# 搜索并安装: ✅ WiX Toolset v3.11
```

### 3. 打包命令

```powershell
# 进入项目目录
cd D:\Projects\baimo_desktop

# 安装依赖
cd frontend
npm install
cd ..

# 开始打包
npm run tauri:build
```

### 4. 获取安装包

打包完成后，产物在：
```
src-tauri/target/release/bundle/
├── msi/PNG部落记账_0.1.0_x64_zh-CN.msi      ← 推荐这个
└── nsis/PNG部落记账_0.1.0_x64-setup.exe    ← 或者这个
```

---

## ❗ 常见错误速查

| 错误信息 | 解决方法 |
|---------|----------|
| `link.exe not found` | 安装 Visual Studio C++ 构建工具 |
| `candle.exe not found` | 安装 WiX Toolset v3.11 |
| `failed to build app` | 先运行 `cd frontend && npm run build` 检查前端 |
| 应用启动崩溃 | 安装 [VC++ 运行时](https://aka.ms/vs/17/release/vc_redist.x64.exe) |

---

## 📋 环境检查清单

打包前运行：

```powershell
rustc --version       # ✅ Rust 1.70+
node --version        # ✅ Node.js 18+
cl                    # ✅ VS C++ 编译器
candle               # ✅ WiX Toolset
```

如果以上命令都能正常输出，说明环境已就绪！

---

## 💡 提示

- ⏱️ 首次打包约需 10-15 分钟
- 📦 最终 MSI 包约 25-30 MB
- 🎯 建议使用 MSI 格式分发

详细文档请参考: [Windows 打包完整手册](./WINDOWS_BUILD_GUIDE.md)
