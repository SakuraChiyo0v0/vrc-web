#!/usr/bin/env bash
# 第三轮功能对齐检查：跑 server/scripts/parity3.mjs（临时 SQLite 库 + 本地图片桩，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity3.mjs "$@"
