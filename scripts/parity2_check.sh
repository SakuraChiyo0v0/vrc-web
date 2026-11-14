#!/usr/bin/env bash
# 第二轮功能对齐检查：跑 server/scripts/parity2.mjs（临时 SQLite 库，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity2.mjs "$@"
