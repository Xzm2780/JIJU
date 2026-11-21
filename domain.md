# JIJU 领域模型

## 文档边界

本文只依据 `docs/product/PRD-v1.1.md` 第 5 节“全局规则”和第 8 节“功能需求”整理。用户指定的 `docs/prd.md` 在当前仓库中不存在，因此以现有 PRD 的现行工作区版本为准；未引用其他章节作为字段或规则依据。

本文使用逻辑类型描述领域模型，不绑定数据库产品，不包含 SQL、建表语句或实现代码。“索引建议”是满足本节所列查询、排序、唯一性和幂等要求的设计建议；未列出默认索引的字段不表示禁止后续基于压测结果优化。

三项特别约束：

- `Post.public_status` 与 `Post.moderation_status` 必须是两个独立字段；前者控制公开生命周期，后者控制内容审核结果，不得合并。（来源：FEED-01、POST-08、EXP-03、MOD-02、MOD-06）
- `Reaction` 必须存在 `(user_id, post_id)` 唯一约束，确保每位用户对同一帖子最多保留一条有效互动记录。（来源：REACT-03、REACT-04）
- `Report` 必须记录举报对象的内容版本 `content_version`，使举报关联用户编辑前被举报的版本。（来源：REPORT-07、POST-07）

## 实体关系概览

| 关系 | 基数 | 说明 | 来源需求 ID |
| --- | --- | --- | --- |
| User 发布 Post | 1:N | 帖子必须属于一个登录用户；游客不能发布。 | AUTH-01、POST-01 |
| User 发布 Comment | 1:N | 评论必须属于一个登录用户；游客不能评论。 | AUTH-01、COMMENT-01 |
| Post 包含 Comment | 1:N | 评论归属于一个帖子，并按发布时间正序展示。 | COMMENT-03、COMMENT-10 |
| User 对 Post 产生 Reaction | N:M | 通过 Reaction 关联；同一用户与帖子组合只能有一条有效记录。 | REACT-02、REACT-03 |
| User 提交 Report | 1:N | 举报人可以举报帖子或评论。 | REPORT-01、REPORT-07 |
| Report 关联内容版本 | N:1 | 举报记录必须保存被举报对象类型、对象 ID 和当时的内容版本。 | REPORT-07、POST-07 |
| User 确认 Notice | 1:N | 每个用户对每个协议版本只保留一条确认记录。 | AUTH-03 |
| User 消耗 QuotaUsage | 1:N | 每次成功发帖或评论形成一条成功配额使用记录。 | POST-09、COMMENT-07 |
| ModerationRecord 处理内容版本 | N:1 | 复核和处理动作关联内容类型、内容 ID 及具体内容版本。 | MOD-02、MOD-05、MOD-06 |
| AuditLog 记录治理动作 | 1:N | 审计日志保存操作者、角色、时间、原因和状态变化。 | MOD-06、MOD-08、MOD-09 |
| ViewRecord 记录 Post 浏览 | 1:N | 每次符合计数条件的新详情访问最多形成一条浏览记录。 | VIEW-04、VIEW-05、VIEW-06 |
| Tag 被 Post 快照引用 | 1:N | 帖子保存发布时标签 ID 和名称快照，而非只引用可变标签。 | POST-03、TAG-05 |

