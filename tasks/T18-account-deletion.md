# T18 任务包：账号永久注销

## 1. 任务名（Task name）

账号永久注销

## 2. 范围（Scope）

- 页面：账号注销说明、身份确认和结果页。
- 本任务当前不接入产品 API；AUTH-06 的接口与数据处理须在 BLOCK-05 关闭后另行评审。

## 3. 非目标（Non-goals）

- 不将“退出登录”等同于账号永久注销。
- 不自行决定内容、互动、举报、审计或账号数据的删除与保留期限。
- 不绕过 BLOCK-05 或隐私政策。
- 不删除依法或按已批准政策必须保留的数据。

## 4. 前置任务（Dependencies）

T03

## 5. 相关 PRD 需求 ID

AUTH-06、MINE-06、NFR-SEC-08、NFR-SEC-09

## 6. 相关 AC

无直接 PRD AC；由 AUTH-06 和 BLOCK-05 上线阻断项约束。

## 7. 涉及接口（Interfaces）

当前不新增接口；BLOCK-05 关闭后再设计账号注销接口。

## 8. 涉及表（Tables）

User、AuthSession、Post、Comment、Reaction、Report、NoticeConfirmation、QuotaUsage、ModerationRecord、AuditLog、ViewRecord、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 注销必须是账号永久注销，不得与会话退出或普通登出混用。
2. 注销入口和二次确认必须解释影响范围，并指向已获法务批准的隐私政策和用户协议。
3. 用户确认后由服务端执行身份校验和幂等注销，客户端不能决定数据删除范围。
4. 到期内容、主动删除内容、举报、审计和其他数据的保留或删除必须遵循 BLOCK-05 的书面结论。
5. 注销过程中的全部治理动作必须审计且不得超出已批准的数据处理范围。

## 10. 测试要求（Test requirements）

- `[MANUAL]` 合规：BLOCK-05 未关闭前只评审流程和文案，不执行真实删除。
- `[AUTO]` 单测：登出与账号注销在状态、副作用和数据范围上严格区分。
- `[AUTO]` 接口：BLOCK-05 关闭后验证身份确认、幂等和越权拒绝。
- `[AUTO]` 数据：按批准规则验证删除、匿名化和保留分类。
- `[MANUAL]` UI：影响说明、二次确认、结果页和错误恢复。

## 11. 完成定义（Definition of done）

- BLOCK-05 已获书面关闭，隐私政策和用户协议版本已批准。
- 账号注销接口、数据处理任务、审计和用户界面均按批准规则实现。
- 退出登录不会被误当作账号注销。
- 在 BLOCK-05 关闭前，本任务保持阻塞且不执行真实数据删除。
