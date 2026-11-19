#!/usr/bin/env bash
# 第十五轮对齐检查：全量备份导入 / CSV 多表导出 / 导出快照分享
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity15.mjs "$@"
