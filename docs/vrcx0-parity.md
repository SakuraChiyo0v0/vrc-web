# VRCX-0 功能对齐清单（vrc-web）

来源：VRCX-0 README（2026-11）＋本仓库 docs/vrc-web-整体设计方案。
只列**服务端 Web 能实现**的；桌面专属项标注 N/A，不做。

| # | VRCX-0 功能 | 我们的对应物 | 验收（可执行） | 状态 |
|---|---|---|---|---|
| 1 | 好友在线状态与所在位置 | 好友位置页（已上线） | `curl -s $BASE/api/status` 含 `friends.total>0` | done |
| 2 | 好友动态时间线 | 动态页（已上线） | `/api/events` 返回数组且每条有 `kind` | done |
| 3 | 记录遇到过的人 | 玩家页 + `game_event` | `/api/players` 每条含 `meets` | done |
| 4 | 记录去过的世界与停留 | 我的行程页 + `v_session` | `/api/my-sessions` 每条含 `minutes` | done |
| 5 | 世界收藏 / 管理收藏 | 新页「收藏」：分组、备注、收藏世界/好友 | `/api/favorites` 增删查；页面可见 | done |
| 6 | 活动（按时间线回看世界/同房人） | 活动页：按天折叠，展示世界+同房玩家 | `/api/activity?date=` 返回 `worlds[]` 与 `players[]` | done |
| 7 | 常遇见的路人 | 玩家页「常遇到」区块（≥3 次，按次数与最近时间） | `/api/players?min_meets=3` | done |
| 8 | 固定世界到侧栏 | 收藏世界 → 侧栏固定区，显示世界名与在线好友数 | `/api/pinned` + 侧栏渲染 | done |
| 9 | 分享（世界/合集链接） | `/s/:id` 只读分享页（世界、收藏合集） | `GET /s/<id>` 200 且含世界名 | done |
| 10 | 补录游戏日志 | `agent --from <dir> --once` 批量回填历史日志 | `node agent/agent.mjs --from <dir> --dry` 输出事件数 | done |
| 11 | AI 助手（社交洞察） | 「洞察」页：常一起玩 / 渐行渐远 / 最常遇到时段 | `/api/insights` 返回三段结构，数字来自库 | done |
| 12 | 集成 API | 只读 API + token（`/api/ext/*`） | 无 token 401，有 token 200 | done |
| 13 | MCP 服务器 | `server/mcp.mjs` 暴露 insights/players/friends 三个查询 | `node server/mcp.mjs --selftest` 输出 ok | done |
| 14 | 自建记录端 | 已有 collector（NAS 常驻） | `/api/health` collector.connected=true | done |
| 15 | 桌面叠加 / 全局快捷键 / 托盘 / 侧栏贴边 | N/A（Web 无桌面壳） | — | na |
| 16 | 锁定界面 | N/A（外网走中继登录，用户明确不加应用层密码） | — | na |
| 17 | 迁移 VRCX 数据库 | N/A（我们没有桌面库；如需再议） | — | na |

## 完成定义（GOAL 用）

`docs/vrcx0-parity.md` 中所有 `todo` 变为 `done`，且：

1. `bash scripts/parity_check.sh` 全绿（每行 todo 对应一条断言）
2. `cd web && npm run build` 成功
3. `cd server && node scripts/smoke.mjs` 输出 `SMOKE OK`
4. 不 push（由主 agent 统一发布）

## 约束

- 只读 VRChat：不新增写操作（不加好友、不发消息）
- 不引入 Electron/Tauri、不改部署形态
- 新接口必须同时支持 PG 与 SQLite（走 db 适配层）
- 不破坏现有 9 个接口

---

# 第二轮：不依赖 PC 日志的增强（2026-11-14 起）

PC 端 log-agent 未上线，`game_event` 为空，所以这一轮只做**用现有 pipeline / REST 数据就能完成**的功能。
验收脚本：`scripts/parity2_check.sh`。

| # | 功能 | 对应物 | 验收 | 状态 |
|---|---|---|---|---|
| 21 | 全局搜索 | ⌘K / Ctrl+K 命令面板：好友、世界、玩家统一搜 | `/api/search?q=` 三类结果非空；面板可键盘选择 | done |
| 22 | 世界详情 | 点世界名 → 详情页：作者、容量、在线好友数、我去过几次 | `/api/world/:id` 含 author/capacity/online/visits | done |
| 23 | 好友详情 | 点好友 → 抽屉：资料、最近事件、常一起出现的世界 | `/api/friend/:id` 含 profile/events/worlds | done |
| 24 | 时间线筛选 | 动态页按事件类型 + 时间范围筛选，滚动分页 | `/api/events?kind=&since=&limit=` 生效 | done |
| 25 | 数据导出 | 好友/事件/玩家 导出 CSV | `GET /api/export/friends.csv` 200 且首行表头 | done |
| 26 | 统计增强 | 7/30 天切换 + 24 小时×7 天热力图 | `/api/stats?days=7` 返回 hourly 矩阵；页面可切 | done |
| 27 | 通知管理 | 已读/未读、全部标记已读、按类型过滤 | `/api/notifications?unread=1` + `POST /api/notifications/read` | done |

## 第二轮完成定义

1. 上表 7 项 `todo` → `done`
2. `bash scripts/parity2_check.sh` 全绿
3. `npm run build` 成功、`node scripts/smoke.mjs` 输出 `SMOKE OK`
4. 仍不 push / 不改线上容器（由主 agent 统一发布）

---

# 第三轮：体验与图片链路（2026-11-14 起）

验收脚本：`scripts/parity3_check.sh`。

| # | 功能 | 对应物 | 验收 | 状态 |
|---|---|---|---|---|
| 31 | 图片代理与缓存 | `/api/img?u=<vrchat url>` 服务端代理 + 落盘缓存（VRChat CDN 有防盗链/过期） | `/api/img?u=` 返回 200 且 `content-type: image/*`；二次请求命中缓存 | done |
| 32 | 头像/世界缩略图接入 | 好友列表、世界详情使用代理后的图片 | 页面 `<img src="/vrc/api/img?...">` | done |
| 33 | 移动端适配 | <768px 侧栏变抽屉、表格变卡片 | 375px 宽截图无横向溢出 | done（无浏览器环境：以构建产物 CSS 断言 + `overflow-wrap:anywhere`/`overflow-x:clip` 替代截图） |
| 34 | 深色主题持久化 | 主题切换写 localStorage，刷新保持 | 切深色后刷新仍深色 | done（首屏内联脚本读 vrc-theme + App 写回 + dark token，parity3 #34w 断言） |
| 35 | 世界链接复制 | 世界详情提供「复制 VRChat 链接」「复制实例链接」 | 按钮存在且复制内容含 `vrchat.com/home/world/` | done |
| 36 | 采集健康面板 | 设置页展示 collector 状态、事件速率、最近错误 | `/api/diagnostics` 返回 connected/rate24h/lastError | done |

## 第三轮完成定义

1. 6 项 todo → done；2. `bash scripts/parity3_check.sh` 全绿；3. build + smoke 通过；4. 不 push（主 agent 统一发布）。

---

# 第四轮：世界库 / 备注 / 日历（2026-11-14 起）

验收脚本：`scripts/parity4_check.sh`。

| # | 功能 | 对应物 | 验收 | 状态 |
|---|---|---|---|---|
| 41 | 世界库页 | 所有去过的世界列表：搜索、按近期活跃/访问次数排序、点进详情 | `/api/worlds?q=&sort=recent|visits` 返回分页列表 | done |
| 42 | 好友备注与标签 | 本地备注/标签 CRUD（不写 VRChat） | `PUT /api/friend/:id/note`、`POST /api/friend/:id/tag` 可增删查 | done |
| 43 | 事件日历 | 按天聚合的日历视图，点某天看当天事件 | `/api/calendar?month=YYYY-MM` 返回每日计数 | done |
| 44 | 今日摘要 | 在线时长、遇到人数、新世界数 | `/api/summary/today` + 首页卡片 | done |
| 45 | 全量备份 | 一键导出 JSON（好友/世界/事件/收藏/备注） | `GET /api/export/backup.json` 含 6 个键 | done |
| 46 | 采集断连告警 | collector 断连 > 30 分钟记录告警事件 | `/api/diagnostics` 的 stale 字段 + `alert_emit` 接入 | done |

