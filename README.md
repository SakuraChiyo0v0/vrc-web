# vrc-web

自建的 VRChat 数据面板：NAS 常驻采集好友动态与游戏内日志，浏览器查看，数据落 PostgreSQL 或 SQLite。

## 数据库：一套代码，两种后端

| 环境 | 连接串 | 说明 |
|---|---|---|
| 服务器（NAS） | `postgres://user:pass@host:5432/db` | schema `vrc`，首次启动自动建表 |
| Windows / 本机 | `sqlite:./data/vrc.db` | 零依赖，文件不存在自动建 |

判定规则：连接串以 `sqlite:` 开头、或等于 `:memory:`、或结尾是 `.db` / `.sqlite` → SQLite，其余按 PostgreSQL。
两个连接串都不给、又读不到 `VRC_DB_URL_FILE` 时，自动落到 `sqlite:./data/vrc.db`（本机开发零配置）。

代码里只写 `?` 占位符的 SQL，适配层负责翻译（`$1..$n`）、时间类型（timestamptz ↔ ISO 字符串）、
布尔（boolean ↔ 0/1）、JSON（jsonb ↔ TEXT）和表名前缀（`vrc.friend` ↔ `friend`）。
会话、统计这类需要方言函数的计算全部在 JS 里做，所以两端结果一致。

## 能做什么

- **好友位置**：谁在线、在哪个世界、状态与平台
- **动态**：上线 / 下线 / 换房 / 资料变更的实时流水
- **我的行程**：进出过的世界与停留时长
- **玩家**：同房遇到过的人（需要 PC 端日志代理）
- **统计**：近 24 小时事件分布与最热闹的世界
- **通知**：邀请、好友请求、群公告

## 数据从哪来

| 通道 | 内容 | 部署位置 |
|---|---|---|
| VRChat pipeline WebSocket | 好友上下线、换房、头像、状态、通知 | 服务器常驻 |
| VRChat REST API | 好友资料、世界信息（缓存） | 服务器常驻 |
| VRChat `output_log_*.txt` | 房间内玩家进出、播放的视频 | PC 端 `agent/agent.mjs` |

游戏内日志只能在装了 VRChat 的机器上读，所以那部分由一个单文件 agent 推上来；不开 agent 时其余功能正常，只是缺房间内细节。

## 部署

```bash
docker run -d --name vrc-web --restart unless-stopped \
  -p 8790:8790 \
  -e VRC_SESSION_FILE=/secrets/vr-session.json \
  -e VRC_DB_URL_FILE=/secrets/db-url \
  -e VRC_INGEST_TOKEN_FILE=/secrets/ingest.token \
  -v /path/to/vr-session.json:/secrets/vr-session.json:ro \
  -v /path/to/db-url:/secrets/db-url:ro \
  -v /path/to/ingest.token:/secrets/ingest.token:ro \
  ghcr.io/sakurachiyo0v0/vrc-web:latest
```

三个文件：

- `vr-session.json`：`{"cookie": "<VRChat auth cookie>", "userId": "usr_...", "displayName": "..."}`
- `db-url`：`postgres://user:pass@host:5432/db`
- `ingest.token`：任意随机串，PC 端 agent 用它鉴权

首次启动自动建表（PostgreSQL 建在 schema `vrc`，SQLite 直接建在当前库）。

本机开发（Windows / macOS / Linux 都行，不需要装数据库）：

```powershell
set VRC_DB_URL=sqlite:./data/vrc.db
node server/src/index.js
# 或先灌样例数据看界面
node server/scripts/smoke.mjs
```

## PC 端日志代理

```powershell
set VRC_INGEST_URL=http://<nas>:8790
set VRC_INGEST_TOKEN=<ingest.token 的内容>
node agent/agent.mjs
```

只读 `%LOCALAPPDATA%Low\VRChat\VRChat\output_log_*.txt`，不改游戏文件、不用 mod。

## 接口

