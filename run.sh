#!/usr/bin/env sh
# 大肥鱼桌宠 · 启动本地服务（幂等：已经在跑就不会重复起进程）
#
# 用法：
#   sh run.sh          只确保服务在跑
#   sh run.sh --open   确保服务在跑，并打开页面（Android/Termux 下自动调 am start）
#
# 可用环境变量：
#   PET_PORT  监听端口，默认 8787
#   PET_ROOT  静态目录，默认 svc.js 所在目录
set -u

D=$(cd "$(dirname "$0")" && pwd)
PORT="${PET_PORT:-8787}"
URL="http://127.0.0.1:$PORT"
LOG="/tmp/dafeiyu.log"

alive() { curl -s -m 2 "$URL/api/ping" 2>/dev/null | grep -q '"ok":true'; }

if alive; then
  echo "[dafeiyu] service already running -> $URL"
else
  echo "[dafeiyu] starting service..."
  if command -v setsid >/dev/null 2>&1; then
    ( cd "$D" && setsid node svc.js >>"$LOG" 2>&1 </dev/null & )
  else
    ( cd "$D" && nohup node svc.js >>"$LOG" 2>&1 </dev/null & )
  fi
  i=0
  while [ "$i" -lt 10 ]; do
    sleep 1
    if alive; then break; fi
    i=$((i + 1))
  done
  if alive; then
    echo "[dafeiyu] up -> $URL"
  else
    echo "[dafeiyu] failed to start, see $LOG" >&2
    exit 1
  fi
fi

if [ "${1:-}" = "--open" ]; then
  am start -a android.intent.action.VIEW -d "$URL/" >/dev/null 2>&1 || true
fi
