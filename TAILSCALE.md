# Tailscale Integration

<!--
  This document describes the Tailscale mesh networking setup for
  ajrasakha-client. The implementation mirrors the setup used in `wa-client`
  and is intentionally kept in lock-step with that repo so the two
  app containers can sit on the same tailnet and reach the same internal
  services (MCP servers, LLM endpoints, STT/TTS, etc.) at `100.100.x.x`.

  IMPORTANT: This documents the ACTUAL implementation. If you change
  the Dockerfile, the s6-scripts, or `api/server/index.js`, update this
  file too.
-->

This document describes how to configure and use Tailscale for mesh
networking in the ajrasakha-client container.

## Overview

The ajrasakha-client container includes Tailscale for secure, low-latency
mesh networking. This lets the container reach internal services
(reviewer MCP, ajrasakha-* MCP servers, vLLM endpoints, STT/TTS,
etc.) that are exposed only on the tailnet at `100.100.x.x` IPs - without
exposing those services to the public internet.

The `librechat.config.yaml` (and the inline MCP / endpoint URLs used by
the app) references these `100.100.x.x` endpoints, so without Tailscale
running inside the container those calls will fail with connection errors.

## Architecture

- **Single Container**: Tailscale runs in userspace networking mode inside
  the same container as the Node.js app.
- **Process Management**: `s6-overlay` supervises both `tailscaled` and
  the Node app (started as separate services).
- **SOCKS5 Proxy**: The Node app proxies outbound HTTP requests to
  tailnet IPs (`100.100.x.x`) through Tailscale's SOCKS5 proxy on
  port `1055`.
- **HTTP Proxy (optional)**: `tailscaled` also exposes an outbound HTTP
  proxy on port `1056` for any HTTP client that reads `HTTP_PROXY` /
  `HTTPS_PROXY` env vars (e.g. anything that uses `global-agent`).

## Setup

### 1. Generate a Tailscale Auth Key

