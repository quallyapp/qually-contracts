require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const { rateLimiter } = require('./middleware/auth');

// Routes
const webhookRoutes = require('./routes/webhooks');
const storageRoutes = require('./routes/storage');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
app.use(rateLimiter(100, 60000)); // 100 requests per minute

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Routes
app.use('/webhooks', webhookRoutes);
app.use('/storage', storageRoutes);
app.use('/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API info
app.get('/', (req, res) => {
  res.json({
    name: 'Qually Backend Service',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhooks: {
        tatum: '/webhooks/tatum',
        subscribe: 'POST /webhooks/tatum/subscribe',
        unsubscribe: 'DELETE /webhooks/tatum/subscribe/:id',
      },
      storage: {
        upload: 'POST /storage/upload',
        uploadJson: 'POST /storage/upload/json',
        read: 'GET /storage/read/:blobId',
        readJson: 'GET /storage/read/:blobId/json',
        info: 'GET /storage/info/:blobId',
        verify: 'POST /storage/verify/:blobId',
      },
      notifications: {
        subscribe: 'POST /notifications/subscribe',
        unsubscribe: 'DELETE /notifications/subscribe/:userId',
        status: 'GET /notifications/status',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  logger.info(`Qually Backend Service running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Tatum API: ${config.tatum.apiUrl ? 'Configured' : 'Not configured'}`);
  logger.info(`Walrus Publisher: ${config.walrus.publisherUrl}`);
});

module.exports = app;
