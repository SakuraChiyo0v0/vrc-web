#!/usr/bin/env bash
# 一键回归：桌面结构（structure_parity）+ 桌面视觉（visual_parity）+ 主框架/导航密度（frame_parity）+ 导航可达（nav_coverage）+ 移动断点（mobile_parity）+ 网格列数阶梯（grid_parity）+ 动态页表格（feed_parity）+ 好友位置分栏（locations_parity）+ 概览三榜单（overview_parity）+ web 单测。
#   用法：scripts/regress_all.sh [baseUrl]     默认 http://127.0.0.1:8891（server/scripts/demo.mjs）
# 不传 baseUrl 时若 8891 没起，会自动起一个 demo 实例并跑完杀掉。
# 线上（容器）：http://172.30.0.7:8790/vrc/   —— 带不带尾斜杠都行：
#   接口用 normBase() 去斜杠，页面（hash 路由）用 pageBase() 补回尾斜杠；写错会在首屏被 assertVrcPage 硬拦。
# 任一环节 FAIL 即 exit 1；每段完整输出落在 cache/regress/<环节>.log。
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/cache/regress"; mkdir -p "$OUT"

BASE="${1:-http://127.0.0.1:8891}"
STARTED=""
cleanup() { [ -n "$STARTED" ] && kill "$STARTED" 2>/dev/null; }
trap cleanup EXIT

if ! curl -sf --max-time 3 "$BASE/api/friends" >/dev/null 2>&1; then
  echo "SELF-HOST 8891 没在跑，临时起 demo 实例"
  node server/scripts/demo.mjs 8891 >"$OUT/demo.log" 2>&1 &
  STARTED=$!
  for _ in $(seq 1 40); do curl -sf --max-time 2 "$BASE/api/friends" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -sf --max-time 3 "$BASE/api/friends" >/dev/null 2>&1 || { echo "REGRESS FAIL demo 实例没起来（见 $OUT/demo.log）"; exit 1; }
fi

FAILED=()
SKIPPED=()
run() {  # run <名字> <命令…>   exit 3 = 本环境不适用（如视觉基准在真实库上），记 SKIP 不算失败
  local name="$1"; shift
  local log="$OUT/$name.log"
  printf '── %-16s' "$name"
  "$@" >"$log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo "OK   $(tail -1 "$log" | cut -c1-110)"
  elif [ $rc -eq 3 ]; then
    echo "SKIP $(tail -1 "$log" | cut -c1-110)"
    SKIPPED+=("$name")
  else
    echo "FAIL $(tail -3 "$log" | tr '\n' ' ' | cut -c1-200)"
    FAILED+=("$name ($log)")
  fi
}

run structure node scripts/structure_parity.mjs "$BASE"
run visual    node scripts/visual_parity.mjs "$BASE"
run frame     node scripts/frame_parity.mjs "$BASE"
run nav       node scripts/nav_coverage.mjs "$BASE"
run mobile    node scripts/mobile_parity.mjs "$BASE"
run grid      node scripts/grid_parity.mjs "$BASE"
run feed      node scripts/feed_parity.mjs "$BASE"
run locations node scripts/locations_parity.mjs "$BASE"
run overview  node scripts/overview_parity.mjs "$BASE"
run unittest  bash -lc "cd '$ROOT/web' && npm test --silent"

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "REGRESS FAIL ${#FAILED[@]}/10 环节未过："
  printf '  %s\n' "${FAILED[@]}"
  exit 1
fi
echo "REGRESS OK 10/10（structure / visual / frame / nav / mobile / grid / feed / locations / overview / unittest）  base=$BASE"
if [ ${#SKIPPED[@]} -gt 0 ]; then echo "  SKIP: ${SKIPPED[*]}（本环境不适用，见各自 log）"; fi
exit 0
