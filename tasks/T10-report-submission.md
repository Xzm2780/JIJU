# T10 任务包：举报提交

## 1. 任务名（Task name）

举报提交

## 2. 范围（Scope）

- 接口：`POST /reports`。
- 页面行为：帖子详情页举报入口、原因选择、“其他”说明和提交回执。
- 支持帖子和评论两类举报对象。

## 3. 非目标（Non-goals）

- 不实现举报处理和结果通知细节。
- 不向举报人公开举报人身份、其他举报详情或审核状态。
- 不允许游客举报。
- 不接受客户端指定内容版本。
- 不实现内容隐藏、下架或账号处罚。

## 4. 前置任务（Dependencies）

T02、T03、T04、T07

## 5. 相关 PRD 需求 ID

AUTH-01、AUTH-03、REPORT-01、REPORT-02、REPORT-03、REPORT-04、REPORT-05、REPORT-06、REPORT-07

## 6. 相关 AC

AC-01、AC-12、AC-19、AC-20、AC-22、SUP-06

## 7. 涉及接口（Interfaces）

`POST /reports`

## 8. 涉及表（Tables）

Report、Post、Comment、PostVersion、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 举报要求登录、当前须知、可用的 POST 或 COMMENT 目标和服务端内容校验。
2. 原因限定为辱骂/攻击/骚扰、隐私、涉及未成年人、危险或不适当、广告或垃圾信息、其他。
3. `other_description` 仅在原因为 OTHER 时必填，只允许后台权限可见，不得公开回显。
4. 服务端捕获目标当前 `content_version`；涉及未成年人时标记 `is_minor_related=true` 并提高队列优先级。
5. 使用 `report.submit` 幂等键并按同用户、同对象、同原因执行 24 小时去重；重复提交不生成第二条有效举报。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：帖子和评论举报、原因枚举、OTHER 必填、旧版本关联和普通用户回执。
- `[AUTO]` 并发：相同幂等键和新幂等键的 24 小时业务去重均不产生重复有效举报。
- `[AUTO]` 越权：游客不能举报，普通用户不能读取举报说明或处理细节。
- `[AUTO+MANUAL]` UI：原因选择、字段校验、提交成功确认和不可用目标提示。
- `[AUTO]` 隐私：举报说明不进入普通日志、错误响应或埋点。

## 11. 完成定义（Definition of done）

- 登录且已确认须知的用户可举报有效帖子和评论。
- 举报准确关联提交时内容版本，未成年人原因进入优先队列。
- AC-01、AC-12、AC-19、AC-20、AC-22、SUP-06 相关断言通过。
- 本任务仅使用 `POST /reports`，不包含举报处理或内容处罚能力。