## User

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | AUTH-01 |
| auth_subject_ref | 字符串（内部敏感主体引用） | 是 | 正式微信由服务端对 openid 做不可逆摘要；mock 仅非生产 | 是 | 唯一索引；不得对外展示或进入日志 | AUTH-01 |
| auth_provider | 枚举（WECHAT、MOCK） | 是 | 正式环境为 WECHAT；MOCK 仅非生产 | 否 | 无 | AUTH-01、NFR-SEC-01 |
| plaza_nickname | 字符串 | 是 | 服务端生成稳定昵称 | 否 | 不建公开检索索引 | AUTH-04 |
| account_status | 枚举（正常或封禁；具体值待确认） | 是 | ACTIVE | 否 | 建议按状态建立筛选索引 | MOD-07、MOD-08 |
| posting_restricted_until | 时间戳（UTC） | 否 | 空 | 否 | 与账号状态联合筛选 | MOD-07 |
| commenting_restricted_until | 时间戳（UTC） | 否 | 空 | 否 | 与账号状态联合筛选 | MOD-07 |
| reaction_restricted_until | 时间戳（UTC） | 否 | 空 | 否 | 与账号状态联合筛选 | MOD-07 |
| deactivated_at | 时间戳（UTC） | 否 | 空 | 否 | 按注销状态检索时使用 | AUTH-06 |
| account_deletion_scheduled_at | 时间戳（UTC） | 否 | 空；注销请求后为 30 天冷静期结束时间 | 否 | `(account_deletion_scheduled_at, account_status)` | AUTH-06 |

**软删除：** 是。账号注销后立即以 `deactivated_at` 和 `DEACTIVATED` 停用，30 天冷静期结束后清理正文和身份关联，并保留匿名化账号行及必要审计关联。（来源：AUTH-06）

**实体规则：**

- 不得设置公开的微信头像或微信昵称字段，广场昵称不得作为唯一身份或主页入口。（来源：AUTH-04）
- 正式微信登录不得保存或对外返回 openid、unionid、session_key；只保存服务端生成的 `auth_subject_ref` 和 provider。（来源：AUTH-01、NFR-SEC-01）
- 注销请求必须撤销全部会话、立即隐藏本人内容和停用互动；冷静期内只允许同一内部账号经微信重新验证后显式恢复。（来源：AUTH-06）
- 警告不单独改变账号状态，应通过 AuditLog 留痕；发帖、评论、互动限制和封禁分别落到 User 的限制字段或账号状态。（来源：MOD-07、MOD-08）

## Post

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | POST-01、POST-12 |
| author_id | ID（User） | 是 | 无 | 否 | `(author_id, public_status, published_at)`；支撑“我的”筛选 | AUTH-01、MINE-02 |
| body_text | 字符串（正文） | 是 | 无 | 否 | 默认不建全文/检索索引 | POST-02、POST-07 |
| body_grapheme_length | 整数 | 是 | 服务端按扩展字素簇计算 | 否 | 无 | POST-02 |
| emotion_tag_id | ID（Tag） | 条件必填：选择情绪标签时必填 | 空 | 否 | 与 `emotion_tag_name_snapshot` 联合解释 | POST-03、TAG-05 |
| emotion_tag_name_snapshot | 字符串 | 条件必填：存在 `emotion_tag_id` 时必填 | 空 | 否 | 无 | TAG-05 |
| context_tag_id | ID（Tag） | 条件必填：选择情境标签时必填 | 空 | 否 | 与 `context_tag_name_snapshot` 联合解释 | POST-03、TAG-05 |
| context_tag_name_snapshot | 字符串 | 条件必填：存在 `context_tag_id` 时必填 | 空 | 否 | 无 | TAG-05 |
| retention_hours | 枚举（24、72、168） | 是 | 客户端预选 168；服务端要求显式提交 | 否 | 无 | POST-04、EXP-01 |
| public_status | 枚举（PUBLISHED、HIDDEN、EXPIRED、DELETED） | 是 | PUBLISHED | 否 | `(public_status, moderation_status, published_at, id)` | FEED-01、POST-08、EXP-03、EXP-07、MOD-06 |
| moderation_status | 枚举（PASSED、PENDING、REJECTED） | 是 | PASSED | 否 | `(moderation_status, public_status, published_at, id)` | FEED-01、MOD-02、MOD-05 |
| risk_confirmed_at | 时间戳（UTC） | 条件必填：审核状态为 PENDING 且允许继续公开时必填 | 空 | 否 | 无 | MOD-02 |
| published_at | 时间戳（UTC） | 是 | 服务端在发布成功时生成 | 否 | `(published_at, id)` 倒序游标分页 | FEED-02、POST-12 |
| expires_at | 时间戳（UTC） | 是 | 发布成功时按 `published_at + retention_hours` 一次性生成 | 否 | `(expires_at, public_status)` | POST-04、EXP-01、EXP-02、EXP-03 |
| current_content_version | 整数 | 是 | 1 | 否 | 与 `id` 联合供版本引用 | POST-07、REPORT-07 |
| edited_at | 时间戳（UTC） | 否 | 空 | 否 | 无 | POST-07 |
| hidden_at | 时间戳（UTC） | 否 | 空 | 否 | `(hidden_at)` 供治理审计 | MOD-06、MINE-03 |
| deleted_at | 时间戳（UTC） | 否 | 空 | 否 | `(deleted_at)` 供审计关联 | POST-08、MINE-06 |

