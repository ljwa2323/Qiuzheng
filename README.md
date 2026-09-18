# Qiuzheng 求证

面向系统综述全生命周期的人机协作工作台。本仓库已从纯前端原型升级为完整的前后端单体仓库：账户权限、PostgreSQL 持久化、对象存储、BullMQ 异步任务，以及用户自备 API Key 的多厂商 OpenAI 兼容模型网关（含 NVIDIA NIM）。

## 仓库结构

```
apps/api          Fastify + Prisma API 与 Worker
apps/web          Vite 前端工作区
packages/shared   共享枚举、角色与筛选契约
docker-compose.yml 一键启动全部依赖与服务
```

## Windows 原生部署（不使用 Docker）

仓库提供了一套 Windows 本机部署脚本。它使用项目目录内的独立 PostgreSQL 数据目录（端口 `55432`）、本机 Memurai/Redis（端口 `6379`）和 `.runtime/objects` 文件存储，不会改动系统已有的 PostgreSQL 数据库。

前置条件：

- Node.js 22 或更高版本
- PostgreSQL 15 或更高版本（需要命令行工具）
- Memurai 或 Redis，监听 `127.0.0.1:6379`
- 根目录已有配置完成的 `.env`

一键构建、迁移、写入演示数据并启动：

```powershell
npm run windows:start
```

启动后访问：

- Web：http://localhost:8080
- API：http://localhost:3000
- 就绪检查：http://localhost:3000/ready

查看状态或停止服务：

```powershell
npm run windows:status
npm run windows:stop
```

应用日志位于 `.runtime/logs`。本机文件存储和隔离数据库都位于 `.runtime`，该目录不会提交到 Git。

## 快速开始（Docker）

1. 复制环境变量：

```powershell
Copy-Item .env.example .env
```

2. 启动全部服务：

```powershell
docker compose up --build
```

3. 打开 http://localhost:8080

可选种子账号（需在 API 容器内执行，或本机连上 Postgres 后执行）：

```powershell
npm run seed -w @qiuzheng/api
```

默认种子：`demo@qiuzheng.local` / `demo-password-123`

## 本地开发（无 Docker 时需自备 Postgres / Redis / MinIO）

```powershell
Copy-Item .env.example .env
npm install
npm run build -w @qiuzheng/shared
npm run prisma:generate -w @qiuzheng/api
npm run prisma:deploy -w @qiuzheng/api
npm run seed -w @qiuzheng/api
npm run dev:api
npm run dev:worker
npm run dev:web
```

- Web: http://localhost:5173（Vite 代理 `/api` 到 3000）
- API: http://localhost:3000
- Health: http://localhost:3000/health

## 核心能力

- 邮箱注册登录，JWT Access + Refresh 轮换
- Team / Project 成员与 RBAC（owner / lead / reviewer / viewer）
- 方案版本、文献导入（RIS / BibTeX / CSV / PubMed XML）、筛选决策与审计落库
- 项目级数据提取字段管理，字段、提取值、原文证据与核验状态持久化
- RoB 2 signaling question 工作区，人工与 AI 判断均绑定可高亮的原文证据
- API Key AES-256-GCM 加密存储；前端只选 `credentialId`，永不回显明文
- LLM 预设：OpenAI、Azure、NVIDIA NIM、DeepSeek、Custom OpenAI-compatible endpoint
- 单条 / 批量 AI 筛选任务（BullMQ）

## 测试

```powershell
npm test
```

## 文档

- [产品说明](docs/PRODUCT_SPEC.md)
- [架构说明](docs/ARCHITECTURE.md)
- [API 概览](docs/API.md)

## 安全提示

- 不要把 `github_token.txt`、`.env` 或任何 API Key 提交进仓库
- 生产环境务必更换 `JWT_*` 与 `CREDENTIALS_MASTER_KEY`
