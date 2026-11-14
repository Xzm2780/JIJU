# T12 任务包：后台内容复核与治理

## 1. 任务名（Task name）

后台内容复核与治理

## 2. 范围（Scope）

- 页面：后台内容复核与治理页。
- 接口：`POST /admin/content/{target_type}/{target_id}/reviews`、`POST /admin/content/{target_type}/{target_id}/actions`。
- 支持复核通过/拒绝和隐藏、下架、恢复动作入口。

## 3. 非目标（Non-goals）

- 不由后台替代作者编辑或删除内容。
- 不允许客户端修改审核状态。
- 不实现统一复核队列；`GET /admin/review-queue` 由 T11 和治理公共查询承担。
- 不实现账号限制或审计查询。

## 4. 前置任务（Dependencies）

T05、T07、T11

## 5. 相关 PRD 需求 ID

REPORT-07、MOD-02、MOD-04、MOD-05、MOD-06、MOD-08、MOD-09

## 6. 相关 AC

AC-06、AC-15、AC-19、AC-23、SUP-06

## 7. 涉及接口（Interfaces）

`POST /admin/content/{target_type}/{target_id}/reviews`、`POST /admin/content/{target_type}/{target_id}/actions`

## 8. 涉及表（Tables）

Post、Comment、PostVersion、Report、ModerationRecord、AuditLog、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 仅具备 CONTENT_MODERATOR 后台角色的用户可以处理，且必须校验当前内容版本。
2. 复核 PASSED 只更新审核结论；REJECTED 必须立即把公开状态转为 HIDDEN。
3. HIDE/TAKEDOWN 使内容不可公开，记录处理人员、时间、原因和状态前后值。
4. RESTORE 仅允许 CONTENT_MODERATOR 将 HIDDEN 恢复为 PUBLISHED，要求未到期、未删除、审核状态非 REJECTED；不得延长 expires_at。
5. 每次复核或治理动作必须写 ModerationRecord 和 AuditLog，并保持 `admin.review`/`admin.content.action` 幂等。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：PENDING 到 PASSED/REJECTED、明显违规隐藏、HIDE/TAKEDOWN 和版本冲突。
- `[AUTO]` 越权：普通用户、作者和非审核角色不能复核或治理。
- `[AUTO]` 并发：同版本并发复核只有一个结论生效，重复幂等键不重复审计。
- `[AUTO]` 条件：RESTORE 的成功、已到期、已删除、REJECTED、版本冲突和非后台角色拒绝路径。
- `[MANUAL]` UI：复核信息、内容版本、原因、状态前后值和审计记录可核验。
- `[AUTO]` 前置：AC-06 通过 `GET /admin/review-queue` 查询待复核内容与举报来源。

## 11. 完成定义（Definition of done）

- 授权审核人员可对当前内容版本完成 PASSED/REJECTED 复核和隐藏/下架。
- REJECTED 内容立即不可公开，复核与治理记录完整可审计。
- RESTORE 仅在批准条件下启用，且恢复不延长 expires_at，完整写入 ModerationRecord 与 AuditLog。
- AC-06、AC-15、AC-19、AC-23、SUP-06 相关断言通过，或已记录明确的状态机/API 阻断项。
