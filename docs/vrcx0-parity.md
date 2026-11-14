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
| 21 | 全局搜索 | ⌘K / Ctrl+K 命令面板：好友、世界、玩家统一搜 | `/api/search?q=` 三类结果非空；面板可键盘选择 | todo |
| 22 | 世界详情 | 点世界名 → 详情页：作者、容量、在线好友数、我去过几次 | `/api/world/:id` 含 author/capacity/online/visits | todo |
| 23 | 好友详情 | 点好友 → 抽屉：资料、最近事件、常一起出现的世界 | `/api/friend/:id` 含 profile/events/worlds | todo |
| 24 | 时间线筛选 | 动态页按事件类型 + 时间范围筛选，滚动分页 | `/api/events?kind=&since=&limit=` 生效 | todo |
| 25 | 数据导出 | 好友/事件/玩家 导出 CSV | `GET /api/export/friends.csv` 200 且首行表头 | todo |
| 26 | 统计增强 | 7/30 天切换 + 24 小时×7 天热力图 | `/api/stats?days=7` 返回 hourly 矩阵；页面可切 | todo |
| 27 | 通知管理 | 已读/未读、全部标记已读、按类型过滤 | `/api/notifications?unread=1` + `POST /api/notifications/read` | todo |

## 第二轮完成定义

1. 上表 7 项 `todo` → `done`
2. `bash scripts/parity2_check.sh` 全绿
3. `npm run build` 成功、`node scripts/smoke.mjs` 输出 `SMOKE OK`
4. 仍不 push / 不改线上容器（由主 agent 统一发布）
