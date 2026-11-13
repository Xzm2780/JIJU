# JIJU 发布流程 Demo

这是一个仅覆盖发布流程的可运行验证 Demo：

- 发布页：编辑正文、可选情绪/情境标签、选择 24 小时/3 天/7 天留存。
- 模拟登录：首次点击发布才要求登录，不连接真实微信。
- `POST /api/v1/posts`：字素簇校验、北京时间日配额、幂等、模拟违规阻断和模拟复核分支。
- 发布成功后的详情预览：使用发布响应展示正文、标签、固定到期时间和审核状态。

## 前置说明

- 仓库不存在用户指定的 `tasks/T3.1.md`，本实现映射到现有 [T05 发布帖子](../../tasks/T05-publish-post.md)。
- 前端框架尚未由项目负责人指定，且项目尚未批准第三方依赖，因此 Demo 使用原生 HTML/CSS/ES Module 和 Node 内置 HTTP 服务，不引入任何第三方包。
- 数据保存在进程内，重启服务后清空；这是流程 Demo，不是生产脚手架。

## 运行要求

- Node.js 22 或更高版本。
- 浏览器需要支持原生 `dialog`、ES Module、`Intl.Segmenter` 和 Web Crypto。

## 启动

```powershell
cd demo/publish
npm start
```

打开：

```text
http://127.0.0.1:3000
```

无需执行 `npm install`。

## 测试

```powershell
cd demo/publish
npm test
```

更严格的纯文档验证可回到仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/docs/Test-PrDemo.ps1
```

## 手工验证流程

1. 不登录，直接填写正文、选择标签和留存时长。
2. 点击“发布到广场”，页面应弹出模拟登录。
3. 点击“取消登录”，正文、标签、留存和公开确认状态应保留。
4. 刷新页面，24 小时内的本地草稿应恢复。
5. 再次点击发布并完成模拟登录，页面应恢复草稿并继续发布。
6. 正常发布后进入详情预览，确认到期时间已固定且显示为北京时间。
7. 输入包含 `[[BLOCK]]` 的正文，应被阻断且不生成帖子。
8. 输入包含 `[[REVIEW]]` 的正文，应先弹出风险确认；确认后详情状态为“审核中”。
9. 同一账号在北京时间自然日内成功发布 5 篇后，第 6 篇应显示下一次可发布时间。

## Demo 数据规则

### 标签

标签为 Demo 内置配置，不提供标签管理接口。标签 ID 固定，前端显示当前启用标签。

### 审核模拟

- `[[BLOCK]]`：模拟明确违规，服务端返回 `JIJU_VALIDATION_4221`。
- `[[REVIEW]]`：模拟允许发布但需复核。首次请求返回 `JIJU_MODERATION_4091` 和风险确认标记；确认后使用新幂等键发布为 `PENDING`。

### 配额

- 每个模拟用户按 `Asia/Shanghai` 自然日最多成功发布 5 篇。
- 只有成功发布消耗配额。
- 失败、校验失败、网络失败和幂等重放不重复消耗配额。

### 幂等

- 客户端生成 `v1:post.publish:<uuid_v7>`。
- 同一用户、同一操作、同一键和相同载荷最多成功一次。
- 同键不同载荷返回 `JIJU_CONFLICT_4091`。
- 网络失败重试复用同一键；内容变化或风险确认后生成新键。

## 文件结构

| 路径 | 说明 |
| --- | --- |
| `server/app.js` | 无依赖 mock API、静态资源和内存数据仓库 |
| `server/index.js` | 本地启动入口 |
| `public/index.html` | 发布页、登录弹窗、风险弹窗和详情预览 |
| `public/app.js` | 页面状态、草稿恢复、登录后恢复、发布与路由 |
| `public/modules/graphemes.js` | Unicode 扩展字素簇计数 |
| `public/modules/draft.js` | 24 小时本地草稿 |
| `public/modules/idempotency.js` | UUIDv7、幂等键和载荷指纹 |
| `tests/client-modules.test.js` | 草稿、字素簇和幂等键单测 |
| `tests/publish-api.test.js` | 发布、校验、配额、幂等和模拟审核接口测试 |

## 非目标

- 不实现评论、轻互动、举报或后台页面。
- 不连接真实微信登录，不生成真实微信 openid。
- 不实现真实关键词审核、人工审核队列或未成年人逻辑。
- 不提供数据库持久化、部署配置或生产级鉴权。
