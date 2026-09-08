#!/bin/zsh
cd "$(dirname "$0")/.."
ulimit -n 65536
export WATCHPACK_POLLING=true
export CHOKIDAR_USEPOLLING=true
export NODE_OPTIONS="--dns-result-order=ipv4first"
# Free port 3000 if a zombie Next is holding it
PIDS=$(lsof -tiTCP:3000 -sTCP:LISTEN)
if [[ -n "$PIDS" ]]; then
  echo "Killing old process on :3000: $PIDS"
  kill -9 $PIDS 2>/dev/null
  sleep 1
fi
exec npm run dev
