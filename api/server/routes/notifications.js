const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('~/server/middleware');
const Notification = require('~/db/notification');
const { logger } = require('@librechat/data-schemas');

router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const { filter = 'unread', page = 1, limit = 10 } = req.query;
    
    const query = { userId: req.user.id };
    if (filter === 'unread') query.isVisited = false;
    else if (filter === 'read') query.isVisited = true;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isVisited: false });
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    res.status(200).json({
      notifications,
      total,
      unreadCount,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit)
    });
  } catch (err) {
    logger.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// PATCH /api/notifications/mark-all-visited - mark all as visited
// Must be before /:id route to avoid being captured as an id
router.patch('/mark-all-visited', requireJwtAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isVisited: false }, { isVisited: true });
    res.status(200).json({ message: 'All notifications marked as visited' });
  } catch (err) {
    logger.error('Error marking all notifications as visited:', err);
    res.status(500).json({ message: 'Error marking notifications as visited' });
  }
});

// PATCH /api/notifications/:id/visited - mark single notification as visited
router.patch('/:id/visited', requireJwtAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isVisited: true },
      { new: true },
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json(notification);
  } catch (err) {
    logger.error('Error marking notification as visited:', err);
    res.status(500).json({ message: 'Error updating notification' });
  }
});

module.exports = router;
