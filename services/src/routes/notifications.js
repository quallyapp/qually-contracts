const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification');
const logger = require('../utils/logger');

/**
 * POST /notifications/subscribe
 * Subscribe to notifications
 * Body: { userId: string, channels?: { email?, webhook? } }
 */
router.post('/subscribe', (req, res) => {
  try {
    const { userId, channels } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    notificationService.subscribe(userId, channels);
    res.json({ success: true, message: 'Subscribed to notifications' });
  } catch (error) {
    logger.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * DELETE /notifications/subscribe/:userId
 * Unsubscribe from notifications
 */
router.delete('/subscribe/:userId', (req, res) => {
  try {
    notificationService.unsubscribe(req.params.userId);
    res.json({ success: true, message: 'Unsubscribed from notifications' });
  } catch (error) {
    logger.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /notifications/status
 * Get notification service status
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    subscribers: notificationService.getSubscriberCount(),
  });
});

module.exports = router;
