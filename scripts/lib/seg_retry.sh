#!/usr/bin/env bash
# 段执行包装：Chromium 段在宿主内存紧张时会被 OOM killer 直接杀掉（日志只有一行 "Killed"），
# 这种情况重跑一次通常就能过；真正的断言失败不重试，避免把假绿跑出来。
#   用法：seg_retry <日志文件> <命令…>
#   返回：命令最终 exit code（重试耗尽仍失败则返回最后一次的 code）
seg_retry() {
  local log="$1"; shift
  local tries="${SEG_RETRY_TRIES:-2}"
  local i=0 rc=0
  while :; do
    i=$((i + 1))
    "$@" >"$log" 2>&1
    rc=$?
    [ $rc -eq 0 ] && return 0
    # 只有「进程被杀 / 浏览器起不来 / 上游接口超时」这种环境性死亡才重试
    if [ $i -lt $tries ] && grep -qE 'Killed|browser has been closed|Target page, context or browser has been closed|SIGKILL|browserType\.launch: Timeout|"error"[[:space:]]*:[[:space:]]*"Request Timeout"|statusCode\\?"?[[:space:]]*:[[:space:]]*408' "$log"; then
      printf 'RETRY %s 第 %d 次环境性失败（OOM/浏览器未起/上游超时），重跑\n' "$(basename "$log" .log)" "$i"
      sleep "${SEG_RETRY_WAIT:-20}"
      continue
    fi
    return $rc
  done
}
