# T02 任务包：帖子详情基础

## 1. 任务名（Task name）

帖子详情基础

## 2. 范围（Scope）

- 页面：帖子详情页的帖子主信息区域。
- 接口：`GET /posts/{post_id}`。
- 支持游客、登录非作者和作者三种读取视图。

## 3. 非目标（Non-goals）

- 不实现评论列表、评论提交、评论删除、轻互动或举报提交。
- 不实现编辑、删除或后台治理动作。
- 不向非作者返回浏览量或浏览者身份。

## 4. 前置任务（Dependencies）

T00、T01

## 5. 相关 PRD 需求 ID

DETAIL-01、DETAIL-02、DETAIL-04、DETAIL-05、DETAIL-06、VIEW-01、VIEW-02、VIEW-03、VIEW-04、VIEW-05、VIEW-06、EXP-03

## 6. 相关 AC

AC-01、AC-03、AC-13、AC-14、AC-23

## 7. 涉及接口（Interfaces）

`GET /posts/{post_id}`

## 8. 涉及表（Tables）

Post、PostVersion、Comment、Reaction、ViewRecord、Tag

## 9. 实现要点（Implementation points / core rules）

1. 非作者访问到期、隐藏、删除或不存在内容时统一返回 `JIJU_CONTENT_4041` 和“内容已不可用”。
2. 详情展示广场昵称、标签快照、正文、发布时间、评论数和轻互动分类数量。
3. 非作者新详情访问使用 `X-View-Token` 去重，首次计数最多创建一条 ViewRecord。
4. 作者访问不计浏览量，并且只有作者详情响应可以包含 `view_count`。
5. 响应序列化必须对非作者完全省略 `view_count`，不得依赖前端删除字段。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：有效详情、不可见内容统一错误、字段完整性和状态过滤。
- `[AUTO]` 越权：游客和非作者响应无 `view_count`、浏览者身份或内部状态。
- `[AUTO]` 并发：相同 `post_id + X-View-Token` 并发请求最多计数一次。
- `[MANUAL]` UI：作者和非作者视图差异、不可用提示和无浏览量展示。
- `[AUTO]` 性能：详情 P95 目标纳入 AC-24 读路径压测。

## 11. 完成定义（Definition of done）

- 游客和登录用户可读取有效帖子详情，非作者不可见场景统一处理。
- 作者详情正确展示浏览量，作者访问不增加浏览量。
- AC-01、AC-03、AC-13、AC-14、AC-23 相关断言通过。
- 本任务仅使用 `GET /posts/{post_id}`，未增加 PRD 外接口。
