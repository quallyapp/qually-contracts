#!/usr/bin/env node
/**
 * Qually E2E Test — Portable Version
 * Run from any machine with internet access:
 *   npm install @mysten/sui @mysten/walrus axios dotenv
 *   node e2e-portable.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');
const crypto = require('crypto');

// ─── Config ───────────────────────────────────────────────────────────────────
const PACKAGE_ID  = process.env.SUI_PACKAGE_ID  || '0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46';
const TREASURY_ID = process.env.SUI_TREASURY_ID  || '0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e';
const WALRUS_EPOCH = parseInt(process.env.WALRUS_EPOCH || '1');

function sha3_256(data) {
  return crypto.createHash('sha3-256').update(data).digest();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getKeyPairRaw() {
  const b64 = process.env.TEST_PRIVATE_KEY;
  if (!b64) throw new Error('Set TEST_PRIVATE_KEY in .env (hex or base64)');
  if (b64.startsWith('0x')) {
    return Uint8Array.from(Buffer.from(b64.slice(2), 'hex')).slice(0, 32);
  } else if (/^[0-9a-fA-F]{64}$/.test(b64)) {
    return Uint8Array.from(Buffer.from(b64, 'hex')).slice(0, 32);
  } else {
    throw new Error('Unsupported key format. Use hex (0x... or 64-char hex)');
  }
}

async function run() {
  // Dynamic ESM imports
  const { SuiClient } = await import('@mysten/sui/client');
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  const { Transaction } = await import('@mysten/sui/transactions');
  const { WalrusClient } = await import('@mysten/walrus');

  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });
  const keypair = Ed25519Keypair.fromSecretKey(getKeyPairRaw());
  const sender = keypair.getPublicKey().toSuiAddress();

  console.log('=== Qually E2E Test ===\n');
  console.log('Package: ', PACKAGE_ID);
  console.log('Treasury:', TREASURY_ID);
  console.log('Wallet:  ', sender);

  const bal = await client.getBalance({ owner: sender });
  const suiBalance = Number(bal.totalBalance) / 1_000_000_000;
  console.log('Balance:', suiBalance.toFixed(2), 'SUI\n');
  if (suiBalance < 0.1) { console.log('❌ Insufficient balance'); process.exit(1); }

  // ── Step 1: Upload brief to Walrus ──────────────────────────────────────
  console.log('Step 1: Upload brief to Walrus');
  const brief = { title: 'E2E Test Bounty', description: 'Test bounty from E2E', timestamp: Date.now() };
  const briefData = Buffer.from(JSON.stringify(brief));

  const walrusClient = new WalrusClient({ network: 'testnet', suiClient: client });
  const walrusResult = await walrusClient.writeBlob({
    blob: briefData,
    deletable: false,
    epochs: WALRUS_EPOCH,
    signer: keypair,
  });
  const blobId = walrusResult.blobId;
  const contentHash = '0x' + sha3_256(JSON.stringify(brief)).toString('hex');
  console.log('  ✅ blobId:', blobId);
  console.log('  hash:', contentHash);

  // ── Step 2: Create bounty ───────────────────────────────────────────────
  console.log('\nStep 2: Create bounty on-chain');
  const now = Date.now();
  const deadline = BigInt(now + 7 * 86400000);
  const judgingDeadline = BigInt(now + 14 * 86400000);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      coin,
      tx.pure.u8(0),
      tx.pure.string(blobId),
      tx.pure.string(contentHash),
      tx.pure.u64(deadline.toString()),
      tx.pure.u64(judgingDeadline.toString()),
      tx.pure.u8(50),
      tx.pure.u8(3),
      tx.pure.vector('u64', [50, 30, 20]),
      tx.pure.bool(false),
      tx.pure.bool(false),
      tx.pure.vector('string', ['e2e-test']),
    ],
  });

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showObjectChanges: true, showEffects: true },
  });

  const bountyObj = result.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('bounty::Bounty'));
  const bountyId = bountyObj?.objectId;
  console.log('  ✅ bountyId:', bountyId);
  console.log('  tx:', result.digest);
  if (result.effects?.status?.status !== 'success') {
    console.log('  ❌ Transaction failed:', result.effects?.status);
    process.exit(1);
  }

  // ── Step 3: Submit work ─────────────────────────────────────────────────
  console.log('\nStep 3: Submit work');
  const submissionBrief = { solution: 'E2E test solution', author: sender, timestamp: Date.now() };
  const submissionData = Buffer.from(JSON.stringify(submissionBrief));
  const submissionWalrus = await walrusClient.writeBlob({
    blob: submissionData,
    deletable: false,
    epochs: WALRUS_EPOCH,
    signer: keypair,
  });
  const submissionBlobId = submissionWalrus.blobId;
  const submissionHash = '0x' + sha3_256(JSON.stringify(submissionBrief)).toString('hex');
  console.log('  Upload:', submissionBlobId);

  const txSub = new Transaction();
  txSub.moveCall({
    target: `${PACKAGE_ID}::bounty::submit_work`,
    arguments: [
      txSub.object(bountyId),
      txSub.pure.vector('address', []),
      txSub.pure.vector('u64', []),
      txSub.pure.string(submissionBlobId),
      txSub.pure.string(submissionHash),
      txSub.object('0x6'),
    ],
  });

  const subResult = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: txSub,
    options: { showEffects: true },
  });
  console.log('  ✅ submission tx:', subResult.digest);

  // ── Step 4: Read bounty state ───────────────────────────────────────────
  console.log('\nStep 4: Read bounty state');
  await sleep(2000);
  const bounty = await client.getObject({ id: bountyId, options: { showContent: true } });
  const fields = bounty.data?.content?.fields;
  console.log('  State:', fields?.state);
  console.log('  Prize:', fields?.prize_pool, 'MIST');
  console.log('  Submissions:', fields?.submission_count);

  // ── Step 5: Read events ─────────────────────────────────────────────────
  console.log('\nStep 5: Read events from Tatum');
  try {
    const eventResp = await axios.post(
      process.env.TATUM_GATEWAY_URL || 'https://sui-testnet.gateway.tatum.io',
      {
        jsonrpc: '2.0', id: 1,
        method: 'suix_queryEvents',
        params: [{ MoveModule: { package: PACKAGE_ID, module: 'bounty' } }, null, 100, true],
      },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.TATUM_API_KEY }, timeout: 15000 }
    );
    const events = eventResp.data?.result?.data || [];
    console.log('  Events found:', events.length);
    if (events.length > 0) {
      console.log('  Latest event type:', events[0]?.type?.split('::').pop());
    }
    console.log('  ✅ Step 5 passed');
  } catch (e) {
    console.log('  ⚠️  Event query failed:', e.response?.data || e.message);
  }

  console.log('\n=== E2E Test Complete ===');
}

run().catch(e => { console.error('❌ Test failed:', e.message); process.exit(1); });