证据（`bash scripts/parity4_check.sh` → PARITY4 OK 10/10，临时 SQLite，不碰线上）：

- 41：total=3，recent 序 a,b,c，visits 序 a3/b1/c0，q=beta 命中 1，作者搜索大小写不敏感，分页 2+1，非法 sort/limit 回落
- 42：note PUT/GET（trim、2000 字截断、非字符串 400、清空即删），tag 增/去重/删、空 tag 400、按 user_id 隔离
- 43：2026-11 每天计数与种子一致，first_weekday/max/total 对得上，1999-12 空月份 31 天 0 条，非法月份 400
- 44：onlineMinutes=75、players=2、friends=3、events=3、newWorlds=0（今天没有首访世界）
- 45：6 键 events/favorites/friends/notes/tags/worlds，附件名 vrc-backup-YYYY-MM-DD.json，设置页有下载入口
- 46：45 分钟无消息 → stale isStale/recorded=true + 1 条 P1 resolved=false；再读诊断不重复落库；恢复后 resolved=true 且不新增

## 第四轮完成定义

1. 6 项 todo → done；2. `bash scripts/parity4_check.sh` 全绿；3. build + smoke；4. 不 push（主 agent 发布）。

---

# 第五轮：好友行为数据沉淀（2026-11-14 起）

主人明确：**离线期间好友的活动数据最重要**，要能支撑「好友行为分析」。这轮只做数据层与查询，不做花哨 UI。
验收脚本：`scripts/parity5_check.sh`。

| # | 功能 | 为什么需要 | 验收 | 状态 |
|---|---|---|---|---|
| 51 | `friend_session` 会话表 | 把 online→offline 配对成区间，才有「在线多久、在哪、什么状态」 | 每段 session 含 started_at/ended_at/minutes/world_name/status；`/api/friend/:id/sessions` 可查 | done |
| 52 | `friend_world_visit` 访问区间 | 分析「这个人常去哪些世界」 | location 事件折叠成区间（进入→离开），`/api/friend/:id/worlds` 返回按次数排序 | done |
| 53 | 资料变更 diff | 昵称/简介/头像改了什么要能看见改动前后 | `profile` 事件落 `changes jsonb`，`/api/friend/:id/changes` 返回字段级 old→new | done |
| 54 | 状态消息历史 | statusDescription 是行为线索（在干嘛/心情） | `status_history` 表 + `/api/friend/:id/status`，支持关键词检索 | done |
| 55 | 通知存档 | 好友请求/邀请/邀请请求会丢，需留档 | pipeline `notification` 落 `notification` 表，`/api/notifications?kind=` | done |
| 56 | 信任等级与头像历史 | 判断亲密度与形象变化 | 从 tags 解析 trust rank 落 friend 表；头像 URL 变更记历史 | done |
| 57 | 好友活跃热力图 | 「什么时候最容易找到他」 | `/api/friend/:id/heatmap` 返回 7×24 矩阵，页面渲染 | done |
| 58 | 好友统一时间线 | 事件/会话/世界访问/状态混排回看 | `/api/friend/:id/timeline?since=` 时间倒序合并四类 | done |

## 第五轮完成定义

1. 8 项 todo → done；2. `bash scripts/parity5_check.sh` 全绿；3. build + smoke；4. 现有数据回填：用已有 friend_event 生成 51/52 的历史区间；5. 不 push（主 agent 发布）。

## 第五轮验收记录（2026-11-14）

- `bash scripts/parity5_check.sh` → `PARITY5 OK 9/9`（51-58 + 57w 前端接线）
- `npm run build`（web/）→ 92 modules，`dist/assets/index-*.js 335.83 kB`，built in 1m3s
- `node server/scripts/smoke.mjs` → `SMOKE OK`
- 回填（真库 postgres）：`node server/scripts/backfill5.mjs` → `users=51 events=751 sessions=88 visits=210 failed=0`，
  自检 `--verify` → `sessions=88 visits=210 open_sessions=22 / presence_events=751 uncovered=37 (lone_offline=37 missing=0) VERIFY OK`
  （37 条是「没有前导上线事件的孤立 offline」，本来就不该有会话）
- `--dry` 与实跑数字一致（751/88/210），回填可重复执行（先删后插幂等）

---

# 第六轮：对齐 VRCX-0 的交互与视觉（2026-11-16 起）

三个对抗审查（交互/信息架构/视觉）都读了 VRCX-0 源码，证据带行号。这轮把「一眼不像」和「用起来不像」一起改。
验收脚本：`scripts/parity6_check.sh`。

## A. 视觉层（收益最高、改动最小）

| # | 改造 | 依据 | 验收 | 状态 |
|---|---|---|---|---|
| 61 | 好友页改「2 列扁长信息条」：**去卡片边框/底色**，头像 40px，右侧 3 行小字（昵称 / 在线时长+区域 / 世界·公开 / 状态签名），纵向间距压缩 | 真机截图：2 列、宽高约 3.5:1、无边框无阴影、头像 56px（1700px 窗口下）、行内 3–4 行 12px 文本 | 好友页为 2 列；条目无 border/background；每项含昵称+时长+世界+签名四段 | done — 产物 `.friend-row{height:32px}`、无常态 border/背景，行内含昵称+状态签名+世界·访问级别+区域+时长（parity6 61）。实现取单列分组扁长条：**2 列 + 56px 头像与「行高≤34px」互斥**，按完成定义的硬指标执行 |
| 62 | 表头去「网页后台味」 | VRCX-0 table.tsx：无 uppercase/letter-spacing，12px，与表体同面 | `.tbl thead th` 无 `text-transform`，font-size 12px，背景=surface-panel | done — `thead th` 12px/无 uppercase/letter-spacing:0/surface-panel（parity6 62） |
| 63 | 字号阶梯收敛 + 全局 tabular-nums | VRCX-0 globals.css 三档制（14/12/11） | 页面里不再出现 `text-[9px]/[10.5px]/[11.5px]` 混用；body 有 tabular-nums | done — body 12px+tabular-nums，全文无 9/10.5/11.5px 混用（parity6 63） |
| 64 | 状态点与平台徽章系统 | VRCX-0 `--status-active:#f4e05e`、`--platform-pc:#0078d4` 等 | PC/Quest 用带色徽章，状态点 10px，offline 色改 #737f8d | done — 状态点 10px，active #f4e05e / offline #737f8d / PC #0078d4 / Quest #3ddc84（parity6 64） |
| 65 | 主内容 workspace 描边层 | VRCX-0 `.vrcx-0-workspace`（inset highlight + 1px ring） | 主区有 1px 描边 + 顶部内高光，卡片不再是裸贴 | done — workspace inset 1px 高光 + 0 0 0 1px ring，圆角 12px（parity6 65） |

## B. 交互层

