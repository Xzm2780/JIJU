# T15 任务包：只读性能与容量

## 1. 任务名（Task name）

只读性能与容量

## 2. 范围（Scope）

- 接口：`GET /feed`、`GET /posts/{post_id}`、`GET /posts/{post_id}/comments`。
- 建立读路径压测数据、观测指标和容量回归基线。
- 验证游标分页、可见性过滤和到期过滤在目标负载下的表现。

## 3. 非目标（Non-goals）

- 不新增只读接口。
- 不改变业务可见性、分页格式或响应字段。
- 不引入未批准缓存或数据库产品。
- 不实现个性化推荐或热门排序。

## 4. 前置任务（Dependencies）

T01、T02、T07

## 5. 相关 PRD 需求 ID

FEED-06、EXP-03、DETAIL-01、COMMENT-03、NFR-PERF-01、NFR-PERF-02、NFR-PERF-05、NFR-PERF-06、NFR-REL-03

## 6. 相关 AC

AC-24、SUP-04

## 7. 涉及接口（Interfaces）

`GET /feed`、`GET /posts/{post_id}`、`GET /posts/{post_id}/comments`

## 8. 涉及表（Tables）

Post、PostVersion、Comment、Reaction、ViewRecord

## 9. 实现要点（Implementation points / core rules）

1. 广场首屏和详情服务端 P95 目标均不超过 1 秒。
2. 所有列表使用稳定游标分页，不依赖 offset 或返回重复资源。
3. 查询时必须执行到期、隐藏、删除和审核可见性过滤，后台任务只作兜底。
4. 压测峰值至少为预期峰值的 2 倍，并记录只读接口错误率、P95 和依赖状态。
5. 监控覆盖读错误率、响应时间、分页异常和到期过滤指标。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：分页稳定性、可见性过滤和错误率。
- `[AUTO]` 性能：按 AC-24 执行广场和详情 P95 压测。
- `[AUTO]` 并发：插入新内容或状态变化后原游标不重复。
- `[AUTO]` 容量：在至少 2 倍预期峰值下无重复写入或计数漂移。
- `[MANUAL]` 评审：压测数据、容量假设、观测面板和告警阈值。

## 11. 完成定义（Definition of done）

- 三个只读接口达到 PRD P95 和错误率目标。
- 游标分页、到期过滤和字段裁剪在容量负载下保持正确。
- AC-24 与 SUP-04 的读路径相关断言通过。
- 未新增接口或未批准依赖，性能报告可复现。
