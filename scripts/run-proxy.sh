#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.env"
  set +a
fi

export OPENAI_API_KEY="${OPENAI_API_KEY:-${VITE_OPENAI_API_KEY:-}}"
export PORT="${PORT:-8787}"
export ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://localhost:5173}"
export RATE_LIMIT_PER_MIN="${RATE_LIMIT_PER_MIN:-30}"
export MAX_CONCURRENT="${MAX_CONCURRENT:-3}"
export MAX_BODY_BYTES="${MAX_BODY_BYTES:-1000000}"
export PROXY_TOKEN="${PROXY_TOKEN:-${VITE_PROXY_TOKEN:-}}"

if [ -z "${OPENAI_API_KEY}" ]; then
  echo "Missing OPENAI_API_KEY. Set OPENAI_API_KEY or VITE_OPENAI_API_KEY in .env."
  exit 1
fi

node "$ROOT_DIR/proxy/server.js"
