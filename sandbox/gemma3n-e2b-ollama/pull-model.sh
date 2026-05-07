#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${OLLAMA_HOST:-127.0.0.1:11435}"
MODEL="${OLLAMA_MODEL:-gemma3n:e2b}"
SANDBOX_HOME="$ROOT_DIR/home"

"$ROOT_DIR/start.sh"

echo "pulling $MODEL from Ollama registry"
HOME="$SANDBOX_HOME" OLLAMA_HOST="$HOST" ollama pull "$MODEL"
