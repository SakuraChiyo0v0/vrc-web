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

七段全过才打印 `REGRESS OK 7/7`，任一失败 exit 1，明细在 `cache/regress/<环节>.log`：

| 环节 | 脚本 | 现在跑出来的数 |
|---|---|---|
| 桌面结构 | `node scripts/structure_parity.mjs` | 59/59 |
| 桌面视觉 | `node scripts/visual_parity.mjs` | 215/215（100%） |
| 主框架/导航密度 | `node scripts/frame_parity.mjs` | 1932/1932（9 视口 × 浅/深色 × 展开/收起，收起态也跑整套外壳断言；展开态逐页也量外壳（顶栏39/状态栏35/内容区填满/侧栏宽恒 214|277），展开态收放折叠夹不动内容列/外壳、600 高矮窗 nav 滚到底不带动整页，浅/深色收起都逐页做溢出 + 顶栏39/状态栏35/内容区填满中间段 + 内容列 ≥720 + 表格密度对比；新 context 必须默认展开；浅/深色收起都验收起 × 右栏开关与收起态 friends，收起态右栏恒 353 且与展开态相等；右栏自身折成 36px 竖条时手柄消失、内容列接过 353−36 且不溢出（≥1440 三档）；同一视口浅/深色收起的面板宽必须相等） |
| 导航可达 | `node scripts/nav_coverage.mjs` | 366/366（4 视口 × 浅/深色 × 45，含命中测试、折叠夹子项不可点/展开可点、展开按钮几何、reload 持久化、收起态 Ctrl+1..9 跳页、收起态 `?` 快捷键表跳页组 9 项且 Esc 关掉后仍收起、收起态 Ctrl K 命令面板打开/聚焦/不抢数字键/过滤归零/Esc 后仍收起/粘贴 wrld_ ID 回车开抽屉、展开态 Ctrl K 上下选/Enter 开抽屉/点遮罩关/鼠标点结果行/Esc 不改 hash、展开态 Ctrl+1..9 逐键跳页且当前项高亮、展开态 `?` 表且 Esc 后侧栏/高亮原样、展开态 reload 仍展开、收起侧栏 × 右栏折成 36 竖条互不干扰） |
| 移动断点 | `node scripts/mobile_parity.mjs` | 1479/1479 |
| 网格列数阶梯 | `node scripts/grid_parity.mjs` | 60/60（10 视口：4 档中间值 + 3 处断点两侧；每档 6 项） |
| 前端单测 | `cd web && npm test` | 48 pass |

单独只跑移动断点：

```bash
node scripts/mobile_parity.mjs                 # 默认 http://127.0.0.1:8891，任一 FAIL exit 1
```

一次性探针（历史排查留档，不参与回归）统一放在 `scripts/probes/`：58 个 `_probe_*.mjs`，用法 `node scripts/probes/_probe_xxx.mjs [baseUrl]`（引 `../lib/page_structure.mjs`）。`scripts/` 顶层只留正式回归脚本和截屏/采集工具，别再往顶层加探针。

### 跑线上容器

五个脚本可以直接指向线上容器，不必先起 demo：

```bash
node scripts/frame_parity.mjs    http://172.30.0.7:8790/vrc/   # 1932/1932
node scripts/structure_parity.mjs http://172.30.0.7:8790/vrc/  # 59/59
node scripts/nav_coverage.mjs    http://172.30.0.7:8790/vrc/   # 366/366（逐视口点侧栏项 + 命中测试）
node scripts/mobile_parity.mjs   http://172.30.0.7:8790/vrc/   # 1479/1479
node scripts/grid_parity.mjs     http://172.30.0.7:8790/vrc/   # 60/60（.loc-grid 列数阶梯）
```

两条硬规则（`scripts/lib/page_structure.mjs`）：

- **接口去尾斜杠、页面补尾斜杠**：接口地址走 `normBase()`（否则拼出 `/vrc//api/roster` 回 403，被误判「不是本服务」）；hash 路由的页面地址走 `pageBase()`（`/vrc#/settings` 会被服务端当 `GET /vrc` 回 404 JSON，而预检照样 200，整轮截成同一张 404 页）。
- **首屏断言 `assertVrcPage()`**：root 为空或 body 出现 `"statusCode":404` 直接 exit 2，不允许在假页面上量出分数；`gotoVrc()` 只对 `chrome-error://` 重试 3 次（容器瞬断），404/白屏仍硬拦。`assertVrcPage()` 自身对 `Execution context was destroyed`（页面还在做一次跳转）重试 3 次，别把瞬跳当白屏。

### 导航可达性口径

