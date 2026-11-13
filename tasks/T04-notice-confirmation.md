# T04 任务包：使用须知确认

## 1. 任务名（Task name）

使用须知确认

## 2. 范围（Scope）

- 页面：当前版本使用须知页。
- 接口：`POST /notices/{notice_version}/confirmations`。
- 支持首次表达或互动前的须知拦截和确认后恢复原操作。

## 3. 非目标（Non-goals）

- 不实现协议管理后台、版本发布或用户协议编辑。
- 不实现发布、评论、互动或举报业务本身。
- 不定义协议内容、协议保留期限或未成年人规则。

## 4. 前置任务（Dependencies）

T03

## 5. 相关 PRD 需求 ID

AUTH-03、NFR-SEC-08

## 6. 相关 AC

AC-22

## 7. 涉及接口（Interfaces）

`POST /notices/{notice_version}/confirmations`

## 8. 涉及表（Tables）

NoticeConfirmation、User

## 9. 实现要点（Implementation points / core rules）

1. 服务端展示并校验当前须知版本，客户端不得自行决定版本有效性。
2. 每个用户与每个须知版本最多保留一条确认记录。
3. 用户首次表达或互动前必须存在当前版本确认，否则返回 `JIJU_ACCESS_4032`。
4. 确认成功或已存在时均返回确认结果，不重复创建记录。
5. 确认后恢复用户原操作和输入，不改变配额、内容或计数。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：当前版本确认、旧版本拒绝、重复确认幂等和唯一约束。
- `[AUTO]` 越权：未登录不能创建确认记录。
- `[AUTO+MANUAL]` UI：确认前阻止原操作、展示须知、确认后恢复原操作。
- `[MANUAL]` 文案：协议版本、确认动作和返回路径清晰可理解。

## 11. 完成定义（Definition of done）

- 用户可在首次表达或互动前查看并确认当前须知。
- 确认记录唯一且可追溯，确认前所有受限操作由服务端拦截。
- AC-22 的自动化与人工验收通过。
- 未实现协议管理或任何 PRD 外功能。
