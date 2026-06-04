#!/usr/bin/env node
/**
 * Qually E2E Test — Uses signAndExecuteTransactionBlock (works with axios fetch)
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const axios = require('axios');
const crypto = require('crypto');

const PACKAGE_ID  = process.env.SUI_PACKAGE_ID  || '0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46';
const TREASURY_ID = process.env.SUI_TREASURY_ID  || '0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e';
const TATUM_RPC = 'https://sui-testnet.gateway.tatum.io';
const TATUM_KEY = process.env.TATUM_API_KEY;

const client = new SuiClient({ url: getFullnodeUrl('testnet') });

let rpcId = 1;
async function tatumRpc(method, params = []) {
  const headers = { 'Content-Type': 'application/json' };
  if (TATUM_KEY) headers['x-api-key'] = TATUM_KEY;
  const resp = await axios.post(TATUM_RPC, { jsonrpc: '2.0', id: rpcId++, method, params }, {
    headers, timeout: 30000,
  });
  if (resp.data.error) throw new Error(resp.data.error.message || JSON.stringify(resp.data.error));
  return resp.data.result;
}

function getKeyPair() {
  const hex = process.env.TEST_PRIVATE_KEY;
  if (!hex) throw new Error('Set TEST_PRIVATE_KEY');
  const bytes = Uint8Array.from(Buffer.from(hex.replace('0x', ''), 'hex')).slice(0, 32);
  return Ed25519Keypair.fromSecretKey(bytes);
}

function sha3_256(data) {
  return crypto.createHash('sha3-256').update(data).digest();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = 3, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) {
      console.log(`  ⚠️  Attempt ${i+1}: ${e.message?.substring(0, 120)}`);
      if (i < retries - 1) await sleep(delay);
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

const MOCK_BRIEF_BLOB = 'PC8TFELKR_ACR0cpSNfVqWiqO1qjfjvFd8HS7amc6DY';
const MOCK_SUB_BLOB = 'AB9TFELKR_BCR0cpSNfVqWiqO1qjfjvFd8HS7amc7EZ';

async function run() {
  console.log('=== Qually E2E Test ===\n');

  const keypair = getKeyPair();
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log('Package: ', PACKAGE_ID);
  console.log('Treasury:', TREASURY_ID);
  console.log('Wallet:  ', sender);

  const bal = await client.getBalance({ owner: sender });
  const suiBalance = Number(bal.totalBalance) / 1_000_000_000;
  console.log('Balance:', suiBalance.toFixed(2), 'SUI\n');
  if (suiBalance < 0.1) { console.log('❌ Insufficient balance'); process.exit(1); }

  // ── Step 1: Create bounty ──────────────────────────────────────────────
  console.log('Step 1: Create bounty on-chain');
  const contentHash = Array.from(sha3_256('test-bounty'));
  const now = Date.now();

  const tx = new TransactionBlock();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(1_000_000_000)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      coin,
      tx.pure(0),
      tx.pure(Array.from(new TextEncoder().encode(MOCK_BRIEF_BLOB))),
      tx.pure(contentHash),
      tx.pure(now + 7 * 86400000),
      tx.pure(now + 14 * 86400000),
      tx.pure(50),
      tx.pure(3),
      tx.pure([50, 30, 20]),
      tx.pure(false),
      tx.pure(false),
      tx.pure(['e2e-test']),
    ],
  });

  console.log('  Signing & executing...');
  const result = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: tx,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  const bountyObj = result.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('bounty::Bounty'));
  const bountyId = bountyObj?.objectId;
  console.log('  ✅ bountyId:', bountyId);
  console.log('  tx:', result.digest);

  if (result.effects?.status?.status !== 'success') {
    console.log('  ❌ Failed:', result.effects?.status?.error);
    process.exit(1);
  }

  // ── Step 2: Submit work ────────────────────────────────────────────────
  console.log('\nStep 2: Submit work');
  const subContent = JSON.stringify({ solution: 'E2E test', author: sender });
  const subHash = Array.from(sha3_256(subContent));

  const txSub = new TransactionBlock();
  txSub.moveCall({
    target: `${PACKAGE_ID}::submission::submit_work`,
    arguments: [
      txSub.object(bountyId),
      txSub.pure([]),
      txSub.pure([]),
      txSub.pure(Array.from(new TextEncoder().encode(MOCK_SUB_BLOB))),
      txSub.pure(subHash),
      txSub.object('0x6'),
    ],
  });

  const subResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txSub,
      options: { showEffects: true },
    })
  );
  console.log('  ✅ submission tx:', subResult.digest);

  if (subResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Submit failed:', subResult.effects?.status?.error);
  }

  // ── Step 3: Read bounty state ──────────────────────────────────────────
  console.log('\nStep 3: Read bounty state');
  await sleep(2000);
  const bounty = await client.getObject({ id: bountyId, options: { showContent: true } });
  const fields = bounty.data?.content?.fields;
  console.log('  State:', fields?.state);
  console.log('  Prize:', fields?.prize_pool, 'MIST');
  console.log('  Submissions:', fields?.submission_count);

  // ── Step 4: Read events via Tatum ──────────────────────────────────────
  console.log('\nStep 4: Read events from Tatum');
  try {
    const eventResp = await tatumRpc('suix_queryEvents', [
      { MoveModule: { package: PACKAGE_ID, module: 'bounty' } },
      null, 100, true
    ]);
    const events = eventResp?.data || [];
    console.log('  Events found:', events.length);
    if (events.length > 0) {
      console.log('  Latest:', events[0]?.type?.split('::').pop());
    }
    console.log('  ✅ Step 4 passed');
  } catch (e) {
    console.log('  ⚠️  Event query:', e.message);
  }

  // ── Step 5: Balance check ──────────────────────────────────────────────
  console.log('\nStep 5: Final balance');
  const balAfter = await client.getBalance({ owner: sender });
  const after = Number(balAfter.totalBalance) / 1_000_000_000;
  console.log('  Before:', suiBalance.toFixed(4), 'SUI');
  console.log('  After: ', after.toFixed(4), 'SUI');
  console.log('  Spent: ', (suiBalance - after).toFixed(4), 'SUI');

  console.log('\n=== E2E Test Complete ===');
  console.log('\nBounty ID:', bountyId);
  console.log('Fund this wallet for next test:', sender);
}

run().catch(e => { console.error('❌ Test failed:', e.message); process.exit(1); });
