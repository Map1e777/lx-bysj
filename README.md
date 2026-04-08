# 文档在线协作与版本管理系统

基于 **Vue3 + Node.js + MySQL** 的文档在线协作与版本管理系统。

## 技术栈

**前端**
- Vue 3 + TypeScript + Vite
- Pinia（状态管理）
- Vue Router 4（路由）
- Element Plus（UI 组件库）
- Tiptap（富文本编辑器）
- Axios + Socket.io-client

**后端**
- Node.js + Express 4
- mysql2（MySQL 数据库驱动）
- jsonwebtoken（JWT 认证）
- bcryptjs（密码加密）
- Socket.io（实时通知）
- multer（文件上传）
- diff-match-patch（版本差异计算）

## 系统角色

| 角色 | 说明 | 主要功能 |
|------|------|---------|
| **系统管理员** | 平台最高权限管理 | 用户管理、组织管理、权限模板、版本规则、平台统计、系统配置 |
| **组织管理员** | 特定组织内管控 | 成员管理、部门管理、组织文档管理、协作规则、版本审计 |
| **文档创作者** | 文档发起者 | 文档管理、权限分配、版本管理、协作管理、文档分享 |
| **文档协作者** | 文档参与方 | 文档编辑/查看、版本查看、协作通知、文档导出 |

## 快速开始

### 1. 准备数据库

在 MySQL 中创建数据库：

```sql
CREATE DATABASE doccollab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 启动后端

```bash
cd server
cp .env.example .env    # 复制环境变量配置，填写 DB_HOST/DB_USER/DB_PASSWORD
npm install
npm run dev              # 启动开发服务器（端口 3000，自动建表）
node db/seed.js          # 写入测试数据（另开终端执行一次即可）
```

### 3. 启动前端

```bash
cd client
npm install
npm run dev              # 启动开发服务器（端口 5173）
```

### 4. 访问系统

打开浏览器访问 http://localhost:5173

## 测试账号

所有账号密码均为 `admin123`。

| 角色 | 邮箱 | 所属部门 |
|------|------|---------|
| 系统管理员 | admin@example.com | — |
| 组织管理员 | orgadmin@example.com | 技术部 |
| 文档创作者 | creator@example.com | 技术部 |
| 文档协作者 | collab@example.com | 产品部 |
| 普通成员 | user2@example.com | 运营部 |
| 普通成员 | user3@example.com | 前端组 |

## 初始化数据说明

执行 `node db/seed.js` 后写入以下示例数据：

**组织与部门**
- 组织：示例组织（slug: `example-org`）
- 部门：技术部、产品部、运营部，以及技术部下的子部门前端组

**文档（5篇）**

| 标题 | 状态 | 可见性 | 所有者 |
|------|------|--------|--------|
| 欢迎使用文档协作系统 | 已发布 | 组织内 | creator |
| 2024 年度产品路线图 | 已发布 | 组织内 | orgadmin |
| 技术架构设计文档 | 草稿 | 私有 | creator |
| 季度运营报告 | 已发布 | 公开 | user2 |
| 内部培训材料 | 已归档 | 组织内 | orgadmin |

每篇文档附有 2–3 个历史版本。

**其他数据**
- 评论：欢迎文档上 4 条（含已解决线程与回复）
- 通知：5 条（document_shared、comment_added、invitation_accepted 类型）
- 邀请：1 条 pending + 1 条 accepted
- 审计日志：6 条（login、create、publish、update 等操作）
- 权限模板：全局只读模板、组织协作模板

> seed 脚本是幂等的，重复执行不会产生重复数据。

## 项目结构

```
lx-bysj/
├── client/                 # Vue3 前端
│   └── src/
│       ├── api/            # API 请求模块（10个）
│       ├── components/     # 公共组件
│       ├── layouts/        # 页面布局
│       ├── router/         # 路由配置
│       ├── stores/         # Pinia 状态管理
│       ├── utils/          # 工具函数
│       └── views/          # 页面视图（25个）
│           ├── admin/      # 系统管理员视图（7个）
│           ├── org/        # 组织管理员视图（5个）
│           ├── doc/        # 文档相关视图（4个）
│           ├── version/    # 版本管理视图（2个）
│           └── collab/     # 协作相关视图（2个）
│
└── server/                 # Node.js 后端
    ├── db/                 # 数据库初始化与种子数据
    ├── middleware/         # 中间件（认证、权限、审计）
    ├── routes/             # API 路由（11个，约60个接口）
    ├── services/           # 业务服务层
    └── utils/              # 工具函数
```

## 核心功能

### 文档管理
- 富文本文档创建与编辑（Tiptap编辑器）
- 文档状态管理（草稿/发布/归档）
- 文档软删除与恢复
- 文档分享（生成公开链接）
- 文档导出（HTML格式）

### 版本管理
- 自动版本快照（基于版本规则配置）
- 手动版本检查点（带标签和说明）
- 版本历史列表（时间线展示）
- 版本内容对比（差异高亮显示）
- 版本回滚（一键恢复历史版本）

### 协作管理
- 邀请协作者（通过邮箱/用户名）
- 细粒度权限（创建者/编辑者/查看者）
- 实时在线状态显示
- 协作邀请接受/拒绝
- 协作者权限变更

### 实时通知
- Socket.io 实时推送
- 通知类型：邀请、评论、版本保存、协作变更
- 通知未读标记与批量已读

### 评论系统
- 行内文档评论
- 多级回复（线程式评论）
- 评论解决/取消解决

### 文件附件
- 文档附件上传
- 附件管理与下载

## API 文档

后端提供约 **60个 REST API 接口**，统一响应格式：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

主要接口前缀：
- `POST /api/auth/login` - 用户登录
- `GET /api/documents` - 文档列表
- `GET /api/documents/:id/versions` - 版本历史
- `POST /api/documents/:id/invite` - 邀请协作者
- `GET /api/admin/stats` - 平台统计
- `GET /api/org/members` - 组织成员

## 权限矩阵

| 操作 | 系统管理员 | 组织管理员 | 文档创作者 | 编辑者 | 查看者 |
|------|-----------|-----------|-----------|--------|--------|
| 创建文档 | ✅ | ✅ | ✅ | - | - |
| 编辑内容 | ✅ | ✅(本组织) | ✅ | ✅ | ❌ |
| 删除文档 | ✅ | ✅(本组织) | ✅ | ❌ | ❌ |
| 管理协作者 | ✅ | ✅(本组织) | ✅ | ❌ | ❌ |
| 保存版本 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 回滚版本 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 查看版本 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 添加评论 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 导出文档 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 查看审计日志 | ✅ | ✅(本组织) | ❌ | ❌ | ❌ |
| 系统配置 | ✅ | ❌ | ❌ | ❌ | ❌ |
