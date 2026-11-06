const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// Placeholder weather payload returned until a real weather provider is connected.
const DUMMY_WEATHER = Object.freeze({
  liveTemperature: 32.5,
  humidity: 65,
  rainfall: 0,
  windSpeed: 12.4,
  weatherCondition: 'Partly Cloudy',
  feelsLikeTemperature: 35.2,
});

// Returns the current weather for the signed in farmer. Always responds with dummy data for now.
router.get('/', requireJwtAuth, (req, res) => {
  res.status(200).json(DUMMY_WEATHER);
});

module.exports = router;
