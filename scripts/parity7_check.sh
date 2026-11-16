#!/usr/bin/env bash
# 第七轮对齐检查：跑 server/scripts/parity7.mjs（读构建产物 + 临时 SQLite 服务，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity7.mjs "$@"
