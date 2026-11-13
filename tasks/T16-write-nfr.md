# T16 任务包：写入稳定性、幂等与压测

## 1. 任务名（Task name）

写入稳定性、幂等与压测

## 2. 范围（Scope）

- 接口：`POST /posts`、`POST /posts/{post_id}/comments`、`PUT /posts/{post_id}/reaction`。
- 建立写入 P95、并发、幂等、配额和事务一致性测试。
- 验证失败请求不留下半成品或重复副作用。

## 3. 非目标（Non-goals）

- 不改变发布、评论或互动的业务规则。
- 不新增写接口。
- 不把业务成功配额当请求限流。
- 不通过客户端补偿替代服务端事务和幂等。

## 4. 前置任务（Dependencies）

T05、T07、T08、T15

## 5. 相关 PRD 需求 ID

POST-09、POST-11、COMMENT-07、COMMENT-09、REACT-03、NFR-PERF-03、NFR-PERF-04、NFR-REL-01、NFR-REL-04、NFR-SEC-03

## 6. 相关 AC

AC-20、AC-24、SUP-03

## 7. 涉及接口（Interfaces）

`POST /posts`、`POST /posts/{post_id}/comments`、`PUT /posts/{post_id}/reaction`

## 8. 涉及表（Tables）

Post、PostVersion、Comment、Reaction、QuotaUsage、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 发布、评论和互动写请求必须支持 `Idempotency-Key`，同键同载荷返回首次结果。
2. 成功配额只在业务成功后写入，失败、校验失败和重放不得重复消耗。
3. Reaction 的 `(user_id, post_id)` 唯一约束必须在并发下成立。
4. 写入事务失败不得留下可见半成品、重复计数或部分配额记录。
5. 发布、评论和互动服务端 P95 目标不超过 1.5 秒，点击后 100 毫秒内出现 UI 反馈。

## 10. 测试要求（Test requirements）

- `[AUTO]` 并发：相同幂等键、同键不同载荷、Reaction 并发切换和取消。
- `[AUTO]` 接口：配额成功/失败计数、事务回滚和错误码。
- `[AUTO]` 性能：三个写接口按 AC-24 执行混合压测。
- `[AUTO]` 稳定性：依赖失败、超时和重试后无可见半成品。
- `[MANUAL]` UI：写入按压/加载反馈、失败保留输入和重试提示。

## 11. 完成定义（Definition of done）

- 三个写接口在并发和重试下最多产生一次业务副作用。
- 配额、计数、版本和幂等记录彼此一致。
- AC-20、AC-24、SUP-03 的写入相关断言通过。
- 未新增接口，且压测报告满足 2 倍预期峰值要求。
