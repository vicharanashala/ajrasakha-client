const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  getProxyOptions,
  isUsingProxy,
  getAgentServiceBaseUrl,
  getFarmerCoordinates,
  toNumberOrNull,
} = require('~/server/utils/agentService');

const router = express.Router();

// How long to wait for the weather service before giving up.
const WEATHER_REQUEST_TIMEOUT_MS = 10000;

// Port the weather service listens on. Fixed in code, only the host comes from the environment.
const WEATHER_SERVICE_PORT = 8085;

// Builds the weather service URL from AGENT_HOST_IP and the fixed port, or null when the host is missing.
function getWeatherServiceUrl() {
  const base = getAgentServiceBaseUrl(WEATHER_SERVICE_PORT);
  return base ? `${base}/live` : null;
}

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

  // Full request URL, included in the error log so a failed call can be traced.
  const requestUrl = `${serviceUrl}?${new URLSearchParams({
    lat: String(coordinates.lat),
    long: String(coordinates.long),
  })}`;

  try {
    const { data } = await axios.get(requestUrl, {
      headers: { accept: 'application/json' },
      timeout: WEATHER_REQUEST_TIMEOUT_MS,
      ...getProxyOptions(),
    });

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
      viaProxy: isUsingProxy(),
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return res.status(502).json({ message: 'Weather is unavailable right now' });
  }
});

module.exports = router;
