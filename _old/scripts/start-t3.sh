#!/bin/bash
# T3 Code – Headless VPS Starter
# Zugriff via SSH-Tunnel: ssh -L 3773:localhost:3773 user@vps -N

set -e

T3_BIN="$(npx --yes t3@latest which 2>/dev/null || echo "$HOME/.npm/_npx/89628044cae88a02/node_modules/.bin/t3")"
T3_LOG="/tmp/t3.log"
T3_PORT=3773
T3_HOST=127.0.0.1
T3_CWD="/home/ubuntu/slopware"

echo "→ Stoppe alte T3-Instanzen..."
pkill -9 -f "bin/t3" 2>/dev/null || true
sleep 1

echo "→ Starte T3 Server auf ${T3_HOST}:${T3_PORT}..."
setsid node "$T3_BIN" serve \
  --host "$T3_HOST" \
  --port "$T3_PORT" \
  "$T3_CWD" \
  < /dev/null > "$T3_LOG" 2>&1 &

echo "→ Warte auf Start..."
sleep 4

if ss -tlnp | grep -q "${T3_PORT}"; then
  echo ""
  echo "✅ T3 Server läuft auf ${T3_HOST}:${T3_PORT}"
  echo ""
  grep -E "Token:|Pairing URL:|Connection string:" "$T3_LOG" || true
  echo ""
  echo "SSH-Tunnel (lokal ausführen):"
  echo "  ssh -L ${T3_PORT}:localhost:${T3_PORT} $(whoami)@<VPS-IP> -N"
  echo ""
else
  echo "❌ Server nicht gestartet. Log:"
  cat "$T3_LOG"
  exit 1
fi
