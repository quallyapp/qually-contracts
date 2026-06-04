require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  tatum: {
    apiKey: process.env.TATUM_API_KEY,
    apiUrl: process.env.TATUM_API_URL || 'https://api.tatum.io/v3',
    webhookSecret: process.env.TATUM_WEBHOOK_SECRET,
  },

  walrus: {
    publisherUrl: process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space',
    aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space',
    epochs: parseInt(process.env.WALRUS_EPOCHS) || 52,
  },

  sui: {
    network: process.env.SUI_NETWORK || 'testnet',
    packageId: process.env.QUALLY_PACKAGE_ID,
    treasuryId: process.env.TREASURY_OBJECT_ID,
    rpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  },

  notifications: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || 'noreply@qually.io',
  },

  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'qually-webhook-secret',
  },
};