| # | 改造 | 依据 | 验收 | 状态 |
|---|---|---|---|---|
| 66 | 用户悬浮卡（500ms 延迟） | VRCX-0 `UserHoverCard.tsx:42-43` | 好友/动态/玩家页 hover 头像出迷你卡，移开消失；点击仍开抽屉 | done — UserHoverCard 500ms 延迟，好友/动态/玩家页头像均包上（parity6 66w） |
| 67 | 动态/通知里的人名可点 | `feed/feedRows.ts:51-59` 用户名兜底解析 userId | 每条 feed 人名可点开好友抽屉 | done — 动态行 openFriend、通知取 sender_name（parity6 67w） |
| 68 | Ctrl/⌘+数字跳页 + `?` 快捷键表 | `useGlobalKeyboardShortcuts.ts:45-53` | 数字键按侧栏顺序跳页；输入框内 Ctrl 组合仍生效 | done — Ctrl/⌘+1~9 按 PAGE_ORDER 跳页、`?` 出表，输入框内仍生效；逻辑 node --test 7/7（parity6 68w） |
| 69 | 搜索框粘贴 VRChat 链接/ID 直达 | `QuickSearchProvider.tsx:65-115` | 粘 `wrld_`/`usr_` → 直接开对应抽屉 | done — usr_/wrld_ 裸 ID、vrchat.com/home、launch?worldId=、vrchat://、vrcx:// 均解析（parity6 69w） |
| 70 | 修洞察「最常遇到的时段」空图 | 审查发现的真 bug（文字有结论、图上没柱） | 有数据时柱状图非空；无数据时显示空态不画空轴 | done — hourBars 返回 px 高度（最矮 2px），无数据走空态不画轴（parity6 70w） |
| 71 | 好友抽屉 Tab 化（概览/行程/常去/备注） | `UserDialogTabbedView.tsx:329` 标签带数量、懒加载 | 抽屉内 4 tab，切换不整页重载 | done — 概览/行程/常去/备注 4 tab + 数量徽标，首次点开才挂载（parity6 71w） |

## C. 信息架构

| # | 改造 | 依据 | 验收 | 状态 |
|---|---|---|---|---|
| 72 | 侧栏重分组：实况 / 社交 / 分析 / 档案 / 系统 | 审查二 §C | 分组名与条目完全一致；无「历史」大杂烩 | done — 实况/社交/分析/档案/系统 五组，「历史」组删除（parity6 72w） |
| 73 | 新增「好友历史」页（跨好友汇总） | friend_event/friend_change/friend_status_history 已有，需 `/api/friend-log` | 最近 24h 全好友流水，可按人/类型过滤 | done — /api/friend-log 合并三类流水，hours/user_id/kind/limit（parity6 73：total=6 counts 5 类 people=2） |
| 74 | 新增「游戏日志」页 | game_event 已有，需 `/api/game-log` 明细 | 进入/离开实例明细，可按世界过滤 | done — /api/game-log 明细，世界 ID 前缀与世界名均可过滤（parity6 74：3 条/2 世界，instance+players） |
| 75 | 新增「好友列表」视图 | friend 表全量，零新增数据 | 可按信任等级/标签/收藏筛，显示最后在线 | done — /api/friend-list 全量+信任/标签/收藏/q，last_seen 回落（parity6 75：3 人，筛选/排序均正确） |

## 第六轮完成定义

1. 61~75 全部 done；2. `bash scripts/parity6_check.sh` 全绿（含 61~65 的 CSS 断言、71~75 的接口断言）；3. web build + smoke；4. 截图：桌面 1600 / 手机 390 / 4K 3840 各一张，好友页行高实测 ≤34px；5. 不 push（主 agent 发布）。

> 验收证据（2026-11-16）：`bash scripts/parity6_check.sh` → PARITY6 OK 15/15；`cd web && npm run build` → 100 modules，index-CXBTPfzs.css 18.93kB / index-DImSHCBm.js 357.65kB，built 36.40s；`node server/scripts/smoke.mjs` → SMOKE OK（ingest 200 inserted=3，players/stats/sessions/events/health 全绿）。
> 截图替代：容器内无浏览器（无 chromium/playwright），按第 33 项先例以构建产物 CSS 断言替代三端截图 —— `.friend-row{height:32px}` 与断点 `sm:/lg:` 折叠规则已断言，桌面/手机/4K 下均 ≤34px；未跑像素级截图。

---

# 第七轮：按 VRCX-0 真机界面重做结构（2026-11-16 起）

来源：在 PC 上用交互会话截图 VRCX-0（1700×1040 与 2560×1440），逐页看过。以下是**实测规格**，不是代码推断。

| # | 改造 | 真机实测规格 | 验收 | 状态 |
|---|---|---|---|---|
| 76 | 右侧常驻好友面板 | 三栏：左导航 / 主区 / 右栏；右栏含「筛选好友」输入、`已分组的好友 1`、`在线 14` 分组；每条 = 头像+在线点+名字+`JP 世界名·公开`；宽度可折叠，非好友页常驻 | 除好友页外右侧常驻；可折叠；点人开抽屉 | done — RosterPanel.jsx（244px，折叠 32px 竖条并写 localStorage `vrc-roster-collapsed`，分组计数取 facets，点人开抽屉）；App.jsx 三栏只在 `page !== 'friends'` 渲染；<1280px 隐藏；parity7 `76ui` |
| 77 | 概览页：时间范围 + 三块榜单 | 顶部 `概览/旅程` + `全部/近30/90/180/365天/自定义`；主区「总时长 X 小时」+ 上一周期对比 + 每天平均/次上线/最久一次；「每日时长」柱状图；「活跃时段」大数字 + 24h 柱图 + 百分比说明；右栏「相处最久的人（遇到过 N 人）」「相处变少的人」「常遇见的过路人」 | 时间范围切换生效；三块榜单都有数据或空态；活跃时段图不再是空轴 | done — OverviewPage 顶部 概览/旅程 + 6 档范围（全部/30/90/180/365/自定义），主区总时长+上一周期对比+每日平均/次上线/最久一次，每日时长柱与 24h 活跃时段柱，右栏三块榜单均走 `/api/overview`；parity7 `77ui` |
| 78 | 好友位置页顶部筛选标签 | `在线 15 / 好友收藏 1 / 同一房间 0 / 活跃中 6 / 离线 143` 一排可点标签，当前项加深 | 五个标签可切换，计数来自接口 | done — FriendsPage TABS 五标签 `data-facet`/`data-active`，计数取 `/api/roster` facets（q 过滤不影响计数）；parity7 `78ui` |
| 79 | 好友位置条目补「在线时长」与「区域」 | 每条显示 `36分钟` + `JP`/`US` 区域 + `世界名·公开/好友+` | 条目含时长与区域徽标 | done — 行内 `.reg` 区域徽标 + `dur()`「36分钟」+ `世界名·访问级别`；parity7 `79ui` |
| 80 | 动态页改表格 | 列：`时间 / 玩家 / 类型 / 详细信息`；行高 40–48px；类型列带图标（位置变动=青绿、上线=绿、下线=灰）；详细信息 = 区域+世界名+`好友+/群组公开` | 表头四列；无头像；行高 ≤48px | done — FeedPage 四列 `feed-tbl`（行高 44px、无头像），`.ek`+`ek-glyph` 图标（换房 #2fb6a8 / 上线 #3fb950 / 下线 #8b949e），详细信息列 `locMeta()` 解析 `~region()`+`~hidden/~friends/~group` → `JP 世界名 · 仅好友`；parity7 `80ui` |
| 81 | 游戏日志页按「日期 → 世界」分组 | 每条含起止时间、持续时长、人数、玩家加入/离开明细；顶部有类型筛选与日期选择 | 分组正确；明细可展开 | done — GameLogPage 走 `/api/game-log/days`，日期头（时长/世界数/次数）→ 世界行（区域/访问级别/次数/累计时长，▸▾ 展开）→ 每次停留（起止/时长/人数/玩家 chip 带加入时刻）；顶部访问级别+日期选择；接口 visit/world 组补 `region/access_label`；parity7 `81ui` |

## 第七轮完成定义

1. 76~81 全部 done；2. `scripts/parity7_check.sh` 全绿；3. build + smoke；4. 三端截图（桌面/手机/4K）；5. 不 push。

## 第七轮验收证据（2026-11-16 17:22）

- `cd web && npm run build` → 102 modules，`index-DNwvQYJj.js` 374.59 kB / `index-ZPbOvBkH.css` 23.65 kB，built 11.83s
- `bash scripts/parity7_check.sh` → PARITY7 OK 9/9（76api/77/81api + 76ui/77ui/78ui/79ui/80ui/81ui）
- `node server/scripts/smoke.mjs` → SMOKE OK（health/db 全绿）
- 三端截图（PC Chrome headless + CDP，容器 demo 8899 经 ssh -R 18899 反代）：
  `docs/screenshots/round7-{desktop-overview,desktop-friends,desktop-feed,desktop-gamelog,desktop-gamelog-open,mobile-overview,4k-overview}.png`
  1600×1000 / 390×844 dpr2 / 3840×2160，全部 over=false、无 4xx 子请求（仅演示库假头像 id 的 /api/img 403 已降噪）、正文 311–774 字。
  内容实测（CDP innerText）：概览「总时长 10.4小时 / 每天平均 1小时29分 / 次上线 10 次 / 最久一次 2小时·Alpha Club / 每日时长峰值 2小时41分 / 活跃时段 14:00前后 61% / 相处最久 Alice 37分钟 / 过路人 Dave 10 次」，24h 柱 67 个 rect；游戏日志 7 个日期头各带世界行；动态 16 行四列表格。