`nav_coverage.mjs` 默认跑 4 个桌面视口（1688×1028 / 1366×768 / 1100×800 / 1024×768），每个视口把侧栏 18 个页面项全点一遍（`hash`、顶栏标题对得上方算过、不许蹦错误边界），外加折叠夹收起/展开（收起后子项不在 DOM、旧坐标处也点不到；展开回来命中测试过且真能点进那一页）、「收起导航栏」以及收起后**再展开还原**（当前页那一项仍高亮、仍过命中测试、再点不换页），还有**收起态快捷键**：逐个按 Ctrl+1..9，每个数字的 hash 必须等于 `web/src/lib/shortcuts.js` 的 `PAGE_ORDER[d-1]`（不拿 DOM 顺序当期望，否则快捷键表和侧栏顺序错位会一起放过）、顶栏标题跟变、侧栏仍不出现、展开按钮还在；最后展开回来当前项已高亮且过命中测试；收起态还验 **`?` 快捷键表**（收起侧栏后记不住数字键只能看这张表）：按 `?` 打开面板、`跳页` 组必须正好 9 项且标签与按键顺序都跟着 `PAGE_ORDER` / `PAGE_LABEL` 走（从源文件解析，不从 DOM 反推）、面板整块落在视口内、Esc 关掉后仍是收起态，再按 Ctrl+5 照旧跳到 `PAGE_ORDER[4]`。收起态还验 **Ctrl K 命令面板**（收起后找东西只剩这一条路）：按 Ctrl K 面板打开、输入框已聚焦、侧栏不回来、整块落在视口内；面板开着时 Ctrl+3 不许偷偷跳页（`App.jsx` 的 `if (palette) return`）；输入无匹配串结果必须归 0 并给空态文案；Esc 关掉仍收起、再 Ctrl K 能再开；粘贴 `wrld_` ID → 置顶「直接打开」→ Enter 关面板并真开世界抽屉（带该 ID），关掉抽屉仍是收起态。「收起导航栏」与顶栏展开按钮本身也要过命中测试（`elementFromPoint` 落在按钮内），顶栏展开按钮还必须整颗落在顶栏内、与「快速搜索」横向不相交且搜索中心仍命中自己（收侧栏顶上多一个按钮，最容易挤坏这簇），且收起后 **reload 仍是收起**（`localStorage.vrc-nav-collapsed=1`，刷新不弹回展开）。矮窗下侧栏要靠滚动，所以每项先 `scrollIntoView` 再做**命中测试**：行框中心点 `elementFromPoint` 必须落回该项自己，且整行落在 `<nav>`（页脚项则用 `[data-nav-footer]`）可视区内 —— 挡住「JS click 能过、人点不到」。每档视口默认再跑一遍**深色主题**（`localStorage.vrc-theme=dark`）：点得到、标题对、折叠夹收放、收起导航栏回升，主题下同样成立；`NAV_THEME=light` 只跑浅色。展开态再补**快捷键与？表**：逐个按 Ctrl+1..9 必须跳到 `PAGE_ORDER[d-1]`、标题跟变、**侧栏始终在位**、当前页那一项 `data-active=true` 且过命中测试（侧栏在场时「高亮没跟快捷键走」最容易复发），reload 后仍是展开（`vrc-nav-collapsed` ≠ 1，与收起态那条互为对照）；按 `?` 打开快捷键表时侧栏与当前页高亮不许被弄丢、跳页组同样 9 项且顺序按 `PAGE_ORDER` / `PAGE_LABEL`，Esc 关掉后侧栏/高亮原样、再按 Ctrl+7 照旧跳到 `PAGE_ORDER[6]`。展开态 Ctrl K 另验**鼠标点结果行**（另一条入口，别只测键盘）：输入 `a` 后点「好友」组第一行中心 → 面板关、好友抽屉开、抽屉名字=那一行 label、侧栏在位、hash 不变；以及**Esc 关面板不改 hash**（输入无匹配串后 Esc，hash 必须与打开前逐字相同）。`NAV_VIEWS=all` 跑 9 个视口（与 `frame_parity` 同口径，含 1024×600 / 1280×600 两档矮窗，828/828），`NAV_VIEWS=1688x1028,1440x900` 自定义。

### 框架状态的两种额外形态

`frame_parity` 除默认「浅色 + 侧栏展开」外，同一批 9 个视口再跑两轮：

