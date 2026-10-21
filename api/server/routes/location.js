const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

const proxyLocation = (path, queryKeys = []) => async (req, res) => {
  const baseUrl = process.env.REVIEW_SYSTEM_URL;
  const apiKey = (process.env.REVIEW_SYSTEM_API_AUTH_KEY || '').replace(/^["']|["']$/g, '');

  if (!baseUrl) {
    console.error('###Missing REVIEW_SYSTEM_URL in environment variables');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  if (!apiKey) {
    console.error('###Missing REVIEW_SYSTEM_API_AUTH_KEY in environment variables');
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
    console.log(`Successfully fetched location/${path} with params:`, params);
    console.log(`Response data:`, response.data);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Error fetching location/${path} with params:`, params);
    console.error(`Error fetching location/${path}:`, {
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
