# JIJU API

NestJS + PostgreSQL + Redis + Prisma 的 JIJU MVP API 与运营后台实现。

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
- `IDEMPOTENCY_TTL`：幂等记录确认的工程默认 24 小时。
- `IDEMPOTENCY_LOCK_TTL`：并发请求短期锁，默认 30 秒。
- `RISK_CHALLENGE_TTL`：风险确认 challenge 的短期工程 TTL，默认 10 分钟。
- `ACCOUNT_DELETION_GRACE_HOURS`：注销冷静期，默认 720 小时。
- `EXPIRED_POST_BODY_RETENTION_DAYS`：到期内容正文清理延迟，默认 30 天。
- `VIEW_RECORD_RETENTION_DAYS`：浏览记录保留期，默认 30 天。
- `AUDIT_LOG_RETENTION_DAYS`：审计保留期，默认 180 天。
- `MOCK_WECHAT_LOGIN`：开发环境设为 `true` 才允许模拟登录。
- `WECHAT_APP_ID`、`WECHAT_APP_SECRET`：关闭 mock 时必须配置；生产环境禁止 mock，正式凭据未提供时微信链路标为“未联调”。

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

单元测试使用模拟的 Prisma/Redis 边界，不要求本机数据库。真实 PostgreSQL/Redis 集成测试需先执行迁移，再设置 `JIJU_RUN_INTEGRATION=true` 和真实 `DATABASE_URL` 运行；未满足时 Jest 会标记为 skip，不能计为集成通过。

隔离测试依赖：

```powershell
docker compose -f compose.test.yaml up -d
$env:DATABASE_URL='postgresql://jiju:jiju@127.0.0.1:55432/jiju_test?schema=public'
$env:REDIS_URL='redis://127.0.0.1:56379'
$env:JIJU_RUN_INTEGRATION='true'
npx prisma migrate deploy
npm run test:integration
```

生产 API 契约测试：

```powershell
$env:JIJU_CONTRACT_BASE_URL='http://127.0.0.1:3001/api/v1'
$env:JIJU_CONTRACT_ACCESS_TOKEN='<dedicated-test-session>'
$env:JIJU_CONTRACT_ALLOW_WRITES='true'
node --test ..\tests\acceptance\publish-contract.test.mjs
```

账本、通知、数据库失败等有副作用的用例只允许在专用测试环境运行；没有环境时用例显示“未验证”。

## MVP 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/wechat/login` | 微信登录；非生产可显式启用 mock |
| POST | `/auth/logout` | 撤销当前会话 |
| DELETE | `/me/account` | 请求永久注销并进入 30 天冷静期 |
| POST | `/notices/:noticeVersion/confirmations` | 确认当前使用须知 |
| GET | `/tags` | 返回带版本的启用标签目录 |
| GET | `/feed` | 广场稳定游标分页 |
| GET | `/posts/:postId` | 帖子详情和作者浏览量视图 |
| POST | `/posts` | 发布帖子 |
| PATCH | `/posts/:postId` | 作者编辑帖子 |
| DELETE | `/posts/:postId` | 作者删除帖子 |
| GET | `/posts/:postId/comments` | 评论列表 |
| POST | `/posts/:postId/comments` | 提交评论 |
| DELETE | `/comments/:commentId` | 删除本人评论 |
| PUT | `/posts/:postId/reaction` | 提交或切换轻互动 |
| DELETE | `/posts/:postId/reaction` | 取消轻互动 |
| GET | `/me/posts` | 本人帖子列表 |
| POST | `/reports` | 提交举报 |
| GET | `/admin/reports` | 举报专用队列 |
| GET | `/admin/review-queue` | 统一查询举报与复核队列 |
| POST | `/admin/content/:targetType/:targetId/reviews` | 内容复核 |
| POST | `/admin/content/:targetType/:targetId/actions` | 隐藏、下架或恢复 |
| POST | `/admin/users/:userId/restrictions` | 警告、限制或封禁账号 |
| GET | `/admin/audit-logs` | 审计查询 |

`POST /posts` 使用 `v1:post.publish:<uuid_v7>` 幂等键。规则结果为 `CONFIRM` 时首次返回 `409 JIJU_MODERATION_4092`、`challenge_id`、提示版本和资源；确认后用同一内容、新的幂等键、`risk_acknowledged=true` 和该 challenge 重试。

## 安全边界

- 模拟登录只用于开发，不得在生产配置中开启；生产启动检测到 mock 会失败。
- 正式登录只返回会话和必要的广场资料，openid、unionid、session_key 不返回客户端、不落库、不进入日志。
- 内容是服务端最终校验对象；客户端校验只改善体验。
- 规则词表与阈值外置，`config/content-rules.json` 中的示例不能作为正式规则上线。
- 日志不得记录正文、评论、举报说明、微信身份或会话令牌。
- 账号永久注销提供 30 天冷静期；每日执行 `npm run retention:run` 处理到期清理和保留规则。