- **深色主题**（`localStorage.vrc-theme=dark`）：跑与浅色**同一套** `assertFrame` —— 侧栏 214|277、顶栏 39、状态栏 35、导航行 36/31、文本列 30、页脚两项可见且不被状态栏盖、状态栏 4 项（x=10 / 间距 23）、右栏只在 ≥1440 出现、顶栏右簇间距（kbd 34 / 22 / 15 / 3×24 pitch40 / 末项 8）、内容 ≥720、无横向溢出 —— 切主题只许改色，几何漂移一律算回归。
- **收起侧栏**（点 `nav-collapse`）：侧栏整列消失、顶栏展开按钮可见、内容区恰好让出 214|277px、无横向溢出；**同一套 `assertChrome` 也跑一遍**（顶栏 39 / 状态栏 35 与 4 项项距 23 / 顶栏右簇 kbd 34 · 22 · 15 · 3×24 pitch40 · 末项 8 / 右栏显隐 / 内容 ≥720）——收起后顶栏簇错位、状态栏少一项这类问题，此前只在展开态才量得到。
- **收起态跑两遍**：浅色收起（第一轮页面上直接收起，不必重载）与深色收起（组合态），主题与折叠互不影响几何。
- **收起 × 右栏开关**（≥1440）：收起后点顶栏 `roster-toggle` 关右栏 → 内容列正好多出右栏宽（353）、`.workspace` 不变宽、无溢出，再开回来原样；浅色收起与深色收起**各跑一遍**。收起态 `friends` 页还要断言右栏不渲染（`App.jsx: roster && page !== 'friends'`）、内容仍 ≥720、无溢出。
- **主题不改宽度**：同一视口浅色收起与深色收起的内容面板宽、右栏宽必须逐像素相等。
- **收起态逐页密度**：收起后把 6 个页面再走一遍，每页都要无横向溢出、内容列仍 ≥720（收起是让宽，不是把内容挤窄）；有表格的页面（动态 / 好友列表）还要列数不变、首列不变窄、行数不变 —— 内容区变宽不该靠牺牲密度换。浅色收起与深色收起**各跑一遍这套**（主题不该改密度）。收起态右栏宽恒 353 且与展开态基线相等（关掉再开回来也不变）。
- **展开态收放折叠夹**：侧栏折叠夹（收藏 / 社交）全收起 → 子项归 0，而侧栏宽、内容列宽、顶栏 39、状态栏 35、内容区 y·h 一律不变、无横向溢出，展开回来复原；浅色与深色各跑 `feed`、`friends` 两页（侧栏是独立列，收放夹子触发的重排最容易把内容列挤窄或把整页推宽）。
- **矮窗 nav 滚动不带动整页**（600 高两档）：`<nav>` 滚到底（`scrollTop>0`）后 `window.scrollY` 仍 0、顶栏仍在 y0、内容区 y/h 不变、末项整行落在 `nav` 可视区内、内容区顶部 `elementFromPoint` 仍命中 `.workspace` 内元素 —— 挡住「导航一滚整页跟着滑」「粘性顶盖住内容」。
- **新 context 必须默认展开**：不带 `localStorage` 的干净 context 里侧栏要在、不能出现顶栏展开按钮、`vrc-nav-collapsed` ≠ `1` —— 收起只能由用户点出来。

每档视口项数：主轮初始化 9 项（3 项默认展开 + 6 页溢出）+ 浅色展开 60 项（外壳/侧栏几何 36 + 6 页逐页外壳 24：顶栏39/状态栏35/内容区填满/侧栏宽恒 214|277）+ 浅色收起 39 项（外壳/折叠 + 6 页溢出 + 6 页内容列 ≥720 + 6 页顶栏/状态栏/内容区填满 + 2 页表格密度 + 收起态 friends 2 项）+ 深色展开 24 项 + 深色收起 55 项（浅色收起那套 + 主题标记 + 浅/深同宽），≥1440 的三档每档再加「收起 × 右栏开关」组合 5 项（内容列让宽/复原/无溢出/右栏恒 353 与展开态相等/aside 仍收起）；展开态另加折叠夹收放 12 项（两页 × 3 断言 × 浅/深）+ 矮窗 nav 滚动 8 项（仅 600 高两档 × 浅/深 × 4 断言）；合计 1932 项（取自 `docs/ref/frame-parity.json` 的 per-view 计数：600 高两档各 211、1440×900 226、1600×900 与 1700×1040 各 236、其余 4 档各 203）。≥1440 三档另跑「右栏自身折成 36px 竖条」3 断言 × 浅/深（原只 ≥1600 两档）：点 ⋯ 折叠后 rail 宽 36、拖宽手柄消失、内容列正好接过让出的 353−36 且面板总宽不变/无溢出；在竖条左缘按下左拖 120px 宽度/内容列/localStorage 全不动；点 ‹ 展开回原宽且手柄回来。另加「右栏宽记忆脏值/越界回落」7 例 × ≥1440 三档浅色：`vrc-roster-w` 写 `abc` / `99999` / `-5` / `0` 必须回落 353，写 `264` / `280` / `770` 原样生效，且内容列 = workspace − 右栏宽、无横向溢出、拖宽手柄仍在，跑完复位 353 再 reload。右栏是 `.workspace` 内部的 flex 列，关掉它面板本身不变宽、让出来的是内容列（353px）。右栏在 `friends` 页刻意不渲染（`App.jsx: roster && page !== 'friends'`），所以右栏显隐/宽度量测固定停在 `settings`，其余外壳项（顶栏/状态栏/内容区高度/侧栏宽）逐页跑。600 高的两档矮窗（1024×600 / 1280×600）单列进来，因为导航 21 行 × 40 = 840 远超可用高，是「行高被 flex 压扁」最容易复发的区间。

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