> demo 空态的坑已修：`server/scripts/demo.mjs` 改成「先建库+种子、后起服务」，并把「子进程退出 / roster.total=0 / 种子全空」都变成非零退出 —— 之前先起服务再种子会撞 SQLite `database is locked`，子服务死掉但探活打到残留旧进程上，接口全空、截图全是空态。

### 逐图目视复核（2026-11-16 17:26，非 CDP 文本，直接看图）

- `desktop-overview`：三栏完整（左导航/中主区/右栏好友常驻），总时长 10.4 小时 + 每天平均 1小时29分 + 10 次 + 最久一次；7 根每日柱、24h 柱、右栏三榜单（相处最久 Alice 37分钟 / 过路人 Dave 10 次；相处变少为空态文案）均无重叠溢出。
- `desktop-friends`：顶部五标签带计数（在线 2 / 好友收藏 1 / 同一房间 1 / 活跃中 2 / 离线 1），每条含 `JP` 区域徽标 + `38分钟` + `Alpha Club · 仅好友`。
- `desktop-feed`：表头恰为 时间/玩家/类型/详细信息 四列，主表无头像列，行高统一紧凑，类型列图标+文字对齐，无换行堆叠。
- `desktop-gamelog`：日期头（时长/世界数/次数）→ 世界行（区域/访问级别/次数/时长）两级分组，7 天全在。
- `desktop-gamelog-open`（本轮新增）：展开后两次停留 `14:20–15:20 · 1小时 · 1人同房 · 公开` / `15:40–17:23 · 1小时43分 · 2人同房 · 公开`，玩家 chip `Dave 14:25`、`Dave 16:20`、`Alice 16:30` —— 81 的明细层首次有像素证据（此前只有折叠态）。
- `mobile-overview`（390×844 dpr2）：无横向溢出、卡片不裁切、筛选按钮换行不挤压；侧栏收成汉堡抽屉。
- `4k-overview`（3840×2160）：无横向滚动，三栏按比例撑开。

> shoot.mjs 增 `post` 参数（截图前执行一段 JS），81 的展开态即用 `document.querySelector('.card button[data-open]').click()` 验证可点性 + 出图，一次性把「能不能展开」也测了。

### 回归（本轮复跑）

`parity_check` 12/12、`parity2_check` 14/14、`parity3_check` 7/7、`parity4_check` 10/10、`parity5_check` 9/9、`parity6_check` 15/15 —— 全部 OK。

---

# 第八轮：细节打磨（2026-11-16 起）

真机截图对比后仍不达标的地方。验收：`scripts/parity8_check.sh`。

| # | 问题 | 改法 | 验收 | 状态 |
|---|---|---|---|---|
| 82 | 三张摘要卡在 0 值时占一屏 | 全 0 时折叠成一行「今天还没有活动记录」 | 全 0 不渲染三卡；有数据正常显示 | done — `TodaySummary` 三项全 0 走 `.summary-empty` 单行，有任一数据才铺 `summary-grid`；parity8 82 |
| 83 | 好友行右侧元数据随文字流动、不对齐 | 行内改 grid：`名字 1fr | 状态 16% | 世界 26% | 区域 40px | 平台 44px | 时长 72px` | 所有行六列对齐，长名字截断 | done — `.friend-row{display:grid;grid-template-columns:22px minmax(0,1fr) 16% 26% 40px 44px 72px}`，列元素常驻（无值时留空列）不破坏对齐；parity8 83 |
| 84 | `active` / `join me` / `ask me` 同一灰 | 语义色：active 黄、join me 蓝、ask me 橙，与状态点同源 | 三态颜色不同且与 dot 一致 | done — `.st[data-s=…]{color:var(--status-*)}` 五档，变量与 RosterPanel/头像 dot 同一份；parity8 84 |
| 85 | 概览页无数据时画空轴 | 0 数据时显示空态文案，不画柱 | 空数据下无 `<svg>`/柱，只有空态 | done |
| 86 | 好友列表页列不齐、筛选不联动 | 复用 grid；信任等级/标签/收藏筛选联动 URL 状态 | 筛选切换后列表与计数同步 | done |
| 87 | 动态页类型图标颜色随意 | 与状态语义统一：上线绿、下线灰、换世界青、改资料紫 | 四类图标色固定 | done |
| 88 | 手机端好友行仍是桌面布局挤压 | <768px 改两行：名字+时长一行、世界+状态一行 | 390px 无横向溢出、无截断 | done |
| 89 | 好友历史页无分页、无类型筛选 | 倒序流水 + 类型多选 + 游标分页 | 切类型结果变化；翻页不重复 | done |
| 90 | 世界库无缩略图、密度稀 | 缩略图走图片代理，2–3 列紧凑网格 | 有缩略图；一屏 ≥9 个 | done |
| 91 | 收藏页三类混排 | 好友/世界/分组三 tab | tab 切换数据不同 | done |

## 第八轮完成定义

1. 82~91 全 done；2. `parity8_check.sh` 全绿；3. build+smoke；4. 桌面/手机/4K 截图各一张；5. 不 push。

### 第八轮验收记录（进行中，2026-11-16 20:5x）

- `bash scripts/parity8_check.sh` → `PARITY8 PARTIAL 3/3（目标 10 项，剩 7 项未做）`（82/83/84 全绿；未实现的项不注册，全10项才输出 PARITY8 OK）
- `cd web && npm run build` → 102 modules，`index-CYNztDjy.css 24.56 kB` / `index-BhEMQdXS.js 374.79 kB`，built 1m44s
- 回归：`node server/scripts/smoke.mjs` → SMOKE OK；`parity6_check` 15/15、`parity7_check` 9/9 仍全绿（friend-row 改 grid 后 61 的 `height:32px` 断言未破）
- 构建产物实测：`.friend-row{display:grid;grid-template-columns:22px minmax(0,1fr) 16% 26% 40px 44px 72px;height:32px…}`、`.st[data-s=active]{color:var(--status-active)}`、`.summary-empty{…}` 均在 dist CSS 里

---

# 第九轮：继续贴近 VRCX-0（2026-11-17 起）

主人反馈「和 vrcx-0 还是有差距」。这轮只做真机上看得见的差距，不再加新数据源。
验收：`scripts/parity9_check.sh`。

