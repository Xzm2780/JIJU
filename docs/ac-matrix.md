# JIJU 验收用例矩阵

## 1. 范围与标记

本文依据：

- `docs/product/PRD-v1.1.md` 第 12 节，AC-01 至 AC-24 逐条保留，不合并。
- `docs/api.yaml` 中已定义的 MVP 与后台接口。
- PRD 隐含但第 12 节未单列的 7 个补充用例，编号为 `SUP-01` 至 `SUP-07`。

执行方式标记：

- `[AUTO]`：必须进入自动化测试集，作为合并或发布门禁。
- `[MANUAL]`：必须由测试人员执行并保留截图、录屏或验证记录。
- `[AUTO+MANUAL]`：核心断言由自动化覆盖，同时需要人工验收 UI、微信平台交互或后台操作。

任务包编号已回填；同一 AC 由多个任务共同承担时，主责任务排在前面。B0 已关闭统一待复核队列缺口，当前验收矩阵不保留 `API_GAP`；后续如发现接口不存在，仍须明确标记为“API 缺口（API_GAP）”，不得用其他接口替代验收。

## 2. PRD AC-01 至 AC-12

| AC 编号 | 场景 | 涉及接口 | 测试类型 | 前置数据 | 步骤 | 预期结果 | 对应任务包编号 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | 未登录用户浏览与写操作权限 | GET /feed<br>GET /posts/{post_id}<br>GET /posts/{post_id}/comments<br>POST /posts<br>POST /posts/{post_id}/comments<br>PUT /posts/{post_id}/reaction<br>DELETE /posts/{post_id}/reaction<br>POST /reports<br>GET /me/posts | 越权 / [AUTO+MANUAL] | 无登录态；存在至少一篇有效公开帖子及评论 | 以游客打开广场、详情和评论；分别直接调用发布、评论、互动、举报和“我的”接口 | 广场、详情和评论可读取；写操作和“我的”返回 JIJU_AUTH_4011；不产生帖子、评论、互动、举报或其他业务数据；UI 不提供可执行的受限操作 | T01、T02、T03、T07、T08、T10 |
| AC-02 | 登录后恢复发布草稿与操作意图 | POST /auth/wechat/login<br>POST /posts | UI / [AUTO+MANUAL] | 游客已填写正文、选择情绪标签、情境标签和留存时长；具备微信测试账号 | 在发布页点击发布触发登录；分别完成登录和取消登录 | 完成登录后返回原发布页，正文、标签、留存时长均保留；取消登录返回原页面且本地草稿仍存在；不得提前在服务端创建 Post | T03、T05 |
| AC-03 | 发布合法帖子 | POST /posts<br>GET /feed<br>GET /posts/{post_id} | 接口 / [AUTO] | 已登录；当前须知已确认；配额未满；标签均为启用状态 | 提交合法正文和标签发布帖子；查看广场及详情 | 发布返回 201；生成固定 published_at 和 expires_at；帖子出现在广场和详情，展示作者广场昵称而不是微信资料；响应不含 view_count | T01、T02、T05 |
| AC-04 | 501 个用户可见字符阻止发布 | POST /posts | 接口 / [AUTO] | 已登录；须知已确认；准备 500 和 501 个用户可见字符两组正文 | 分别提交 500 字和 501 字正文；检查发帖配额使用情况 | 500 字通过；501 字返回 JIJU_VALIDATION_4221，展示字数/字段提示；不创建 Post，不写入成功 QuotaUsage，不消耗发帖配额 | T05 |
| AC-05 | 明确违规内容阻断 | POST /posts | 接口 / [AUTO] | 已登录；须知已确认；准备命中明确违规规则且可修改的正文 | 提交违规内容；随后修改为合法内容 | 首次返回 JIJU_VALIDATION_4221 或对应内容阻断错误；不生成公开 Post、不消耗成功配额；用户输入保留并可修改 | T05 |
| AC-06 | 需复核内容进入人工复核 | POST /posts<br>GET /admin/review-queue<br>POST /admin/content/{target_type}/{target_id}/reviews | 接口+UI / [AUTO+MANUAL] | 已登录；须知已确认；准备命中“允许发布但需人工复核”规则的内容；有审核角色账号 | 用户确认风险提示后发布；通过统一复核队列按 source=moderation 查找当前版本并执行复核 | 发布响应 moderation_status=PENDING，risk_confirmed_at 非空；内容可继续展示并进入 ModerationRecord；授权后台可分页查询该版本并执行复核；队列不返回正文或举报说明 | T05、T11、T12 |
| AC-07 | 第 6 次发帖触发自然日配额 | POST /posts | 接口+UI / [AUTO+MANUAL] | 已登录；须知已确认；当日已有 5 篇成功帖子；准备第 6 篇合法内容 | 提交第 6 篇；随后在北京时间自然日切换后重试 | 第 6 篇返回 JIJU_QUOTA_4291；不创建 Post、不消耗额外配额；UI 展示北京时间下一次可发布时间；到达该时间后可成功发布 | T05 |
| AC-08 | 首次发送轻互动 | PUT /posts/{post_id}/reaction<br>GET /posts/{post_id} | 接口 / [AUTO] | 已登录；须知已确认；目标有效公开；用户尚无有效互动；三类计数已记录 | 发送 HUG 轻互动；读取详情计数 | 返回 my_reaction=HUG；hug 加一，head_pat 和 cheer 不变；total 加一；同一 user_id 与 post_id 只有一条有效 Reaction | T08 |
| AC-09 | 切换轻互动 | PUT /posts/{post_id}/reaction<br>GET /posts/{post_id} | 接口 / [AUTO] | 用户已对目标帖子选择 HUG，当前三类计数已知 | 使用新幂等键将互动切换为 HEAD_PAT；读取计数 | 原 HUG 减一、HEAD_PAT 加一、CHEER 不变、total 不变；仍只有一条有效 Reaction；返回 my_reaction=HEAD_PAT | T08 |
| AC-10 | 取消轻互动 | DELETE /posts/{post_id}/reaction<br>GET /posts/{post_id} | 接口 / [AUTO] | 用户已有一种有效轻互动，对应类型计数至少为 1 | 取消互动；再次调用取消；读取计数 | 首次取消后 active=false，对应类型减一，total 减一且不为负；重复取消保持幂等，不影响计数；返回 my_reaction=null | T08 |
| AC-11 | 连续 60 分钟评论配额 | POST /posts/{post_id}/comments<br>GET /posts/{post_id}/comments | 接口+UI / [AUTO+MANUAL] | 已登录；须知已确认；目标有效；用户连续 60 分钟内已有 10 条成功评论 | 提交第 11 条评论；检查评论列表和配额解除时间 | 返回 JIJU_QUOTA_4292；不创建评论、不增加评论数、不消耗额外配额；UI 在输入框附近展示北京时间解除时间；到达后重试成功 | T07 |
| AC-12 | 24 小时重复举报去重 | POST /reports<br>GET /admin/reports | 接口+并发 / [AUTO] | 已登录；须知已确认；已存在一条同用户、同对象、同原因的有效举报；仍在该举报的 24 小时去重窗口内 | 使用新的幂等键再次提交相同举报；并发发送重复请求；查询后台有效举报 | 重复请求返回同一成功提交状态，不生成第二条有效举报；后台队列只有一条有效记录；正文和举报说明不进入普通日志或埋点 | T10、T11、T17 |

