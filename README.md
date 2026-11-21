# JIJU

几句 · 无关系链公共情绪表达空间｜微信小程序 MVP 产品设计

## 项目入口

- [正式产品需求说明书 v1.2](docs/product/PRD-v1.2.md)
- [文档索引](docs/README.md)
- [开发上下文](ai-context.md)
- [领域模型](domain.md)
- [接口契约](docs/api.yaml)
- [验收矩阵](docs/ac-matrix.md)

## 工程目录

- 微信小程序：[frontend/README.md](frontend/README.md)
- API 服务与运营后台：[server/README.md](server/README.md)
- 任务包：[tasks/](tasks/)
- 自动化测试：[tests/](tests/)

运营后台由 API 服务提供，启动后访问 `/api/v1/admin-console`。

## 文档校验

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-RepositoryLayout.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-AiContext.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Domain.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-PrD-v11.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-PrD-v12.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Production.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-ApiDocs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-AuthorizationDocs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-StateMachine.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-AcMatrix.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Tasks.ps1
```

生产 API 契约测试使用 `JIJU_CONTRACT_BASE_URL`、测试会话令牌和显式写开关。未提供专用 PostgreSQL/Redis 或真实微信凭据时，相关用例显示为 skip/未验证，不得表述为集成通过。

