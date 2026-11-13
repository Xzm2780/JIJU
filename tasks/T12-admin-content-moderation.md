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
- 不在状态机未确认时启用 `HIDDEN -> PUBLISHED` 恢复。
- 不新增待复核内容列表接口；该 API 缺口须另行确认。
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
4. RESTORE 在当前状态机确认前必须返回 `JIJU_CONFLICT_4091`，不得自行恢复公开。
5. 每次复核或治理动作必须写 ModerationRecord 和 AuditLog，并保持 `admin.review`/`admin.content.action` 幂等。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：PENDING 到 PASSED/REJECTED、明显违规隐藏、HIDE/TAKEDOWN 和版本冲突。
- `[AUTO]` 越权：普通用户、作者和非审核角色不能复核或治理。
- `[AUTO]` 并发：同版本并发复核只有一个结论生效，重复幂等键不重复审计。
- `[AUTO]` 阻塞：状态机未批准前 RESTORE 稳定返回冲突。
- `[MANUAL]` UI：复核信息、内容版本、原因、状态前后值和审计记录可核验。
- `[AUTO+MANUAL]` 前置：AC-06 的待复核内容查询 API 缺口必须在验收前关闭或给出正式替代方案。

## 11. 完成定义（Definition of done）

- 授权审核人员可对当前内容版本完成 PASSED/REJECTED 复核和隐藏/下架。
- REJECTED 内容立即不可公开，复核与治理记录完整可审计。
- RESTORE 只有状态机正式授权后才能启用，否则按契约返回冲突。
- AC-06、AC-15、AC-19、AC-23、SUP-06 相关断言通过，或已记录明确的状态机/API 阻断项。