## 3. PRD AC-13 至 AC-24

| AC 编号 | 场景 | 涉及接口 | 测试类型 | 前置数据 | 步骤 | 预期结果 | 对应任务包编号 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-13 | 非作者不得获取浏览量 | GET /feed<br>GET /posts/{post_id} | 越权 / [AUTO+MANUAL] | 已登录非作者、游客和帖子作者均存在；帖子已有浏览量 | 游客和登录非作者分别读取广场、详情及响应原文；人工检查 UI | 广场和详情响应均不得包含 view_count；UI 不展示浏览量；不能通过搜索响应、调试日志或错误信息推断浏览量 | T01、T02、T09 |
| AC-14 | 浏览量只向作者展示且作者访问不计数 | GET /posts/{post_id}<br>GET /me/posts | 接口+越权 / [AUTO+MANUAL] | 帖子已有浏览量；准备作者和非作者账号；每次详情请求使用不同 X-View-Token | 非作者打开新详情；作者随后打开详情；作者刷新同一详情；读取作者详情 | 非作者访问按去重规则最多增加一次浏览量；作者详情返回 view_count；作者本人访问不增加；我的帖子列表不返回 view_count；非作者响应不带该字段 | T02、T09 |
| AC-15 | 到期内容从公域移除并停止回应 | GET /feed<br>GET /posts/{post_id}<br>GET /posts/{post_id}/comments<br>POST /posts/{post_id}/comments<br>PUT /posts/{post_id}/reaction<br>GET /me/posts<br>POST /admin/content/{target_type}/{target_id}/actions | 接口 / [AUTO+MANUAL] | 帖子 expires_at 可由服务端时间控制；作者和非作者账号；帖子已有评论和互动 | 将服务端时间推进至 server_now >= expires_at；刷新广场、详情和评论；提交评论和互动；以作者查看“我的”；后台尝试 RESTORE | 广场、非作者详情和评论返回内容已不可用或从列表消失；评论、互动和 RESTORE 被服务端拒绝；public_status=EXPIRED；作者在“我的”可按到期状态查看只读历史；任何恢复不得延长 expires_at | T01、T02、T06、T07、T08、T09、T12 |
| AC-16 | 有效编辑生成新版本且保持到期时间 | PUT /posts/{post_id}<br>GET /posts/{post_id} | 接口 / [AUTO] | 作者已发布有效帖子；当前内容版本为 v1；published_at 和 expires_at 已知 | 提交通过校验的新正文；读取详情和内部版本审计数据 | 返回 200；current_content_version 递增；展示 v2 内容；published_at 和 expires_at 完全不变；PostVersion v1 保留供治理审计 | T06 |
| AC-17 | 编辑校验失败保留旧公开版本 | PUT /posts/{post_id}<br>GET /posts/{post_id} | 接口 / [AUTO] | 作者帖子当前公开版本为 v1；准备超长或违规的新正文 | 提交失败编辑；随后读取详情和版本 | 返回 JIJU_VALIDATION_4221 等校验错误；current_content_version 不递增；详情仍展示 v1；旧版本未被替换 | T06 |
| AC-18 | 作者删除有效帖子 | DELETE /posts/{post_id}<br>GET /posts/{post_id}<br>GET /me/posts | 接口 / [AUTO] | 作者拥有有效帖子；非作者账号存在 | 作者执行删除；非作者和作者分别刷新详情与“我的” | 删除返回 204；public_status=DELETED、deleted_at 非空；广场、详情和“我的”均不可见该帖子；不返还发帖配额 | T06、T09 |
| AC-19 | 未成年人举报优先队列 | POST /reports<br>GET /admin/reports<br>GET /admin/review-queue | 接口+UI / [AUTO+MANUAL] | 已登录；须知已确认；存在可举报帖子或评论；准备 MINOR_INVOLVED 原因 | 提交举报；分别以举报来源和全部来源查询统一复核队列 | 普通用户只收到提交回执，不看到处理细节或举报说明；后台记录 is_minor_related=true、priority=PREEMPTIVE；统一队列中未成年人举报先于 NORMAL；跨来源分页不重复、不遗漏 | T10、T11、T12 |
| AC-20 | 重复或并发请求最多成功一次 | POST /posts<br>POST /posts/{post_id}/comments<br>PUT /posts/{post_id}/reaction<br>POST /reports | 并发 / [AUTO] | 已登录；准备相同载荷和同一 Idempotency-Key；各业务目标有效 | 并发发送重复发布、评论、互动和举报请求，并在客户端重试 | 每个业务操作最多产生一条内容或一次有效状态；只消耗一次成功配额；后续重放返回首次成功结果；同键不同载荷返回冲突 | T05、T06、T07、T08、T10、T16 |
| AC-21 | 游客绕过 UI 直接调用写接口 | POST /auth/wechat/login<br>POST /posts<br>POST /posts/{post_id}/comments | 越权 / [AUTO] | 无登录态；存在有效帖子；失效/有效两种令牌测试夹具；非生产 mock 与生产正式 provider 配置 | 直接调用发布和评论接口；使用过期令牌再次调用；在 production 环境尝试开启 mock 登录 | 写接口明确返回 JIJU_AUTH_4011 或 JIJU_AUTH_4012；不创建数据、不消耗配额；登录响应不含 openid、unionid、session_key；生产 mock 启动失败；真实微信未联调时标未验证 | T03、T05、T07 |
| AC-22 | 未确认须知时阻止首次表达或互动 | POST /posts<br>POST /posts/{post_id}/comments<br>PUT /posts/{post_id}/reaction<br>POST /reports<br>POST /notices/{notice_version}/confirmations | 接口+UI / [AUTO+MANUAL] | 已登录；NoticeConfirmation 为空；存在有效帖子 | 尝试发布、评论、互动和举报；在 UI 查看须知；确认后重试原操作 | 确认前上述写入均被阻止并返回 JIJU_ACCESS_4032；UI 展示当前版本须知；确认后创建唯一确认记录，原输入和操作意图保留 | T04、T05、T07、T08、T10 |
| AC-23 | 旧详情链接不泄露内容与浏览量 | GET /posts/{post_id}<br>GET /posts/{post_id}/comments | 越权+UI / [AUTO+MANUAL] | 准备到期、隐藏、删除和不存在的帖子；另准备有效对照帖；使用游客和登录非作者账号 | 使用旧详情链接分别访问四类帖子并检查响应和 UI | 到期、隐藏、删除和不存在均返回 JIJU_CONTENT_4041、HTTP 404，文案统一为“内容已不可用”；不得返回 view_count、作者权限、审核状态或存在性差异 | T01、T02、T12 |
| AC-24 | 性能与容量基线 | GET /feed<br>GET /posts/{post_id}<br>POST /posts<br>POST /posts/{post_id}/comments<br>PUT /posts/{post_id}/reaction | 接口 / [AUTO] | 满足约定的数据量、网络条件和缓存状态；压测峰值不低于预期峰值 2 倍 | 执行广场首屏、详情、发布、评论和互动混合压测；记录 P95、错误率和依赖状态 | 广场首屏和详情服务端 P95 不超过 1 秒；发布、评论和互动 P95 不超过 1.5 秒；未出现重复写入、计数漂移或配额重复消耗 | T15、T16 |

