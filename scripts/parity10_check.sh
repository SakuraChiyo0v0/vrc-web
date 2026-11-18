#!/usr/bin/env bash
# 第十轮对齐检查：跑 server/scripts/parity10.mjs（读构建产物 + 源码，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity10.mjs "$@"
