# T01 任务包：广场信息流

## 1. 任务名（Task name）

广场信息流

## 2. 范围（Scope）

- 页面：广场列表页。
- 接口：`GET /feed`。
- 支持下拉刷新、游标加载、加载中、空态、失败和到底状态。

## 3. 非目标（Non-goals）

- 不实现详情页、发布、登录、评论或互动。
- 不提供个性化推荐、热门排序、关注流或浏览量展示。
- 不返回或渲染 `view_count`。

## 4. 前置任务（Dependencies）

T00

## 5. 相关 PRD 需求 ID

FEED-01、FEED-02、FEED-03、FEED-04、FEED-05、FEED-06、FEED-07、FEED-08、EXP-03、DETAIL-04

## 6. 相关 AC

AC-01、AC-03、AC-13、AC-15、AC-23、AC-24、SUP-04

## 7. 涉及接口（Interfaces）

`GET /feed`

## 8. 涉及表（Tables）

Post、Comment、Reaction、Tag；Post 的标签名称使用快照字段。

## 9. 实现要点（Implementation points / core rules）

1. 只返回有效 `PUBLISHED`、审核允许公开、未到期、未隐藏且未删除的帖子。
2. 按 `published_at` 倒序并使用稳定次级排序键生成服务端不透明游标。
3. 卡片只包含广场昵称、标签、正文摘要、发布时间、评论数和三类轻互动数量。
4. 响应和 UI 均不得包含浏览量；浏览量仅在作者详情接口返回。
5. 游标翻页不得重复帖子，并覆盖空态、加载失败、刷新和到底状态。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：状态过滤、排序、游标分页、空页和错误响应。
- `[AUTO]` 并发：插入新帖后继续原游标，结果不重复。
- `[AUTO]` 越权：游客和非作者响应均无 `view_count`。
- `[MANUAL]` UI：下拉刷新、加载更多、空态、错误重试和到底提示。
- `[AUTO]` 性能：首屏 P95 目标纳入 AC-24 读路径压测。

## 11. 完成定义（Definition of done）

- 广场可分页浏览有效帖子并正确处理刷新、错误和结束状态。
- 所有列表响应字段经过白名单裁剪且不含浏览量。
- AC-01、AC-03、AC-13、AC-15、AC-23、SUP-04 的相关断言通过。
- 本任务仅使用 `GET /feed`，未增加 PRD 外接口。