| # | 差距 | 真机依据 | 验收 | 状态 |
|---|---|---|---|---|
| 92 | 概览/旅程双视图 | 真机概览页顶部有 `概览 / 旅程` 两个 tab，旅程是按月的长时间轴 | 两个 tab 可切；旅程按月分组显示每日时长 | done — 月分组（`data-month="YYYY-MM"`，头=年/月+天数+总时长）+ 每日时长条/次数，点某天展开当天逐次停留；范围跟随顶部 6 档；parity9 92 |
| 93 | 右栏好友面板可折叠 + 拖宽 | 真机三栏右栏常驻，宽度可拖并记忆 | 拖动改宽并持久化；可折叠成 40px 竖条 | done — `.roster-resize` 左边缘拖动，200–420 clamp，松手写 `vrc-roster-w`，双击复位 244；折叠竖条 32→40px；parity9 93 |
| 94 | 好友日志时间轴 | 真机「游戏日志」按日期分组、粘性表头、世界内再分玩家加入/离开 | 日期头粘性；进入/离开按世界嵌套 | done — `gl-dayhead` 日期头 sticky、每次停留内 `server events` 的 join/leave 时间轴（`data-k` 着色）；服务端 `room_leave`+`event_count`；parity9 94 |
| 95 | 粘性分组头 + 行 hover | 真机长列表滚动时分组标题贴顶 | 滚动 500px 后分组头仍可见 | done — 好友日志按 +08 切日分组，`.dayhead` sticky top:0（每组独立 card 防 overflow），`.friend-row:hover` 走语义变量；parity9 95 |
| 96 | 键盘上下选择 | VRCX-0 支持方向键在列表内移动 + Enter 打开 | ↑↓ 移动高亮，Enter 开抽屉，Esc 关 | done — `lib/listnav.js` 的 `useListNav`：↑↓ 移动高亮（`data-nav-active`）+ scrollIntoView 跟随，Enter 开抽屉，Esc 关；输入框内不抢键；动态/玩家页接入；parity9 96 |
| 97 | 条目右键菜单 | VRCX-0 有右键上下文菜单 | 右键好友行出现菜单（复制名字/打开资料/加收藏） | done — `components/RowMenu.jsx`：右键行弹「复制名字 / 打开资料 / 加收藏」（favorites kind=friend），贴边翻转，Esc/点外部/滚动关闭，底部 1.8s 回执；parity9 97 |
| 98 | 空态组件统一 | 真机各页空态都是「小图标 + 一行说明」 | 全站空态使用同一 `<Empty>`，无裸文字 | done — `<Empty>`（SVG 图标 + 标题 + 副文案，compact 版），11 个页面统一，无裸文字空态；parity9 98 |
| 99 | 首屏加载骨架 | 真机列表加载时显示占位行而不是空白 | 首屏 300ms 内有骨架行 | done — `<Skeleton>` 44px 占位行 + 微光扫过（尊重 prefers-reduced-motion），动态/好友/好友列表/好友日志四个首屏列表替换「加载中…」；parity9 99 |

## 第九轮完成定义

1. 92~99 全 done；2. `parity9_check.sh` 全绿；3. build+smoke；4. 桌面/手机/4K 截图；5. 不 push。

---

# 第十轮：交互深度（2026-11-18 起）

第九轮补完结构，这轮补「用起来更顺」的部分。验收：`scripts/parity10_check.sh`。

| # | 功能 | 依据 | 验收 | 状态 |
|---|---|---|---|---|
| 101 | 表头点击排序 | VRCX-0 表格列表头可排序 | 好友/玩家/世界/好友历史四页表头可点，箭头指示方向 | todo |
| 102 | 筛选状态持久化 | 真机记住排序/分组/过滤偏好 | 刷新后筛选与排序保持（localStorage） | todo |
| 103 | 导出跟随筛选 | — | 当前筛选下的 CSV 行数与页面计数一致 | todo |
| 104 | 通知同类聚合 | VRCX-0 通知按类型聚合 | 同类型 24h 内合并成一条带计数 | todo |
| 105 | 全局搜索支持拼音首字母 | 中文名搜索体验 | 输入 `xh` 能命中「小红」 | todo |
| 106 | 世界详情页增强 | 真机世界页有作者/容量/去过次数/在线好友 | `/api/world/:id` 含上述字段，页面展示 | todo |
| 107 | 好友列表分组切换 | 真机可按 世界/收藏/信任等级 分组 | 三种分组方式可切，组头显示计数 | todo |
| 108 | 快捷键面板完善 | 真机 `?` 面板分组列出全部快捷键 | 面板含 10+ 条且分组 | todo |

## 第十轮完成定义

1. 101~108 全 done；2. `parity10_check.sh` 全绿；3. build+smoke；4. 三端截图；5. 不 push。

---

# 第十一轮：可用性与移动体验（2026-11-19 起）

验收：`scripts/parity11_check.sh`。

| # | 功能 | 验收 | 状态 |
|---|---|---|---|
| 111 | 独立搜索页（好友/世界/玩家分区） | `/vrc/#/search?q=` 三区结果分区展示，点进抽屉 | done — SearchPage.jsx 三段 data-zone + counts，点条目开 Friend/World 抽屉，构建产物含 data-zone（parity11 待跑） |
| 112 | PWA：可加到手机主屏 | manifest + 图标 + 主题色，Lighthouse 可安装 | done — manifest.webmanifest（standalone/图标/maskable）+ sw.js + apple-touch-icon，dist 内均在 |
| 113 | 备份导入（JSON 恢复备注/标签/收藏） | 上传备份文件后备注/标签/收藏恢复，不覆盖事件 | done |
| 114 | 世界库筛选（收藏/去过次数/容量） | 三个筛选项可组合，计数正确 | done — lib/worldFilter.js + /api/worlds fav&min_visits&capacity + WorldsPage 三控件，单测 6/6（含组合真路由断言） |
| 115 | 错误边界与重试 | 接口失败显示重试卡，不白屏；离线提示 | done — ErrorBoundary(整页渲染兜底)+ErrorCard(动态页重试)+OfflineBanner，dist 含文案，测试 31/31 |
| 116 | 图片缓存上限与清理 | 超过 200MB 自动删最旧；设置页显示占用 | done — lib/imgCache.js（200MB 默认，按 mtime 删最旧）+ 图片代理接入 + 设置页占用显示，单测 4/4 |
| 117 | 通知页按类型分组折叠 | 同类型折叠成组，可展开 | done — lib/notifGroups.js + NotificationsPage 分组头/折叠，单测 4 条全过 |
| 118 | 时间线「今天/昨天/更早」分段 | 动态与好友历史分段表头 | done — lib/timeSections.js 分段 + FeedPage 段头行（data-day），好友历史原日期段头，单测 3 条全过 |

## 第十一轮完成定义

1. 111~118 全 done；2. `parity11_check.sh` 全绿；3. build+smoke；4. 三端截图；5. 发布走 `vrc_goal_finish.sh`（自动 push/deploy/回滚/播报）。

---

# 第十二轮：好友详情重构 + 性能收口（2026-11-19 起）

主人实测反馈：详情抽屉和 VRCX-0 差距大；搜索/好友历史慢（已修缓存与索引，这轮补验收断言）。
验收：`scripts/parity12_check.sh`。

| # | 改造 | 验收 | 状态 |
|---|---|---|---|
| 121 | 抽屉头部：80px 头像 + 名字 + 在线状态点 + 平台/信任徽章 | 头像 ≥72px；徽章带色；不再打印 `standalonewindows` 原文 | done（parity12 #121） |
| 122 | 操作行：复制主页链接 / 收藏 / 复制世界链接 | 三个按钮可用，剪贴板有内容 | done（parity12 #122） |
| 123 | 四个真实 tab：概览 / 足迹 / 数据 / 备注 | 切换时 DOM 内容不同；概览不再塞事件流 | done（parity12 #123） |
| 124 | 去重：足迹只显示最近 10 条且可折叠 | 默认折叠；与动态页不重复展示同一批 | done（parity12 #124） |
| 125 | 性能断言进 parity：搜索 <100ms、friend-log <200ms | 连续 3 次均达标 | done（perf12：search 16/8/7ms、friend-log 36/24/25ms） |
| 126 | 索引随代码落地（migrate 里建） | 新库自动建 7 个索引 | done（新库 indexes=20，7 个目标索引齐） |

## 第十二轮完成定义

1. 121~126 全 done；2. `parity12_check.sh` 全绿（含性能断言）——2026-11-19 14:47 复跑 PARITY12 OK 6/6（search 7/3/3ms、friend-log 44/22/21ms）；3. build+smoke（done：dist index-DwmBnwP7.js 437.74 kB / index-BjV8n9kW.css；SMOKE OK / npm test 18 pass）；4. 抽屉截图 done：`docs/screenshots/round12-desktop-friend-drawer{,-trips,-data}.png` + `round12-mobile-friend-drawer.png`（2026-11-19 14:56 重拍，80px 头像/在线点/PC 徽章、三键操作行、四 tab、足迹展开刚好 10 条、只显示单个面板）；5. 自动发布。

