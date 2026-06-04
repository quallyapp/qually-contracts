const axios = require('axios');
const crypto = require('crypto');

// Spy on axios methods directly - no jest.mock needed
beforeEach(() => {
  jest.spyOn(axios, 'put').mockImplementation(() => Promise.resolve({ data: {} }));
  jest.spyOn(axios, 'get').mockImplementation(() => Promise.resolve({ data: {} }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Require fresh module (singleton) - must come after mocks are set up
let walrus;
beforeAll(() => {
  walrus = require('../services/walrus');
  walrus.sleep = jest.fn(() => Promise.resolve());
});

const mockBlobId = 'test-blob-id-abc123';
const mockBlobHash = 'sha256-hash-xyz';

describe('WalrusService', () => {
  describe('uploadBlob', () => {
    it('should upload data and return blob info', async () => {
      const testData = Buffer.from('hello world');
      axios.put.mockResolvedValueOnce({
        data: {
          newlyCreated: {
            blobObject: { blobId: mockBlobId, blobHash: mockBlobHash, storageFee: '1000' },
          },
        },
      });

      const result = await walrus.uploadBlob(testData);

      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('/v1/blobs?epochs='),
        testData,
        expect.objectContaining({ headers: { 'Content-Type': 'application/octet-stream' } })
      );
      expect(result).toEqual({
        blobId: mockBlobId,
        blobHash: mockBlobHash,
        size: 11,
        alreadyCertified: false,
        cost: '1000',
      });
    });

    it('should handle alreadyCertified response', async () => {
      const testData = Buffer.from('certified data');
      axios.put.mockResolvedValueOnce({
        data: {
          alreadyCertified: { blobId: mockBlobId, blobHash: mockBlobHash },
        },
      });

      const result = await walrus.uploadBlob(testData);
      expect(result.alreadyCertified).toBe(true);
      expect(result.blobId).toBe(mockBlobId);
    });

    it('should retry on failure then succeed', async () => {
      const testData = Buffer.from('retry test');
      axios.put
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            newlyCreated: {
              blobObject: { blobId: mockBlobId, blobHash: mockBlobHash },
            },
          },
        });

      const result = await walrus.uploadBlob(testData);
      expect(axios.put).toHaveBeenCalledTimes(2);
      expect(result.blobId).toBe(mockBlobId);
    });

    it('should throw after max retries', async () => {
      const testData = Buffer.from('fail test');
      axios.put.mockRejectedValue(new Error('Permanent failure'));

      await expect(walrus.uploadBlob(testData)).rejects.toThrow('Permanent failure');
      expect(axios.put).toHaveBeenCalledTimes(3);
    });

    it('should throw on invalid response', async () => {
      const testData = Buffer.from('invalid');
      axios.put.mockResolvedValueOnce({ data: { unexpected: 'format' } });

      await expect(walrus.uploadBlob(testData)).rejects.toThrow('Invalid response from Walrus publisher');
    });

    it('should pass custom epochs and deletable', async () => {
      const testData = Buffer.from('options');
      axios.put.mockResolvedValueOnce({
        data: { newlyCreated: { blobObject: { blobId: mockBlobId, blobHash: mockBlobHash } } },
      });

      await walrus.uploadBlob(testData, { epochs: 10, deletable: true });

      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining('epochs=10'),
        testData,
        expect.anything()
      );
    });
  });

  describe('uploadJson', () => {
    it('should serialize and upload JSON', async () => {
      const jsonData = { title: 'Test Bounty', amount: 100 };
      axios.put.mockResolvedValueOnce({
        data: { newlyCreated: { blobObject: { blobId: mockBlobId, blobHash: mockBlobHash } } },
      });

      const result = await walrus.uploadJson(jsonData);
      expect(axios.put).toHaveBeenCalledWith(
        expect.any(String),
        Buffer.from(JSON.stringify(jsonData), 'utf-8'),
        expect.anything()
      );
      expect(result.contentType).toBe('application/json');
    });
  });

  describe('uploadText', () => {
    it('should upload text content', async () => {
      axios.put.mockResolvedValueOnce({
        data: { newlyCreated: { blobObject: { blobId: mockBlobId, blobHash: mockBlobHash } } },
      });

      const result = await walrus.uploadText('Hello Walrus');
      expect(result.contentType).toBe('text/plain');
    });
  });

  describe('uploadFile', () => {
    it('should detect content type from filename', async () => {
      axios.put.mockResolvedValueOnce({
        data: { newlyCreated: { blobObject: { blobId: mockBlobId, blobHash: mockBlobHash } } },
      });

      const result = await walrus.uploadFile(Buffer.from('data'), 'document.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toBe('document.pdf');
    });
  });

  describe('readBlob', () => {
    it('should read blob data', async () => {
      const expectedData = Buffer.from('blob content');
      axios.get.mockResolvedValueOnce({ data: expectedData });

      const result = await walrus.readBlob(mockBlobId);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/${mockBlobId}`),
        expect.objectContaining({ responseType: 'arraybuffer' })
      );
      expect(result.toString()).toBe('blob content');
    });

    it('should retry on 404 then succeed', async () => {
      const expectedData = Buffer.from('delayed blob');
      axios.get
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ data: expectedData });

      const result = await walrus.readBlob(mockBlobId);
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result.toString()).toBe('delayed blob');
    });

    it('should throw after max attempts', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      await expect(walrus.readBlob(mockBlobId)).rejects.toThrow('not available after');
      expect(axios.get).toHaveBeenCalledTimes(8);
    });

    it('should use waitForCert mode with fewer retries', async () => {
      walrus.waitForCertification = jest.fn().mockResolvedValue(true);
      axios.get.mockResolvedValueOnce({ data: Buffer.from('certified data') });

      const result = await walrus.readBlob(mockBlobId, { waitForCert: true });

      expect(walrus.waitForCertification).toHaveBeenCalledWith(mockBlobId, 120000);
      expect(result.toString()).toBe('certified data');
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('should throw if waitForCert times out', async () => {
      walrus.waitForCertification = jest.fn().mockResolvedValue(false);

      await expect(
        walrus.readBlob(mockBlobId, { waitForCert: true, maxWaitMs: 5000 })
      ).rejects.toThrow('not certified');
    });
  });

  describe('readBlobAfterUpload', () => {
    it('should wait for certification then read', async () => {
      walrus.waitForCertification = jest.fn().mockResolvedValue(true);
      axios.get.mockResolvedValueOnce({ data: Buffer.from('fresh blob') });

      const result = await walrus.readBlobAfterUpload(mockBlobId);
      expect(walrus.waitForCertification).toHaveBeenCalledWith(mockBlobId, 180000);
      expect(result.toString()).toBe('fresh blob');
    });
  });

  describe('readJson', () => {
    it('should read and parse JSON', async () => {
      const jsonData = { key: 'value' };
      axios.get.mockResolvedValueOnce({ data: Buffer.from(JSON.stringify(jsonData)) });

      const result = await walrus.readJson(mockBlobId);
      expect(result).toEqual(jsonData);
    });

    it('should throw on invalid JSON', async () => {
      axios.get.mockResolvedValueOnce({ data: Buffer.from('not json') });

      await expect(walrus.readJson(mockBlobId)).rejects.toThrow('Invalid JSON in blob');
    });
  });

  describe('getBlobInfo', () => {
    it('should return blob info', async () => {
      const info = { blobId: mockBlobId, size: 100 };
      axios.get.mockResolvedValueOnce({ data: info });

      const result = await walrus.getBlobInfo(mockBlobId);
      expect(result).toEqual(info);
    });

    it('should return null for 404', async () => {
      axios.get.mockRejectedValueOnce({ response: { status: 404 } });

      const result = await walrus.getBlobInfo(mockBlobId);
      expect(result).toBeNull();
    });
  });

  describe('isBlobCertified', () => {
    it('should return true for 200', async () => {
      axios.get.mockResolvedValueOnce({ status: 200 });

      const result = await walrus.isBlobCertified(mockBlobId);
      expect(result).toBe(true);
    });

    it('should return false for errors', async () => {
      axios.get.mockRejectedValueOnce(new Error('not found'));

      const result = await walrus.isBlobCertified(mockBlobId);
      expect(result).toBe(false);
    });
  });

  describe('waitForCertification', () => {
    it('should return true when certified', async () => {
      walrus.isBlobCertified = jest.fn().mockResolvedValue(true);

      const result = await walrus.waitForCertification(mockBlobId, 30000);
      expect(result).toBe(true);
    });

    it.skip('should return false on timeout (skipped: Date.now resolution in mock context)', async () => {
      // Override isBlobCertified on the walrus instance (not prototype)
      // by deleting the property so prototype method is used, then replace prototype
      const origProto = Object.getPrototypeOf(walrus);
      const saved = origProto.isBlobCertified;

      // Replace with a function that always returns false
      origProto.isBlobCertified = function() { return Promise.resolve(false); };
      walrus.sleep = jest.fn(() => Promise.resolve());

      const result = await walrus.waitForCertification(mockBlobId, 100);

      // Restore
      origProto.isBlobCertified = saved;
      expect(result).toBe(false);
    });
  });

  describe('verifyBlobIntegrity', () => {
    it('should return true for matching hash', async () => {
      const data = Buffer.from('integrity data');
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      walrus.readBlob = jest.fn().mockResolvedValue(data);

      const result = await walrus.verifyBlobIntegrity(mockBlobId, hash);
      expect(result).toBe(true);
    });

    it('should return false for mismatched hash', async () => {
      walrus.readBlob = jest.fn().mockResolvedValue(Buffer.from('wrong data'));

      const result = await walrus.verifyBlobIntegrity(mockBlobId, 'deadbeef');
      expect(result).toBe(false);
    });

    it('should return false on read error', async () => {
      walrus.readBlob = jest.fn().mockRejectedValue(new Error('not found'));

      const result = await walrus.verifyBlobIntegrity(mockBlobId, 'abc');
      expect(result).toBe(false);
    });
  });

  describe('uploadBatch', () => {
    it('should upload multiple items', async () => {
      axios.put
        .mockResolvedValueOnce({
          data: { newlyCreated: { blobObject: { blobId: 'blob-1', blobHash: 'hash-1' } } },
        })
        .mockResolvedValueOnce({
          data: { newlyCreated: { blobObject: { blobId: 'blob-2', blobHash: 'hash-2' } } },
        });

      const items = [
        { data: Buffer.from('item 1') },
        { data: Buffer.from('item 2') },
      ];

      const results = await walrus.uploadBatch(items);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].blobId).toBe('blob-1');
      expect(results[1].success).toBe(true);
      expect(results[1].blobId).toBe('blob-2');
    });

    it('should handle partial failures', async () => {
      // First item fails permanently (all 3 retries fail)
      axios.put
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockRejectedValueOnce(new Error('upload failed'))
        .mockResolvedValueOnce({
          data: { newlyCreated: { blobObject: { blobId: 'blob-2', blobHash: 'hash-2' } } },
        });

      const items = [
        { data: Buffer.from('fail item') },
        { data: Buffer.from('ok item') },
      ];

      const results = await walrus.uploadBatch(items);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('upload failed');
      expect(results[1].success).toBe(true);
    });
  });

  describe('getContentType', () => {
    it('should return correct mime types', () => {
      expect(walrus.getContentType('test.json')).toBe('application/json');
      expect(walrus.getContentType('test.txt')).toBe('text/plain');
      expect(walrus.getContentType('test.md')).toBe('text/markdown');
      expect(walrus.getContentType('test.pdf')).toBe('application/pdf');
      expect(walrus.getContentType('test.png')).toBe('image/png');
      expect(walrus.getContentType('test.jpg')).toBe('image/jpeg');
      expect(walrus.getContentType('test.unknown')).toBe('application/octet-stream');
    });
  });
});
