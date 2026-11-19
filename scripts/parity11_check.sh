#!/usr/bin/env bash
# 第十一轮对齐检查：跑 server/scripts/parity11.mjs（源码 + 构建产物 + 114/116 真函数断言）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity11.mjs "$@"
