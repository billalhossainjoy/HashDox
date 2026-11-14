#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_FILE="$(mktemp)"
cleanup() {
  if [[ -n "${WORKER_PID:-}" ]]; then
    kill "$WORKER_PID" 2>/dev/null || true
    wait "$WORKER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8787 \
  --var OWNER_EMAIL:owner@example.test \
  --var BETTER_AUTH_URL:http://127.0.0.1:8787 \
  --var BETTER_AUTH_SECRET:1234567890abcdefghijklmnopqrstuvwxyz123456 \
  --var GOOGLE_CLIENT_ID:placeholder-test-client \
  --var GOOGLE_CLIENT_SECRET:placeholder-test-secret >"$LOG_FILE" 2>&1 &
WORKER_PID=$!

READY=0
for attempt in $(seq 1 50); do
  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    cat "$LOG_FILE"
    echo "Worker exited unexpectedly" >&2
    exit 1
  fi
  if node -e "fetch('http://127.0.0.1:8787/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.4
done
if [[ "$READY" != 1 ]]; then
  cat "$LOG_FILE"
  echo "Local Worker did not become healthy" >&2
  exit 1
fi

node tests/worker-smoke.mjs || {
  cat "$LOG_FILE"
  exit 1
}
