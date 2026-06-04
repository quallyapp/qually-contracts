const config = require('../config');
const logger = require('../utils/logger');

/**
 * Verify webhook signature from Tatum
 */
function verifyTatumSignature(req, res, next) {
  const signature = req.headers['x-tatum-signature'];

  if (!config.tatum.webhookSecret) {
    // Skip validation if no secret configured
    return next();
  }

  if (!signature) {
    logger.warn('Missing webhook signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', config.tatum.webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * Rate limiting middleware (simple in-memory)
 */
const rateLimit = new Map();

function rateLimiter(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimit.has(ip)) {
      rateLimit.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const record = rateLimit.get(ip);

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ error: 'Too many requests' });
    }

    record.count++;
    next();
  };
}

module.exports = {
  verifyTatumSignature,
  rateLimiter,
};
