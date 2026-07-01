#!/usr/bin/env bash
# Expose frontend + backend for remote testers (two ngrok URLs).
# Prereqs: backend on :8000, frontend on :5173, ngrok authtoken configured globally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ENV="$ROOT/backend/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed. Install: brew install ngrok/ngrok/ngrok"
  exit 1
fi

if ! curl -sf --max-time 1 "http://127.0.0.1:5173" >/dev/null 2>&1; then
  echo "Warning: nothing is listening on port 5173 — start the frontend first (npm run dev)."
fi

if ! curl -sf --max-time 1 "http://127.0.0.1:8000/api/config" >/dev/null 2>&1; then
  echo "Warning: backend is not responding on port 8000 — start uvicorn before testing API calls."
fi

GLOBAL_NGROK="${HOME}/Library/Application Support/ngrok/ngrok.yml"
NGROK_CONFIG_ARGS=(--config "$ROOT/ngrok.yml")
if [[ -f "$GLOBAL_NGROK" ]]; then
  NGROK_CONFIG_ARGS=(--config "$GLOBAL_NGROK" --config "$ROOT/ngrok.yml")
fi

echo "Starting ngrok tunnels (web → :5173, api → :8000)…"
ngrok start web api "${NGROK_CONFIG_ARGS[@]}" --log stdout &
NGROK_PID=$!

cleanup() {
  kill "$NGROK_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

NGROK_API=""
WEB_URL=""
API_URL=""
for _ in $(seq 1 60); do
  for port in 4040 4041 4042; do
    if curl -sf --max-time 1 "http://127.0.0.1:${port}/api/tunnels" >/dev/null 2>&1; then
      NGROK_API="http://127.0.0.1:${port}/api/tunnels"
      break
    fi
  done
  if [[ -n "$NGROK_API" ]]; then
    read -r WEB_URL API_URL < <(curl -sf "$NGROK_API" | python3 -c "
import json, sys
data = json.load(sys.stdin)
urls = {}
for t in data.get('tunnels', []):
    if t.get('proto') == 'https':
        urls[t.get('name', '')] = t['public_url']
web = urls.get('web', '')
api = urls.get('api', '')
if web and api:
    print(web, api)
" 2>/dev/null || true)
    if [[ -n "$WEB_URL" && -n "$API_URL" ]]; then
      break
    fi
  fi
  sleep 0.25
done

if [[ -z "$NGROK_API" || -z "$WEB_URL" || -z "$API_URL" ]]; then
  echo "Could not read ngrok tunnel URLs. Open the inspector (usually http://127.0.0.1:4040)."
  wait "$NGROK_PID"
  exit 1
fi

INSPECTOR="${NGROK_API%/api/tunnels}"

echo ""
echo "Share with testers:  $WEB_URL"
echo "Backend API tunnel:  $API_URL"
echo "Inspector:           $INSPECTOR"
echo ""

cat > "$FRONTEND_ENV" <<EOF
# Written by scripts/ngrok-tunnel.sh — delete this file to return to local-only dev.
VITE_API_URL=${API_URL}
EOF
echo "Wrote frontend/.env.local (VITE_API_URL) — restart npm run dev to apply."

if [[ -f "$BACKEND_ENV" ]]; then
  if grep -q '^FRONTEND_URL=' "$BACKEND_ENV"; then
    sed -i '' "s|^FRONTEND_URL=.*|FRONTEND_URL=${WEB_URL}|" "$BACKEND_ENV"
  else
    echo "FRONTEND_URL=${WEB_URL}" >> "$BACKEND_ENV"
  fi
  echo "Updated FRONTEND_URL in backend/.env — restart uvicorn to apply."
else
  echo "Set FRONTEND_URL=${WEB_URL} in backend/.env and restart uvicorn."
fi

echo ""
echo "Google Sign-In: add ${WEB_URL} to Authorized JavaScript origins in Google Cloud Console."
echo "Stripe: keep using 'stripe listen --forward-to localhost:8000/api/webhooks/stripe' locally."
echo "To stop sharing: Ctrl+C here, delete frontend/.env.local, restart frontend + backend."
echo ""
echo "Press Ctrl+C to stop the tunnels."

wait "$NGROK_PID"
