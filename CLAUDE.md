# 白墨记账系统桌面版 - AI 开发上下文

> 本文档为 Claude AI 提供项目上下文信息，用于理解项目结构和开发规范。

## 📋 项目概述

**项目名称**: 白墨记账系统桌面版 (Baimo Desktop)
**项目类型**: Tauri 2.0 桌面应用程序
**开发语言**: TypeScript (前端) + Rust (后端)
**状态**: Alpha 开发阶段

### 业务背景

专为印花行业打造的本地桌面记账管理软件，主要功能包括：
- 客户管理（信用额度、余额管理）
- 图案库管理（TIFF 文件解析）
- 订单管理（多订单项、价格计算）
- 财务统计

## 🏗️ 技术栈

### 前端
```
React 19.2.0
├── TypeScript 5.9.3
├── Vite 7.2.4
├── Ant Design 6.1.4
├── Zustand 5.0.9 (状态管理)
├── Day.js 1.11.19 (日期处理)
├── @tauri-apps/api 2.9.1
└── @tauri-apps/plugin-* 2.x (插件)
```

### 后端 (Rust)
```
Tauri 2.0
├── prisma-client-rust (SQLite ORM)
├── serde (序列化)
├── tokio (异步运行时)
└── chrono (日期时间)
```

### 数据库
```
SQLite (通过 Prisma ORM)
├── prisma 7.2.0
└── 数据库文件: prisma/dev.db
```

## 📁 目录结构

```
baimo_desktop/
│
├── frontend/                    # React 前端应用
│   ├── src/
│   │   ├── components/          # 可复用组件
│   │   │   └── Layout.tsx      # 主布局
│   │   ├── pages/              # 页面组件
│   │   │   ├── Customers.tsx   # 客户管理（已完成）
│   │   │   ├── Orders.tsx      # 订单管理（已完成）
│   │   │   ├── Patterns.tsx    # 图案管理（待完善）
│   │   │   └── Dashboard.tsx   # 仪表盘
│   │   ├── services/
│   │   │   └── tauriApi.ts     # Tauri API 封装
│   │   ├── store/
│   │   │   └── useStore.ts     # Zustand 状态管理
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript 类型定义
│   │   ├── App.tsx             # 应用根组件
│   │   └── main.tsx            # 入口文件
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── src-tauri/                   # Rust 后端应用
│   ├── src/
│   │   ├── commands/           # Tauri 命令（API 端点）
│   │   │   ├── mod.rs         # 命令模块导出
│   │   │   ├── customer.rs    # 客户相关命令
│   │   │   ├── order.rs       # 订单相关命令
│   │   │   ├── pattern.rs     # 图案相关命令
│   │   │   └── tiff.rs        # TIFF 文件解析
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   └── database.rs    # 数据库单例服务
│   │   ├── prisma/
│   │   │   ├── mod.rs         # Prisma 客户端导出
│   │   │   └── _prisma.rs     # 生成的 Prisma 代码
│   │   ├── models/            # 数据模型（DTO）
│   │   │   ├── mod.rs
│   │   │   ├── customer.rs
│   │   │   ├── order.rs
│   │   │   └── pattern.rs
│   │   ├── bin/
│   │   │   └── prisma.rs      # Prisma CLI 二进制
│   │   ├── lib.rs
│   │   └── main.rs            # Tauri 主入口
│   ├── Cargo.toml
│   └── tauri.conf.json        # Tauri 配置
│
├── prisma/                     # Prisma 配置
│   ├── schema.prisma          # 数据模型定义
│   ├── migrations/            # 数据库迁移文件
│   └── dev.db                 # SQLite 数据库文件
│
├── package.json               # 根 package.json（快捷脚本）
├── .gitignore
├── README.md
└── CLAUDE.md                  # 本文档
```

## 🔑 关键文件说明

### 前端关键文件

#### `frontend/src/types/index.ts`
- 定义所有 TypeScript 类型
- 与 Rust 后端的数据模型对应
- **重要**: 修改类型时需同步更新 Rust models

#### `frontend/src/services/tauriApi.ts`
- Tauri invoke API 封装
- 按模块分组（CustomerApi, OrderApi, PatternApi, TiffApi）
- **重要**: 添加新命令时需在此添加对应 API 方法

#### `frontend/src/pages/`
- 页面组件，每个对应一个功能模块
- 使用 Ant Design 组件
- 通过 Tauri API 与后端通信

### 后端关键文件

#### `src-tauri/src/main.rs`
- Tauri 应用入口
- 注册所有命令和插件
- 初始化数据库连接
- **注意**: 插件配置需与 tauri.conf.json 一致

#### `src-tauri/tauri.conf.json`
- Tauri 应用配置
- 窗口设置、构建路径、插件配置
- **重要**: 修改配置后需重启开发服务器

