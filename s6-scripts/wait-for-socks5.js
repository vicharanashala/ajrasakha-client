// wait-for-socks5.js
// Polls the SOCKS5 server on 127.0.0.1:1055 with a real protocol handshake
// (RFC 1928 greeting + method-selection response). Exits 0 once SOCKS5 is
// confirmed ready, 1 if the 5-minute timeout is exceeded.
//
// Why Node and not bash + dd: portable byte-handling via Buffer (no POSIX/GNU
// quirks), proper error propagation, and we already have node on PATH in the
// LibreChat container so there's no extra dependency.
//
// Env vars:
//   SOCKS_HOST         default 127.0.0.1
//   SOCKS_PORT         default 1055
//   SOCKS_TIMEOUT_MS   default 300000 (5 minutes -- cold start on a slow tailnet)
//
const net = require('net');

const HOST = process.env.SOCKS_HOST || '127.0.0.1';
const PORT = parseInt(process.env.SOCKS_PORT || '1055', 10);
const TIMEOUT_MS = parseInt(process.env.SOCKS_TIMEOUT_MS || '300000', 10);
const RETRY_MS = 1000;
const PROBE_TIMEOUT_MS = 3000;

const start = Date.now();

function probe() {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, HOST);
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      reject(err);
    };
    sock.setTimeout(PROBE_TIMEOUT_MS);
    sock.once('connect', () => {
      // SOCKS5 greeting: ver=5, nmethods=1, method=0 (no auth)
      sock.write(Buffer.from([0x05, 0x01, 0x00]));
    });
    sock.once('data', (data) => {
      // Expect: ver=5, method=0x00 (no auth accepted)
      if (data && data[0] === 0x05 && data[1] === 0x00) {
        settled = true;
        sock.end();
        resolve();
      } else {
        fail(new Error('unexpected SOCKS5 response: ' + (data ? data.toString('hex') : '<no data>')));
      }
    });
    sock.on('error', fail);
    sock.on('timeout', () => fail(new Error('socket timeout')));
  });
}

(async () => {
  let attempt = 0;
  while (Date.now() - start < TIMEOUT_MS) {
    attempt++;
    try {
      await probe();
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log('[socks5] ready after ' + elapsed + 's (attempt #' + attempt + ')');
      process.exit(0);
    } catch (err) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log('[socks5] not ready (' + elapsed + 's elapsed, attempt #' + attempt + '): ' + err.message);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  console.error('[socks5] FAILED after ' + Math.round(TIMEOUT_MS / 1000) + 's timeout');
  process.exit(1);
})();