**软删除：** 是。作者删除后 `public_status` 变为 `DELETED` 并写入 `deleted_at`；记录仅供审计和举报关联，业务上不可恢复，作者端不再展示。实际保留期限不在第 5、8 节决定。（来源：POST-08、MINE-06、EXP-07）

**实体规则：**

- `public_status` 与 `moderation_status` 必须分开保存；公开可见性需要同时满足公开状态允许公开和审核结果允许公开。（来源：FEED-01、MOD-02）
- `PENDING` 内容只有在用户确认高风险提示后才允许继续公开；明确阻断的内容不得进入公域。（来源：MOD-02、MOD-04）
- `DRAFT` 只存在于用户设备，不得作为服务端 Post 记录保存；服务端不得在用户提交前收集草稿正文。（来源：AUTH-02）
- 帖子正文去除首尾空白后必须为 1 至 500 个用户可见字符；编辑也必须重新校验并生成新内容版本。（来源：POST-02、POST-06、POST-07）
- 每篇帖子最多选择一种情绪标签和一种情境标签；标签停用或重命名后，历史帖子继续展示上述名称快照。（来源：POST-03、TAG-03、TAG-05）
- 到达 `expires_at` 后公开状态按 `EXPIRED` 处理，并且编辑、评论和轻互动均被服务端拒绝。（来源：EXP-03、EXP-04、EXP-06）
- 编辑不得改变 `id`、`published_at` 或 `expires_at`；校验失败时不得替换当前公开内容版本。（来源：POST-07、EXP-02）

## Comment

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | COMMENT-01 |
| post_id | ID（Post） | 是 | 无 | 否 | `(post_id, published_at, id)` 正序分页 | COMMENT-03、COMMENT-10 |
| author_id | ID（User） | 是 | 无 | 否 | 支撑作者删除权限校验 | AUTH-01、COMMENT-05 |
| body_text | 字符串（评论正文） | 是 | 无 | 否 | 默认不建全文/检索索引 | COMMENT-02、COMMENT-04 |
| body_grapheme_length | 整数 | 是 | 服务端按扩展字素簇计算 | 否 | 无 | COMMENT-02 |
| content_version | 整数 | 是 | 1 | 否 | `(id, content_version)` 供举报和审核引用 | COMMENT-06、REPORT-07 |
| moderation_status | 枚举（PASSED、PENDING、REJECTED） | 是 | PASSED | 否 | 建议按审核状态筛选 | POST-06、MOD-01、MOD-02 |
| published_at | 时间戳（UTC） | 是 | 服务端在提交成功时生成 | 否 | `(post_id, published_at, id)` | COMMENT-03 |
| deleted_at | 时间戳（UTC） | 否 | 空 | 否 | `(post_id, deleted_at)` 供审计关联 | COMMENT-05、REPORT-07 |

**软删除：** 是。作者删除后写入 `deleted_at`，所有用户端不再展示；物理清理期限不在第 5、8 节决定。（来源：COMMENT-05、REPORT-07）

**实体规则：**

