# T06 任务包：编辑与删除帖子

## 1. 任务名（Task name）

编辑与删除帖子

## 2. 范围（Scope）

- 页面：编辑帖页，以及作者端删除确认交互。
- 接口：`PUT /posts/{post_id}`、`DELETE /posts/{post_id}`。
- 支持内容版本、编辑复核和作者软删除。

## 3. 非目标（Non-goals）

- 不允许非作者编辑或删除帖子。
- 不允许编辑到期、删除或被禁止编辑的帖子。
- 不允许评论编辑。
- 不延长 `expires_at`，不恢复已删除内容。
- 不实现后台恢复或治理动作。

## 4. 前置任务（Dependencies）

T02、T05

## 5. 相关 PRD 需求 ID

POST-07、POST-08、REPORT-07、EXP-02、EXP-06、MINE-05、MOD-02、MOD-05

## 6. 相关 AC

AC-16、AC-17、AC-18、AC-20、SUP-01、SUP-02、SUP-05

## 7. 涉及接口（Interfaces）

`PUT /posts/{post_id}`、`DELETE /posts/{post_id}`

## 8. 涉及表（Tables）

Post、PostVersion、Report、ModerationRecord、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 编辑和删除均由服务端验证作者身份、公开状态、当前版本和规则允许性；详情返回 `content_version`，编辑时作为必填 `expected_content_version` 回传。
2. 成功编辑先执行服务端校验，再追加不可变 PostVersion 并更新 `current_content_version` 和 `edited_at`。
3. 编辑不得改变 `id`、`published_at` 或 `expires_at`；校验失败时旧公开版本保持有效。
4. 高风险编辑写新的风险确认并进入 PENDING 复核；旧举报和复核继续关联原内容版本。
5. 删除使用 `post.delete` 幂等键，写入 DELETED 和 `deleted_at`，不返还配额，不向任何用户端展示。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：安全编辑、无效编辑、版本冲突和到期时间不变。
- `[AUTO]` 越权：非作者、到期帖和已删除帖不能编辑或删除。
- `[AUTO]` 审计：旧版本可追溯，举报的 `content_version` 不被编辑覆盖。
- `[AUTO]` 并发：相同幂等键和并发编辑不生成重复版本。
- `[MANUAL]` UI：编辑失败保留输入、删除确认、删除后不可恢复提示。

## 11. 完成定义（Definition of done）

- 作者可安全编辑有效帖子并生成新版本，旧版本继续可审计。
- 作者删除后帖子从公开区和作者端消失，重复删除幂等。
- AC-16～AC-18、AC-20、SUP-01、SUP-02、SUP-05 相关断言通过。
- 本任务只使用两个帖子写接口，未增加恢复或 PRD 外接口。
