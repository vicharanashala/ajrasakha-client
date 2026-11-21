const { HttpsProxyAgent } = require('https-proxy-agent');

// Removes surrounding quotes some .env files keep around values.
const cleanEnvValue = (value) => (value || '').trim().replace(/^["']|["']$/g, '');

// Proxy agent built once from PROXY. Undefined while not created, null when PROXY is empty.
let cachedProxyAgent;

// Returns the axios options that send the request through PROXY when it is set. On Cloud Run the
// agent services are only reachable over the Tailscale network, and the container reaches them
// through Tailscale's proxy that PROXY points to. Locally PROXY is usually empty and the machine
// is on the tailnet itself, so the request goes direct.
function getProxyOptions() {
  if (cachedProxyAgent === undefined) {
    const proxyUrl = cleanEnvValue(process.env.PROXY);
    cachedProxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
  }
  if (!cachedProxyAgent) {
    return {};
  }
  // proxy: false stops axios applying its own env proxy handling on top of the agent.
  return { httpAgent: cachedProxyAgent, httpsAgent: cachedProxyAgent, proxy: false };
}

// True when requests to the agent services go through PROXY. Used in error logs.
const isUsingProxy = () => !!cachedProxyAgent;

// Builds the base URL of a service on AGENT_HOST_IP at the given port, or null when the host is missing.
function getAgentServiceBaseUrl(port) {
  const host = cleanEnvValue(process.env.AGENT_HOST_IP).replace(/\/+$/, '');
  if (!host) {
    return null;
  }
  const base = /^https?:\/\//.test(host) ? host : `http://${host}`;
  return `${base}:${port}`;
}

// Reads the farmer's saved coordinates. The database stores latitude and longitude, and the
// geo_ prefixed names are accepted too because the shared client type uses them.
function getFarmerCoordinates(user) {
  const location = user?.farmerProfile?.location ?? {};
  const lat = Number(location.latitude ?? location.geo_latitude);
  const long = Number(location.longitude ?? location.geo_longitude);
  const isValid =
    Number.isFinite(lat) && Number.isFinite(long) && Math.abs(lat) <= 90 && Math.abs(long) <= 180;
  return isValid ? { lat, long } : null;
}

// Converts a value to a number, or null when the service sent nothing usable.
const toNumberOrNull = (value) => {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
};

module.exports = {
  cleanEnvValue,
  getProxyOptions,
  isUsingProxy,
  getAgentServiceBaseUrl,
  getFarmerCoordinates,
  toNumberOrNull,
};
