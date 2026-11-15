# T09 任务包：我的帖子

## 1. 任务名（Task name）

我的帖子

## 2. 范围（Scope）

- 页面：我的页面。
- 接口：`GET /me/posts`、`GET /me/profile`、`PUT /me/profile`。
- 支持本人有效、到期和已下架帖子的状态筛选、编辑/删除入口、仅包含系统头像和可编辑昵称的个人资料，以及会话注销入口。

## 3. 非目标（Non-goals）

- 不提供个人主页、用户内容聚合页、关注、粉丝或陌生人身份入口。
- 不展示他人帖子、浏览量或浏览者名单。
- 不实现账号永久注销。
- 不在列表直接返回 `view_count`；浏览量只由作者帖子详情返回。

## 4. 前置任务（Dependencies）

T02、T03、T05、T06、T07、T08

## 5. 相关 PRD 需求 ID

AUTH-01、MINE-01、MINE-02、MINE-03、MINE-04、MINE-05、MINE-06、DETAIL-04、DETAIL-06、EXP-05、EXP-06、EXP-07

## 6. 相关 AC

AC-13、AC-14、AC-15、AC-18、SUP-04

## 7. 涉及接口（Interfaces）

`GET /me/posts`

## 8. 涉及表（Tables）

Post、Comment、Reaction、ViewRecord、AuthSession

## 9. 实现要点（Implementation points / core rules）

1. “我的”必须要求登录，只查询当前账号本人帖子，不得由客户端传入作者 ID。
2. 列表支持 ACTIVE、EXPIRED、HIDDEN 状态筛选和稳定游标分页，已删除帖子不进入列表。
3. 条目展示正文摘要、标签、公开状态、审核状态、发布时间、到期时间、评论数和轻互动数量。
4. 根据服务端返回状态提供详情、编辑和删除入口；到期与下架内容只读，删除后立即从列表消失。
5. 本 API 契约不在列表返回 `view_count`，并需准确处理 PRD 列表展示浏览量的待确认差异。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：登录限制、状态筛选、分页、已删除不可见和字段裁剪。
- `[AUTO]` 越权：不能通过修改参数查看他人帖子或浏览量。
- `[AUTO]` 并发：新帖子或到期变化下原游标不重复返回同一帖子。
- `[MANUAL]` UI：有效、审核中、到期、下架状态展示及可编辑/只读入口。
- `[AUTO+MANUAL]` 退出登录：注销后页面回到游客态且不展示原账号数据。

## 11. 完成定义（Definition of done）

- 登录用户可查看和筛选本人有效、到期和已下架帖子。
- 已删除帖子不可见，其他账号数据不可越权读取。
- AC-13、AC-14、AC-15、AC-18、SUP-04 相关断言通过。
- 本任务只使用 `GET /me/posts`，未增加个人主页或其他 PRD 外接口。