```
GET  /api/status          采集器状态 + 账号 + 在线数
GET  /api/friends[?online=1]
GET  /api/events?limit=
GET  /api/sessions        好友会话（从事件流推导）
GET  /api/my-sessions     自己的行程
GET  /api/players         同房遇到的人
GET  /api/stats           近 24 小时统计
GET  /api/notifications
POST /ingest/log          PC agent 上报（x-ingest-token）
```

## 验收

一键回归（需要 `web/dist` 已构建；8891 没起会自动起一个 demo 实例）：

```bash
cd web && npm run build && cd ..
scripts/regress_all.sh                 # 默认 http://127.0.0.1:8891
```

六段全过才打印 `REGRESS OK 6/6`，任一失败 exit 1，明细在 `cache/regress/<环节>.log`：

| 环节 | 脚本 | 现在跑出来的数 |
|---|---|---|
| 桌面结构 | `node scripts/structure_parity.mjs` | 59/59 |
| 桌面视觉 | `node scripts/visual_parity.mjs` | 215/215（100%） |
| 主框架/导航密度 | `node scripts/frame_parity.mjs` | 189/189 |
| 导航可达 | `node scripts/nav_coverage.mjs` | 20/20 |
| 移动断点 | `node scripts/mobile_parity.mjs` | 1479/1479 |
| 前端单测 | `cd web && npm test` | 48 pass |

单独只跑移动断点：

```bash
node scripts/mobile_parity.mjs                 # 默认 http://127.0.0.1:8891，任一 FAIL exit 1
```

### 跑线上容器

四个脚本可以直接指向线上容器，不必先起 demo：

```bash
node scripts/frame_parity.mjs    http://172.30.0.7:8790/vrc/   # 189/189
node scripts/structure_parity.mjs http://172.30.0.7:8790/vrc/  # 59/59
node scripts/nav_coverage.mjs    http://172.30.0.7:8790/vrc/   # 20/20（逐个点侧栏项验可达）
node scripts/mobile_parity.mjs   http://172.30.0.7:8790/vrc/   # 1479/1479
```

两条硬规则（`scripts/lib/page_structure.mjs`）：

- **接口去尾斜杠、页面补尾斜杠**：接口地址走 `normBase()`（否则拼出 `/vrc//api/roster` 回 403，被误判「不是本服务」）；hash 路由的页面地址走 `pageBase()`（`/vrc#/settings` 会被服务端当 `GET /vrc` 回 404 JSON，而预检照样 200，整轮截成同一张 404 页）。
- **首屏断言 `assertVrcPage()`**：root 为空或 body 出现 `"statusCode":404` 直接 exit 2，不允许在假页面上量出分数；`gotoVrc()` 只对 `chrome-error://` 重试 3 次（容器瞬断），404/白屏仍硬拦。`assertVrcPage()` 自身对 `Execution context was destroyed`（页面还在做一次跳转）重试 3 次，别把瞬跳当白屏。

### 已知形态差（不进 FAIL）

真机窗口顶栏右侧有 3 个窗口按钮（最小化/最大化/关闭，合计 120px）。浏览器版现在也放了 3 个**装饰性**按钮（24px、pitch 40，`data-topbar="window-controls"`，不执行真窗控动作），所以「快速搜索 / Ctrl K」簇的相对位置能对齐了；`frame_parity` 锁的是簇内间距而不是绝对 x：`kbd` 宽 34、`kbd→图标组` 22、`图标组→窗口控制` 15、窗口控制 3×24 / pitch 40、簇末项距右缘 8，另加顶栏内容右端 `topbar.right_pad = 8px`、搜索按钮宽 `topbar.search_w = 225px`（允许 200–240）。

真机那条 12px 差已归因清楚：`topbar-measure.json` 是 1689 宽的截图上量的，契约视口是 1700，绝对 x 随宽度整体平移 +11px，不是布局差——所以契约里只留间距，不留绝对 x。

