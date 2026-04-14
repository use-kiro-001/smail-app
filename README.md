# smail.pw（smail-v3）

基于 React Router Framework Mode + Cloudflare Workers 的临时邮箱服务。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/akazwz/smail)

- 线上域名：`https://smail.pw`
- Worker 名称：`smail-app`
- 默认语言：`en`（同时支持 10 种语言）

## 一键部署（Deploy to Cloudflare）

- 上方按钮可让其他开发者将本项目一键部署到他们自己的 Cloudflare 账号。
- 部署流程会基于仓库中的 `wrangler.jsonc` 自动创建并绑定所需资源（KV / D1 / R2）。
- 项目仓库需要保持公开（public）才能让他人正常使用该按钮。

## 项目简介

这是一个面向低风险场景的临时邮箱网站，核心目标是：

- 一键生成临时邮箱地址
- 即时查看收件箱
- 用于注册验证、OTP、一次性下载等短期流程
- 避免暴露长期个人邮箱

项目同时包含多语言 SEO 页面（Markdown）和多语言博客。

## 技术栈

- React 19 + React Router 7（Framework Mode，SSR）
- Cloudflare Workers（HTTP + Email Worker）
- Cloudflare D1（存储邮件元数据）
- Cloudflare R2（存储邮件原始内容）
- Cloudflare KV（Session 存储）
- Tailwind CSS 4
- Markdoc（渲染 Markdown 页面与博客）

## 核心功能

- 首页临时邮箱收件箱
- 邮件预览弹窗（解析 HTML/Text）
- 多邮箱地址管理（生成、删除、备注）
- **邀请码系统**：
  - 管理员可生成邀请码，设置使用次数和有效期
  - 邀请码用户通过邀请码登录，受次数限制
  - Session 绑定防止邀请码共享
  - 自动清理过期邀请码
- 多语言路由（`/:lang?`）
- SEO 路由：`/robots.txt`、`/sitemap.xml`、`/rss.xml`
- 多语言 Markdown 页面（about/faq/privacy/terms + 长尾 SEO 落地页）
- 多语言博客列表、分页、文章页

## 数据流（真实实现）

1. 邮件进入 Worker 的 `email` 事件（`workers/app.ts`）
2. 解析原始邮件后：
   - 元数据写入 D1 `emails` 表（`id/to_address/from/subject/time`）
   - 原始邮件内容写入 R2（对象 key 为 `id`）
3. 首页按当前会话中的地址读取 D1 列表
4. 打开邮件详情时，通过 `/api/email/:id`：
   - 校验该邮件地址属于当前会话
   - 校验地址是否超过 24h
   - 从 R2 读取原始邮件并解析后返回

说明：当前“24 小时”主要体现在会话可访问窗口与前端展示逻辑；`scheduled` 清理入口已预留，但未实现数据库物理清理逻辑。

## 目录结构

```text
app/
  routes/              # 路由模块（home、md、blog、api、sitemap、robots 等）
  md/                  # 多语言 SEO Markdown 页面
  blog/                # 多语言博客内容与元数据
  i18n/                # 语言配置与文案
  .server/session.ts   # KV Session
  utils/               # 公共工具（meta、theme、retention 等）
workers/
  app.ts               # Cloudflare Worker 入口（fetch + email）
migrations/
  *.sql                # D1 迁移
wrangler.jsonc         # Cloudflare 绑定配置
```

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发

```bash
pnpm run dev
```

默认访问：`http://localhost:5173`

### 3. 类型检查

```bash
pnpm run typecheck
```

### 4. 生产构建与预览

```bash
pnpm run build
pnpm run preview
```

## 常用命令

- `pnpm run dev`：本地开发
- `pnpm run build`：生产构建
- `pnpm run preview`：本地预览构建产物
- `pnpm run typecheck`：Cloudflare 类型生成 + 路由类型生成 + TS 检查
- `pnpm run test`：运行单元测试
- `pnpm run test:watch`：监听模式运行测试
- `pnpm run deploy`：构建后部署到 Cloudflare Workers
- `pnpm run migrate`：对远端 D1（`smail-v3`）执行迁移

## 测试

项目使用 Vitest 进行单元测试，测试文件位于 `tests/` 目录。

### 运行测试

```bash
# 运行所有测试
pnpm run test

# 监听模式（开发时使用）
pnpm run test:watch
```

### 测试覆盖

当前测试覆盖以下模块：

