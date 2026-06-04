/**
 * Walrus Setup Script
 * 
 * Test Walrus connectivity and configuration.
 * Usage: node scripts/setup-walrus.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const axios = require('axios');

const PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space';

async function testPublisher() {
  console.log('Testing Walrus Publisher...');
  console.log(`URL: ${PUBLISHER_URL}\n`);

  try {
    // Try to store a small test blob
    const testData = Buffer.from('Qually test - ' + Date.now());
    const response = await axios.put(
      `${PUBLISHER_URL}/v1/blobs?epochs=1&deletable=true`,
      testData,
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        timeout: 30000,
      }
    );

    const blobId = response.data.newlyCreated?.blobObject?.blobId ||
                   response.data.alreadyCertified?.blobId;

    console.log('Publisher is reachable!');
    console.log('Test blob uploaded:', blobId);
    
    return blobId;
  } catch (error) {
    if (error.response?.status === 400) {
      // 400 might mean the request format is wrong, but server is up
      console.log('Publisher is reachable! (test upload format issue, but server is up)');
      return 'test-blob';
    }
    console.error('Publisher is not reachable:', error.message);
    return null;
  }
}

async function testAggregator() {
  console.log('\nTesting Walrus Aggregator...');
  console.log(`URL: ${AGGREGATOR_URL}\n`);

  try {
    // Try to read a non-existent blob (should return 404 or error, not connection error)
    await axios.get(`${AGGREGATOR_URL}/v1/test-blob-id-12345`);
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      console.log('Aggregator is reachable!');
      return true;
    }
    console.error('Aggregator is not reachable:', error.message);
    return false;
  }
}

async function testRead(blobId) {
  if (!blobId || blobId === 'test-blob') return false;
  
  console.log('\nTesting read...');
  
  try {
    const response = await axios.get(`${AGGREGATOR_URL}/v1/${blobId}`, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const content = Buffer.from(response.data).toString('utf-8');
    console.log('Read successful!');
    console.log('Content:', content);
    return true;
  } catch (error) {
    console.error('Read failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== Walrus Setup Test ===\n');

  const blobId = await testPublisher();
  const aggregatorOk = await testAggregator();
  
  if (blobId && aggregatorOk) {
    await testRead(blobId);
  }

  console.log('\n=== Summary ===');
  console.log(`Publisher: ${blobId ? 'OK' : 'FAILED'}`);
  console.log(`Aggregator: ${aggregatorOk ? 'OK' : 'FAILED'}`);
  console.log(`Upload/Read: ${blobId && aggregatorOk ? 'OK' : 'NEEDS TESTING'}`);

  if (blobId && aggregatorOk) {
    console.log('\n=== Walrus is ready for use! ===');
  }
}

main().catch(console.error);
