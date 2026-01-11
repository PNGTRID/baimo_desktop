# AGENTS.md - 白墨记账桌面版开发指南

本文件为 AI 编码代理提供项目开发规范和最佳实践。

## 项目架构

**技术栈**：Tauri 2.0 桌面应用（React 19 + Rust + SQLite）
- 前端：`frontend/` - React + TypeScript + Vite + Ant Design + Zustand
- 后端：`src-tauri/` - Rust + Tauri + rusqlite
- 数据库：`prisma/` - SQLite（通过 rusqlite 访问）

## 常用命令

### 开发
```bash
# 启动 Tauri 开发服务器（推荐）
npm run tauri:dev

# 仅前端开发服务器
cd frontend && npm run dev

# 前端生产构建
cd frontend && npm run build
```

### 代码检查
```bash
# TypeScript lint
cd frontend && npm run lint

# Rust 代码检查
cd src-tauri && cargo check

# Rust 构建
cd src-tauri && cargo build
```

### 测试
```bash
# 运行所有 Rust 测试
cd src-tauri && cargo test

# 运行单个测试（指定函数名）
cd src-tauri && cargo test test_name

# 运行特定模块的测试
cd src-tauri && cargo test customer::tests

# 显示测试输出（包括 println!）
cd src-tauri && cargo test -- --nocapture
```

### 数据库
```bash
# 生成 Prisma 客户端（自定义 CLI）
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 打开 Prisma Studio
npm run prisma:studio
```

## 代码风格指南

### TypeScript/React

#### 导入顺序
```typescript
// 1. React hooks
import { useState, useEffect } from 'react';

// 2. Ant Design 组件
import { Button, Table, Modal } from 'antd';

// 3. Ant Design icons
import { PlusOutlined, EditOutlined } from '@ant-design/icons';

// 4. 类型导入（使用 type 关键字）
import type { Customer, Order } from '@/types';

// 5. 服务/API 导入
import { CustomerApi } from '@/services/tauriApi';

// 6. 其他库
import dayjs from 'dayjs';
```

