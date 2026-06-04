const express = require('express');
const router = express.Router();
const walrusService = require('../services/walrus');
const logger = require('../utils/logger');

/**
 * POST /storage/upload
 * Upload data to Walrus
 * Body: { data: string (base64), options?: { epochs?, deletable? } }
 */
router.post('/upload', async (req, res) => {
  try {
    const { data, options } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'data required (base64 encoded)' });
    }

    const buffer = Buffer.from(data, 'base64');
    const result = await walrusService.uploadBlob(buffer, options);

    res.json({
      success: true,
      blobId: result.blobId,
      blobHash: result.blobHash,
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload' });
  }
});

/**
 * POST /storage/upload/json
 * Upload JSON to Walrus
 * Body: { json: any, options?: { epochs?, deletable? } }
 */
router.post('/upload/json', async (req, res) => {
  try {
    const { json, options } = req.body;

    if (!json) {
      return res.status(400).json({ error: 'json required' });
    }

    const result = await walrusService.uploadJson(json, options);

    res.json({
      success: true,
      blobId: result.blobId,
      blobHash: result.blobHash,
    });
  } catch (error) {
    logger.error('JSON upload error:', error);
    res.status(500).json({ error: 'Failed to upload JSON' });
  }
});

/**
 * GET /storage/read/:blobId
 * Read blob from Walrus
 */
router.get('/read/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    const buffer = await walrusService.readBlob(blobId);

    res.set('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (error) {
    logger.error('Read error:', error);
    res.status(500).json({ error: 'Failed to read blob' });
  }
});

/**
 * GET /storage/read/:blobId/json
 * Read and parse JSON from Walrus
 */
router.get('/read/:blobId/json', async (req, res) => {
  try {
    const { blobId } = req.params;
    const json = await walrusService.readJson(blobId);
    res.json(json);
  } catch (error) {
    logger.error('JSON read error:', error);
    res.status(500).json({ error: 'Failed to read JSON' });
  }
});

/**
 * GET /storage/info/:blobId
 * Get blob info/status
 */
router.get('/info/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    const info = await walrusService.getBlobInfo(blobId);
    res.json(info);
  } catch (error) {
    logger.error('Info error:', error);
    res.status(500).json({ error: 'Failed to get blob info' });
  }
});

/**
 * POST /storage/verify/:blobId
 * Verify blob integrity
 * Body: { expectedHash: string }
 */
router.post('/verify/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    const { expectedHash } = req.body;

    if (!expectedHash) {
      return res.status(400).json({ error: 'expectedHash required' });
    }

    const isValid = await walrusService.verifyBlobIntegrity(blobId, expectedHash);
    res.json({ valid: isValid });
  } catch (error) {
    logger.error('Verify error:', error);
    res.status(500).json({ error: 'Failed to verify blob' });
  }
});

module.exports = router;
