# JIJU API

NestJS + PostgreSQL + Redis + Prisma 的 T05 发布服务实现。

## 配置

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

关键配置：

- `DATABASE_URL`：PostgreSQL 连接串。
- `REDIS_URL`：Redis 连接串。
- `NOTICE_VERSION`：当前使用须知版本。
- `CONTENT_RULES_FILE`：外部内容规则配置路径。
- `IDEMPOTENCY_TTL`：幂等记录默认 24 小时，待 BLOCK-05 数据保留规则确认。
- `IDEMPOTENCY_LOCK_TTL`：并发请求短期锁，默认 30 秒。
- `RISK_CHALLENGE_TTL`：风险确认 challenge 的短期工程 TTL，默认 10 分钟。
- `MOCK_WECHAT_LOGIN`：开发环境设为 `true` 才允许模拟登录。

## 本地运行

项目提供 `compose.yaml` 启动 PostgreSQL、Redis 和 API：

```powershell
docker compose up --build
```

若本机已有 PostgreSQL 和 Redis：

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm start
```

API 默认监听 `http://127.0.0.1:3001/api/v1`。

## 测试

```powershell
npm test
npm run build
```

单元测试使用模拟的 Prisma/Redis 边界，不要求本机数据库；真实 PostgreSQL/Redis 集成测试应在具备 Docker 或测试数据库的环境执行迁移后运行。

## MVP 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/wechat/login` | 开发用模拟微信登录 |
| POST | `/auth/logout` | 撤销当前会话 |
| POST | `/notices/:noticeVersion/confirmations` | 确认当前使用须知 |
| GET | `/tags` | 返回带版本的启用标签目录 |
| POST | `/posts` | 发布帖子 |

`POST /posts` 使用 `v1:post.publish:<uuid_v7>` 幂等键。规则结果为 `CONFIRM` 时首次返回 `409 JIJU_MODERATION_4092`、`challenge_id`、提示版本和资源；确认后用同一内容、新的幂等键、`risk_acknowledged=true` 和该 challenge 重试。

## 安全边界

- 模拟登录只用于开发，不得在生产配置中开启。
- 内容是服务端最终校验对象；客户端校验只改善体验。
- 规则词表与阈值外置，`config/content-rules.json` 中的示例不能作为正式规则上线。
- 日志不得记录正文、评论、举报说明、微信身份或会话令牌。
- 账号永久注销不在本服务中实现，由 T18 在 BLOCK-05 关闭后处理。