#### 命名约定
- 组件：PascalCase（如 `CustomerList.tsx`）
- 函数：camelCase（如 `loadCustomers`）
- 类型/接口：PascalCase（如 `Customer`, `CreateCustomerRequest`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_ITEMS`）

#### 组件结构
```typescript
export default function ComponentName() {
  // Hooks（状态、引用、上下文）
  const { message } = App.useApp();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 加载数据函数
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await Api.getData();
      setData(result);
    } catch (error) {
      message.error('加载失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 生命周期
  useEffect(() => {
    loadData();
  }, []);

  // 事件处理函数
  const handleAction = async () => {
    // 实现
  };

  // 渲染
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### 类型定义
- 所有接口定义在 `frontend/src/types/index.ts`
- 可选字段使用 `?` 标记
- 日期类型为 `string`（ISO 8601 格式）
- 货币金额使用 `number`

### Rust

#### 命名约定
- 函数：snake_case（如 `get_customers`）
- 结构体：PascalCase（如 `Customer`, `CreateCustomerRequest`）
- 模块：snake_case（如 `customer.rs`, `mod.rs`）

#### 命令函数结构
```rust
use crate::models::{CreateCustomerRequest, Customer};
use crate::services::Database;
use tauri::State;

#[tauri::command]
pub async fn create_customer(
    request: CreateCustomerRequest,
    db: State<'_, Database>,
) -> Result<Customer, String> {
    // 生成 ID
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 数据库操作
    db.sqlite().execute(
        "INSERT INTO customers (...) VALUES (...)",
        &[&id as &dyn rusqlite::ToSql, /* 更多参数 */],
    ).map_err(|e| format!("Failed to create customer: {:?}", e))?;

    // 返回结果
    get_customer_by_id(id, db).await.map(|c| c.unwrap())
}
```

#### 数据库访问规范
**项目使用 rusqlite 原生 SQL，不使用 Prisma API。**

| Rust 类型 | SQLite 类型 | 获取方法 |
|-----------|-------------|----------|
| String | TEXT | `row.get(index)` |
| i32 | INTEGER | `row.get::<_, i32>(index)` |
| f64 | REAL | `row.get::<_, f64>(index)` |
| bool | INTEGER (0/1) | `row.get::<_, bool>(index)` |
| i64 (日期) | INTEGER | `row.get::<_, i64>(index)?.to_string()` |

#### 日期处理
```rust
// 获取当前时间戳
let now = chrono::Utc::now().timestamp(); // 返回 i64

// 存储到数据库
db.sqlite().execute(
    "INSERT INTO table (...) VALUES (...)",
    &[&now as &dyn rusqlite::ToSql],
)?;

// 从数据库读取
let created_at: String = row.get::<_, i64>(7)?.to_string();
```

#### 错误处理
- 所有 Tauri 命令返回 `Result<T, String>`
- 使用 `.map_err(|e| format!("操作失败: {:?}", e))` 转换错误
- 财务相关操作必须使用事务

#### 事务操作
```rust
db.sqlite().transaction(|tx| {
    tx.execute("INSERT INTO ...", &[...])?;
    tx.execute("UPDATE ...", &[...])?;
    Ok(())
}).map_err(|e| format!("Transaction failed: {:?}", e))
```

### 数据库类型映射

| TypeScript | Prisma | SQLite | Rust |
|-----------|--------|--------|------|
| string | String | TEXT | String |
| number | Int | INTEGER | i32 |
| number | Float | REAL | f64 |
| boolean | Boolean | INTEGER (0/1) | bool |
| string | DateTime | INTEGER | i64 → String |

## 开发工作流

### 添加新功能

1. **数据库层**
   - 编辑 `prisma/schema.prisma`
   - 运行 `npm run prisma:migrate`
   - 运行 `npm run prisma:generate`

2. **Rust 后端**
   - 在 `src-tauri/src/models/` 添加数据模型
   - 在 `src-tauri/src/commands/` 添加命令函数
   - 在 `src-tauri/src/main.rs` 注册命令
   - 使用 `rusqlite` 原生 SQL 访问数据库

3. **TypeScript 前端**
   - 在 `frontend/src/types/index.ts` 添加类型定义
   - 在 `frontend/src/services/tauriApi.ts` 添加 API 方法
   - 在页面组件中使用 API

### 重要注意事项

- **不要从 `frontend` 目录运行 `npm run tauri:dev`**
- **修改数据库 schema 后必须运行迁移**
- **财务操作必须使用数据库事务**
- **不要在代码中硬编码敏感信息**
- **所有 Tauri 命令必须在 `src-tauri/src/main.rs` 注册**
- **Rust 日期统一使用 `chrono::Utc::now().timestamp()`**

## Tauri 2.0 特定配置

- 插件配置在 `src-tauri/tauri.conf.json`
- Tauri API 导入：`import { invoke } from '@tauri-apps/api/core'`
- 检测 Tauri 环境：检查 `window.__TAURI_INTERNALS__`
- 路径配置：`frontendDist` 相对于项目根目录

## 文件组织

### 前端目录
```
frontend/src/
├── components/     # 可复用组件
├── pages/         # 页面组件
├── services/      # Tauri API 封装
├── store/         # Zustand 状态管理
├── types/         # TypeScript 类型定义
├── App.tsx        # 应用根组件
└── main.tsx       # 入口文件
```

### 后端目录
```
src-tauri/src/
├── commands/      # Tauri 命令（API 端点）
├── models/        # 数据模型（DTO）
├── services/      # 数据库服务等
├── prisma/        # Prisma 客户端
├── bin/           # Prisma CLI 二进制
├── lib.rs         # 库入口
└── main.rs        # Tauri 主入口
```
