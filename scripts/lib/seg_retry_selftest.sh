#!/usr/bin/env bash
# seg_retry 自测：3 个用例，全过打印 SEG_RETRY SELFTEST OK
set -uo pipefail
cd "$(dirname "$0")"
. ./seg_retry.sh
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export SEG_RETRY_WAIT=0
fail=0

# 1) 直接成功 → 只跑 1 次
n=0
ok_once() { n=$((n + 1)); echo "line $n"; }
seg_retry "$TMP/a.log" ok_once; rc=$?
[ $rc -eq 0 ] && [ "$n" -eq 1 ] && echo "case1 PASS 成功不重试" || { echo "case1 FAIL rc=$rc n=$n"; fail=1; }

# 2) 第一次被 OOM 杀（写 Killed 且 exit 137），第二次成功 → 重试
n=0
oom_then_ok() { n=$((n + 1)); if [ $n -eq 1 ]; then echo "Killed" >&2; return 137; fi; echo ok; }
seg_retry "$TMP/b.log" oom_then_ok; rc=$?
[ $rc -eq 0 ] && [ "$n" -eq 2 ] && echo "case2 PASS OOM 被杀后重试成功（跑 2 次）" || { echo "case2 FAIL rc=$rc n=$n"; fail=1; }

# 3) 断言失败（非环境性）→ 不重试
n=0
assert_fail() { n=$((n + 1)); echo "结构对齐 58/59 有 FAIL"; return 1; }
seg_retry "$TMP/c.log" assert_fail; rc=$?
[ $rc -ne 0 ] && [ "$n" -eq 1 ] && echo "case3 PASS 断言失败不重试（rc=$rc）" || { echo "case3 FAIL rc=$rc n=$n"; fail=1; }

# 4) 连续被杀到重试上限 → 返回非 0
n=0
always_killed() { n=$((n + 1)); echo "Killed" >&2; return 137; }
seg_retry "$TMP/d.log" always_killed; rc=$?
[ $rc -ne 0 ] && [ "$n" -eq 2 ] && echo "case4 PASS 重试上限后返回 $rc（跑 $n 次）" || { echo "case4 FAIL rc=$rc n=$n"; fail=1; }

[ $fail -eq 0 ] && echo "SEG_RETRY SELFTEST OK" || { echo "SEG_RETRY SELFTEST FAIL"; exit 1; }
