const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// How long to wait for the weather service before giving up.
const WEATHER_REQUEST_TIMEOUT_MS = 10000;

// Port the weather service listens on. Fixed in code, only the host comes from the environment.
const WEATHER_SERVICE_PORT = 8085;

// Removes surrounding quotes some .env files keep around values.
const cleanEnvValue = (value) => (value || '').trim().replace(/^["']|["']$/g, '');

// Builds the weather service URL from AGENT_HOST_IP and the fixed port, or null when the host is missing.
function getWeatherServiceUrl() {
  const host = cleanEnvValue(process.env.AGENT_HOST_IP).replace(/\/+$/, '');
  if (!host) {
    return null;
  }
  const base = /^https?:\/\//.test(host) ? host : `http://${host}`;
  return `${base}:${WEATHER_SERVICE_PORT}/live`;
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

// Keeps only the fields the app shows, so unexpected upstream data never reaches the browser.
function toWeatherResponse(data) {
  return {
    liveTemperature: toNumberOrNull(data?.liveTemperature),
    humidity: toNumberOrNull(data?.humidity),
    rainfall: toNumberOrNull(data?.rainfall),
    windSpeed: toNumberOrNull(data?.windSpeed),
    weatherCondition: typeof data?.weatherCondition === 'string' ? data.weatherCondition : '',
    feelsLikeTemperature: toNumberOrNull(data?.feelsLikeTemperature),
    source: typeof data?.source === 'string' ? data.source : null,
    stationName: typeof data?.station_name === 'string' ? data.station_name : null,
    stationDistanceKm: toNumberOrNull(data?.station_distance_km),
    recordedAt: typeof data?.recorded_at === 'string' ? data.recorded_at : null,
  };
}

// Returns live weather for the signed in farmer's saved location from the weather service.
// The request URL and the service's response are logged to the backend console.
router.get('/', requireJwtAuth, async (req, res) => {
  const serviceUrl = getWeatherServiceUrl();
  if (!serviceUrl) {
    logger.error('[weather] AGENT_HOST_IP is not set');
    return res.status(500).json({ message: 'Weather service is not configured' });
  }

  const coordinates = getFarmerCoordinates(req.user);
  if (!coordinates) {
    return res.status(404).json({ message: 'Farmer location is not set' });
  }

  // Full request URL, logged so the call to the weather service can be traced in the console.
  const requestUrl = `${serviceUrl}?${new URLSearchParams({
    lat: String(coordinates.lat),
    long: String(coordinates.long),
  })}`;

  try {
    logger.info(`[weather] Requesting ${requestUrl}`);
    const { data } = await axios.get(requestUrl, {
      headers: { accept: 'application/json' },
      timeout: WEATHER_REQUEST_TIMEOUT_MS,
    });
    logger.info('[weather] Response', data);

    const weather = toWeatherResponse(data);
    if (weather.liveTemperature === null) {
      logger.error('[weather] Weather service returned no live temperature');
      return res.status(502).json({ message: 'Weather is unavailable right now' });
    }

    // No browser caching: the app caches weather itself and must get fresh data right after the
    // farmer changes location, which a cached response for the same URL would block.
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(weather);
  } catch (error) {
    // Upstream details stay in the server log only, they are never sent to the browser.
    logger.error(`[weather] Failed to fetch live weather from ${requestUrl}`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return res.status(502).json({ message: 'Weather is unavailable right now' });
  }
});

module.exports = router;
