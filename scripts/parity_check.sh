#!/usr/bin/env bash
# VRCX-0 功能对齐检查：跑 server/scripts/parity.mjs（临时 SQLite 库，不碰线上）
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity.mjs "$@"