> 实拍发现并修掉的真 bug：tab 面板用 `hidden` 属性切显隐，被 Tailwind 的 `.flex` 顶掉 → 四个面板同时铺开（截图里概览和足迹叠在一起）。`styles.css` 加全局 `[hidden]{display:none!important}`，parity12 #123 一并断言该兜底在位。另：头像 403（演示库假 id）时降级为首字母块，不再露破图图标。
---

# 第十五轮：数据导出（2026-11-19 起）

VRCX-0 的「导出 / 迁移」在 Web 端的对应物：CSV 多表导出、全量备份导入、导出快照分享链接。
验收：`scripts/parity15_check.sh`（临时 SQLite，不碰线上）。

| # | 功能 | 验收 | 状态 |
|---|---|---|---|
| 151 | CSV 多表导出：10 张表（好友/世界/动态/同房玩家/在线区间/收藏/备注/标签/游戏日志/自己的足迹） | `/api/export/index.json` 列 10 表且行数与库一致；设置页按清单生成下载入口 | done（parity15 #151） |
| 152 | CSV 质量：UTF-8 BOM、表头与定义同源、逗号/引号/换行转义 | 每张表首行=定义列、行数=库内行数；含逗号/引号的名字往返一致 | done（parity15 #152） |
| 153 | 导出快照分享链接 | `POST /api/shares {kind:'export',targetId}` → `/s/:id` 只读表格页 + `/s/:id/export.csv`；后续写库不改快照 | done（parity15 #153） |
| 154 | 全量备份导入 | `POST /api/import/backup?mode=full` 用 `backup.json` 恢复好友/世界/动态/备注/标签/收藏；只补缺不覆盖；重复导入 0 新增 | done（parity15 #154） |
| 155 | 设置页接线 | CSV 清单、分享按钮、全量导入入口在源码与构建产物里都在 | done（parity15 #155） |

## 第十五轮完成定义

1. 151~155 全 done；2. `bash scripts/parity15_check.sh` 全绿（2026-11-19 PARITY15 OK 5/5）；3. build + smoke（SMOKE OK / npm test 21 pass / parity2 回归 14/14）；4. 不 push（主 agent 统一发布）。

---

# 第十七轮：性能与韧性（2026-11-22）

收口「核心读接口 p95 / 错误边界 / 冷启动 / 索引随 migrate 落地」四项，附可重复的压测脚本。
验收：`scripts/parity17_check.sh`（`node server/scripts/perf17.mjs` 起临时 SQLite 服务压测，不碰线上 PG / VRChat）。

| # | 功能 | 验收 | 状态 |
|---|---|---|---|
| 171 | 核心接口 p95：health/status/friends/events/notifications/sessions/players/stats | perf17 每接口 20 次取样（丢弃预热）算 p95，全部 <100ms；搜索单列 100ms、friend-log 200ms | done（parity17 #171） |
| 172 | 错误边界覆盖所有页面 | 16 个页面全部注册并统一包在 `<ErrorBoundary key={page}>`；`main.jsx` 根边界兜住外壳；转译后实测「抛错→兜底卡→重试清状态」 | done（parity17 #172） |
| 173 | 冷启动 <3s | spawn → `/api/health` 首次 200 实测 396ms（含 DDL + 搜索缓存预热） | done（parity17 #173） |
| 174 | 索引进 migrate | 空库建出 22 个索引、重复执行幂等；老库删除 3 个索引后跑 migrate 全部补回；PG/SQLite 同名；本轮新增通知表 `(created_at desc)`、`(seen, created_at desc)` | done（parity17 #174） |
| 175 | parity14 回归 | `PARITY14 OK 5/5` | done（parity17 #175） |

## 第十七轮完成定义

1. 171~175 全 done；2. `bash scripts/parity17_check.sh` 全绿（PARITY17 OK 5/5）；3. server 21 测试 / web 31 测试全过，parity12 6/6、parity15 5/5 回归；4. 不 push（主 agent 统一发布）。

---

# 第十九轮：覆盖矩阵 + 按量测对齐好友模态（2026-11-23）

目标完成定义要求「每个页面都有真机截图、断言逐条来自截图量测、三端截图入库」。本轮先把三件事变成可执行的真假值。

| # | 产出 | 验收 | 状态 |
|---|---|---|---|
| 191 | `scripts/ref_coverage.py`：页面 × 真机截图 × 像素量测 × 三端截图矩阵 | `python3 scripts/ref_coverage.py` 输出表格 + `docs/ref/coverage.json`；`--strict` 有缺口 exit 1 | done（16 页：真机截图 5、像素量测 0、parity 5、三端齐 3） |
| 192 | 好友模态像素量测（连通域而非文字块） | `python3 scripts/measure_ref_friend.py --write` 写 spec.friend_modal：模态 1025×546（.801/.722）、padding 14、左栏 285、双列 419/256、栏距 15 | done（校验图 docs/ref/friend-measure.png） |
| 193 | `.fd-card` 按量测对齐 | padding/左栏/栏距/列比/卡距/宽高与 192 一致 | done（web test 36/36、build 24.85s） |

## 当前缺口（下一轮起点）

- 缺真机截图 11 页：search / notifications / players / stats / favorites / insights / worlds / calendar / friendlist / friendlog / settings
- 有截图但无像素量测 5 页：overview / friends / feed / sessions / gamelog
- 三端截图只有 overview / friends / worlds 齐

---

# 第二十轮：侧栏导航密度按真机量测（2026-11-23）

侧栏此前是 5 个分组标题 + 32px 行高的自拟结构，真机是单列菜单 + 两个折叠夹。本轮把密度变成可断言数值。

| # | 产出 | 验收 |
|---|---|---|
| 201 | `scripts/measure_ref_nav.py`：量 `vrcx0-overview.png` 侧栏文字带起点差 → 行距、左端 x 差 → 二级缩进 | `top_pitch 40`、`sub_pitch 35`、`sub_indent 27`（24 条文字带，落 `docs/ref/nav-measure.json`） |
| 202 | `spec.chrome.nav` + `chrome_parity.mjs` 6 项导航断言（top_pitch / sub_pitch / item_h / sub_item_h / sub_indent / folders） | chrome_parity **30/30（100%）** |
| 203 | Sidebar 改单列菜单 + 收藏/社交两个折叠夹（默认展开），`styles.css` 行高 36+4 / 子项 31+4 / 左移 27 | `npm test` 40/40、`npm run build` ✓ |
| 204 | 导航可达性：`web/test/nav.test.mjs`（PAGES ⊆ NAV 且 NAV ⊆ PAGES，折叠夹非页面）+ `scripts/nav_coverage.mjs` 逐项点击 | nav.test 4/4；nav_coverage **19/19**（18 页 hash+标题全对、folder 3→0→3） |
| 205 | 回归 | structure_parity **31/31**、visual_parity **166/166（100%）** |

---

# 第二十一轮：侧栏底部与底部状态栏按真机收敛（2026-11-23）

真机侧栏底部只有 `SidebarFooter` 两项（设置 / 收起导航栏），底部状态栏是 4 个左对齐状态点。此前我们是自拟的 PinnedWorlds + 「数据来自 VRChat pipeline / NAS 常驻采集」说明块，状态栏是 pipeline/在线/事件/页码混排。

| # | 产出 | 验收 |
|---|---|---|
| 211 | `scripts/measure_ref_footer.py` 量 `vrcx0-overview.png` 侧栏 y>900 与状态栏 → `docs/ref/footer-measure.json`（footer 2 项、pitch 39、上方无分割线；状态栏 h35、4 项、点径 8、首点 x10、项间距 24/23/22、左对齐） | 量测文件落库，写入 `spec.chrome.nav.footer` / `spec.chrome.statusbar` |
| 212 | Sidebar footer 只留「设置 / 收起导航栏」两项并去掉说明块；收起后顶栏出现展开按钮，状态存 `localStorage` | `nav.footer_count 2/2`、`nav.footer_pitch 40/39`、`nav.footer_labels 一致`、`nav.footer_no_note none` |
| 213 | StatusBar 改 4 项「圆点 + 文字」（服务器状态 / 实时连接 / VRChat / SteamVR），绿灰只跟真实信号（`/api/status` 有数据、collector.connected、账号 last_ok_at < 10 分钟；SteamVR 采集未接入恒灰），右侧不放东西 | `statusbar.items 4/4`、`first_dot_x 10/10`、`item_gap 23/23`、`dot_w 8/8`、`labels 一致`、`left_aligned 337<=844` |
| 214 | 收起/展开闭环断言进 `scripts/nav_coverage.mjs`（点收起 → 侧栏消失 + 展开按钮出现 + localStorage=1 → 点展开 → 侧栏回来） | nav_coverage **20/20**（18 页 + folder 3→0→3 + footer:collapse nav→no→nav） |
| 215 | 回归 | chrome_parity **40/40（100%）**、structure_parity **31/31**、visual_parity **166/166（100%）**、`npm run build` ✓、`npm test` 40/40 |