1. Log in to your [Tailscale admin console](https://login.tailscale.com/admin/settings/keys).
2. Go to **Settings** > **Keys**.
3. Click **Generate auth key**.
4. For containers that can be recreated freely, enable **Ephemeral**
   (auto-cleanup) and **Reusable** if you want to share the key across
   staging + production.
5. Copy the generated key (format: `tskey-auth-...`).

### 2. Add the Secret to GitHub

Add `TAILSCALE_AUTHKEY` to your GitHub repository secrets:

1. Go to repository **Settings** > **Secrets and variables** > **Actions**.
2. Add a new secret: `TAILSCALE_AUTHKEY` = `tskey-auth-your-key-here`.

The Cloud Run deploy workflow (`.github/workflows/cloudrun-deploy.yml`)
already passes `TAILSCALE_AUTHKEY` and a per-environment `TS_HOSTNAME`
into both the staging and production deploy steps.

### 3. Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TAILSCALE_AUTHKEY` | Tailscale auth key | `tskey-auth-...` |
| `TS_HOSTNAME` | Hostname this container registers as on the tailnet | `ajrasakha-client-staging` |
| `SKIP_TAILSCALE_STATUS` | If `true`, the startup `tailscale status` check is skipped (useful in CI/local) | `false` |
| `TAILSCALE_BIN` | Override the `tailscale` binary path (used by the status check) | `/usr/bin/tailscale` |

## Container Startup (s6-overlay)

The container uses `s6-overlay` to manage multiple processes:

- **`tailscale` service** (`/etc/services.d/tailscale/run`): starts the
  Tailscale daemon in userspace networking mode, exposes the SOCKS5
  proxy on port 1055, then runs `tailscale up` with the auth key.
- **`node` service** (`/etc/services.d/node/run`): waits for Tailscale
  to be ready, prints `tailscale status`, and then runs `npm run backend`.

This guarantees the Tailscale daemon is running *before* the Node app
tries to make any outbound HTTP request.

## How the Node App Uses Tailscale

`api/server/index.js` hijacks `globalThis.fetch` at the very top of the
file (before any other imports) so that any HTTP request to a `100.100.`
URL is automatically routed through the SOCKS5 proxy:

```js
const { SocksProxyAgent } = require('socks-proxy-agent');
const globalSocksAgent = new SocksProxyAgent('socks5://127.0.0.1:1055');
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (url && typeof url.toString === 'function' && url.toString().includes('100.100.')) {
    return originalFetch(url, { ...options, agent: globalSocksAgent });
  }
  return originalFetch(url, options);
};
```

**Key points:**

- Only traffic to `100.100.x.x` IPs is routed through Tailscale.
- External traffic (e.g. Anthropic, Google, webhooks, OAuth callbacks)
  bypasses the proxy and uses normal routing.
- The check is based on the URL string, so it works for any HTTP client
  that uses the built-in `fetch` (Node 18+).
- Uses the `socks-proxy-agent` npm package for SOCKS5 support.

## Local Development

To run the container locally with Tailscale:

```bash
docker build -t ajrasakha-client .

docker run -d \
  --name ajrasakha-client \
  -e TAILSCALE_AUTHKEY=tskey-auth-YOUR_KEY \
  -e TS_HOSTNAME=ajrasakha-client-local \
  -e MONGO_URI=mongodb://host.docker.internal:27017/LibreChat \
  -p 3080:3080 \
  ajrasakha-client
```

For local dev where you don't need Tailscale, you can simply omit
`TAILSCALE_AUTHKEY` and the SOCKS5 interceptor will be set up but never
triggered (since nothing will try to reach `100.100.x.x`).

## Verifying the Tailscale Connection

Check the container logs:

```bash
docker logs ajrasakha-client
```

Look for:

- `=== TAILSCALE UP FINISHED (EXIT CODE: 0) ===`
- `=== TAILSCALE STATUS ===` followed by the list of peers
- A line like `100.x.x.x   ajrasakha-client-staging   user@   linux   -`

Or exec into the container and run `tailscale` directly:

```bash
docker exec -it ajrasakha-client sh
tailscale status
tailscale ip
tailscale ping <peer-name>
```

The pre-existing `checkTailscaleStatus()` function in `api/server/index.js`
also writes a proof file to `/app/logs/tailscale-status.log` (or
`$LIBRECHAT_LOG_DIR` if set) - this is useful when stdout is detached
(e.g. Cloud Run). You can fetch it from a running container with:

```bash
docker exec ajrasakha-client cat /app/logs/tailscale-status.log
```

## Troubleshooting

### Container fails to start

Check the auth key is valid and not expired. Generate a new key at
https://login.tailscale.com/admin/settings/keys if needed.

### `tailscaled.sock was not created within 15 seconds`

The Tailscale daemon failed to start. Check:

1. `/var/run/tailscale` and `/var/lib/tailscale` are writable.
2. The `tailscale` package was installed correctly
   (`docker exec ajrasakha-client tailscale version`).
3. The container has outbound network access on UDP 41641 (Tailscale's
   coordination server).

### App can't reach tailnet services (e.g. reviewer MCP)

Verify:

1. The Tailscale device shows up in the Tailscale admin console.
2. The internal service is online on the tailnet
   (`tailscale ping <peer>` from inside the container).
3. The URL in `librechat.config.yaml` matches the `100.100.x.x` IP of
   the target service.
4. `tailscale status` from inside the container shows the peer as
   "direct" or "relay" (not "offline").

### Firefox / browser-side Tailscale issues

This is only relevant if you also need to reach `https://chat.annam.ai`
from a machine that's not on the tailnet. The browser-side Tailscale
client is independent of this container-side integration.

## Security Notes

- Use **ephemeral auth keys** for containers that can be recreated freely
  (Cloud Run / dev sandboxes). This prevents stale devices from
  accumulating in your tailnet.
- The auth key is passed as an environment variable, so ensure it's
  stored as a GitHub secret (never committed).
- Tailscale encrypts all traffic between nodes with WireGuard.
- Only `100.100.x.x` traffic is routed through Tailscale; other services
  use normal routing.
- The SOCKS5 proxy is bound to `127.0.0.1` only and is not exposed to
  the public internet.
- Container runs as `root` so `tailscaled` can manage `/var/run/tailscale`
  and the TUN device. This matches the wa-client setup.

## File map

| File | Purpose |
|------|---------|
| `s6-scripts/tailscale-run` | s6 service that starts `tailscaled` and runs `tailscale up` |
| `s6-scripts/node-run` | s6 service that runs `npm run backend` (after Tailscale is up) |
| `Dockerfile` | Installs `tailscale`, downloads s6-overlay, copies the two scripts, sets `ENTRYPOINT ["/init"]` |
| `api/server/index.js` | Hijacks `globalThis.fetch` to route `100.100.x.x` traffic through SOCKS5 + runs `checkTailscaleStatus()` |
| `package.json` | Adds `socks-proxy-agent` dependency |
| `.env.example` | Documents `TAILSCALE_AUTHKEY`, `TS_HOSTNAME`, `SKIP_TAILSCALE_STATUS` |
| `.github/workflows/cloudrun-deploy.yml` | Passes `TAILSCALE_AUTHKEY` + `TS_HOSTNAME` to Cloud Run for staging and production |
