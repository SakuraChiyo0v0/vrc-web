#!/usr/bin/env bash
# 世界库卡片一键回归：真封面实测（1700 真机基准）+ 多视口复核（1700/1920/2560/3840）。
#   用法：scripts/worlds_check.sh [baseUrl]
# 不传 baseUrl 时自己起一个读 PG 的实例（默认库 = server/src/index.js 的默认 VRC_DB_URL），
# 跑完杀掉；若 127.0.0.1:8892 已有读 PG 的实例则直接复用、不杀。
# 依赖 playwright：先看 /opt/data/cache/hermes-daily-template/node_modules/playwright。
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TPL=/opt/data/cache/hermes-daily-template
export VRC_ROOT="$ROOT"
[ -d "$TPL/node_modules/playwright" ] || { echo "WORLDS SKIP 没有 playwright"; exit 0; }

BASE="${1:-}"
STARTED=""
cleanup() { [ -n "$STARTED" ] && kill "$STARTED" 2>/dev/null; }
trap cleanup EXIT

has_covers() {  # 接口必须带 thumbnail，否则这个回归验不到东西
  curl -sf --max-time 5 "$1/api/worlds?limit=8" 2>/dev/null \
    | grep -q '"thumbnail":"http'
}

if [ -z "$BASE" ]; then
  if has_covers "http://127.0.0.1:8892"; then
    BASE="http://127.0.0.1:8892"
    echo "复用已有实例 $BASE"
  else
    PORT=8892
    ( cd "$ROOT/server" && PORT=$PORT node src/index.js >/tmp/worlds_check_srv.log 2>&1 ) &
    STARTED=$!
    for _ in $(seq 1 40); do has_covers "http://127.0.0.1:$PORT" && break; sleep 0.5; done
    BASE="http://127.0.0.1:$PORT"
    has_covers "$BASE" || { echo "WORLDS FAIL 起不来读 PG 的实例（看 /tmp/worlds_check_srv.log）"; exit 1; }
    echo "自起实例 $BASE（pid $STARTED）"
  fi
fi

rc=0
echo "── 真封面实测（1700）"
( cd "$ROOT" && node scripts/worlds_realcovers.mjs "$BASE" 2>&1 | tail -4 ) || rc=1
echo "── 多视口复核"
( cd "$ROOT" && node scripts/worlds_viewports.mjs "$BASE" 2>&1 | tail -8 ) || rc=1

[ "$rc" = 0 ] && echo "WORLDS OK" || echo "WORLDS FAIL"
exit "$rc"
