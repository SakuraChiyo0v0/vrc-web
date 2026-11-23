#!/usr/bin/env bash
# 第十八轮对齐检查：抽屉数据图表 / 旅程按月折叠 / 每日柱可点 / 聚合自洽 / web 单测
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity18.mjs "$@"