- 评论正文去除首尾空白后必须为 1 至 200 个用户可见字符，并在发布前通过服务端内容校验。（来源：COMMENT-02、COMMENT-04）
- 评论不支持编辑，因此正常评论的内容版本固定从 1 开始；举报仍必须保存被举报时的内容版本。（来源：COMMENT-06、REPORT-07）
- 已到期、隐藏或删除的帖子不得新增评论，校验必须由服务端执行。（来源：COMMENT-10、EXP-04）

## Reaction

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | REACT-02 |
| user_id | ID（User） | 是 | 无 | 与 `post_id` 联合唯一 | 唯一约束首列 | REACT-03 |
| post_id | ID（Post） | 是 | 无 | 与 `user_id` 联合唯一 | 唯一约束次列 | REACT-03 |
| reaction_type | 枚举（抱一抱、摸摸头、加油） | 是 | 无 | 否 | `(post_id, reaction_type, active)` 供分类计数 | REACT-01、REACT-06、REACT-08 |
| active | 布尔 | 是 | true | 否 | 与帖子、类型联合筛选 | REACT-04、REACT-05 |
| created_at | 时间戳（UTC） | 是 | 服务端首次创建时间 | 否 | 无 | REACT-02 |
| updated_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | 无 | REACT-04、REACT-05 |

**软删除：** 是。取消互动只把 `active` 置为 false，不删除记录；这样可保留 `(user_id, post_id)` 唯一性并避免重复计数。（来源：REACT-03、REACT-05）

**实体规则：**

- `(user_id, post_id)` 必须唯一；用户切换互动时更新同一条记录的 `reaction_type`，取消时更新 `active`，不得新建第二条有效记录。（来源：REACT-03、REACT-04、REACT-05）
- 只有 `active = true` 的记录进入分类数量和总数；重复取消不得产生负计数。（来源：REACT-05、REACT-06）
- 不得提供参与者身份查询能力，Reaction 的 `user_id` 仅用于服务端权限、唯一性和聚合。（来源：REACT-06）
- 已到期、隐藏或删除的帖子禁止新增、修改或取消互动。（来源：REACT-07、EXP-04）

## Report

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | REPORT-01 |
| reporter_id | ID（User） | 是 | 无 | 否 | 举报去重和审计检索 | REPORT-01、REPORT-04 |
| target_type | 枚举（POST、COMMENT） | 是 | 无 | 与内容版本联合引用 | `(target_type, target_id, content_version)` | REPORT-01、REPORT-07 |
| target_id | ID（Post 或 Comment） | 是 | 无 | 否 | `(target_type, target_id, content_version)` | REPORT-01、REPORT-07 |
| content_version | 整数（内容版本引用） | 是 | 取举报提交时的目标当前版本 | 否 | `(target_type, target_id, content_version)` | POST-07、REPORT-07 |
| reason | 枚举（辱骂/攻击/骚扰、隐私信息、危险或不适当内容、广告或垃圾信息、其他） | 是 | 无 | 否 | `(reason, submitted_at)` 供治理统计 | REPORT-02 |
| other_description | 字符串（举报说明） | 条件必填：`reason = 其他` 时必填 | 空 | 否 | 不建公开检索索引 | REPORT-03 |
| status | 枚举（PENDING、PROCESSING、RESOLVED） | 是 | PENDING | 否 | `(status, submitted_at, id)` | REPORT-07 |
| dedupe_key | 字符串 | 是 | 服务端按举报人、对象、原因和 24 小时窗口生成 | 是 | 唯一索引 | REPORT-05 |
| submitted_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | `(submitted_at)` | REPORT-05、REPORT-07 |

**软删除：** 否。第 5、8 节没有用户删除举报的流程；举报保留、匿名化和最终删除期限须按后续批准的数据规则执行。（来源：REPORT-04、REPORT-07）

**实体规则：**

