#!/usr/bin/env bash
# 第四轮功能对齐检查：跑 server/scripts/parity4.mjs（临时 SQLite 库，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity4.mjs "$@"
