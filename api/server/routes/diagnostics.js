const express = require('express');
const axios = require('axios');
const { execFileSync } = require('child_process');
const router = express.Router();

const LGD_API_KEY = process.env.LGD_API_KEY || process.env.LGD_VILLAGES_API_KEY;
const TEST_URL = 'https://api.data.gov.in/resource/a71e60f0-a21d-43de-a6c5-fa5d21600cdb';

/**
 * Run `tailscale status` (or `tailscale status --json`) and return the parsed result.
 * Returns a structured object so the route can always respond with JSON, even if
 * the binary is missing or the command fails.
 */
function runTailscaleStatus({ asJson = false } = {}) {
  const binary = process.env.TAILSCALE_BIN || 'tailscale';
  const args = ['status'];
  if (asJson) {
    args.push('--json');
  }

  try {
    const stdout = execFileSync(binary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
      encoding: 'utf8',
    });

    if (asJson) {
      try {
        return { success: true, reachable: true, parsed: JSON.parse(stdout), raw: stdout };
      } catch (parseErr) {
        return { success: true, reachable: true, parsed: null, raw: stdout, parseError: parseErr.message };
      }
    }

    return { success: true, reachable: true, raw: stdout };
  } catch (error) {
    return {
      success: false,
      reachable: false,
      error: {
        code: error.code,
        message: error.message,
        stderr: error.stderr ? error.stderr.toString().trim() : '',
      },
    };
  }
}

/**
 * GET /api/diagnostics/test-lgd
 * Tests if data.gov.in is reachable from this Cloud Run server
 * This endpoint is used to PROVE the connectivity issue.
 */