- 举报对象只能是 Post 或 Comment，且必须同时记录 `target_type`、`target_id` 和 `content_version`。（来源：REPORT-01、REPORT-07）
- 同一用户对同一对象、同一原因在 24 小时内重复提交时，必须返回首次结果，不生成第二条有效举报。（来源：REPORT-05）
- `other_description` 只供受权限保护的治理流程使用，不得作为公开内容展示。（来源：REPORT-03、REPORT-04）
- Report 与 ModerationRecord 必须是两张独立事实表；后台统一复核队列只做跨来源查询投影，不得复制正文或举报说明。（来源：REPORT-07、MOD-05）

## Tag

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | TAG-04、TAG-05 |
| category | 枚举（EMOTION、CONTEXT） | 是 | 无 | 与 `name` 联合唯一 | `(category, enabled, sort_order)` | TAG-01、TAG-02 |
| name | 字符串 | 是 | 无 | 与 `category` 联合唯一 | 无 | TAG-01、TAG-02 |
| sort_order | 整数 | 是 | 0 | 否 | `(category, enabled, sort_order)` | TAG-04 |
| enabled | 布尔 | 是 | true | 否 | `(category, enabled, sort_order)` | TAG-04、TAG-05 |
| is_other | 布尔 | 是 | false | 同一 `category` 最多一条 true（业务约束） | `(category, is_other)` | TAG-01、TAG-02 |
| created_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | 无 | TAG-04 |
| updated_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | 无 | TAG-04、TAG-05 |

**软删除：** 否。停用标签使用 `enabled = false`，不得删除其稳定 ID；历史帖子通过名称快照保持原语义。（来源：TAG-04、TAG-05）

**实体规则：**

- 情绪标签首期必须包含开心、平静、疲惫、焦虑、委屈、难过、愤怒、孤独、迷茫、失落、其他；情境标签首期必须包含家庭、校园、亲密关系、职场、朋友关系、自我与生活、其他。（来源：TAG-01、TAG-02）
- 每个分类最多一个“其他”固定标签，不提供自由文本补充字段。（来源：TAG-01、TAG-02、TAG-03）
- 选择器只返回 `enabled = true` 的标签，并按 `sort_order` 展示；停用标签不得用于新帖子。（来源：TAG-04）
- 帖子必须保存标签 ID 和发布时名称快照，标签重命名或停用不得改变历史帖子语义。（来源：TAG-05）

## TagCatalog

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | 固定标识 | 是 | current | 是 | 主键 | TAG-04 |
| version | 字符串 | 是 | 版本发布时由服务端生成 | 是 | 唯一索引 | TAG-04、TAG-05 |
| updated_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | 无 | TAG-04 |

**软删除：** 否。目录版本用于让客户端识别标签配置是否变化，历史 Post 标签语义由快照保证。（来源：TAG-04、TAG-05）

**实体规则：**

- `GET /tags` 只返回启用标签及当前目录版本，版本或启用状态变化后客户端须重新获取。（来源：TAG-04）
- 发布提交必须按标签 ID 重新校验分类和启用状态，不得只信任客户端缓存版本。（来源：TAG-03、TAG-04）

## ModerationChallenge

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（Redis 短期挑战） | 是 | 服务端生成 | 是 | 主键键 | MOD-02 |
| user_id | ID（User） | 是 | 无 | 否 | 与 challenge 键组合 | MOD-02 |
| content_fingerprint | 字符串 | 是 | 服务端按正文、标签和留存计算 | 否 | 无 | MOD-02 |
| prompt_version | 字符串 | 是 | 由规则配置决定 | 否 | 无 | MOD-02 |
| resource_version | 字符串 | 是 | 由资源配置决定 | 否 | 无 | MOD-02 |
| expires_at | 时间戳（UTC） | 是 | 服务端短期 TTL | 否 | Redis TTL | MOD-02 |
| consumed_at | 时间戳（UTC） | 否 | 空 | 否 | 无 | MOD-02 |

