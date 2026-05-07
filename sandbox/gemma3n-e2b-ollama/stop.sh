#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/ollama.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "no pid file found"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "stopped ollama server (pid $PID)"
else
  echo "process already stopped"
fi

rm -f "$PID_FILE"
