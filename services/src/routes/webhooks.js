const express = require('express');
const router = express.Router();
const webhookHandler = require('../services/webhookHandler');
const tatumService = require('../services/tatum');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * POST /webhooks/tatum
 * Receive Tatum webhook events
 */
router.post('/tatum', (req, res) => webhookHandler.handleTatumWebhook(req, res));

/**
 * POST /webhooks/tatum/subscribe
 * Subscribe to address events
 * Body: { address: string, webhookUrl: string }
 */
router.post('/tatum/subscribe', async (req, res) => {
  try {
    const { address, webhookUrl } = req.body;

    if (!address || !webhookUrl) {
      return res.status(400).json({ error: 'address and webhookUrl required' });
    }

    const result = await tatumService.subscribeAddressEvent(address, webhookUrl);
    res.json({ success: true, subscription: result });
  } catch (error) {
    logger.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * DELETE /webhooks/tatum/subscribe/:id
 * Unsubscribe from address events
 */
router.delete('/tatum/subscribe/:id', async (req, res) => {
  try {
    await tatumService.unsubscribeAddressEvent(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
