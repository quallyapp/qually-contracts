const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

class WalrusService {
  constructor() {
    this.publisherUrl = config.walrus.publisherUrl;
    this.aggregatorUrl = config.walrus.aggregatorUrl;
    this.epochs = config.walrus.epochs;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Upload a blob to Walrus with retry logic
   * @param {Buffer|Uint8Array} data - The data to upload
   * @param {Object} options - Upload options
   * @returns {Object} - { blobId, blobHash, alreadyCertified, size }
   */
  async uploadBlob(data, options = {}) {
    const epochs = options.epochs || this.epochs;
    const deletable = options.deletable || false;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Walrus uses PUT /v1/blobs (not POST /v1/store)
        const params = new URLSearchParams({ epochs: epochs.toString() });
        if (deletable) params.append('deletable', 'true');
        if (options.permanent) params.append('permanent', 'true');
        if (options.sendObjectTo) params.append('send_object_to', options.sendObjectTo);

        const response = await axios.put(
          `${this.publisherUrl}/v1/blobs?${params.toString()}`,
          data,
          {
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 60000, // 60 second timeout for large uploads
          }
        );

        const result = response.data;
        const blobInfo = result.newlyCreated?.blobObject || result.alreadyCertified;

        if (!blobInfo) {
          throw new Error('Invalid response from Walrus publisher');
        }

        const blobId = blobInfo.blobId;
        const blobHash = blobInfo.blobHash;
        const size = data.length;
        const alreadyCertified = !!result.alreadyCertified;

        logger.info(`Blob uploaded to Walrus: ${blobId} (${size} bytes, attempt ${attempt})`);

        return {
          blobId,
          blobHash,
          size,
          alreadyCertified,
          cost: result.newlyCreated?.blobObject?.storageFee || '0',
        };
      } catch (error) {
        logger.warn(`Walrus upload attempt ${attempt} failed:`, error.message);

        if (attempt === this.maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        await this.sleep(this.retryDelay * attempt);
      }
    }
  }

  /**
   * Upload JSON data to Walrus
   */
  async uploadJson(jsonData, options = {}) {
    const jsonString = JSON.stringify(jsonData);
    const data = Buffer.from(jsonString, 'utf-8');

    const result = await this.uploadBlob(data, options);
    return {
      ...result,
      contentType: 'application/json',
    };
  }

  /**
   * Upload text content to Walrus
   */
  async uploadText(text, options = {}) {
    const data = Buffer.from(text, 'utf-8');

    const result = await this.uploadBlob(data, options);
    return {
      ...result,
      contentType: 'text/plain',
    };
  }

  /**
   * Upload file with automatic content type detection
   */
  async uploadFile(buffer, filename, options = {}) {
    const contentType = this.getContentType(filename);
    const data = buffer;

    const result = await this.uploadBlob(data, options);
    return {
      ...result,
      contentType,
      filename,
    };
  }

  /**
   * Read a blob from Walrus by blob ID with retry.
   * @param {string} blobId - The blob ID to read
   * @param {Object} options - { waitForCert: bool, maxWaitMs: number }
   *   If waitForCert is true, polls for certification before attempting read.
   *   Default: false (fast path, retries on 404).
   */
  async readBlob(blobId, options = {}) {
    const { waitForCert = false, maxWaitMs = 120000 } = options;

    if (waitForCert) {
      const certified = await this.waitForCertification(blobId, maxWaitMs);
      if (!certified) {
        throw new Error(`Blob ${blobId} not certified after ${maxWaitMs / 1000}s`);
      }
    }

    const maxAttempts = waitForCert ? 3 : 8;
    const baseDelay = waitForCert ? 2000 : 3000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${this.aggregatorUrl}/v1/${blobId}`,
          {
            responseType: 'arraybuffer',
            timeout: 30000,
          }
        );

        const buffer = Buffer.from(response.data);
        logger.info(`Blob retrieved from Walrus: ${blobId} (${buffer.length} bytes, attempt ${attempt})`);
        return buffer;
      } catch (error) {
        const is404 = error.response?.status === 404;
        logger.warn(`Walrus read attempt ${attempt}/${maxAttempts} failed: ${is404 ? 'not yet available' : error.message}`);

        if (attempt === maxAttempts) {
          throw new Error(`Blob ${blobId} not available after ${maxAttempts} attempts`);
        }

        const delay = baseDelay * attempt;
        await this.sleep(delay);
      }
    }
  }

  /**
   * Read a blob that was just uploaded. Waits for certification then reads.
   * Use this after uploadBlob() to ensure the blob is available.
   */
  async readBlobAfterUpload(blobId, maxWaitMs = 180000) {
    logger.info(`readBlobAfterUpload: waiting for certification of ${blobId}...`);
    return this.readBlob(blobId, { waitForCert: true, maxWaitMs });
  }

  /**
   * Read and parse JSON from Walrus
   */
  async readJson(blobId) {
    const buffer = await this.readBlob(blobId);
    const jsonString = buffer.toString('utf-8');

    try {
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error(`Failed to parse JSON from blob ${blobId}`);
      throw new Error('Invalid JSON in blob');
    }
  }

  /**
   * Get blob info/status
   */
  async getBlobInfo(blobId) {
    try {
      const response = await axios.get(
        `${this.aggregatorUrl}/v1/${blobId}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Blob not found or not yet certified
      }
      logger.error('Failed to get blob info:', error.message);
      throw error;
    }
  }

  /**
   * Check if a blob is certified and available for reading
   */
  async isBlobCertified(blobId) {
    try {
      const response = await axios.get(
        `${this.aggregatorUrl}/v1/${blobId}`,
        {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for blob certification with configurable timeout
   */
  async waitForCertification(blobId, maxWaitMs = 120000) {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    logger.info(`Waiting for blob ${blobId} certification (max ${maxWaitMs / 1000}s)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const isCertified = await this.isBlobCertified(blobId);
      if (isCertified) {
        logger.info(`Blob ${blobId} certified after ${(Date.now() - startTime) / 1000}s`);
        return true;
      }
      await this.sleep(checkInterval);
    }

    logger.warn(`Blob ${blobId} certification timeout after ${maxWaitMs / 1000}s`);
    return false;
  }

  /**
   * Verify blob integrity by comparing hash
   */
  async verifyBlobIntegrity(blobId, expectedHash) {
    try {
      const buffer = await this.readBlob(blobId);
      const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const isValid = actualHash === expectedHash;

      if (!isValid) {
        logger.warn(`Blob integrity mismatch for ${blobId}: expected ${expectedHash}, got ${actualHash}`);
      }

      return isValid;
    } catch (error) {
      logger.error(`Failed to verify blob integrity: ${error.message}`);
      return false;
    }
  }

  /**
   * Batch upload multiple blobs
   */
  async uploadBatch(items, options = {}) {
    const results = [];

    for (const item of items) {
      try {
        const result = await this.uploadBlob(item.data, options);
        results.push({
          success: true,
          blobId: result.blobId,
          blobHash: result.blobHash,
          size: item.data.length,
          contentType: item.contentType || 'application/octet-stream',
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          size: item.data.length,
        });
      }
    }

    return results;
  }

  /**
   * Get content type from filename
   */
  getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'json': 'application/json',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'zip': 'application/zip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new WalrusService();
