# T11 任务包：后台举报队列

## 1. 任务名（Task name）

后台举报队列

## 2. 范围（Scope）

- 页面：后台举报队列页，支持状态、优先级和原因筛选。
- 接口：`GET /admin/reports`、`GET /admin/review-queue`。
- 展示目标类型、目标 ID、内容版本、原因、优先标记和处理状态。

## 3. 非目标（Non-goals）

- 不在本任务执行内容复核、隐藏、下架或恢复。
- 不提供普通用户访问入口。
- 不展示浏览者身份或浏览量。
- 不新增举报处理接口。

## 4. 前置任务（Dependencies）

T00、T10

## 5. 相关 PRD 需求 ID

REPORT-04、REPORT-06、REPORT-07、MOD-05、MOD-08、NFR-SEC-05

## 6. 相关 AC

AC-06、AC-12、AC-19

## 7. 涉及接口（Interfaces）

`GET /admin/reports`、`GET /admin/review-queue`

## 8. 涉及表（Tables）

Report、Post、Comment、PostVersion、AdminRoleAssignment、AuditLog

## 9. 实现要点（Implementation points / core rules）

1. 只允许具备 REPORT_REVIEWER、CONTENT_MODERATOR 或 AUDITOR 范围的后台身份访问。
2. 举报专用队列支持状态、优先级、原因筛选；统一复核队列支持 `source=moderation|report|all`、优先级和服务端游标分页。
3. 统一队列跨 Report、ModerationRecord 合并时不得漏项或重复，并按入队时间、来源和稳定 ID 排序。
4. 返回处理所需的结构化字段和内容版本；不返回正文、举报说明、浏览量或浏览者身份，举报说明不得进入常规日志。
5. 查询只读；敏感后台查询可按审批后的安全策略写入访问审计。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：角色鉴权、来源筛选、游标分页和稳定排序。
- `[AUTO]` 越权：普通用户、作者和低权限后台角色不能读取队列。
- `[AUTO]` 并发：新举报和状态改变下原游标不重复返回同一举报。
- `[MANUAL]` UI：筛选控件、内容版本和空/错/到底状态。
- `[AUTO]` 数据裁剪：响应不含浏览量和浏览者身份。

## 11. 完成定义（Definition of done）

- 授权后台可按状态、优先级和原因浏览举报队列。
- 举报与复核来源按稳定顺序展示，普通用户无法访问。
- AC-06、AC-12、AC-19 中与队列查询相关的断言通过。
- 本任务只读取举报专用队列和统一复核队列，未增加举报处理或内容治理接口。
