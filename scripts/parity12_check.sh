#!/usr/bin/env bash
# 第十二轮对齐检查：跑 server/scripts/parity12.mjs（源码 + 构建产物 + perf12 + 临时库索引）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity12.mjs "$@"