**软删除：** 不适用。挑战在 Redis 中短期存在，成功消费或到期后删除；具体 TTL 为工程配置，不作为用户数据保留承诺。（来源：MOD-02）

## NoticeConfirmation

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | AUTH-03 |
| user_id | ID（User） | 是 | 无 | 与 `notice_version` 联合唯一 | 唯一索引首列 | AUTH-03 |
| notice_version | 字符串 | 是 | 无 | 与 `user_id` 联合唯一 | 唯一索引次列 | AUTH-03 |
| confirmed_at | 时间戳（UTC） | 是 | 服务端确认成功时间 | 否 | 无 | AUTH-03 |

**软删除：** 否。第 5、8 节未定义用户撤销须知确认；保留或清理期限须按后续批准的数据规则执行。（来源：AUTH-03）

**实体规则：**

- 用户首次发布、评论、互动或举报前，必须存在当前版本的有效须知确认记录；确认前不得继续。（来源：AUTH-03）
- 每个用户与每个协议版本只保留一条确认记录；重复确认按幂等处理。（来源：AUTH-03）

## QuotaUsage

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | POST-09、COMMENT-07 |
| user_id | ID（User） | 是 | 无 | 否 | `(user_id, quota_type, consumed_at)` 计数查询 | POST-09、COMMENT-07 |
| quota_type | 枚举（POST_DAILY、COMMENT_ROLLING_60M） | 是 | 无 | 否 | `(user_id, quota_type, consumed_at)` | POST-09、COMMENT-07 |
| request_id | 字符串（请求幂等标识） | 是 | 无 | 与 `user_id`、`quota_type` 联合唯一 | 唯一索引 | POST-11、COMMENT-09 |
| source_id | ID（Post 或 Comment） | 是 | 无 | 与 `user_id`、`quota_type` 联合唯一 | 唯一索引；防止同一成功内容重复计数 | POST-11、COMMENT-09 |
| consumed_at | 时间戳（UTC） | 是 | 服务端成功事务时间 | 否 | `(user_id, quota_type, consumed_at)` | POST-09、COMMENT-07 |

**软删除：** 否。第 5、8 节未定义帖子或评论删除后返还配额，因此不得在模型中自行返还；保留期限另按数据规则确认。（来源：POST-08、POST-09、COMMENT-05、COMMENT-07）

**实体规则：**

- 只有成功发布的帖子或评论生成 QuotaUsage；提交失败、内容校验失败、网络失败和重复请求不得写入。（来源：POST-09、POST-11、COMMENT-09）
- `POST_DAILY` 按北京时间自然日统计，每个账号最多成功 5 条；`COMMENT_ROLLING_60M` 按任意连续 60 分钟统计，每个账号最多成功 10 条。（来源：POST-09、POST-10、COMMENT-07、COMMENT-08）
- `(user_id, quota_type, request_id)` 与 `(user_id, quota_type, source_id)` 均须唯一，避免重试产生重复配额消耗。（来源：POST-11、COMMENT-09）