`visual_parity` 另有一条环境判据：真机基准是在种子数据上量的（动态 4 列、模态 8 个 tab、概览 24 格柱、收藏 150 条），真实库数据形态不同，分数无意义 —— 检测到 `/api/health` 的 `db.kind !== 'sqlite'` 时打 `SKIP` exit 3（回归里记 SKIP 不算失败）；确实要在真实库上看就加 `VRC_ALLOW_REAL=1`，结果只作参考。同理，结构断言碰上线上库本身为空的数据（收藏夹 0 条、没有屏蔽/静音记录）记 `SKIP` 而不是 `DIFF`，既混不进分母也不会把线上跑红。

### 移动端验收口径

「移动形态」的条件是**窄（≤1023px）或矮（≤500px）**——手机横屏宽 844 但高 390，平板竖屏 768 又窄到放不下侧栏 277 + 表格，若不看这两个维度会掉回桌面布局（表格右侧被 `overflow-x:clip` 裁掉且滚不出来）。`styles.css` 的 7 个 `@media`、`tailwind.config.js` 的 `md` screen（`(min-width:768px) and (min-height:501px)`）、`Sidebar` 的 `matchMedia` 三处用同一条件，改的时候一起改。

`mobile_parity.mjs` 的覆盖：14 页（spec 的 13 页 + 世界库 `#/worlds`）× 11 视口（竖屏 320/360/375/390/414/430；横屏 844×390、932×430；平板 768×1024、820×1180），外加 1023/1024 与 1024×500/1024×501 两对断点两侧。逐页断言：

- 无横向溢出（`scrollWidth ≤ innerWidth+1`，失败时列出右溢元素）
- 表格卡片化（`thead` 隐藏、`tr` 变 flex 列）
- 触控命中区分层：顶栏按钮与抽屉导航 ≥44、chip 与表单控件 ≥36（含 sessions 的来源框与视图段、设置子导航）、表格单元格/行内链接与表头排序 ≥32
- 字号 ≥11；表单控件 ≥16 防 iOS 聚焦自动放大；日期框内宽 ≥96
- 抽屉默认收起、☰ 开 / ✕ / Esc / 点遮罩关、焦点陷阱、关闭后焦点回 ☰
- 安全区（`env(safe-area-inset-*)`）注入 47/34 后顶栏加高、抽屉与状态栏让位、横屏刘海左右内缩
- 命令面板按 `--app-vh`（`100dvh`）算高度，iOS 地址栏展开时不顶出可视区
- 长列表：开合抽屉 / 旋转后滚动位置保持；极端数据（超长昵称、缺头像、空值）不撑破卡片
- 横屏抽屉底边不压状态栏、顶栏标题不截断
- 软键盘（`visualViewport.height` 压到 380 模拟）：外壳跟 `--app-vh` 缩、状态栏与聚焦输入框仍在可视区、收起即恢复；桌面不介入
- 表单控件中心 `elementFromPoint` 必须命中自己（防被后续表格/卡片盖住，feed 搜索框曾中招）
- 底部状态栏在 320 极窄下最后一段不被裁（移动端 `gap` 23→12 + 横向滚动兜底）
- 横屏 + 软键盘同时存在（844×390 键盘 220 → 可视 170；932×430 → 190）：**14 页逐页矩阵**，每页断言 `data-kb=1`、主内容 ≥60、以及「内容可用」＝至少一块内容元素完整可见（列表页）或首块露出 ≥60px（概览/图表/设置这类整块天然高于 134px 的面板页）；同期让位规则：状态栏隐藏、顶栏 36、feed 工具条只留搜索框、friendlist 隐序号/语言/社交链接、sessions 隐分组头、search 隐子段、settings 隐标题说明


## 已知限制

- 只读：不做加好友、邀请、改状态这类写操作
- 一个 VRChat 账号只允许一条 pipeline 连接，别同时跑两个实例
- 长期 WebSocket 采集在 VRChat 服务条款的灰区，自用为主，控制频率

## License

MIT
