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

## 交互参考 Demo

`demo/publish/` 仅用于验证发布交互，不是生产实现，也不代表最新接口契约。

## 文档校验

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-PrD.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-Production.ps1
```

