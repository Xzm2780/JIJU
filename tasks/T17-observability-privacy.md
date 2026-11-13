# T17 任务包：日志脱敏、埋点与安全回归

## 1. 任务名（Task name）

日志脱敏、埋点与安全回归

## 2. 范围（Scope）

- 接口：`POST /posts`、`POST /posts/{post_id}/comments`、`POST /reports`。
- 建立事件白名单、日志脱敏、错误追踪和隐私回归测试。
- 覆盖敏感错误、后台治理和第三方 SDK 的数据边界。

## 3. 非目标（Non-goals）

- 不记录帖子正文、评论正文、举报说明或浏览者身份。
- 不新增埋点事件或扩展属性。
- 不采集 openid、unionid、session_key、手机号、证件号码或精确位置。
- 不自行决定日志、埋点或审计数据保留期限。

## 4. 前置任务（Dependencies）

T05、T07、T10、T12、T13

## 5. 相关 PRD 需求 ID

REPORT-04、REPORT-07、MOD-06、MOD-08、MOD-09、NFR-SEC-03、NFR-SEC-04、NFR-SEC-06

## 6. 相关 AC

AC-12、SUP-07

## 7. 涉及接口（Interfaces）

`POST /posts`、`POST /posts/{post_id}/comments`、`POST /reports`

## 8. 涉及表（Tables）

Post、Comment、Report、AuditLog、ModerationRecord

## 9. 实现要点（Implementation points / core rules）

1. 日志和埋点使用字段白名单，只记录事件名、request_id、路由模板、状态和耗时等安全字段。
2. 正文、评论、举报说明、微信身份、令牌、IP、浏览者身份和完整请求体不得进入日志、APM 或分析 SDK。
3. 错误日志与用户错误响应只使用 `request_id` 关联，不返回堆栈或内部异常文本。
4. 埋点仅使用 PRD 定义事件和安全属性，不得通过调试字段或第三方自动采集绕过。
5. 举报说明和内容正文只能进入受权限保护的业务/审计数据，不进入通用日志。

## 10. 测试要求（Test requirements）

- `[AUTO]` 单测：脱敏器、事件白名单、错误响应和 request_id 关联。
- `[AUTO]` 接口：发帖、评论、举报成功与失败路径的日志/埋点快照。
- `[AUTO]` 安全：扫描 APM、错误上报、第三方 SDK 和分析 payload。
- `[AUTO]` 越权：普通用户不能读取后台审计或举报详情。
- `[MANUAL]` 隐私评审：保留期限、访问权限、日志导出和第三方 SDK 配置。

## 11. 完成定义（Definition of done）

- 发帖、评论和举报链路的所有日志与埋点通过敏感数据扫描。
- 错误响应和追踪不包含正文、评论、举报说明或内部堆栈。
- AC-12、SUP-07 与相关 NFR 安全要求通过。
- 未新增埋点事件或接口，未自行决定任何数据保留期限。