router.get('/test-lgd', async (req, res) => {
  const startTime = Date.now();

  console.log('========================================');
  console.log('[DIAGNOSTIC] Starting LGD connectivity test');
  console.log('[DIAGNOSTIC] Test URL:', TEST_URL);
  console.log('[DIAGNOSTIC] API Key configured:', LGD_API_KEY ? `YES (length: ${LGD_API_KEY.length})` : 'NO');
  console.log('========================================');

  try {
    const response = await axios.get(TEST_URL, {
      params: {
        'api-key': LGD_API_KEY,
        format: 'json',
        limit: 1
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'AjraSakha-CloudRun-Diagnostic/1.0'
      }
    });

    const duration = Date.now() - startTime;

    console.log('[DIAGNOSTIC] SUCCESS - Response received in', duration, 'ms');
    console.log('[DIAGNOSTIC] Status:', response.status);

    return res.json({
      success: true,
      reachable: true,
      duration_ms: duration,
      httpStatus: response.status,
      message: '✅ data.gov.in IS reachable from this Cloud Run server',
      data: {
        recordCount: response.data?.records?.length || 0,
        sampleRecord: response.data?.records?.[0] || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.log('========================================');
    console.log('[DIAGNOSTIC] FAILED - Connection error');
    console.log('[DIAGNOSTIC] Duration:', duration, 'ms');
    console.log('[DIAGNOSTIC] Error code:', error.code);
    console.log('[DIAGNOSTIC] Error message:', error.message);
    console.log('[DIAGNOSTIC] Error errno:', error.errno);
    console.log('[DIAGNOSTIC] Error syscall:', error.syscall);
    console.log('[DIAGNOSTIC] Full error:', error.stack);
    console.log('========================================');

    return res.json({
      success: false,
      reachable: false,
      duration_ms: duration,
      httpStatus: error.response?.status || null,
      error: {
        code: error.code,
        message: error.message,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port,
      },
      diagnosis: getDiagnosis(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/server-info
 * Returns info about the server environment
 */
router.get('/server-info', (req, res) => {
  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV,
    region: process.env.GCP_REGION || 'unknown',
    service: process.env.K_SERVICE || 'unknown',
    revision: process.env.K_REVISION || 'unknown',
    instanceId: process.env.HOSTNAME || 'unknown',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/diagnostics/egress-ip
 * Determines the public IP address that Cloud Run uses for outbound traffic
 * This is the IP that data.gov.in sees when we call them
 */
router.get('/egress-ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 10000 });
    res.json({
      success: true,
      egressIp: response.data.ip,
      message: 'This is the public IP that data.gov.in sees when we call them from Cloud Run',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      message: 'Could not determine egress IP',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/full-test
 * Combines all tests into one comprehensive diagnostic
 */
router.get('/full-test', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV,
      service: process.env.K_SERVICE || 'unknown',
      revision: process.env.K_REVISION || 'unknown',
    },
    egressIp: null,
    lgdTest: null,
  };

  // Get egress IP
  try {
    const ipResponse = await axios.get('https://api.ipify.org?format=json', { timeout: 10000 });
    results.egressIp = {
      success: true,
      ip: ipResponse.data.ip,
    };
  } catch (error) {
    results.egressIp = {
      success: false,
      error: error.message,
    };
  }

  // Test LGD
  const startTime = Date.now();
  try {
    const response = await axios.get(TEST_URL, {
      params: {
        'api-key': LGD_API_KEY,
        format: 'json',
        limit: 1
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'AjraSakha-CloudRun-Diagnostic/1.0'
      }
    });

    results.lgdTest = {
      success: true,
      reachable: true,
      duration_ms: Date.now() - startTime,
      httpStatus: response.status,
      recordCount: response.data?.records?.length || 0,
    };
  } catch (error) {
    results.lgdTest = {
      success: false,
      reachable: false,
      duration_ms: Date.now() - startTime,
      httpStatus: error.response?.status || null,
      error: {
        code: error.code,
        message: error.message,
        errno: error.errno,
        syscall: error.syscall,
      },
      diagnosis: getDiagnosis(error),
    };
  }

  console.log('[DIAGNOSTIC] Full test results:', JSON.stringify(results, null, 2));

  return res.json(results);
});

/**
 * GET /api/diagnostics/tailscale-status
 * Runs `tailscale status` on the host and returns the raw text output.
 * Useful for seeing which machines are currently in your Tailscale network.
 * Query `?json=1` to get a parsed JSON payload instead.
 */
router.get('/tailscale-status', (req, res) => {
  const wantsJson = req.query.json === '1' || req.query.json === 'true';
  const result = runTailscaleStatus({ asJson: wantsJson });

  if (!result.success) {
    return res.json({
      success: false,
      reachable: false,
      message: 'Could not run `tailscale status` on this host. Is Tailscale installed?',
      error: result.error,
      hint: 'Set SKIP_TAILSCALE_STATUS=true to silence startup checks, or install Tailscale on the host.',
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    success: true,
    reachable: true,
    ...(wantsJson
      ? { parsed: result.parsed, raw: result.raw, parseError: result.parseError || null }
      : { raw: result.raw }),
    timestamp: new Date().toISOString(),
  });
});

function getDiagnosis(error) {
  if (error.code === 'ECONNRESET') {
    return '🚨 ECONNRESET: The server actively closed the connection. This typically means data.gov.in is BLOCKING this Cloud Run IP address. The TCP connection was established but the server forcibly closed it before sending data.';
  }
  if (error.code === 'ENOTFOUND') {
    return '🚨 DNS FAILURE: Could not resolve the hostname api.data.gov.in';
  }
  if (error.code === 'ETIMEDOUT') {
    return '🚨 TIMEOUT: data.gov.in took too long to respond (>30s)';
  }
  if (error.code === 'ECONNREFUSED') {
    return '🚨 CONNECTION REFUSED: data.gov.in actively rejected the connection';
  }
  if (error.response?.status === 403) {
    return '🚨 FORBIDDEN: API key may be invalid or restricted';
  }
  if (error.response?.status === 429) {
    return '🚨 RATE LIMITED: Too many requests from this IP';
  }
  return `❌ UNKNOWN ERROR: ${error.code || 'no code'} - ${error.message}`;
}

module.exports = router;
