#!/usr/bin/env bash
# 第十七轮对齐检查：核心接口 p95 / 错误边界 / 冷启动 / 索引进 migrate / parity14 回归
set -u
cd "$(dirname "$0")/.."
exec node server/scripts/parity17.mjs "$@"
