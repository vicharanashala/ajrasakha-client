#!/bin/bash
set -euo pipefail

if [ -z "${TS_CLIENT_SECRET:-}" ]; then
  echo "TS_CLIENT_SECRET is required"
  exit 1
fi

TS_DIR=/tmp/tailscale
TS_SOCKET="${TS_DIR}/tailscaled.sock"
mkdir -p "${TS_DIR}"

echo "Starting Tailscale daemon..."
tailscaled \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --outbound-http-proxy-listen=localhost:1055 \
  --state="${TS_DIR}/tailscaled.state" \
  --statedir="${TS_DIR}" \
  --socket="${TS_SOCKET}" \
  &

# Wait until the local Tailscale socket exists
for i in $(seq 1 30); do
  if [ -S "${TS_SOCKET}" ]; then
    break
  fi
  sleep 0.5
done

if [ ! -S "${TS_SOCKET}" ]; then
  echo "Tailscale daemon failed to create socket"
  exit 1
fi

HOSTNAME="${TAILSCALE_HOSTNAME:-ajrasakha-client}"
echo "Bringing Tailscale up as ${HOSTNAME}..."
tailscale --socket="${TS_SOCKET}" up \
  --auth-key="${TS_CLIENT_SECRET}" \
  --advertise-tags=tag:ci-cd \
  --hostname="${HOSTNAME}" \
  --accept-routes \
  --reset

echo "Tailscale connected"
tailscale --socket="${TS_SOCKET}" status || true

# Userspace Tailscale: app must send traffic via local proxies (OS has no 100.x routes).
# PROXY is LibreChat's own env; HTTP(S)_PROXY/ALL_PROXY cover other clients.
export PROXY="http://127.0.0.1:1055"
export HTTP_PROXY="${PROXY}"
export HTTPS_PROXY="${PROXY}"
export ALL_PROXY="socks5://127.0.0.1:1055"
export http_proxy="${HTTP_PROXY}"
export https_proxy="${HTTPS_PROXY}"
export all_proxy="${ALL_PROXY}"

echo "Outbound Tailscale userspace proxy: PROXY=${PROXY} ALL_PROXY=${ALL_PROXY}"
exec npm run backend
