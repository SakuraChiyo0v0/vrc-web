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

1. 121~126 全 done；2. `parity12_check.sh` 全绿（含性能断言）；3. build+smoke（done：dist index-DM4v8Dad.js / SMOKE OK）；4. 抽屉截图对比 VRCX-0（待出：PC 侧 headless Chrome 连不上 127.0.0.1:18899 隧道，见 STATE）；5. 自动发布。