## ModerationRecord

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | MOD-05、MOD-06 |
| target_type | 枚举（POST、COMMENT） | 是 | 无 | 与复核轮次联合唯一 | `(target_type, target_id, content_version)` | MOD-01、MOD-05 |
| target_id | ID（Post 或 Comment） | 是 | 无 | 否 | `(target_type, target_id, content_version)` | MOD-05 |
| content_version | 整数（内容版本引用） | 是 | 无 | 否 | `(target_type, target_id, content_version)` | POST-07、REPORT-07、MOD-05 |
| review_round | 整数 | 是 | 1 | 与 `target_type`、`target_id`、`content_version` 联合唯一 | 唯一索引 | MOD-02、MOD-05 |
| status | 枚举（PENDING、PROCESSING、RESOLVED） | 是 | PENDING | 否 | `(status, created_at, id)` | MOD-02、MOD-05 |
| hit_rule_refs | 规则引用列表 | 否 | 空 | 否 | 不建正文索引 | MOD-01、MOD-05 |
| action | 枚举（隐藏、下架、恢复、无动作；具体值待确认） | 否 | 空 | 否 | `(action, handled_at)` | MOD-06 |
| public_status_before | 枚举（Post.public_status 取值） | 条件必填：执行处理动作时必填 | 空 | 否 | 审计查询 | MOD-06 |
| public_status_after | 枚举（Post.public_status 取值） | 条件必填：执行处理动作时必填 | 空 | 否 | 审计查询 | MOD-06 |
| moderation_status_before | 枚举（PASSED、PENDING、REJECTED） | 条件必填：审核状态变化时必填 | 空 | 否 | 审计查询 | MOD-02、MOD-06 |
| moderation_status_after | 枚举（PASSED、PENDING、REJECTED） | 条件必填：审核状态变化时必填 | 空 | 否 | 审计查询 | MOD-02、MOD-06 |
| handled_by | ID（User） | 条件必填：完成处理时必填 | 空 | 否 | `(handled_by, handled_at)` | MOD-06、MOD-08 |
| handled_at | 时间戳（UTC） | 条件必填：完成处理时必填 | 空 | 否 | `(handled_at)` | MOD-06 |
| reason | 字符串（处理原因） | 条件必填：执行处理动作时必填 | 空 | 否 | 不建公开检索索引 | MOD-06 |
| created_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | `(status, created_at, id)` | MOD-02、MOD-05 |

**软删除：** 否。复核记录属于治理审计链，不得由普通业务删除。（来源：MOD-05、MOD-06、MOD-09）

**实体规则：**

- 校验结果至少区分通过、需高风险确认并复核、明确阻断；需复核内容必须进入人工队列。（来源：MOD-01、MOD-02、MOD-05）
- 审核人员必须能够查看内容版本、关联举报和命中规则，但不得修改客户端上报的内容版本。（来源：MOD-05）
- 隐藏、下架和恢复必须记录处理人员、时间、原因以及处理前后状态；审核状态由服务端变更。（来源：MOD-06）
- 后台处理动作必须校验后台身份和角色权限。（来源：MOD-08）
- RESTORE 仅允许 `HIDDEN -> PUBLISHED`，要求未到期、未删除、审核状态非 REJECTED；恢复不延长 expires_at，并必须写审计。（来源：MOD-06）

## AuditLog

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | MOD-06、MOD-09 |
| actor_id | ID（User） | 是 | 无 | 否 | `(actor_id, occurred_at)` | MOD-06、MOD-08 |
| actor_role | 字符串（角色快照） | 是 | 无 | 否 | `(actor_role, occurred_at)` | MOD-08 |
| action_type | 枚举（处理动作或配置变更类型） | 是 | 无 | 否 | `(action_type, occurred_at)` | MOD-06、MOD-07、MOD-09 |
| object_type | 枚举（内容、审核规则、标签、频率上限、求助资源等） | 是 | 无 | 否 | `(object_type, object_id, occurred_at)` | MOD-06、MOD-09 |
| object_id | ID（字符串） | 是 | 无 | 否 | `(object_type, object_id, occurred_at)` | MOD-06、MOD-09 |
| content_version | 整数 | 条件必填：对象为内容时必填 | 空 | 否 | 与对象类型、对象 ID 联合检索 | POST-07、MOD-06 |
| state_before | 状态快照 | 条件必填：发生状态或配置变化时必填 | 空 | 否 | 不作为公开检索字段 | MOD-06、MOD-09 |
| state_after | 状态快照 | 条件必填：发生状态或配置变化时必填 | 空 | 否 | 不作为公开检索字段 | MOD-06、MOD-09 |
| reason | 字符串 | 条件必填：治理动作需要原因时必填 | 空 | 否 | 不作为公开检索字段 | MOD-06 |
| request_id | 字符串（请求追踪标识） | 是 | 无 | 否 | `(request_id)` | MOD-06、MOD-09 |
| occurred_at | 时间戳（UTC） | 是 | 服务端当前时间 | 否 | `(occurred_at)` | MOD-06、MOD-09 |

