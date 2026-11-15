# T08 任务包：轻互动提交、切换与取消

## 1. 任务名（Task name）

轻互动提交、切换与取消

## 2. 范围（Scope）

- 接口：`PUT /posts/{post_id}/reaction`、`DELETE /posts/{post_id}/reaction`。
- 页面行为：帖子详情页三类固定轻互动的选择、切换和取消，包含图标、选中态和点击后的动态粒子反馈。
- 支持分类数量、总数和当前用户选择状态。

## 3. 非目标（Non-goals）

- 不支持自定义互动名称、文案或类型。
- 不展示互动参与者身份或名单。
- 不允许游客、到期、隐藏或删除帖子产生新互动。
- 不实现评论、举报或内容治理。

## 4. 前置任务（Dependencies）

T02、T03、T04

## 5. 相关 PRD 需求 ID

AUTH-01、AUTH-03、REACT-01、REACT-02、REACT-03、REACT-04、REACT-05、REACT-06、REACT-07、REACT-08、DETAIL-02、DETAIL-07、EXP-04

## 6. 相关 AC

AC-01、AC-08、AC-09、AC-10、AC-15、AC-20、SUP-03

## 7. 涉及接口（Interfaces）

`PUT /posts/{post_id}/reaction`、`DELETE /posts/{post_id}/reaction`

## 8. 涉及表（Tables）

Reaction、Post、IdempotencyRecord

## 9. 实现要点（Implementation points / core rules）

1. 轻互动仅允许 HUG、HEAD_PAT、CHEER，并要求登录、当前须知和有效公开帖子。
2. `(user_id, post_id)` 必须唯一，同一用户对同一帖子最多保留一条 Reaction。
3. 首次选择新类型加一；切换时旧类型减一、新类型加一，总数保持不变。
4. 取消把 `active` 置为 false 并对应减一；重复取消保持幂等且计数不得为负。
5. 分类数量和总数可从有效 Reaction 校验，任何响应不得暴露参与者身份或浏览量。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：首次选择、切换、取消和重复取消。
- `[AUTO]` 并发：相同或不同类型并发设置时始终满足用户与帖子唯一约束。
- `[AUTO]` 计数：切换总数不变，取消不出现负数，计数与事实表一致。
- `[AUTO]` 越权：游客不能操作，非有效帖禁止新增、修改或取消。
- `[MANUAL]` UI：三类按钮状态、当前选择、数量和失败恢复。

## 11. 完成定义（Definition of done）

- 用户可提交、切换和取消三类固定轻互动。
- 唯一约束、幂等和计数规则在并发下稳定成立。
- AC-01、AC-08、AC-09、AC-10、AC-15、AC-20、SUP-03 相关断言通过。
- 本任务只使用两个轻互动接口，未增加参与者身份或自定义类型能力。
