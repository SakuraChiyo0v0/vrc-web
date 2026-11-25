
- [2026-11-24 19:20] 端到端 regress_all 首跑失败，根因是浏览器撞车不是回归红：bash scripts/regress_all.sh http://localhost:8891 → structure 59/59 OK、visual 215/215 OK，frame/nav 双双崩（cache/regress/frame.log=TimeoutError、nav.log=browserContext.close: Target page/context closed）。原因是先前一次前台跑被 300s 预算 kill 后遗留的子进程与 chrome 仍在跑，两个 regress 同时抢同一批 cache/regress/*.log 和 chromium 上下文（frame.log 里同一文件既出现过 FRAME OK 又出现 TimeoutError 即互写证据）。frame_parity 单独一次仍留 1932/1932 的旧证据（上一提交 945be42 之前），不能算本轮实测。

- [2026-11-24 19:22] 探针归位落地：58 个 scripts/_probe_*.mjs 全部 git mv 到 scripts/probes/（git ls-files 与磁盘计数均 58）；5 个引用 ./lib/page_structure.mjs 的探针（_probe_320all/_probe_kb320/_probe_kb_matrix/_probe_topbar_gaps/_probe_under44）import 改 ../lib/；全部 58 个过 node --check 无 SYNTAX_FAIL；docs/vrcx0-parity.md 3 处、scripts/mobile_parity.mjs 注释 1 处路径同步为 scripts/probes/；README 新增「探针统一放 scripts/probes/，顶层只留正式脚本」一段。提交 258b01a。

- [2026-11-24 19:22] 核对上一轮「nav 收起侧栏×右栏36竖条只跑浅色」这条待办：读 scripts/nav_coverage.mjs，rail:collapsed_strip/strip_toggle/strip_unfold 三例在 THEMES 循环内（L98），且 366 = 4 视口×2 主题×45 + 3 例×2 主题，即深色已在跑，这条待办本身不成立，不需要 +18 扩项。

- [2026-11-24 19:22] 下一步：① 单人跑一次干净端到端：先确认 ps 里没有 regress/parity/chrome-headless 残留，再 `bash scripts/regress_all.sh http://localhost:8891 > cache/regress_all_r31.log 2>&1`（前台 timeout 不设 300s 以内、用 background+notify），期望末行 REGRESS OK 7/7，把真实数字写进 STATE；② 若 frame/nav 仍崩，疑似并发或内存（容器 7.4G，playedwright 常驻 4.7G used）→ 串行降到 NAV_THEME 单主题分两次跑，先定位是并发还是单脚本不稳；③ 探针归位后抽 2 个跑过实际执行（不止 --check）：node scripts/probes/_probe_under44.mjs http://localhost:8891 与 node scripts/probes/_probe_topbar_gaps.mjs http://localhost:8891，证 import 路径真能解析，输出落 cache/probes/。

- [2026-11-24 20:30] 定位并修掉 1929/1932 的根因（不是右栏宽校验）：reloadVrc 等 waitUntil 'load'，demo 长连接让 load 永不落地 → 两次 60s 超时后页面仍是旧文档、#vrc-topbar h1 照旧在，调用方读到上一条用例的 353（exp.dirty.264/280 假 FAIL），run3 更是直接挂住 618s 无输出。改法：reload 只等 domcontentloaded(30s) + <html> dataset.reloadStamp 打戳验「文档真换新」，失败整页 goto 兜底（新增 reloadVrcHard）；frame 4 处 / nav 2 处全改 reloadVrcHard，checkRosterDirtyW 把 reload 新鲜度计入断言（detail 标 fresh/STALE）。证据：探针 cache/probes/dirty_reload.mjs 7 例全对、cache/probes/reload_stress.mjs 连刷 20 次 bad=0 maxMs=117（旧版 0.5s 且偶发卡死）；web npm test 48 pass。全量 frame_parity 尚未复跑（预算到顶）。

- [2026-11-24 20:30] 下一步：① 后台单跑 frame_parity 期望 1932/1932 EXIT=0 且日志无 STALE；② 单跑 nav_coverage 期望 366/366；③ regress_all 取 REGRESS OK 7/7；④ README 数字同步 + 补「reload 别等 load」说明后提交（page_structure.mjs + frame_parity.mjs + nav_coverage.mjs + README）

