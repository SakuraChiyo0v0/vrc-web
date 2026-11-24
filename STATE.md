
- [2026-11-24 19:20] 端到端 regress_all 首跑失败，根因是浏览器撞车不是回归红：bash scripts/regress_all.sh http://localhost:8891 → structure 59/59 OK、visual 215/215 OK，frame/nav 双双崩（cache/regress/frame.log=TimeoutError、nav.log=browserContext.close: Target page/context closed）。原因是先前一次前台跑被 300s 预算 kill 后遗留的子进程与 chrome 仍在跑，两个 regress 同时抢同一批 cache/regress/*.log 和 chromium 上下文（frame.log 里同一文件既出现过 FRAME OK 又出现 TimeoutError 即互写证据）。frame_parity 单独一次仍留 1932/1932 的旧证据（上一提交 945be42 之前），不能算本轮实测。

- [2026-11-24 19:22] 探针归位落地：58 个 scripts/_probe_*.mjs 全部 git mv 到 scripts/probes/（git ls-files 与磁盘计数均 58）；5 个引用 ./lib/page_structure.mjs 的探针（_probe_320all/_probe_kb320/_probe_kb_matrix/_probe_topbar_gaps/_probe_under44）import 改 ../lib/；全部 58 个过 node --check 无 SYNTAX_FAIL；docs/vrcx0-parity.md 3 处、scripts/mobile_parity.mjs 注释 1 处路径同步为 scripts/probes/；README 新增「探针统一放 scripts/probes/，顶层只留正式脚本」一段。提交 258b01a。

- [2026-11-24 19:22] 核对上一轮「nav 收起侧栏×右栏36竖条只跑浅色」这条待办：读 scripts/nav_coverage.mjs，rail:collapsed_strip/strip_toggle/strip_unfold 三例在 THEMES 循环内（L98），且 366 = 4 视口×2 主题×45 + 3 例×2 主题，即深色已在跑，这条待办本身不成立，不需要 +18 扩项。

- [2026-11-24 19:22] 下一步：① 单人跑一次干净端到端：先确认 ps 里没有 regress/parity/chrome-headless 残留，再 `bash scripts/regress_all.sh http://localhost:8891 > cache/regress_all_r31.log 2>&1`（前台 timeout 不设 300s 以内、用 background+notify），期望末行 REGRESS OK 7/7，把真实数字写进 STATE；② 若 frame/nav 仍崩，疑似并发或内存（容器 7.4G，playedwright 常驻 4.7G used）→ 串行降到 NAV_THEME 单主题分两次跑，先定位是并发还是单脚本不稳；③ 探针归位后抽 2 个跑过实际执行（不止 --check）：node scripts/probes/_probe_under44.mjs http://localhost:8891 与 node scripts/probes/_probe_topbar_gaps.mjs http://localhost:8891，证 import 路径真能解析，输出落 cache/probes/。

- [2026-11-24 20:30] 定位并修掉 1929/1932 的根因（不是右栏宽校验）：reloadVrc 等 waitUntil 'load'，demo 长连接让 load 永不落地 → 两次 60s 超时后页面仍是旧文档、#vrc-topbar h1 照旧在，调用方读到上一条用例的 353（exp.dirty.264/280 假 FAIL），run3 更是直接挂住 618s 无输出。改法：reload 只等 domcontentloaded(30s) + <html> dataset.reloadStamp 打戳验「文档真换新」，失败整页 goto 兜底（新增 reloadVrcHard）；frame 4 处 / nav 2 处全改 reloadVrcHard，checkRosterDirtyW 把 reload 新鲜度计入断言（detail 标 fresh/STALE）。证据：探针 cache/probes/dirty_reload.mjs 7 例全对、cache/probes/reload_stress.mjs 连刷 20 次 bad=0 maxMs=117（旧版 0.5s 且偶发卡死）；web npm test 48 pass。全量 frame_parity 尚未复跑（预算到顶）。

- [2026-11-24 20:30] 下一步：① 后台单跑 frame_parity 期望 1932/1932 EXIT=0 且日志无 STALE；② 单跑 nav_coverage 期望 366/366；③ regress_all 取 REGRESS OK 7/7；④ README 数字同步 + 补「reload 别等 load」说明后提交（page_structure.mjs + frame_parity.mjs + nav_coverage.mjs + README）

- [2026-11-25 00:50] 动态页表格做成常驻断言（第 34 轮）：新增 `scripts/feed_parity.mjs`（14 项，基线 docs/ref/feed-measure.json），实测 **14/14 · FEED OK · exit 0**（`cache/feed_r1.log`）：列文字起点 77/181/380/549 vs 真机 78/184/382/551、右缘留白 353 vs 358、表头/行高 44、类型四色互异。反向 `FEED_NEG=1`（注入行高 56 + padding 8）→ 11/14、NEG OK 被抓到（`cache/probes/feed_neg.log`）。`regress_all.sh` 加第八段 feed → `REGRESS OK 8/8`；README/docs 口径同步。
- [2026-11-25 00:50] 下一步：等 `cache/regress_all_r41.log` 跑完确认 8/8，把实际末行写进 STATE 并提交（feed_parity.mjs + regress_all.sh + README + docs + STATE）。
