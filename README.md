# 🖥️ 白墨记账系统桌面版 (Baimo Desktop)

> 专为印花行业打造的本地桌面记账管理软件

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0+-FFC131.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19+-61DAFB.svg)](https://reactjs.org/)
[![Rust](https://img.shields.io/badge/Rust-1.80+-000000.svg)](https://www.rust-lang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/PNGTRID/baimo_desktop?style=flat)](https://github.com/PNGTRID/baimo_desktop)
[![GitHub Release](https://img.shields.io/github/v/release/PNGTRID/baimo_desktop)](https://github.com/PNGTRID/baimo_desktop/releases)

**📦 下载地址**: [https://github.com/PNGTRID/baimo_desktop/releases](https://github.com/PNGTRID/baimo_desktop/releases)

## 📋 项目概述

白墨记账系统桌面版是基于 Tauri 2.0 构建的跨平台桌面应用程序，专为印花行业设计。系统采用本地 SQLite 数据库存储，无需联网即可使用，保障数据隐私和安全。

### 核心特性

- **🖥️ 原生桌面体验**: 使用 Tauri 构建轻量级、高性能的桌面应用
- **💾 本地数据存储**: SQLite 数据库，数据完全本地化
- **🎨 现代化 UI**: React 19 + Ant Design 6 提供优雅的界面
- **⚡ 高性能**: Rust 后端确保快速的数据处理
- **🔒 数据安全**: 本地存储，无需担心云端数据泄露
- **🔄 自动更新**: 支持一键自动更新，轻松获取最新功能

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **Rust** >= 1.80.0
- **npm** >= 8.0.0
- **系统要求**:
  - macOS 10.15+ (Intel & Apple Silicon)
  - Windows 10+ (64-bit)
  - Linux (主流发行版)

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/PNGTRID/baimo_desktop.git
cd baimo_desktop

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run tauri:dev
```

### 下载安装包

前往 [Releases](https://github.com/PNGTRID/baimo_desktop/releases) 页面下载最新版本的安装包：
- **Windows**: `PNG部落记账_x.x.x_x64-setup.exe`
- **macOS**: `baimo_desktop_x.x.x_x64.dmg` 或 `baimo_desktop_x.x.x_aarch64.dmg`

### 🛠️ 开发脚本

```bash
# 前端开发
npm run dev              # 启动 Vite 开发服务器

# Tauri 开发
npm run tauri:dev        # 启动 Tauri 开发模式（推荐）
npm run tauri:build      # 构建生产版本

# 数据库
npm run prisma:generate  # 生成 Prisma 客户端
npm run prisma:migrate   # 运行数据库迁移
npm run prisma:studio    # 打开 Prisma Studio
```

## 🏗️ 技术架构

### 前端技术栈

```
React 19 + TypeScript + Vite
├── 🎨 UI框架: Ant Design 6.1+
├── 🏪 状态管理: Zustand 5.0+
├── 📅 日期处理: Day.js
├── 🛠️ 构建工具: Vite 7+
└── 📡 Tauri API: @tauri-apps/api 2.9+
```

### 后端技术栈

```
Rust + Tauri 2.0
├── 🗄️ 数据库: SQLite + Prisma ORM
├── 🔄 异步运行时: Tokio
├── 📝 序列化: Serde
└── 🛡️ 类型安全: Rust 类型系统
```

### 数据库设计

```
prisma/schema.prisma
├── Customer    (客户表)
├── Product     (产品表)
├── Order       (订单表)
└── OrderItem   (订单明细表)
```

## 📁 项目结构

```
baimo_desktop/
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 通用组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务
│   │   ├── store/         # 状态管理
│   │   ├── types/         # TypeScript 类型
│   │   └── main.tsx       # 应用入口
│   ├── package.json
│   └── vite.config.ts
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── commands/      # Tauri 命令
│   │   ├── services/      # 业务服务
│   │   ├── prisma/        # Prisma 客户端
│   │   └── main.rs        # 应用入口
│   ├── Cargo.toml
│   └── tauri.conf.json
├── prisma/                # 数据库配置
│   └── schema.prisma      # 数据模型
├── package.json           # 根 package.json
└── README.md
```

## 🎯 核心功能

### 已实现功能 ✅

- **👥 客户管理**: 客户信息 CRUD、余额管理、信用额度
- **📋 订单管理**: 订单创建、订单项管理、状态跟踪
- **🎨 图案管理**: 图案库管理、TIF/TIFF 文件解析、预览图持久化
- **💾 本地存储**: SQLite 数据库自动初始化
- **📊 数据统计**: 今日订单统计、销售报表、财务分析
- **🧮 价格计算**: 自动价格计算引擎
- **📤 数据导出**: Excel/CSV 导出功能
- **🔄 自动更新**: 一键自动更新功能
- **💾 数据备份**: 数据库备份与恢复

## 📖 开发指南

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/commands/` 创建命令文件
2. 定义命令函数并添加 `#[tauri::command]` 宏
3. 在 `main.rs` 中注册命令
4. 在前端 `services/tauriApi.ts` 中添加 API 调用

### 修改数据库模型

1. 编辑 `prisma/schema.prisma`
2. 运行 `npm run prisma:migrate` 创建迁移
3. 运行 `npm run prisma:generate` 生成 Rust 客户端
4. 更新相关 TypeScript 类型

### 前端状态管理

使用 Zustand 进行状态管理，store 文件位于 `frontend/src/store/`。

## 🐛 常见问题

### 开发环境问题

**Q: Tauri CLI 找不到 `src-tauri` 目录？**
- A: 确保从项目根目录运行 `npm run tauri:dev`，而不是从 `frontend` 目录

**Q: Prisma 客户端生成失败？**
- A: 检查 `.bin/prisma-client-rust` 是否在 PATH 中，或使用 `cargo run --bin prisma`

### 构建问题

**Q: Rust 编译警告过多？**
- A: 这些警告主要来自 Prisma 生成的代码，不影响功能

**Q: 前端热更新不生效？**
- A: Tauri 开发模式下，前端修改会自动刷新

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📞 联系方式

- **项目维护者**: 老王技术团队
- **技术支持**: 提交 GitHub Issues

---

**🖥️ 白墨记账系统桌面版** - 让印花行业管理更简单、更高效！

**最后更新**: 2026-02-24
**版本**: v2.2.0