- [2026-11-25 00:50] 动态页表格做成常驻断言（第 34 轮）：新增 `scripts/feed_parity.mjs`（14 项，基线 docs/ref/feed-measure.json），实测 **14/14 · FEED OK · exit 0**（`cache/feed_r1.log`）：列文字起点 77/181/380/549 vs 真机 78/184/382/551、右缘留白 353 vs 358、表头/行高 44、类型四色互异。反向 `FEED_NEG=1`（注入行高 56 + padding 8）→ 11/14、NEG OK 被抓到（`cache/probes/feed_neg.log`）。`regress_all.sh` 加第八段 feed → `REGRESS OK 8/8`；README/docs 口径同步。
- [2026-11-25 00:50] 下一步：等 `cache/regress_all_r41.log` 跑完确认 8/8，把实际末行写进 STATE 并提交（feed_parity.mjs + regress_all.sh + README + docs + STATE）。

- [2026-11-25 02:5x] 第 32 轮（好友位置分栏复刻）主体落地：修两处真机偏差（组头 JPJP 区域重复、私人房间卡显示「未知世界 · 公开」），新增 `scripts/locations_parity.mjs` 17 项分栏断言，实测 17/17 · LOCATIONS OK · exit 0（cache/locations_r2.log），LOC_NEG=1 注入 120 高/3 列 → 15/17 被抓（cache/probes/locations_neg.log）；web npm test 48 pass；regress_all.sh 加第九段 locations（README/docs 口径 9/9 同步）。端到端 `cache/regress_all_r42.log` 仍在跑（structure 59/59 OK 后进入 visual）。
- [2026-11-25 02:5x] 下一步：等 cache/regress_all_r42.log 跑完确认末行 REGRESS OK 9/9，把实际数字写进 docs/STATE 并提交（locations_parity.mjs + locationGroups.js + FriendsPage.jsx + 单测 + regress_all.sh + README + docs + STATE）。

- [2026-11-25 04:0x] 第 33 轮（概览三榜单复刻）：① 修节间距真偏差——`.ov-sec + .ov-sec` 48→115px、`.ov-people` 加 padding-bottom 23px，实测 companions 末行 421.9 → shrinking 标题 559.9 = **138**（真机 panel_gap 138；折叠块标题→标题 24+115=139 对齐真机 139）。② 新增 `scripts/overview_parity.mjs` 45 项断言（节数/顺序/标题、栏宽 300、标题 24/600、副标题 18 且标题下 46、hero 116 圆头像 + 32/600 名字 + 20 时长名下 25 + 下距 55、紧凑行 50/22/行距 71.5、灰条高 7/槽宽 67/左端固定/右内缩 25/长度∝榜首、hero 唯一首行、空态文案、节间距 138、无横向溢出），实测 **45/45 · OVERVIEW LISTS OK · exit 0**（`docs/ref/overview-lists-parity.json`）；`OV_NEG=1` 注入标题 18/400 + hero 头像 60 + 灰条高 14 + 节间距 0 → 37/45，**NEG OK** 四项被抓（`cache/ov_neg.log`）。③ `regress_all.sh` 加第十段 overview（REGRESS OK 10/10 口径）+ README/docs 同步；web `npm test` 48 pass。
- [2026-11-25 04:0x] 下一步：等 `cache/regress_all_r44.log` 跑完，确认末行 `REGRESS OK 10/10`（尤其新加的 overview 段 45/45），把实际数字写进 STATE/README 端到端段后提交。

- [2026-11-25 08:2x] 第31轮（主框架与导航密度）：把真机 nav/footer/topbar 规格里未断言的密度数字补成常驻断言 —— scripts/frame_parity.mjs 的 measureFrame 新增 topPitch/subPitch（同组相邻行 y 差，>45 剔除块间距）/subIndent/iconX/subTextFit/footPitch/footDivider，__chrome 新增 statusbar 每项 label·dotW·gapDT 与 topbar actPitch；新增 9 条：statusbar.labels、statusbar.dot(8/9)、topbar.actions_pitch 36±1、nav.top_pitch 40、nav.sub_pitch 35、nav.sub_indent 27±1、nav.icon_x 18±2、nav.sub_text_fit ≤-8、nav.footer_pitch 39±1、nav.footer_no_divider(宽0)。实测 FRAME_VIEWS=1024x600 → **237/237 FRAME OK exit 0**（cache/scratch/frame_r31_v1.log）；两视口首跑 495/499，4 条红全是 footer_no_divider 判据写错（实际 0px/solid，宽 0 即无分割线），改判后转绿。基线 docs/ref/frame-parity.json 未被覆盖（FRAME_OUT 指 cache/scratch）。
- [2026-11-25 08:2x] 下一步：①后台跑全 9 视口 `node scripts/frame_parity.mjs` 取 FRAME OK 总数（预期 ≈2130），写进 README 口径与 docs/vrcx0-parity.md 第40轮小节；②再跑一次 `bash scripts/regress_all.sh` 确认十段仍 10/10（frame 段数字变了）；③web 源码未改，`cd web && npm test` 应仍 48 pass（本轮未跑）。

