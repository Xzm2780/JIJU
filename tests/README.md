# JIJU 测试目录

## 目录职责

- `acceptance/`：生产 API 契约和验收测试。缺少 `JIJU_CONTRACT_BASE_URL`、写开关或专用账号时必须标记为未验证，不得用 mock 结果替代。
- `performance/`：读路径性能基线。
- `production/Verify-Production.ps1`：后端测试与构建、Prisma schema、前端类型检查和测试的总验证入口。
- `structure/Test-RepositoryLayout.ps1`：仓库目录、文档索引、废弃路径和本地配置规则校验。
- `docs/`：PRD、领域模型、OpenAPI、权限、状态机、AC 矩阵、任务包和 AI 上下文校验。

## 其他测试位置

- `frontend/tests/`：小程序纯函数、会话、导航文案和长文本规则测试。
- `server/src/**/*.spec.ts`：与 NestJS 模块共置的单元测试。
- `server/test/`：需要真实 PostgreSQL/Redis 的集成测试。

## 验证入口

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/production/Verify-Production.ps1
```

仓库完整规则见 [开发上下文](../ai-context.md)。
