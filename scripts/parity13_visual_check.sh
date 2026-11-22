#!/usr/bin/env bash
# 视觉对齐验收：把「像不像 VRCX-0」变成发布门槛（相似度 ≥95% 才算过）。
# 依赖：/opt/data/cache/hermes-daily-template 里有 playwright（容器全局没装）。
set -uo pipefail
BASE="${1:-http://nginx/vrc/}"
ROOT=/opt/data/apps/vrc-web
TPL=/opt/data/cache/hermes-daily-template

[ -d "$TPL/node_modules/playwright" ] || { echo "PARITY13 SKIP 没有 playwright"; exit 0; }
cp "$ROOT/scripts/visual_parity.mjs" "$TPL/.visual_parity.mjs" 2>/dev/null || true

out=$(cd "$TPL" && VRC_ROOT="$ROOT" node .visual_parity.mjs "$BASE" 2>&1)
rc=$?
echo "$out" | tail -20

score=$(printf '%s' "$out" | grep -o '视觉相似度 [0-9]*%' | grep -o '[0-9]*')
score=${score:-0}
if [ "$score" -ge 95 ]; then
  echo "PARITY13 OK 视觉相似度 ${score}%"
  exit 0
fi
echo "PARITY13 FAIL 视觉相似度 ${score}%（门槛 95%）"
exit 1
