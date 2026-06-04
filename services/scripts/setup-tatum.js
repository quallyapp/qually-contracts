/**
 * Tatum Webhook Setup Script
 * 
 * Run this script to register webhooks for Qually contract events.
 * Usage: node scripts/setup-tatum.js
 * 
 * Prerequisites:
 * 1. Get API key from https://dashboard.tatum.io
 * 2. Set TATUM_API_KEY in .env
 * 3. Set WEBHOOK_URL in .env (your server's webhook endpoint)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');

const TATUM_API_KEY = process.env.TATUM_API_KEY;
const PACKAGE_ID = process.env.QUALLY_PACKAGE_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-domain.com/webhooks/tatum';
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';

if (!TATUM_API_KEY) {
  console.error('Error: TATUM_API_KEY not set in .env');
  console.error('Get your API key at https://dashboard.tatum.io');
  process.exit(1);
}

if (!PACKAGE_ID) {
  console.error('Error: QULLY_PACKAGE_ID not set in .env');
  process.exit(1);
}

// Tatum Gateway URL for SUI
const GATEWAY_URL = `https://sui-${SUI_NETWORK}.gateway.tatum.io`;

const client = axios.create({
  baseURL: GATEWAY_URL,
  headers: {
    'x-api-key': TATUM_API_KEY,
    'Content-Type': 'application/json',
  },
});

async function testConnection() {
  console.log('Testing Tatum connection...\n');
  console.log(`Network: ${SUI_NETWORK}`);
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log(`Package ID: ${PACKAGE_ID}\n`);

  try {
    // Test RPC call
    const response = await client.post('/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getLatestCheckpointSequenceNumber',
      params: [],
    });

    if (response.data.result) {
      console.log('Connection successful!');
      console.log(`Latest checkpoint: ${response.data.result}\n`);
      return true;
    }
  } catch (error) {
    console.error('Connection failed:', error.response?.data || error.message);
    return false;
  }
}

async function subscribeToEvents() {
  console.log('Setting up Tatum webhook...\n');

  try {
    // Subscribe to package events
    const response = await client.post('/notification/subscription', {
      type: 'ADDRESS_EVENT',
      attr: {
        address: PACKAGE_ID,
        chain: 'SUI',
        url: WEBHOOK_URL,
      },
    });

    console.log('Webhook registered successfully!');
    console.log('Subscription ID:', response.data.id);
    console.log('\nSave this ID to remove the webhook later.');
    console.log('Webhook URL:', WEBHOOK_URL);
    
    return response.data;
  } catch (error) {
    console.error('Failed to register webhook:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

async function listSubscriptions() {
  try {
    const response = await client.get('/notification/subscription');
    console.log('\nCurrent subscriptions:');
    if (response.data && response.data.length > 0) {
      response.data.forEach((sub, i) => {
        console.log(`${i + 1}. ID: ${sub.id}, Address: ${sub.attr?.address}, URL: ${sub.attr?.url}`);
      });
    } else {
      console.log('No subscriptions found.');
    }
  } catch (error) {
    console.error('Failed to list subscriptions:', error.message);
  }
}

// Run setup
async function main() {
  console.log('=== Tatum Webhook Setup ===\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('Cannot proceed without connection.');
    process.exit(1);
  }

  await subscribeToEvents();
  await listSubscriptions();

  console.log('\n=== Setup Complete ===');
}

main().catch(console.error);
