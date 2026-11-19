#!/usr/bin/env bash
# 第十四轮对齐检查：移动端卡片化 / 懒加载 / 离线提示
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity14.mjs "$@"
