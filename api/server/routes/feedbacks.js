const express = require('express');
const { Message, User } = require('~/db/models');
const { logger } = require('@librechat/data-schemas');
const { sendEmail } = require('~/server/utils');

const router = express.Router();

router.patch('/:messageId/status', async (req, res) => {
  try {
    const internalApiKey = req.headers['x-internal-api-key'];
    const expectedApiKey = process.env.INTERNAL_API_KEY;

    if (!expectedApiKey || internalApiKey !== expectedApiKey) {
      return res.status(403).json({ message: 'Forbidden: Invalid API key' });
    }

    const { messageId } = req.params;
    const { status, note } = req.body;

    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ message: 'Invalid status. Must be "accepted" or "rejected"' });
    }

    const message = await Message.findOne({ messageId });
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (!message.feedback) {
      return res.status(404).json({ message: 'No feedback exists for this message' });
    }

    if (message.feedback.status === 'accepted' || message.feedback.status === 'rejected') {
      return res.status(400).json({ message: 'Feedback status has already been processed' });
    }

    message.feedback.status = status;
    message.feedback.reviewNote = note;
    message.feedback.updatedAt = new Date();
    
    message.markModified('feedback');
    await message.save();

    return res.status(200).json({
      status,
      pendingFeedbackCount: 0
    });
  } catch (error) {
    logger.error('[Feedback Webhook] Error processing status update:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
