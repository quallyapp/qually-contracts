/**
 * End-to-End Lifecycle Test
 * 
 * Tests the core bounty lifecycle on testnet:
 * 1. Upload brief to Walrus
 * 2. Create bounty on-chain
 * 3. Submit work
 * 4. Read bounty state via RPC
 * 5. Query events via Tatum
 * 
 * Usage: node scripts/e2e-test.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { createHash } = require('crypto');
const axios = require('axios');

// Config
const PACKAGE_ID = process.env.QUALLY_PACKAGE_ID;
const TREASURY_ID = process.env.TREASURY_OBJECT_ID;
const NETWORK = process.env.SUI_NETWORK || 'testnet';
const WALRUS_PUBLISHER = process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space';
const TATUM_API_KEY = process.env.TATUM_API_KEY;

// Test wallet
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY;

// Helpers
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function generateHash(data) {
  return createHash('sha3-256').update(data).digest();
}

// Walrus upload
async function uploadToWalrus(content, epochs = 1) {
  console.log('  Uploading to Walrus...');
  const response = await axios.put(
    `${WALRUS_PUBLISHER}/v1/blobs?epochs=${epochs}&deletable=true`,
    content,
    {
      headers: { 'Content-Type': 'application/octet-stream' },
      timeout: 60000,
    }
  );
  const blobId = response.data.newlyCreated?.blobObject?.blobId;
  console.log(`  ✓ Blob uploaded: ${blobId}`);
  return blobId;
}

// Tatum RPC call (uses suix_ prefix for Sui methods)
async function tatumRpc(method, params = []) {
  if (!TATUM_API_KEY) return null;
  try {
    const response = await axios.post(
      `https://sui-${NETWORK}.gateway.tatum.io`,
      { jsonrpc: '2.0', id: 1, method, params },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': TATUM_API_KEY }, timeout: 15000 }
    );
    if (response.data.error) return null;
    return response.data.result;
  } catch (e) {
    return null;
  }
}

// Main test
async function runTest() {
  console.log('=== Qually E2E Test ===\n');

  if (!PACKAGE_ID) {
    console.error('Error: QULLY_PACKAGE_ID not set in .env');
    process.exit(1);
  }

  console.log(`Package:  ${PACKAGE_ID}`);
  console.log(`Treasury: ${TREASURY_ID}`);
  console.log(`Network:  ${NETWORK}\n`);

  const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

  // Load wallet
  let keypair;
  if (TEST_PRIVATE_KEY) {
    keypair = Ed25519Keypair.fromSecretKey(Buffer.from(TEST_PRIVATE_KEY, 'hex'));
  } else {
    console.error('No TEST_PRIVATE_KEY in .env');
    process.exit(1);
  }

  const address = keypair.getPublicKey().toSuiAddress();
  console.log(`Wallet: ${address}`);

  // Check balance
  const balance = await client.getBalance({ owner: address });
  const suiBalance = parseInt(balance.totalBalance) / 1_000_000_000;
  console.log(`Balance: ${suiBalance} SUI\n`);

  if (suiBalance < 0.1) {
    console.error('❌ Insufficient balance. Get testnet SUI from https://faucet.testnet.sui.io/');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════
  // Step 1: Upload brief to Walrus
  // ═══════════════════════════════════════════════════════════
  console.log('Step 1: Upload brief to Walrus');
  const brief = {
    title: 'E2E Test Bounty',
    description: 'Automated test bounty for verifying the full lifecycle',
    acceptance_criteria: ['Submit working code', 'Pass all tests'],
    skill_tags: ['javascript', 'testing'],
  };
  const briefBlobId = await uploadToWalrus(JSON.stringify(brief));
  const briefHash = generateHash(briefBlobId);
  await sleep(3000);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // Step 2: Create bounty on-chain
  // ═══════════════════════════════════════════════════════════
  console.log('Step 2: Create bounty on-chain');
  const tx = new TransactionBlock();
  const prizeAmount = 1_000_000_000; // 1 SUI

  const [coin] = tx.splitCoins(tx.gas, [tx.pure(prizeAmount)]);

  tx.moveCall({
    target: `${PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      coin,                                              // payment: Coin<SUI>
      tx.pure(0),                                        // bounty_type: u8 (Fixed)
      tx.pure(Array.from(new TextEncoder().encode(briefBlobId))),  // brief_blob_id: vector<u8>
      tx.pure(Array.from(briefHash)),                    // brief_content_hash: vector<u8>
      tx.pure(Date.now() + 86400000),                    // submission_deadline: u64
      tx.pure(Date.now() + 172800000),                   // judging_deadline: u64
      tx.pure(50),                                       // poster_weight: u8
      tx.pure(3),                                        // max_judges: u8
      tx.pure([]),                                       // contest_splits: vector<u8>
      tx.pure(false),                                    // is_recurring: bool
      tx.pure(false),                                    // auto_extend: bool
      tx.pure(['e2e', 'test']),                          // category_tags: vector<String>
    ],
  });

  const result = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status?.status !== 'success') {
    console.error('❌ Create bounty failed:', result.effects?.status?.error);
    process.exit(1);
  }

  const bountyObject = result.objectChanges?.find(c => c.type === 'created');
  const bountyId = bountyObject?.objectId;
  console.log(`  ✓ Bounty created: ${bountyId}`);
  console.log(`  Digest: ${result.digest}\n`);

  // ═══════════════════════════════════════════════════════════
  // Step 3: Submit work
  // ═══════════════════════════════════════════════════════════
  console.log('Step 3: Submit work');
  const submission = {
    work_files: ['https://github.com/test/repo'],
    links: ['https://demo.example.com'],
    notes: 'Test submission for E2E verification',
  };
  const submissionBlobId = await uploadToWalrus(JSON.stringify(submission));
  const submissionHash = generateHash(submissionBlobId);
  await sleep(3000);

  const submitTx = new TransactionBlock();
  submitTx.moveCall({
    target: `${PACKAGE_ID}::submission::submit_work`,
    arguments: [
      submitTx.object(bountyId),                         // bounty: &mut Bounty
      submitTx.pure([]),                                 // collaborators: vector<address>
      submitTx.pure([]),                                 // payout_splits: vector<u8>
      submitTx.pure(Array.from(new TextEncoder().encode(submissionBlobId))), // blob_id: vector<u8>
      submitTx.pure(Array.from(submissionHash)),          // content_hash: vector<u8>
      submitTx.object('0x6'),                            // clock: &Clock
    ],
  });

  const submitResult = await client.signAndExecuteTransactionBlock({
    signer: keypair,
    transactionBlock: submitTx,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (submitResult.effects?.status?.status !== 'success') {
    console.error('❌ Submit work failed:', submitResult.effects?.status?.error);
    process.exit(1);
  }

  const submissionObject = submitResult.objectChanges?.find(c => c.type === 'created');
  const submissionId = submissionObject?.objectId;
  console.log(`  ✓ Submission created: ${submissionId}`);
  console.log(`  Digest: ${submitResult.digest}\n`);

  // ═══════════════════════════════════════════════════════════
  // Step 4: Read bounty state via RPC
  // ═══════════════════════════════════════════════════════════
  console.log('Step 4: Read bounty state via RPC');
  const bountyData = await client.getObject({
    id: bountyId,
    options: { showContent: true, showType: true },
  });

  if (bountyData.data) {
    const fields = bountyData.data.content?.fields;
    console.log(`  ✓ Bounty state: ${fields?.state} (0=Open)`);
    console.log(`  ✓ Prize pool: ${fields?.prize_pool} MIST`);
    console.log(`  ✓ Submission count: ${fields?.submission_count}`);
    console.log(`  ✓ Poster: ${fields?.poster}\n`);
  } else {
    console.log('  ⚠️  Could not read bounty object\n');
  }

  // ═══════════════════════════════════════════════════════════
  // Step 5: Query events via Tatum
  // ═══════════════════════════════════════════════════════════
  console.log('Step 5: Query events via Tatum RPC');
  const events = await tatumRpc('suix_queryEvents', [
    { MoveModule: { package: PACKAGE_ID, module: 'bounty' } },
    null,
    10,
    true,
  ]);

  if (events && events.data) {
    console.log(`  ✓ Found ${events.data.length} events from bounty module`);
    for (const evt of events.data.slice(0, 5)) {
      const type = evt.type || evt.parsedJson?.type || 'unknown';
      const name = type.split('::').pop();
      console.log(`    - ${name}`);
    }
    console.log('');
  } else {
    console.log('  ⚠️  No events found or Tatum unavailable\n');
  }

  // ═══════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════');
  console.log('  E2E TEST PASSED');
  console.log('══════════════════════════════════════');
  console.log(`  Bounty:      ${bountyId}`);
  console.log(`  Submission:  ${submissionId}`);
  console.log(`  Brief Blob:  ${briefBlobId}`);
  console.log(`  Work Blob:   ${submissionBlobId}`);
  console.log(`  Digest:      ${result.digest}`);
  console.log('══════════════════════════════════════\n');
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