**软删除：** 否。审计日志只追加、不改写，不得由普通用户端修改或删除。（来源：MOD-06、MOD-08、MOD-09）

**实体规则：**

- 运营处理内容时必须记录处理人员、时间、原因、动作及变更前后状态。（来源：MOD-06）
- 警告、限制发帖、限制评论、限制互动和封禁账号必须经过身份认证与角色权限校验，并可由审计链追溯。（来源：MOD-07、MOD-08）
- 审核规则、标签、频率上限和求助资源的变更必须审计，且不得由普通用户端调用。（来源：MOD-09）

## ViewRecord

| 字段名 | 类型 | 是否必填 | 默认值 | 唯一约束 | 索引建议 | 来源需求 ID |
| --- | --- | --- | --- | --- | --- | --- |
| id | ID（字符串） | 是 | 服务端生成 | 是 | 主键 | VIEW-04、VIEW-05 |
| post_id | ID（Post） | 是 | 无 | 与 `view_token` 联合唯一 | `(post_id, viewed_at)` 与唯一约束 | VIEW-01、VIEW-04 |
| viewer_id | ID（User） | 否 | 空 | 否 | 仅内部权限判定使用；不建立公开参与者查询 | VIEW-03、VIEW-04 |
| view_token | 字符串（单次新详情访问标识） | 是 | 服务端在成功打开新详情页时生成 | 与 `post_id` 联合唯一 | 唯一索引 | VIEW-05 |
| viewed_at | 时间戳（UTC） | 是 | 服务端成功计入浏览的时间 | 否 | `(post_id, viewed_at)` | VIEW-04、VIEW-05 |

**软删除：** 否。第 5、8 节未定义浏览记录删除流程；保留期限须按后续批准的数据规则执行。（来源：VIEW-04、VIEW-05）

**实体规则：**

- 浏览量是详情访问次数，不是独立访问人数；同一用户重新打开新的详情页可以形成新的 ViewRecord。（来源：VIEW-04、VIEW-05）
- `(post_id, view_token)` 必须唯一，确保同一次新详情访问即使页面刷新、回到前台或返回已打开详情页也不重复计数。（来源：VIEW-05）
- 作者本人查看、加载失败、内容不可用和自动化巡检不得写入可计数 ViewRecord；作者看到的是按 `post_id` 汇总的计数。（来源：VIEW-01、VIEW-06）
- `viewer_id` 只允许服务端内部使用，不得向任何用户展示浏览者身份或名单。（来源：VIEW-02、VIEW-03）

## 跨实体待确认项

以下事项无法仅由第 5、8 节确定；在确认前不得通过默认值或删除级联隐含决定。

1. `account_status`、举报处理状态、复核状态和处理动作的最终枚举值及展示文案。（来源：REPORT-07、MOD-02、MOD-06、MOD-07）
2. `DRAFT` 客户端草稿的本地字段结构不属于服务端 Post 实体；登录恢复所需本地草稿格式须在前端方案确认后定义。（来源：AUTH-02）
3. 内容历史版本的独立存储载体未在指定实体清单中给出；本文只规定 Post、Comment、Report 和 ModerationRecord 必须保存可追溯的内容版本引用。（来源：POST-07、REPORT-07、MOD-05）
4. User 注销后对 Post、Comment、Reaction、Report、NoticeConfirmation、QuotaUsage、ModerationRecord、AuditLog 和 ViewRecord 的保留、匿名化或删除范围尚未由第 5、8 节确定。（来源：AUTH-06）
5. Post、Comment、Report、NoticeConfirmation 和 ViewRecord 的最终保留期限及物理清理策略尚未确定。（来源：AUTH-03、AUTH-06、POST-08、COMMENT-05、REPORT-07、VIEW-04）