## 4. PRD 隐含补充用例

以下编号不属于 PRD 第 12 节的原始 AC，不得替代 AC-01 至 AC-24。

| AC 编号 | 场景 | 涉及接口 | 测试类型 | 前置数据 | 步骤 | 预期结果 | 对应任务包编号 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SUP-01 | Unicode 扩展字素簇计数 | POST /posts<br>PUT /posts/{post_id}<br>POST /posts/{post_id}/comments | 单测+接口 / [AUTO] | 准备组合附加符、ZWJ 家庭 emoji、肤色 emoji、500/501 字素帖子正文、200/201 字素评论 | 分别提交边界内、边界外和组合 emoji 文本；比较前后端计数和响应 | 按 Unicode 扩展字素簇计数，不按 UTF-16 或字节长度；正文 500 通过、501 拒绝，评论 200 通过、201 拒绝；不得静默截断；错误提示对应字段 | T05、T06、T07 |
| SUP-02 | 零宽字符（zero-width）和控制字符绕过 | POST /posts<br>PUT /posts/{post_id}<br>POST /posts/{post_id}/comments | 单测+接口+UI / [AUTO] | 准备含零宽空格、零宽连接符、方向控制符及夹在受限词中的变体；准备服务端配置的控制字符测试标签 | 提交帖子正文、编辑正文和评论；检查保存文本、校验结果和公开展示 | 服务端必须统一规范化或拒绝，不得因插入零宽/控制字符绕过内容校验、标签校验或字符计数；不得公开包含控制字符的绕过内容；错误提示可定位字段 | T05、T06、T07 |
| SUP-03 | 轻互动并发唯一 | PUT /posts/{post_id}/reaction<br>DELETE /posts/{post_id}/reaction | 并发 / [AUTO] | 同一用户、同一有效帖子；初始无互动；三类计数基线已知 | 并发发送相同或不同 reaction_type 的 PUT 请求；并发混合 PUT 与 DELETE；读取记录和计数 | 数据库层 (user_id, post_id) 始终唯一；最多一条有效 Reaction；切换时旧类型减一、新类型加一；按最终 active 状态聚合计数一致，无负数、无重复总数 | T08 |
| SUP-04 | 游标分页不重复 | GET /feed<br>GET /posts/{post_id}/comments<br>GET /me/posts | 接口+并发 / [AUTO] | 每个列表准备足够数据形成至少三页；准备两个读取会话；记录现有 ID | 读取第一页；在两个会话之间插入新帖子、评论或到期状态变化；继续使用原 cursor 读取后续页面 | 同一翻页序列不重复返回同一资源；已删除/到期资源不再出现；相同 published_at 使用稳定次级排序；不因插入数据造成重复页 | T01、T07、T09、T15 |
| SUP-05 | 编辑不改变 expires_at | PUT /posts/{post_id}<br>GET /posts/{post_id} | 单测+接口 / [AUTO] | 有效帖子；记录发布时 published_at 和 expires_at；内容版本为 v1 | 在到期前后边界内多次安全编辑；读取详情和版本记录 | 每次编辑不改变 published_at 和 expires_at；只更新正文、标签快照、current_content_version 和 edited_at；到期判断仍使用首次发布确定的 expires_at | T06 |
| SUP-06 | 举报关联被举报时的旧内容版本 | POST /posts<br>PUT /posts/{post_id}<br>POST /reports<br>GET /admin/reports | 接口 / [AUTO] | 作者帖子当前为 v1；举报人已登录且须知已确认；准备编辑后的 v2 内容 | 对 v1 提交举报；作者编辑为 v2；查询后台举报记录和内容版本 | Report.content_version 保持 v1；不得被客户端伪造为 v2；后台能定位 v1 内容和处理记录；v2 的发布不覆盖已举报版本 | T10、T11、T12 |
| SUP-07 | 日志（log）与埋点（telemetry）不含内容正文 | POST /posts<br>POST /posts/{post_id}/comments<br>POST /reports | 单测+接口 / [AUTO] | 启用测试日志、APM、埋点和第三方 SDK 捕获；准备可检索的唯一正文、评论和举报说明标记 | 完成发帖、评论、举报和错误触发；扫描全部日志、埋点 payload、错误上报和服务端追踪 | 不得出现帖子正文、评论正文、举报说明、微信 openid、unionid、session_key、令牌、手机号或浏览者身份；允许使用 request_id 和事件白名单属性；日志（log）和埋点（telemetry）不得新增正文类扩展字段 | T17 |