- [2026-11-25 08:45] 第 40 轮（主框架/导航密度断言加固）：`scripts/frame_parity.mjs` 新增 13 条契约断言 —— 状态栏 4 项文字与顺序（服务器状态,实时连接,VRChat,SteamVR）、圆点 8 + 圆点→文字 9、顶栏图标按钮中心距 36、导航顶层行距 40 / 二级行距 35 / 二级左移 27 / 图标距左 18±2 / 二级文字右内缩 ≤−8 / 页脚行距 39 / 页脚无上分割线。实测全 9 视口浅/深 × 展开/收起：**2166/2166 · FRAME OK**（`cache/frame_r51.log`；旧版 1932，每档 +26 = 13 条 × 浅/深两套；per-view 237/229/229/237/229/229/252/262/262）。README 三处数字 + per-view 口径、`docs/vrcx0-parity.md` 第 380 条同步。
- [2026-11-25 08:45] 下一步：①`bash scripts/regress_all.sh` 单实例复跑确认十段仍全绿且 frame 段显示 2166/2166（frame.log 数字变了，需真实证据）；②`cd web && npm test` 确认 48 pass（本轮未改 web 源码）；③两个未跟踪探针 `scripts/probes/_probe_r31_density.mjs` / `_probe_r31_nav_density.mjs` 已随本轮提交入库。

- [2026-11-25 09:2x] 第 32 轮（动态页表格复刻）：复核 feed 14/14 后做视觉对比，发现类型列图标是字体字符且 `⌖`(U+2316) 全字体链缺字——位置变动（最高频类型）整列豆腐块。改 FeedPage 为 9 类 12×12 内联 SVG（stroke=currentColor），`.ek-glyph` 改 flex:none/12px；feed_parity 加「类型图标为矢量(非字体字符)」第 15 条。实测 **15/15 FEED OK exit 0**（cache/feed_r32_v2.log）、FEED_NEG 12/15 NEG OK、npm test 48 pass；类型列截图无豆腐块。README/docs 口径同步，提交 ce9e15c。
- [2026-11-25 09:2x] 下一步：数据侧两处与真机仍不同——群组公开不带群名（events 无 group name）、模型变动行详细信息为空（events 未返回模型/头像名）。需先从 friend_avatar_history / location 的 ~group(grp_) 关联出名字，再补 Detail 与断言；属数据管道改动，另起一轮。

## 第33轮 好友位置分栏（卡片两段式布局收口，2026-11-25）

- [2026-11-25 09:40] 接手上一轮未提交的半成品：`FriendsPage.jsx` 已把头像+名字/时长收进 `.loc-top`、世界行/状态行跨整卡宽，但 `styles.css` 没有 `.loc-top/.loc-meta/.loc-glyph` 规则，卡片实际被排成竖排堆叠（量测 name 与 avatar 同在 x=11）。补齐 CSS：`.loc-card` 改 `display:block`、`height:96px`（padding 7 + 上段 56 + 世界/状态各 12×2）、`overflow:hidden`；`.loc-top` flex 横排高 56；`.loc-world/.loc-status` 固定 12 高单行；世界栏组头加 12×12 矢量 glyph。
- [2026-11-25 09:41] 证据：`web npm run build` 通过；量测卡片 221×96、avatar(11,8)56×56、name(77,27)、status(11,64,w199) → 头像左、名字/时长右侧竖排、世界/状态跨整卡宽，与 `docs/ref/vrcx0-locations.png` 裁图一致（截图 `cache/loc_r33.png`，vision 复核无裁字/重叠）；`node scripts/locations_parity.mjs` → 20/20 · LOCATIONS OK · exit 0；`grid_parity` 60/60 GRID OK；`structure_parity` 59/59；`cd web && npm test` 48 pass 0 fail。提交 74cb7d0。
- [2026-11-25 09:52] 端到端 `bash scripts/regress_all.sh`（日志 `cache/regress_all_r33.log`）进行中：structure 59/59 OK、visual 215/215 OK（100%），frame 段仍在跑，末行未出。
- [2026-11-25 09:52] 下一步：等 cache/regress_all_r33.log 出末行；若 `REGRESS OK 10/10` 则把 r33 数字写进 README 第 117 行与 docs/vrcx0-parity.md（新增「第四十二轮」小节：卡片两段式 + 三条踩坑：CSS 未构建/未补类导致静默竖排、世界栏卡片是否显示世界行、demo 数据缺 online_minutes 导致时长空行）并 push；若某段 FAIL 先看 cache/regress/<段>.log。另：demo 数据里世界栏好友没有 `online_minutes`，卡片时长行为空——属数据侧缺口，不编造。

