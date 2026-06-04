/**
 * Webhook URL Setup Helper
 * 
 * For local development, Tatum needs a publicly accessible webhook URL.
 * This script helps configure and test webhook connectivity.
 * 
 * Usage:
 *   node scripts/setup-webhook.js                    # Show current config
 *   node scripts/setup-webhook.js set <url>          # Set webhook URL
 *   node scripts/setup-webhook.js test               # Test webhook endpoint
 *   node scripts/setup-webhook.js ngrok              # Start ngrok tunnel
 *   node scripts/setup-webhook.js cloudflared        # Start cloudflared tunnel
 *   node scripts/setup-webhook.js register           # Register with Tatum
 * 
 * Tunneling Options (for local development):
 *   - ngrok:       ngrok http 3000
 *   - cloudflared: cloudflared tunnel --url http://localhost:3000
 *   - localtunnel: lt --port 3000
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ENV_PATH = path.join(__dirname, '..', '.env');

function readEnv() {
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function writeEnv(content) {
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

function getWebhookUrl() {
  return process.env.WEBHOOK_URL || 'http://localhost:3000/webhooks/tatum';
}

function setWebhookUrl(url) {
  let content = readEnv();
  const regex = /^WEBHOOK_URL=.*/m;
  if (content.match(regex)) {
    content = content.replace(regex, `WEBHOOK_URL=${url}`);
  } else {
    content += `\nWEBHOOK_URL=${url}\n`;
  }
  writeEnv(content);
  console.log(`Webhook URL set to: ${url}`);
}

function showConfig() {
  console.log('=== Webhook Configuration ===\n');
  console.log(`Current URL: ${getWebhookUrl()}`);
  console.log(`Port: ${process.env.PORT || 3000}`);
  console.log(`Package ID: ${process.env.QUALLY_PACKAGE_ID || 'not set'}`);
  
  const isLocal = getWebhookUrl().includes('localhost');
  if (isLocal) {
    console.log('\n⚠️  Localhost detected - Tatum cannot reach this URL');
    console.log('   Options:');
    console.log('   1. Run: node scripts/setup-webhook.js ngrok');
    console.log('   2. Run: node scripts/setup-webhook.js cloudflared');
    console.log('   3. Set a public URL: node scripts/setup-webhook.js set <url>');
  } else {
    console.log('\n✓ Public URL configured');
  }
}

function startTunnel(type) {
  const port = process.env.PORT || 3000;
  
  console.log(`Starting ${type} tunnel to port ${port}...\n`);
  
  const commands = {
    ngrok: `ngrok http ${port}`,
    cloudflared: `cloudflared tunnel --url http://localhost:${port}`,
    localtunnel: `lt --port ${port}`,
  };
  
  const cmd = commands[type];
  if (!cmd) {
    console.error('Unknown tunnel type:', type);
    console.log('Available types: ngrok, cloudflared, localtunnel');
    process.exit(1);
  }
  
  console.log('Instructions:');
  console.log('1. Copy the public URL from the tunnel output');
  console.log('2. Run: node scripts/setup-webhook.js set <public-url>/webhooks/tatum');
  console.log('3. Run: node scripts/setup-webhook.js register\n');
  console.log('Starting tunnel...\n');
  
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (error) {
    if (error.message.includes('ENOENT')) {
      console.error(`\n${type} is not installed.`);
      console.log(`\nInstall ${type}:`);
      if (type === 'ngrok') {
        console.log('  npm install -g ngrok');
        console.log('  or visit: https://ngrok.com/download');
      } else if (type === 'cloudflared') {
        console.log('  Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      } else if (type === 'localtunnel') {
        console.log('  npm install -g localtunnel');
      }
    } else {
      console.error('Error:', error.message);
    }
  }
}

function testWebhook() {
  const url = getWebhookUrl();
  console.log(`Testing webhook endpoint: ${url}\n`);
  
  const http = require('http');
  const https = require('https');
  
  const client = url.startsWith('https') ? https : http;
  
  const req = client.get(url, { timeout: 10000 }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Response:', res.statusCode === 404 ? 'Endpoint exists (404 expected for GET)' : 'OK');
    console.log('\n✓ Webhook endpoint is reachable');
  });
  
  req.on('error', (error) => {
    console.error('Connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\nMake sure the server is running:');
      console.log('  cd services && npm start');
    }
  });
  
  req.on('timeout', () => {
    console.error('Connection timed out');
    req.destroy();
  });
}

function registerWithTatum() {
  const axios = require('axios');
  
  const apiKey = process.env.TATUM_API_KEY;
  const packageId = process.env.QUALLY_PACKAGE_ID;
  const webhookUrl = getWebhookUrl();
  const network = process.env.SUI_NETWORK || 'testnet';
  
  if (!apiKey) {
    console.error('Error: TATUM_API_KEY not set in .env');
    process.exit(1);
  }
  
  if (!packageId) {
    console.error('Error: QULLY_PACKAGE_ID not set in .env');
    process.exit(1);
  }
  
  console.log('Registering webhook with Tatum...\n');
  console.log(`Package ID: ${packageId}`);
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Network: ${network}\n`);
  
  const gatewayUrl = `https://sui-${network}.gateway.tatum.io`;
  
  axios.post('https://api.tatum.io/v3/subscription', {
    type: 'ADDRESS_EVENT',
    attr: {
      address: packageId,
      chain: 'SUI',
      url: webhookUrl,
    },
  }, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  })
    .then(response => {
      console.log('✓ Webhook registered successfully!');
      console.log(`Subscription ID: ${response.data.id}`);
      console.log('\nSave this ID to manage the subscription later.');
    })
    .catch(error => {
      console.error('Failed to register webhook:');
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    });
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'set':
    if (!args[1]) {
      console.error('Usage: node scripts/setup-webhook.js set <url>');
      process.exit(1);
    }
    setWebhookUrl(args[1]);
    break;
    
  case 'test':
    testWebhook();
    break;
    
  case 'ngrok':
  case 'cloudflared':
  case 'localtunnel':
    startTunnel(command);
    break;
    
  case 'register':
    registerWithTatum();
    break;
    
  default:
    showConfig();
    break;
}
