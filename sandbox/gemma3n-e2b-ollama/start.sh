#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODELS_DIR="$ROOT_DIR/models"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$ROOT_DIR/ollama.pid"
SANDBOX_HOME="$ROOT_DIR/home"
HOST="${OLLAMA_HOST:-127.0.0.1:11435}"
FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"
KV_CACHE_TYPE="${OLLAMA_KV_CACHE_TYPE:-q8_0}"

mkdir -p "$MODELS_DIR" "$LOG_DIR" "$SANDBOX_HOME"

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama CLI not found in PATH" >&2
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "ollama server already running on $HOST (pid $PID)"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "starting ollama serve on $HOST"
OLLAMA_MODELS="$MODELS_DIR" \
OLLAMA_HOST="$HOST" \
OLLAMA_FLASH_ATTENTION="$FLASH_ATTENTION" \
OLLAMA_KV_CACHE_TYPE="$KV_CACHE_TYPE" \
HOME="$SANDBOX_HOME" \
nohup ollama serve >"$LOG_DIR/server.log" 2>&1 &

echo $! >"$PID_FILE"

PID="$(cat "$PID_FILE")"
if ! kill -0 "$PID" 2>/dev/null; then
  echo "ollama server failed to start; inspect $LOG_DIR/server.log" >&2
  exit 1
fi

for _ in $(seq 1 30); do
  if curl --fail -sS "http://$HOST/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --fail -sS "http://$HOST/api/tags" >/dev/null 2>&1; then
  echo "ollama server did not become ready; inspect $LOG_DIR/server.log" >&2
  exit 1
fi

echo "ollama server started (pid $PID)"
echo "models dir: $MODELS_DIR"
