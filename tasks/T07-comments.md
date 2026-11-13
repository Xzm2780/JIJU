# T07 任务包：评论列表、提交与删除

## 1. 任务名（Task name）

评论列表、提交与删除

## 2. 范围（Scope）

- 接口：`GET /posts/{post_id}/comments`、`POST /posts/{post_id}/comments`、`DELETE /comments/{comment_id}`。
- 页面行为：帖子详情页评论区列表、提交和作者删除。
- 支持评论游标分页和连续 60 分钟配额。

## 3. 非目标（Non-goals）

- 不支持评论编辑、楼中楼、点赞、收藏或评论者主页。
- 不允许游客评论。
- 不实现帖子编辑、轻互动或举报。
- 不在已到期、隐藏或删除的帖子下创建评论。

## 4. 前置任务（Dependencies）

T02、T03、T04

## 5. 相关 PRD 需求 ID

AUTH-01、AUTH-03、COMMENT-01、COMMENT-02、COMMENT-03、COMMENT-04、COMMENT-05、COMMENT-06、COMMENT-07、COMMENT-08、COMMENT-09、COMMENT-10、EXP-04、MINE-04

## 6. 相关 AC

AC-01、AC-11、AC-15、AC-20、AC-21、SUP-01、SUP-02、SUP-04

## 7. 涉及接口（Interfaces）

`GET /posts/{post_id}/comments`、`POST /posts/{post_id}/comments`、`DELETE /comments/{comment_id}`

## 8. 涉及表（Tables）

Comment、Post、QuotaUsage、ModerationRecord、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 评论列表按发布时间正序和稳定次级键进行游标分页，不返回已删除评论。
2. 提交评论要求登录、当前须知、有效公开帖子和未满的连续 60 分钟配额。
3. 评论正文去首尾空白后按 Unicode 扩展字素簇计数为 1 至 200。
4. 成功提交创建 Comment、评论数加一并写一条成功评论配额；失败和重复请求不消耗配额。
5. 只有评论作者可删除评论，删除后所有用户端隐藏、评论数减一并保持幂等。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：正序分页、边界字数、违规阻断、配额和第 11 条拒绝。
- `[AUTO]` 越权：游客不能评论，非评论作者不能删除。
- `[AUTO]` 并发：相同评论、删除幂等键最多产生一次副作用。
- `[AUTO]` 并发：插入新评论后原游标不重复返回同一评论。
- `[AUTO+MANUAL]` UI：输入定位、配额解除时间、删除确认和空/错/到底状态。

## 11. 完成定义（Definition of done）

- 用户可阅读、提交并删除本人评论，配额和状态规则由服务端执行。
- 评论分页、评论计数和配额事实数据保持一致。
- AC-01、AC-11、AC-15、AC-20、AC-21、SUP-01、SUP-02、SUP-04 相关断言通过。
- 本任务严格包含三个评论接口，无编辑或楼中楼等 PRD 外能力。
