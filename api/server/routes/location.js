const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

const proxyLocation = (path, queryKeys = []) => async (req, res) => {
  const baseUrl = process.env.VITE_AJRASAKHA_SERVER_URL;
  const apiKey = (process.env.WEB_WEBHOOK_API_KEY || '').replace(/^["']|["']$/g, '');

  if (!baseUrl || !apiKey) {
    logger.error('Missing VITE_AJRASAKHA_SERVER_URL or WEB_WEBHOOK_API_KEY in environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const params = {};
  for (const key of queryKeys) {
    if (req.query[key] !== undefined) {
      params[key] = req.query[key];
    }
  }

  try {
    let cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    if (!cleanBaseUrl.endsWith('/api')) {
      cleanBaseUrl = `${cleanBaseUrl}/api`;
    }
    const response = await axios.get(`${cleanBaseUrl}/location/${path}`, {
      params,
      headers: { 'x-internal-api-key': apiKey },
      timeout: 15000,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    logger.error(`Error fetching location/${path}:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response) {
      return res.status(error.response.status).json({
        message: 'Error from location API',
        details: error.response.data,
      });
    }

    return res.status(500).json({ message: 'Failed to fetch locations', error: error.message });
  }
};

router.get('/states', proxyLocation('states'));
router.get('/districts', proxyLocation('districts', ['stateCode']));
router.get('/blocks', proxyLocation('blocks', ['districtCode']));
router.get('/villages', proxyLocation('villages', ['blockCode']));
router.get('/kvks', proxyLocation('kvks', ['districtCode']));

module.exports = router;