#### `prisma/schema.prisma`
- 数据库模型定义
- **重要**: 修改后需要运行 `npm run prisma:migrate` 和 `npm run prisma:generate`

#### `src-tauri/Cargo.toml`
- Rust 依赖配置
- **注意**: prisma-client-rust 使用 git 源，已指定 tag

## 📝 开发规范

### 添加新功能的流程

#### 1. 数据库层
```bash
# 1. 编辑 prisma/schema.prisma
# 2. 创建迁移
npm run prisma:migrate

# 3. 生成 Rust 客户端
npm run prisma:generate
```

#### 2. Rust 后端
```rust
// 1. 在 src-tauri/src/models/ 添加数据模型
// 2. 在 src-tauri/src/commands/ 添加命令函数

#[tauri::command]
pub async fn my_new_command(db: State<'_, Database>) -> Result<MyData, String> {
    // 实现逻辑
}

// 3. 在 src-tauri/src/main.rs 注册命令
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_new_command,
])
```

#### 3. TypeScript 前端
```typescript
// 1. 在 frontend/src/types/index.ts 添加类型定义

// 2. 在 frontend/src/services/tauriApi.ts 添加 API
export const MyApi = {
  async myMethod(): Promise<MyData> {
    return await invoke<MyData>('my_new_command');
  },
};

// 3. 在页面组件中使用
const data = await MyApi.myMethod();
```

### 代码风格

#### TypeScript
- 使用函数式组件 + Hooks
- 状态管理使用 `useState`、`useEffect`
- 使用 Ant Design 组件
- 遵循 ESLint 规则

#### Rust
- 使用 `async/await` 处理异步
- 错误返回 `Result<T, String>`
- **数据库访问**: 统一使用 `rusqlite` 原生 SQL（通过 `db.sqlite()` API）
- 日期使用 `chrono::Utc::now().timestamp()` 返回 i64

### 数据库访问规范

**项目使用 rusqlite 原生 SQL 访问 SQLite 数据库。**

#### ✅ 正确的数据库访问方式

```rust
use crate::services::Database;
use tauri::State;

#[tauri::command]
pub async fn get_items(db: State<'_, Database>) -> Result<Vec<Item>, String> {
    // 1. 查询多行
    db.sqlite().query_map(
        "SELECT id, name, value FROM items ORDER BY createdAt DESC",
        &[],
        |row: &rusqlite::Row| {
            Ok(Item {
                id: row.get(0)?,
                name: row.get(1)?,
                value: row.get(2)?,
            })
        },
    ).map_err(|e| format!("Failed to fetch items: {:?}", e))
}

#[tauri::command]
pub async fn get_item_by_id(
    id: String,
    db: State<'_, Database>,
) -> Result<Option<Item>, String> {
    // 2. 查询单行
    db.sqlite().query_row(
        "SELECT id, name, value FROM items WHERE id = ?1",
        &[&id as &dyn rusqlite::ToSql],
        |row| { /* ... */ },
    )
}

#[tauri::command]
pub async fn create_item(
    request: CreateItemRequest,
    db: State<'_, Database>,
) -> Result<Item, String> {
    let now = chrono::Utc::now().timestamp();

    // 3. 插入数据
    db.sqlite().execute(
        "INSERT INTO items (id, name, value, createdAt) VALUES (?1, ?2, ?3, ?4)",
        &[&uuid::Uuid::new_v4().to_string() as &dyn rusqlite::ToSql, &request.name, &request.value, &now],
    )?;

    // 4. 事务操作（财务相关必须使用）
    db.sqlite().transaction(|tx| {
        tx.execute("INSERT INTO ...", &[...])?;
        tx.execute("UPDATE ...", &[...])?;
        Ok(())
    })?;

    Ok(item)
}
```

#### ❌ 错误的数据库访问方式

```rust
// ❌ Prisma API 不可用
db.client().order().find_many(vec![])  // 此方法不存在
crate::prisma::order::id::equals(id)   // prisma 模块不存在
```

#### Database API 方法

| 方法 | 用途 | 返回值 |
|------|------|--------|
| `db.sqlite()` | 获取 SQLite 引擎 | `&SqliteDatabase` |
| `.query_map(sql, params, mapper)` | 查询多行 | `Result<Vec<T>, String>` |
| `.query_row(sql, params, mapper)` | 查询单行 | `Result<Option<T>, String>` |
| `.execute(sql, params)` | 执行 INSERT/UPDATE/DELETE | `Result<usize, String>` |
| `.transaction(closure)` | 事务操作 | `Result<R, String>` |

#### 类型映射