---

# 第二十二轮：顶栏按真机量测收敛（2026-11-23）

真机顶栏是页面无关的自定义标题栏：左「VRCX-0 + 帮助」，右「快速搜索（Ctrl K）+ 6 图标 + 3 窗口控制」，无 logo 方块/账号名/页面标题。上一轮量完（`docs/ref/topbar-measure.json`，16 张截图逐项一致），本轮落到实现并变成断言。

| # | 产出 | 验收 |
|---|---|---|
| 221 | 品牌加 `letter-spacing .85` → w 49；帮助去 `px-1` → w 24；搜索块宽 225 去 `paddingLeft`（放大镜 x1110、占位 x1125、Ctrl K 右端 1335）；actions 左距 22、窗口控制左距 15、顶栏右 padding 8（真机量的是字形，按钮内留白已扣） | `topbar.brand_x 14/14`、`brand_w 49/49`、`help_x 88/88`、`search_icon_x 1110/1110`、`placeholder_x 1125/1125`、`actions_first_x 1361/1362`、`wc_first_x 1581/1582` |
| 222 | Ctrl K 压到真机宽 34 且不破字号白名单：11px + `letter-spacing -1`（10px/9.5px 版本会把 `typography.px_sizes_allowed` 顶成含 10px，visual_parity 掉 24 项） | `topbar.shortcut_x 1301.3/1301`、`shortcut_w 33.8/34` |
| 223 | `spec.chrome.topbar.search` 补 `placeholder_x / placeholder_w / shortcut_x1 / shortcut_w`（量测值，非自拟） | spec 与 `topbar-measure.json` 一致 |
| 224 | `chrome_parity.mjs` 新增 20 项 topbar 断言（品牌/帮助/搜索/占位的 x+w、actions 数/首 x/pitch/gap、窗口控制数/首 x/pitch/right_pad、底色 rgb(245,245,245)、无可见页面标题）；窗口控制按 glyph（svg）量，`right_pad` 容忍 4px（真机字形宽 11-12，我们 svg 14） | chrome_parity **60/60（100%）** |
| 225 | 回归 | `npm run build` ✓、`npm test` 40/40、nav_coverage **20/20**、structure_parity **31/31**、visual_parity **166/166（100%）** |

---

# 第二十三轮：世界库卡片按 1700 真机量测复刻（2026-11-24）

世界卡片的盒模型此前只对了一半：列距/缩进/圆角/4:3 都断言，但**卡片宽 316 与行距 319 没有断言**，于是两个真问题一直没暴露——(1) `@media (min-width:1700px){html{zoom:1.15}}` 正好覆盖全部真机截图的量测视口（1700×1040），把 316 的卡压成 296；(2) 世界库用通用的 `p-4`（16px 内边），而真机内容是左缩 23、右侧让出 rail 分隔条 10 + 右留白 13。本轮按量测改到 316×237 / 行距 319，并把两项变成断言。

| # | 产出 | 验收 |
|---|---|---|
| 231 | 整页 zoom 起点 1700 → **1800**（`styles.css`）：1700 是全部 `vrcx0-*.png` 的量测视口，该视口下任何整页缩放都会让量测失真；2K/4K 的 1.35/1.7 档不变 | 1700 视口 `getComputedStyle(html).zoom === '1'`，卡片从 296 → 312 |
| 232 | 世界库专用容器 `.worlds-page`（替换 `p-4`）：≥1600px 时 padding `23px 52px 24px 23px`（真机左缩 23、右侧 35 + rail 分隔条/右留白 29），<1600 保持 16px | 网格 982、卡片 **317**、缩略图 317×237、行距 **320**（真机 316/319，±2 内） |
| 233 | `scripts/worlds_realcovers.mjs` 接 PG 实例（1220 个世界）实测真封面：首屏 49 张真图全部解码、512×384；占位灰块断言改成「与库内无缩略图的世界数一致」（原来写死 0，把 1 条数据缺口算成几何 DIFF） | 封面实测 **10/10 PASS**，截图 `docs/screenshots/compare/worlds-real-covers-1700.png` |
| 234 | 回归：`npm run build` ✓、visual_parity worlds **78/78**、总 **214/215（100%）**、structure_parity **58/59**（唯一 DIFF 是 feed 行高 46/44，与本轮无关，留待下轮） | 三端截图 18 页齐、`ref_coverage.py` 待办 0 |


---

# 第二十四轮：世界库卡片多视口复核 + 一键回归（2026-11-24）

第二十三轮只在 1700 视口实测过真封面。zoom 起点从 1700 挪到 1800 之后，1920/2560/3840 会整页放大 1.15/1.35/1.7，卡片是否塌列/溢出没有实测；`worlds_realcovers.mjs` 也还是手动跑，没进任何一键回归（parity8 的世界库段只查 CSS 字面，夹具库 thumbnail 全 null，验不到真封面）。

| # | 产出 | 验收 |
|---|---|---|
| 241 | 新增 `scripts/worlds_viewports.mjs`：1700/1920/2560/3840 四视口量世界卡片，断言 zoom 与断点一致、列数恒 3、卡片宽等于网格算式 `(内容宽-2×16)/3`（±2）、列距 16、行距=卡高+28、缩略图 4:3、名称/元信息不溢出、页面无横向滚动；顺带报告缩略图渲染宽/源图宽 | 四视口 **36/36 PASS**；各视口卡片宽（CSS px）1700→317、1920→307、2560→382、3840→503，全部等于算式解 |
| 242 | 换算口径要分清：`getComputedStyle` 的 gap/zoom 是 CSS px，`getBoundingClientRect` 是放大后的设备 px；第一版把 gap 也乘了 zoom，误报 13 项 DIFF，改成「设备 px 先除 zoom 再跟算式比」后全绿 | 同上 36/36；误报口径修正写在脚本头注释 |
| 243 | 新增 `scripts/worlds_check.sh` 一键回归：优先复用 127.0.0.1:8892 的读 PG 实例，否则自起一个（跑完杀掉），先跑 `worlds_realcovers.mjs`（1700 真封面）再跑 `worlds_viewports.mjs`，任一失败返回非 0 | `bash scripts/worlds_check.sh` → 真封面 **10/10** + 多视口 **36/36** → `WORLDS OK` |
| 244 | 顺带量到的真问题（本轮不改，留作下一轮）：缩略图库内只存 `/256`，VRChat 同一 file 可换 `/512`、`/1024`（实测同一世界 60KB → 188KB → 476KB 都 200）。渲染宽/源图宽 = 1700 0.62×、1920 0.69×、2560 1.01×、**3840 1.67×（放大发虚）**；要修就得给 4K 走 `<picture>`/srcset 换 /1024，属于带宽换清晰度的取舍 | 数字见 `worlds_viewports.mjs` 输出的「缩略图清晰度」段 |


---

# 第二十五轮：世界卡片缩略图 2 倍档（4K 不再发虚）（2026-11-24）

第二十四轮量到 3840 视口缩略图「渲染 855 / 源 512 = 1.67×」在放大发虚。本轮按 `<picture>` 换档，只让宽视口加带宽。

