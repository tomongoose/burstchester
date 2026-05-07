#!/usr/bin/env bash

set -euo pipefail

HOST="${OLLAMA_HOST:-127.0.0.1:11435}"
MODEL="${OLLAMA_MODEL:-gemma3n:e2b}"

curl --fail -sS "http://$HOST/api/chat" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with OK only.\"}],\"stream\":false}"
