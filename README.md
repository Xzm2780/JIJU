# JIJU

几句 · 无关系链公共情绪表达空间｜微信小程序 MVP 产品设计

## 项目文档

- [产品需求文档（V1.1-rev.1）](docs/product/PRD-v1.1.md)
- [开发上下文](ai-context.md)
- [领域模型](domain.md)
- [接口契约](docs/api.yaml)
- [验收矩阵](docs/ac-matrix.md)
- [T05 生产实现说明](docs/T05-production.md)
- [视觉配色规范](docs/ui-design.md)

## 生产实现

- 微信小程序：[frontend/README.md](frontend/README.md)
- API 服务：[server/README.md](server/README.md)
- 运营后台：API 启动后访问 `/api/v1/admin-console`

MVP 已覆盖广场、帖子详情、发布、编辑删除、评论、轻互动、我的帖子、举报、登录、须知、账号注销及运营后台治理。

## 交互参考 Demo

`demo/publish/` 仅用于验证发布交互，不是生产实现，也不代表最新接口契约。

## 文档校验

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-PrD.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Production.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-ApiDocs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-AuthorizationDocs.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-StateMachine.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-AcMatrix.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Tasks.ps1
```

生产 API 契约测试使用 `JIJU_CONTRACT_BASE_URL`、测试会话令牌和显式写开关。未提供专用 PostgreSQL/Redis 或真实微信凭据时，相关用例显示为 skip/未验证，不得表述为集成通过。

