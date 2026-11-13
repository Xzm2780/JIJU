# T03 任务包：微信登录与会话恢复

## 1. 任务名（Task name）

微信登录与会话恢复

## 2. 范围（Scope）

- 页面：登录/授权恢复流程。
- 接口：`POST /auth/wechat/login`、`POST /auth/logout`。
- 支持登录成功后恢复原页面、操作意图和本地草稿。

## 3. 非目标（Non-goals）

- 不实现账号永久注销；该能力由独立任务 T18 承担并依赖 BLOCK-05。
- 不实现个人主页、关系链、年龄采集或身份核验。
- 不实现发布、评论、互动、举报或须知页面。
- 本任务的“注销”仅指撤销当前会话，不指删除账号；T18 另行设计账号永久注销。

## 4. 前置任务（Dependencies）

T00

## 5. 相关 PRD 需求 ID

AUTH-01、AUTH-02、AUTH-04、AUTH-05、NFR-SEC-01、NFR-SEC-02、NFR-SEC-04

## 6. 相关 AC

AC-01、AC-02、AC-21

## 7. 涉及接口（Interfaces）

`POST /auth/wechat/login`、`POST /auth/logout`

## 8. 涉及表（Tables）

User、AuthSession、NoticeConfirmation

## 9. 实现要点（Implementation points / core rules）

1. 服务端使用微信登录 code 换取内部账号，不返回任何微信公开身份或原始 openid。
2. 为账号生成稳定广场昵称，并返回当前须知版本与确认状态。
3. 登录成功后恢复原页面、操作意图和本地草稿；取消登录保留本地草稿。
4. 明确区分未登录 `JIJU_AUTH_4011` 与登录失效 `JIJU_AUTH_4012`。
5. 注销只撤销当前会话，重复注销保持幂等，不删除账号或业务数据。

## 10. 测试要求（Test requirements）

- `[AUTO]` 接口：有效 code、无效 code、会话发放、过期会话和重复注销。
- `[AUTO]` 越权：游客直接调用受限接口返回未登录错误且不产生数据。
- `[AUTO+MANUAL]` UI：登录成功后恢复发布页和输入，取消登录保留草稿。
- `[MANUAL]` 微信真机：授权、取消、网络中断和重新进入小程序的会话表现。

## 11. 完成定义（Definition of done）

- 微信登录、会话恢复和会话注销流程可用。
- 未登录与登录失效可被客户端区分并正确处理。
- AC-01、AC-02、AC-21 相关断言通过。
- 本任务仅实现两个认证接口，未增加账号注销或其他 PRD 外接口。
