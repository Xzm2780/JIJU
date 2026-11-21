# T13 任务包：后台账号限制

## 1. 任务名（Task name）

后台账号限制

## 2. 范围（Scope）

- 页面：后台用户管理列表，以及从用户行进入的独立账号处理页。
- 接口：`GET /admin/users`、`POST /admin/users/{user_id}/restrictions`、`POST /admin/auth/login`。
- 用户管理页通过列表筛选昵称和账号状态，行内操作进入使用“概览 / 处理”标签页的账号处理页。
- 支持警告、限制发帖、限制评论、限制互动和封禁。

## 3. 非目标（Non-goals）

- 不删除或修改用户内容。
- 不提供普通用户端治理入口。
- 不处理年龄、未成年人资格或身份核验。
- 不定义限制期限的产品或法务规则。

## 4. 前置任务（Dependencies）

T00、T03

## 5. 相关 PRD 需求 ID

MOD-07、MOD-08、NFR-SEC-05、AUTH-06

## 6. 相关 AC

无直接 PRD AC；对应 MOD-07、MOD-08 的后台账号治理验收。

## 7. 涉及接口（Interfaces）

`GET /admin/users`、`POST /admin/users/{user_id}/restrictions`

## 8. 涉及表（Tables）

User、AdminRoleAssignment、AuditLog、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 用户列表允许 ACCOUNT_MODERATOR 或 AUDITOR 只读查询；处置仅允许 ACCOUNT_MODERATOR，且必须从用户列表确认目标账号后提交。后台登录令牌仅保存在当前标签页会话存储中，刷新可恢复，关闭标签页或退出后清除。
2. 动作限定 WARNING、POST_LIMIT、COMMENT_LIMIT、REACTION_LIMIT、BAN。
3. 限制类动作必须提供未来 `expires_at`；BAN 可为空表示持续封禁，具体运营期限须按批准规则填写。
4. WARNING 只写审计；其他动作更新对应账号限制或封禁字段，不删除内容。
5. 使用 `admin.user.restrict` 幂等键并写完整 AuditLog，重复请求不得重复改变状态。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：用户列表状态筛选、资料字段裁剪、游标分页；五种动作、时间校验、账号不存在和重复幂等请求。
- `[AUTO+MANUAL]` UI：后台登录成功后刷新页面仍保持会话；过期、撤销或退出后回到登录页，且不在持久存储中保存密码。
- `[AUTO]` 越权：普通用户、作者和非账号治理角色不能调用。
- `[AUTO]` 副作用：限制只影响对应能力，不改写或删除用户内容。
- `[AUTO]` 审计：操作者、角色、原因、时间和前后状态完整。
- `[MANUAL]` UI：用户列表筛选、行内选择后自动带入账号、动作/期限选择、二次确认和结果展示。

## 11. 完成定义（Definition of done）

- 授权后台可执行警告、单项能力限制和封禁。
- 限制在到期前由服务端执行，到期后按批准规则恢复。
- 所有动作可审计，普通用户不能访问后台接口。
- 本任务使用 `GET /admin/users` 和 `POST /admin/users/{user_id}/restrictions`，未定义未成年人或保留期限规则。
