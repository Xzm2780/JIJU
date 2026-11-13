# T05 任务包：发布帖子

## 1. 任务名（Task name）

发布帖子

## 2. 范围（Scope）

- 页面：发布页，包括正文、情绪标签、情境标签、留存时长、风险提示和发布结果。
- 接口：`GET /tags`、`POST /posts`。
- 发布成功后进入帖子详情并展示成功状态。

## 3. 非目标（Non-goals）

- 不实现帖子编辑、删除、评论或轻互动。
- 不支持图片、语音、视频、自由文本标签或自定义留存时长。
- 不在服务端收集未提交的本地草稿正文。
- 不自行设定未成年人准入或数据保留规则。
- 不实现标签管理、真实审核后台或账号永久注销；永久注销由独立任务 T18 在 BLOCK-05 关闭后处理。

## 4. 前置任务（Dependencies）

T02、T03、T04

## 5. 相关 PRD 需求 ID

AUTH-03、POST-01、POST-02、POST-03、POST-04、POST-05、POST-06、POST-09、POST-10、POST-11、POST-12、TAG-01、TAG-02、TAG-03、TAG-04、TAG-05、EXP-01、EXP-02、MOD-01、MOD-02、MOD-04

## 6. 相关 AC

AC-03、AC-04、AC-05、AC-06、AC-07、AC-20、AC-22、SUP-01、SUP-02

## 7. 涉及接口（Interfaces）

`GET /tags`、`POST /posts`

## 8. 涉及表（Tables）

Post、PostVersion、Tag、QuotaUsage、ModerationRecord、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 从公开 `GET /tags` 读取带版本的服务端标签配置；提交时校验标签 ID 属于对应分类且仍启用。
2. 提交前校验登录、当前须知、发帖配额、服务端内容规则和非空字段。
3. 正文去首尾空白后按 Unicode 扩展字素簇计数为 1 至 500；`retention_hours` 必须显式传 24、72 或 168，客户端默认预选 168，但服务端不隐式补值。
4. 服务端规则返回 CONFIRM 时先返回 challenge_id、提示版本和求助资源且不落库；确认后使用 challenge_id 和 `risk_acknowledged=true` 重试，成功时生成 PENDING 并进入复核队列。
5. 使用 `post.publish` 幂等键，同一次成功发布只创建一条 Post、一个首个版本和一条成功配额记录。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：边界字数、标签分类、留存枚举、配额、风险确认和成功响应。
- `[AUTO]` 并发：相同幂等键并发发布最多成功一次，只消耗一次配额。
- `[AUTO]` 安全：零宽/控制字符不能绕过服务端校验。
- `[AUTO]` 失败路径：501 字素、违规、配额满、未确认须知均不创建帖子。
- `[AUTO+MANUAL]` UI：字段错误定位、风险提示、草稿保留和发布成功跳转。

## 11. 完成定义（Definition of done）

- 登录且已确认须知的用户可发布合法纯文字帖子并进入详情。
- 正文、标签、留存、风险复核、配额和幂等规则全部由服务端执行。
- AC-03～AC-07、AC-20、AC-22、SUP-01、SUP-02 相关断言通过。
- 本任务仅使用 `POST /posts`，未增加 PRD 外接口。
