const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');

router.get('/:messageId', requireJwtAuth, async (req, res) => {
  const { messageId } = req.params;

  try {
    const REVIEW_SYSTEM_URL = process.env.REVIEW_SYSTEM_URL;
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

    if (!REVIEW_SYSTEM_URL || !INTERNAL_API_KEY) {
      logger.error('Missing REVIEW_SYSTEM_URL or INTERNAL_API_KEY in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const axios = require('axios');
    const response = await axios.get(`${REVIEW_SYSTEM_URL}/api/answers/message/${messageId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': INTERNAL_API_KEY
      }
    });

    const data = response.data;
    return res.status(200).json(data);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: 'No final answer found for this message ID.' });
    }
    logger.error('Error proxying to Review System API:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return res.status(500).json({ 
      message: 'Failed to fetch answer', 
      error: error.message,
      details: error.response?.data || 'No additional details provided by Review System'
    });
  }
});

module.exports = router;
