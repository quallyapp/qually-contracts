const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const crypto = require('crypto');

class TatumService {
  constructor() {
    this.apiKey = config.tatum.apiKey;
    this.gatewayUrl = `https://sui-${config.sui.network}.gateway.tatum.io`;
    this.apiUrl = config.tatum.apiUrl;

    // Create axios instance for Tatum RPC
    this.rpcClient = axios.create({
      baseURL: this.gatewayUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: 30000,
    });

    // Create axios instance for Tatum REST API (notifications)
    // Uses api.tatum.io, not the RPC gateway
    this.restClient = axios.create({
      baseURL: this.apiUrl || 'https://api.tatum.io/v3',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      timeout: 30000,
    });
  }

  /**
   * Make a JSON-RPC call to Sui via Tatum
   */
  async rpcCall(method, params = []) {
    try {
      const response = await this.rpcClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      logger.error(`Tatum RPC call failed: ${method}`, error.message);
      throw error;
    }
  }

  /**
   * Get SUI balance for an address
   * Tatum uses suix_ prefix for balance/coin methods
   */
  async getBalance(address) {
    try {
      const result = await this.rpcCall('suix_getBalance', [address]);
      return {
        address,
        totalBalance: BigInt(result.totalBalance),
        coins: result.coins || [],
      };
    } catch (error) {
      logger.error('Failed to get balance:', error.message);
      throw error;
    }
  }

  /**
   * Get native SUI balance
   */
  async getNativeBalance(address) {
    try {
      const result = await this.rpcCall('suix_getBalance', [address, '0x2::sui::SUI']);
      return {
        address,
        balance: BigInt(result.totalBalance),
      };
    } catch (error) {
      logger.error('Failed to get native balance:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction details by digest
   */
  async getTransaction(digest) {
    try {
      const result = await this.rpcCall('sui_getTransactionBlock', [
        digest,
        { showEffects: true, showEvents: true, showObjectChanges: true },
      ]);
      return result;
    } catch (error) {
      logger.error('Failed to get transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get recent transactions for an address
   * Tatum uses suix_queryTransactionBlocks
   */
  async getTransactionsByAddress(address, limit = 20) {
    try {
      const result = await this.rpcCall('suix_queryTransactionBlocks', [
        { ToAddress: address },
        null,
        limit,
        true, // ascending
      ]);
      return result;
    } catch (error) {
      logger.error('Failed to get transactions:', error.message);
      throw error;
    }
  }

  /**
   * Get events by package and module
   * Tatum uses suix_queryEvents with MoveModule filter
   */
  async getEventsByPackage(packageId, options = {}) {
    try {
      const { limit = 100, cursor = null } = options;
      const result = await this.rpcCall('suix_queryEvents', [
        { MoveModule: { package: packageId, module: 'bounty' } },
        cursor,
        limit,
        true, // ascending
      ]);
      return result;
    } catch (error) {
      logger.error('Failed to get events:', error.message);
      throw error;
    }
  }

  /**
   * Get events by module
   */
  async getEventsByModule(packageId, moduleName, options = {}) {
    try {
      const { limit = 100, cursor = null } = options;
      const result = await this.rpcCall('suix_queryEvents', [
        { MoveModule: { package: packageId, module: moduleName } },
        cursor,
        limit,
        true,
      ]);
      return result;
    } catch (error) {
      logger.error('Failed to get events:', error.message);
      throw error;
    }
  }

  /**
   * Get latest checkpoint sequence number
   */
  async getLatestCheckpoint() {
    try {
      const result = await this.rpcCall('sui_getLatestCheckpointSequenceNumber');
      return result;
    } catch (error) {
      logger.error('Failed to get checkpoint:', error.message);
      throw error;
    }
  }

  /**
   * Register a webhook for address events
   * Uses Tatum REST notification API (api.tatum.io)
   */
  async subscribeAddressEvent(address, webhookUrl) {
    try {
      const response = await this.restClient.post('/subscription', {
        type: 'ADDRESS_EVENT',
        attr: {
          address,
          chain: 'SUI',
          url: webhookUrl,
        },
      });
      logger.info(`Tatum webhook registered for address: ${address}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to register Tatum webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Remove a webhook subscription
   */
  async unsubscribeAddressEvent(subscriptionId) {
    try {
      await this.restClient.delete(`/subscription/${subscriptionId}`);
      logger.info(`Tatum webhook removed: ${subscriptionId}`);
    } catch (error) {
      logger.error('Failed to remove Tatum webhook:', error.message);
      throw error;
    }
  }

  /**
   * List all webhook subscriptions
   */
  async listSubscriptions() {
    try {
      const response = await this.restClient.get('/subscription?pageSize=50');
      return response.data;
    } catch (error) {
      logger.error('Failed to list subscriptions:', error.message);
      throw error;
    }
  }

  /**
   * Validate webhook signature (HMAC-SHA256)
   */
  validateWebhookSignature(payload, signature) {
    if (!config.tatum.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping validation');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.tatum.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastTransaction(txBytes) {
    try {
      const result = await this.rpcCall('sui_executeTransactionBlock', [
        txBytes,
        'ImmediateWaitForLocalExecution',
      ]);
      return result;
    } catch (error) {
      logger.error('Failed to broadcast transaction:', error.message);
      throw error;
    }
  }

  /**
   * Get reference gas price
   */
  async getReferenceGasPrice() {
    try {
      const result = await this.rpcCall('suix_getReferenceGasPrice');
      return result;
    } catch (error) {
      logger.error('Failed to get gas price:', error.message);
      throw error;
    }
  }
}

module.exports = new TatumService();
