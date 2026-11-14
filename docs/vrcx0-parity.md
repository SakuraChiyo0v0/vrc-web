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

