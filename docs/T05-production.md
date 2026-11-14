# T05 生产实现说明

## 实现边界

- 前端：原生微信小程序 + TypeScript。
- 后端：NestJS + PostgreSQL + Redis + Prisma。
- 范围：发布页、模拟登录恢复、须知确认、标签目录、`POST /posts`、成功详情预览。
- 现有 `demo/publish` 仅作交互参考，不是生产入口。
- 发布页使用紧凑公开提示卡和原生勾选确认；留存时长采用三等分可收缩布局，必须在窄屏下完整展示三个选项。
- 视觉基调为偏冷调的暖色：暖象牙背景、烟熏玫瑰主色和柔和陶土提示色，避免偏橙主色与冷绿色点缀混用。
- 视觉配色采用奶油暖底、陶土红主操作、蜂蜜金提示和柔和橄榄绿成功态，统一规则见 [视觉配色规范](ui-design.md)。

## 运行

- 后端：[server/README.md](../server/README.md)
- 前端：[frontend/README.md](../frontend/README.md)

## AC 对照

| AC | 实现位置 | 验收方式 | 状态 |
| --- | --- | --- | --- |
| AUTH-02 | 小程序发布页、登录弹窗、草稿模块；`POST /auth/wechat/login` | 前端单测、接口集成测试、微信开发者工具人工复验 | 已实现开发版 |
| AC-03（部分） | `POST /posts`、成功详情预览 | `PostsService` 单测和生产 API 集成测试 | 已覆盖发布响应和详情预览；广场可见性由 T01/T02 负责 |
| AC-04 | 前后端扩展字素簇校验、失败不消耗配额 | 前后端单测；错误路径测试 | 已实现 |
| AC-05 | 外置规则配置 `BLOCK` 分支 | ContentRuleEngine 与 PostsService 单测 | 已实现模拟规则，正式规则待 BLOCK-06 |
| AC-06 | `409 JIJU_MODERATION_4092` 两阶段 challenge、PENDING 复核记录 | PostsService 单测；挑战与幂等测试 | 后端已实现；后台查询队列端到端仍由 T11/T12 补齐 |
| AC-07 | 北京时间自然日 5 篇配额 | PostService 配额测试；待 PostgreSQL 集成测试补强 | 已实现 |
| AC-20 | Redis 锁 + IdempotencyRecord + UUIDv7 幂等键 | 服务单测；待真实 PostgreSQL/Redis 并发测试补强 | 已实现核心逻辑 |
| AC-22 | 登录后使用须知确认 | 须知接口、发布服务前置校验、UI 弹窗 | 已实现 |
| SUP-01 | `Intl.Segmenter` 客户端 + 服务端权威计数 | 两端单测 | 已实现 |
| SUP-02 | 规则匹配前移除 Unicode 格式/控制字符，保留原文用于展示和字素计数 | Common 与 PostsService 单测 | 已实现；正式规则词表仍待 BLOCK-06 |
| SUP-07 | 日志不采集请求正文，错误仅返回 request_id | 代码审查、后续可观测性任务 | 基础约束已实现 |

## 尚未关闭的上线项

- 正式关键词、阈值和误拦截标准：BLOCK-06。
- 正式求助资源：BLOCK-03；当前资源仅为示例配置。
- 数据保留和 `IDEMPOTENCY_TTL` 正式值：BLOCK-05。
- 真实微信登录换取：不属于本任务。
- 账号永久注销：T18，按配置化冷静期与清理任务实现。
- PostgreSQL/Redis 集成/压测环境：当前执行环境没有 Docker，只能用单元测试和编译验证。
