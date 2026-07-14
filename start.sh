#!/bin/bash
set -euo pipefail

if [ -z "${TAILSCALE_AUTHKEY:-}" ]; then
  echo "TAILSCALE_AUTHKEY is required"
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
  --auth-key="${TAILSCALE_AUTHKEY}" \
  --hostname="${HOSTNAME}" \
  --accept-routes \
  --reset

echo "Tailscale connected"
tailscale --socket="${TS_SOCKET}" status || true

# Proxy for clients that honor these (needed to reach Tailscale IPs from userspace mode)
export ALL_PROXY="socks5://localhost:1055/"
export HTTP_PROXY="http://localhost:1055/"
export HTTPS_PROXY="http://localhost:1055/"
export http_proxy="${HTTP_PROXY}"
export https_proxy="${HTTPS_PROXY}"
export all_proxy="${ALL_PROXY}"

exec npm run backend