## 第34轮 概览三榜单复刻收口（2026-11-25）

- [2026-11-25 10:5x] 复核概览三榜单：`node scripts/overview_parity.mjs http://127.0.0.1:8891/vrc/` → **45/45 · OVERVIEW LISTS OK · exit 0**（节间距 138、无横向溢出 1688/1688 均 PASS）。修 README:146 命令示例 locations 20/20 → 24/24。
- [2026-11-25 10:5x] 端到端 `cache/regress_all_r34.log`：structure 59/59、visual 215/215、frame 2166/2166 已 OK，nav 起跑；上一轮 r33 全量 `REGRESS OK 10/10`（overview 段 45/45）。

## 第43轮 侧栏图标矢量化 + 导航密度 5 条常驻断言（2026-11-25）

- [2026-11-25 11:0x] 第 32 轮「主框架与导航密度」收尾。上一轮探针量到 `⧉`(U+29C9) 在 Chromium 字体链缺字（glyphW 6.6 = 豆腐宽），与动态页 `⌖` 同类。改法：新增 `web/src/components/navIcons.jsx`（21 枚 14×14 内联 SVG，`stroke=currentColor` 1.3 描边），`Sidebar.jsx` 去掉 NAV 的 `icon` 字段、折叠夹箭头 `›` 也换 12×12 SVG；`styles.css` 补 `.nav-icon{display:flex;height:14px;opacity:.6}` + `.nav-glyph{display:block}`（矢量是 inline 元素，不写死会撑行高）。
- [2026-11-25 11:0x] 断言：`frame_parity.mjs` 的 `measureFrame` 加 `rowGapTop/rowGapSub`、`iconVec/iconCells`、`subIconDelta`、`subBorder/subBorderX`、`folderCount/chevCount/chevW/chevRightGap`；`assertNav` 加 5 条 —— `nav.row_gap` 4/4、`nav.icon_vector` 19/19 全矢量、`nav.sub_icon_delta` 27±1、`nav.sub_border` 1px/solid@25±1、`nav.folders` 2 夹 / 2 箭头 12px 右距 19±2。
- [2026-11-25 11:0x] 证据：全 9 视口浅/深 `node scripts/frame_parity.mjs http://127.0.0.1:8891` → **2256/2256 · FRAME OK · exit 0**（`cache/frame_r32_full2.log`；2166 + 5×浅/深×9 = +90，per-view 247/239/239/247/239/239/262/272/272，`docs/ref/frame-parity.json` pass=2256 total=2256）；单档 `FRAME_VIEWS=1024x600` → 247/247（`cache/scratch/frame_r32_v1.log`）；`cd web && npm test` → 48 pass 0 fail；`npm run build` → 12.00s 通过；探针 `scripts/probes/_probe_r32_navshot.mjs` 量 21 行全 `svg:true 14×14`，截图 `cache/scratch/nav_r32.png` 视觉复核无豆腐框/无裁字。
- [2026-11-25 11:0x] 单测同步：`web/test/nav.test.mjs` 折叠夹判据从 `id/label/icon/children` 收窄到 `id/label/children`（NAV 已无 icon 字段，否则 folderIds 全空、收藏/社交被当页、快捷键断言假红）。
- [2026-11-25 11:0x] 踩坑：跑 frame 期间我重建了 `web/dist`（demo 服务读 dist），旧 hash 资源被清 → 在跑的 frame 段 `browser has been closed` 重试；另有上一轮 10:40 遗留的 frame_parity 进程在跑。两个并发 frame 进程互相抢浏览器，kill 干净后单实例重跑才拿到 2256。**改 dist 前先确认没有 parity 在跑**。
- [2026-11-25 11:0x] 下一步：`bash scripts/regress_all.sh` 单实例跑一次，确认十段仍全绿且 frame 段显示 2256/2256；README 已同步 2256 口径（表格/命令示例/per-view 计数），docs/vrcx0-parity.md 已加第四十三轮小节（389–392）。