| Rust 类型 | SQLite 类型 | 获取方法 |
|-----------|-------------|----------|
| String | TEXT | `row.get(index)` |
| i32 | INTEGER | `row.get::<_, i32>(index)` |
| f64 | REAL | `row.get::<_, f64>(index)` |
| bool | INTEGER (0/1) | `row.get::<_, bool>(index)` |
| i64 | INTEGER | `row.get::<_, i64>(index)?.to_string()` (日期) |
| Option\<T\> | NULLABLE | `row.get(index)` |

### 命名约定

| 类型 | 命名风格 | 示例 |
|------|----------|------|
| 组件 | PascalCase | `CustomerList.tsx` |
| 函数 | camelCase | `loadCustomers` |
| 类型/接口 | PascalCase | `Customer` |
| 常量 | UPPER_SNAKE_CASE | `MAX_ITEMS` |
| Rust 函数 | snake_case | `get_customers` |
| Rust 结构体 | PascalCase | `Customer` |

## 🚀 常用命令

### 开发
```bash
# 启动 Tauri 开发服务器（推荐）
npm run tauri:dev

# 仅启动前端开发服务器
npm run dev

# 构建生产版本
npm run tauri:build
```

### 数据库
```bash
# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 打开 Prisma Studio（数据库管理界面）
npm run prisma:studio
```

### Rust
```bash
# 进入 src-tauri 目录
cd src-tauri

# 构建 Rust 项目
cargo build

# 运行 Rust 测试
cargo test

# 检查代码
cargo check
```

## ⚠️ 注意事项

### Tauri 配置

1. **命令运行位置**:
   - ✅ 从项目根目录运行 `npm run tauri:dev`
   - ❌ 不要从 `frontend` 目录运行

2. **插件配置格式** (Tauri 2.0):
   ```json
   "plugins": {
     "fs": {
       "requireLiteralLeadingDot": false  // 正确
     }
   }
   // ❌ 不再支持 "scope": ["**"]
   ```

3. **路径配置**:
   ```json
   "beforeDevCommand": "cd frontend && npm run dev",  // ✅ 正确
   "beforeBuildCommand": "cd frontend && npm run build",
   "frontendDist": "frontend/dist"  // 相对于项目根目录
   ```

### Prisma 使用

1. **CLI 命令**: 由于 prisma-client-rust 已不再维护，使用自定义的 CLI:
   ```bash
   cargo run --bin prisma
   ```

2. **Rust API**:
   ```rust
   // 创建
   db.client().customer().create(params).exec().await?

   // 查询
   db.client().customer().find_many(vec![]).exec().await?

   // 更新
   db.client().customer().update(where, params).exec().await?

   // 删除
   db.client().customer().delete(where).exec().await?
   ```

### 数据类型映射

| Prisma | Rust | TypeScript |
|--------|------|------------|
| String | String | string |
| Int | i32 | number |
| Float | f64 | number |
| Boolean | bool | boolean |
| DateTime | DateTime<FixedOffset> | string (ISO 8601) |
| Optional | Option<T> | T \| undefined |

## 🐛 常见问题解决

### 编译警告

**问题**: 466 个编译警告，主要来自 Prisma 生成代码
**解决**: 这些警告不影响功能，可以暂时忽略

### 前端热更新

**问题**: 前端修改后没有自动刷新
**解决**: Tauri 开发模式支持热更新，检查 Vite 配置

### 数据库迁移

**问题**: Prisma 迁移失败
**解决**:
1. 检查 `.bin/prisma-client-rust` 权限
2. 删除 `prisma/dev.db` 重新初始化
3. 运行 `cargo run --bin prisma`

## 📊 数据模型

### Customer (客户)
```rust
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}
```

### Order (订单)
```rust
pub struct Order {
    pub id: String,
    pub order_number: String,
    pub customer_id: String,
    pub total_amount: f64,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
    pub items: Vec<OrderItem>,
}
```

### OrderItem (订单明细)
```rust
pub struct OrderItem {
    pub id: String,
    pub order_id: String,
    pub pattern_id: String,
    pub quantity: i32,
    pub area: Option<f64>,
    pub unit_price: f64,
    pub total_price: f64,
}
```

## 🔄 开发工作流

```mermaid
graph LR
    A[修改需求] --> B[更新 Prisma Schema]
    B --> C[运行迁移]
    C --> D[生成 Rust 客户端]
    D --> E[编写 Rust 命令]
    E --> F[更新 TypeScript 类型]
    F --> G[编写前端页面]
    G --> H[测试功能]
```

## 📚 相关资源

- [Tauri 文档](https://tauri.app/v1/guides/)
- [Prisma 文档](https://www.prisma.io/docs)
- [React 文档](https://react.dev/)
- [Ant Design 文档](https://ant.design/)

---

**维护者**: 老王技术团队
**最后更新**: 2026-01-10