#### 1. 认证与多邮箱管理（`tests/auth.test.ts`）
- `verifyToken`：ACCESS_TOKEN 验证逻辑
- `isAddressExpired`：地址过期判断
- `addressMap` 多邮箱管理逻辑（生成、删除、过期清理）

#### 2. 邀请码系统（`tests/invite.test.ts`）
- **邀请码生成**：8 位字符、小写字母+数字、唯一性
- **额度管理**：
  - 新邀请码 `used_count` 初始为 0
  - 消耗后递增，用完后拒绝
  - 过期邀请码拒绝使用
  - 永不过期的邀请码只要有额度就可用
- **Session 绑定**：
  - 首次使用时绑定 session
  - 已绑定的邀请码只允许同一 session
  - 防止邀请码共享
- **过期清理**：
  - 批量清理过期邀请码
  - 永不过期的邀请码不被清理
- **角色权限**：
  - 管理员可创建邀请码，无生成地址限制
  - 邀请码用户不能创建邀请码，生成地址需检查额度
- **并发安全**：
  - 模拟并发场景，验证额度不会超发

### 测试说明

- 所有测试均为纯逻辑单元测试，不依赖 Cloudflare 运行时（D1/KV/R2）
- 实际的数据库操作需要在集成测试或本地 `wrangler dev` 环境中验证
- 测试使用 `vitest` 框架，配置文件为 `vitest.config.ts`

### 添加新测试

在 `tests/` 目录下创建 `*.test.ts` 文件，参考现有测试编写：

```typescript
import { describe, expect, it } from "vitest";

describe("功能模块名称", () => {
    it("测试用例描述", () => {
        // 测试逻辑
        expect(result).toBe(expected);
    });
});
```

## Cloudflare 资源绑定

`wrangler.jsonc` 当前使用以下绑定：

- `KV`：Session 存储
- `D1`：邮件元数据（数据库名 `smail-v3`）
- `R2`：邮件内容对象存储（桶名 `smailv3`）
- `triggers.crons`：`*/30 * * * *`（30 分钟触发一次，当前 `scheduled` 未实现清理）

## 数据库迁移

当前迁移文件：

- `migrations/20260211_create_emails.sql` — 邮件元数据表
- `migrations/20260212_email_indexes.sql` — 邮件索引
- `migrations/20260410_add_address_notes.sql` — 地址备注表
- `migrations/20260413_create_invites.sql` — 邀请码表

首次部署或表结构变更后，执行：

```bash
pnpm run migrate
```

### 邀请码表结构

```sql
CREATE TABLE IF NOT EXISTS invites (
    code         TEXT PRIMARY KEY,      -- 邀请码
    max_uses     INTEGER NOT NULL,      -- 最大使用次数
    used_count   INTEGER NOT NULL DEFAULT 0,  -- 已使用次数
    created_at   INTEGER NOT NULL,      -- 创建时间戳
    expires_at   INTEGER,               -- 过期时间戳（NULL 表示永不过期）
    bound_session TEXT                  -- 绑定的 session ID（防止共享）
);
```

## 多语言与 SEO

- 支持语言：`en/zh/es/fr/de/ja/ko/ru/pt/ar`
- 默认语言为 `en`，默认语言不带前缀
- Markdown 页面与博客均支持多语言
- 自动生成 sitemap（包含首页、Markdown 页、博客列表/分页/文章）

## 部署说明

```bash
pnpm run deploy
```

发布前建议至少执行：

```bash
pnpm run typecheck
pnpm run test
pnpm run build
```

### 首次部署

1. 确保已配置 Cloudflare 账号和 wrangler
2. 执行数据库迁移：`pnpm run migrate`
3. 设置环境变量：
   - `ACCESS_TOKEN`：管理员登录凭证
   - `SESSION_SECRET`：Session 签名密钥
4. 部署：`pnpm run deploy`

### 邀请码使用流程

1. 管理员登录后访问 `/invite` 页面
2. 设置使用次数和有效期，生成邀请码
3. 将邀请码链接分享给用户（格式：`https://itshuai.cc/login?token=邀请码`）
4. 用户使用邀请码登录，可生成有限次数的临时邮箱地址
5. 邀请码首次使用时绑定到该用户的 session，防止共享

## 重要边界

- 本项目面向临时收信与低风险验证场景。
- 不建议用于银行、工作、政务、法律与关键账号找回等高敏感场景。