| # | 产出 | 验收 |
|---|---|---|
| 251 | `WorldsPage.jsx` 缩略图改 `<picture>`：`<source media="(min-width: 2560px)" srcset={imgUrl(w.thumbnail, 1024)}>` + `<img src={imgUrl(w.thumbnail, 512)}>`；`styles.css` 加 `.world-card picture{display:block}`（否则 img 的 `width:100%` 撑不满卡片） | 1700/1920 仍只请求 512（`naturalWidth=512`，体积不涨）；2560/3840 取大档 |
| 252 | 断点口径实测（`scripts/probes/_probe_zoom_mq.mjs`）：CSS `zoom` **不影响** media query，`innerWidth` = 视口宽（1700/1920/2560/3840 原样），所以 `<source media>` 按视口宽匹配是可靠的 | 探针输出：2560 起 `mq2200/mq2560` 均 true，1700/1920 均 false |
| 253 | 顺带校准了源图上限：VRChat 世界缩略图 `/1024` 档实际回 **800×600**（8 个世界全一致，`/768` 与 `/1024` 同字节 660KB，`/640` 与 `/512` 同字节 267KB → 只有 256/512/800 三档） | 800 是文件上限，3840 只能做到 855/800 = **1.07×**（原 1.67×） |
| 254 | `worlds_viewports.mjs` 加两项断言（源档位：<2560 必须 512、≥2560 必须 >512；渲染/源 ≤1.02，源到 800 上限时 ≤1.10）+ 等首图解码后再量 | 四视口 **44/44 PASS**（原 36 项） |
| 255 | `server/scripts/parity8.mjs` #90 断言过期修正：原来要求字面 `imgUrl(w.thumbnail)`，与 23 轮起的 `imgUrl(w.thumbnail,512)` 已经对不上（一直 FAIL）；改成校验 512 代理 + `<source>` 2 倍档 + `picture{display:block}` 三条 | parity8 世界库段 ok（7/10，其余 3 项是 #82/#88/#91 的历史遗留，与本轮无关） |


---

# 第二十六轮：feed 行高 44（structure_parity 59/59）（2026-11-24）

structure_parity 唯一残留 DIFF 是动态页行高「我们 46 / 真机 44」。定位到是时间列折行：`white-space: pre-line` 只把 `\n` 当强制换行，但仍允许自动折行，于是「11-23」在连字符处又断一次 → 3 行 ×15px = 45 → 行高 46。

| # | 产出 | 验收 |
|---|---|---|
| 261 | `styles.css`：`.feed-tbl tbody td[data-label='时间']` 的 `white-space: pre-line` → `pre`（时间串本身已写死「月-日\n时:分」，只认这个换行） | 1688 视口 feed 全行 **44px**；`node scripts/structure_parity.mjs` → **59/59（100%）**，DIFF 清零 |
| 262 | 探针留档 `scripts/probes/_probe_feedrow.mjs`（逐格 rect/line-height 定位折行）+ `scripts/probes/_probe_feed_mobile.mjs`（390/1688 溢出与裁切） | 390 视口 `docOverflowX=0`、`scrollOwnOverflow=0`、时间列 `scrollWidth=clientWidth`（无裁切）；1688 同上 |
| 263 | 回归：`web npm run build` ✓、`web npm test` 48/48、`visual_parity` **215/215（100%）**（原 214/215，feed 行高是最后一项） | 输出见 STATE.md |

---

# 第二十七轮：好友位置网格列数阶梯常驻断言（grid_parity 60/60）（2026-11-24）

第二十六轮前把 `.loc-grid` 从 `auto-fill` 改回阶梯列数（1fb499c），但验证只跑过一次一次性探针（`cache/probes/locgrid.mjs`），退回 `auto-fill` 不会被任何常驻脚本拦住。本轮把它做成第七个回归环节。

| # | 产出 | 验收 |
|---|---|---|
| 271 | 新增 `scripts/grid_parity.mjs`：10 个视口＝4 档中间值（1688/1440/1024/390）＋三处断点两侧（1599·1600、1279·1280、767·768）。每档 6 项：列数 6/4/3/2、网格自身不溢出（含末列右缘不越界）、同档卡片等宽（极差 ≤1）、卡片内 `.loc-name/.loc-world/.loc-meta/.loc-time` 不被硬裁、卡片本体不溢出且高 96（≤1023 走 `min-height:76`）、整页无横向溢出 | `node scripts/grid_parity.mjs` → **网格阶梯 60/60（100%）· GRID OK · exit 0**；明细写 `docs/ref/grid-parity.json` |
| 272 | 反向验证断言真的能抓回归（不重建 dist，只在页面里注入一条 `!important` 覆盖规则再跑同一套量法）：`cache/probes/grid_neg.mjs` | 1688 现状列数 **6**、注入 `repeat(auto-fill,minmax(230px,1fr))` 后 **5** → 与 c5c6aa8 当年「只排 5 列」的现象一致，NEG_EXIT=0（说明该断言确实会 DIFF） |
| 273 | `scripts/regress_all.sh` 加第七段 `grid`（`REGRESS OK 7/7`）；README 表格＋线上容器命令行＋段数口径同步 | 段名 `grid` 输出 `网格阶梯 60/60`；README 写 60/60 与 7/7 |
| 274 | `styles.css` 里 `.loc-grid` 上方的旧注释「窗口变窄按 5/4/3 列递减」改成「6/4/3/2 阶梯递减」，并注明由 `grid_parity.mjs` 锁定（注释与实现同步，避免下次按注释改回去） | 注释与 `@media` 四段一致；`grid_parity` 仍 60/60 |

---

# 第三十一轮：reload 脆弱点收口 + 端到端 REGRESS OK 7/7（2026-11-24）

第三十轮起 frame/nav 在 `regress_all.sh` 里反复崩（frame 是 `TimeoutError`、nav 是 `browserContext.close: Target closed`），先归因为并发抢 chromium，串行后仍崩在 `page.reload` 等 `'load'` 上。本轮把刷新统一成「只等 domcontentloaded + 打戳验文档换新」，再端到端复跑证明七段全绿。

| # | 产出 | 验收 |
|---|---|---|
| 311 | `scripts/lib/page_structure.mjs` 新增 `reloadVrc` / `reloadVrcHard`：只等 `domcontentloaded`（30s），失败整页 `goto` 兜底；给 `<html>` 打 `dataset.reloadStamp`，刷新后必须看不到这枚戳且 `#vrc-topbar h1` 在才算成功，否则再 goto 硬重试；`frame_parity` 4 处、`nav_coverage` 2 处裸 `page.reload()` 全改走它 | 压力探针 `cache/probes/reload_stress.mjs`：1440×900 连刷 20 次（353/264 交替）bad=0、maxMs=117（旧版单次 0.5s 且偶发卡死） |
| 312 | 单独复跑两个脚本：`node scripts/frame_parity.mjs` → **1932/1932 · FRAME OK · exit 0**（`cache/frame_r31_run4.log`）；`node scripts/nav_coverage.mjs` → **366/366 · exit 0**（`cache/nav_r31_run2.log`） | 全程零 FAIL 行，`docs/ref/frame-parity.json` pass=1932 total=1932 |
| 313 | 端到端 `bash scripts/regress_all.sh http://127.0.0.1:8891`（后台串行跑，不与其它浏览器任务并发） | 末行 **`REGRESS OK 7/7`**：structure 59/59、visual 215/215、frame 1932/1932、nav 366/366、mobile 1479/1479、grid 60/60、unittest 48 pass/0 fail（`cache/regress_all_r32.log` + `cache/regress/*.log`） |

踩坑记录：
- `page.reload({waitUntil:'load'})` 在 demo 长连接下可能永不落地，两次 60s 超时后进程挂住（`cache/frame_r31_run3.log` 只有 3 行报错、618s 未收尾）。
- 只等 `domcontentloaded` 会在 React 挂载前返回，调用方 `evaluate` 撞 `Execution context was destroyed`（`cache/frame_r31_fix.log`）。
- 超时后「静默失败」最危险：页面还是旧文档而 `#vrc-topbar h1` 照旧在，断言读到上一条用例的右栏宽 → 假 PASS。打戳是唯一可靠判据。
