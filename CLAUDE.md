# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 白墨记账系统桌面版 - AI 开发上下文

> 本文档为 Claude AI 提供项目上下文信息，用于理解项目结构和开发规范。

## 项目概述

**项目名称**: 白墨记账系统桌面版 (Baimo Desktop)
**项目类型**: Tauri 2.0 桌面应用程序
**技术栈**: TypeScript (前端) + Rust (后端) + SQLite

### 业务背景

专为印花行业打造的本地桌面记账管理软件：
- 客户管理（信用额度、余额管理）
- 图案库管理（TIFF 文件解析）
- 订单管理（多订单项、价格计算）
- 财务统计

## 常用命令

```bash
# 开发
npm run tauri:dev      # 启动 Tauri 开发服务器（推荐）
npm run dev            # 仅启动前端

# 构建
npm run tauri:build    # 构建生产版本

# 数据库
npm run prisma:generate  # 生成 Rust 客户端
npm run prisma:migrate   # 运行数据库迁移
npm run prisma:studio    # 打开 Prisma Studio
```

## 架构要点

### 数据库访问（必须遵循）

项目使用 **rusqlite 原生 SQL** 访问 SQLite 数据库，**不是** Prisma ORM：

```rust
// ✅ 正确：使用 db.sqlite() 原生 SQL
db.sqlite().query_map("SELECT ...", &[], |row| Ok(...))

// ❌ 错误：Prisma API 不存在
db.client().customer().find_many(...)
```

### 前端 API 调用

所有后端命令通过 `frontend/src/services/tauriApi.ts` 封装，使用 `invoke` 调用：

```typescript
import { invoke } from '@tauri-apps/api/core';
const data = await invoke<Customer[]>('get_customers');
```

### 添加新功能流程

1. 修改 `prisma/schema.prisma`
2. 运行 `npm run prisma:migrate && npm run prisma:generate`
3. 在 `src-tauri/src/commands/` 添加 Rust 命令
4. 在 `main.rs` 注册命令
5. 在 `frontend/src/types/index.ts` 添加 TypeScript 类型
6. 在 `frontend/src/services/tauriApi.ts` 添加前端 API

## 关键约束

- **Tauri 2.0**：命令从项目根目录运行 `npm run tauri:dev`
- **日期格式**：Rust 使用 `i64` 时间戳，前端用 Day.js 处理
- **事务**：财务相关操作必须使用事务 `db.sqlite().transaction(...)`
- **插件配置**：Tauri 2.0 格式 `"plugins": { "fs": { ... } }`，不再支持 `scope`

## 注意事项

- Prisma CLI 通过 `cargo run --bin prisma` 运行
- 编译警告来自生成代码，可忽略
- 修改 `tauri.conf.json` 后需重启开发服务器

---

**最后更新**: 2026-02-24
