#!/usr/bin/env node
/**
 * Qually Judge Flow E2E Test
 * Tests: mint profile → create bounty → submit work → apply as judge → approve → commit vote → reveal vote
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const axios = require('axios');
const crypto = require('crypto');

const PACKAGE_ID = process.env.SUI_PACKAGE_ID || '0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46';
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
      console.log(`  ⚠️  Attempt ${i + 1}: ${e.message?.substring(0, 150)}`);
      if (i < retries - 1) await sleep(delay);
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

// BCS encode an address as 32 raw bytes
function bcsAddress(hexAddr) {
  const clean = hexAddr.startsWith('0x') ? hexAddr.slice(2) : hexAddr;
  const padded = clean.padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// BCS encode a u64 as 8 little-endian bytes
function bcsU64(value) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

// Compute commit hash: sha3_256(bcs(submissionId) ++ bcs(score) ++ nonce)
function computeCommitHash(submissionId, score, nonce) {
  const subIdBytes = bcsAddress(submissionId);
  const scoreBytes = bcsU64(score);
  const nonceBytes = Buffer.from(nonce);
  const combined = Buffer.concat([subIdBytes, scoreBytes, nonceBytes]);
  return Array.from(sha3_256(combined));
}

async function run() {
  console.log('=== Qually Judge Flow E2E Test ===\n');

  const keypair = getKeyPair();
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log('Package: ', PACKAGE_ID);
  console.log('Wallet:  ', sender);

  const bal = await client.getBalance({ owner: sender });
  const suiBalance = Number(bal.totalBalance) / 1_000_000_000;
  console.log('Balance:', suiBalance.toFixed(2), 'SUI\n');
  if (suiBalance < 0.15) { console.log('❌ Need at least 0.15 SUI'); process.exit(1); }

  // ── Step 1: Mint Judge Profile ──────────────────────────────────────────
  console.log('Step 1: Mint judge profile');
  const txProfile = new TransactionBlock();
  txProfile.moveCall({
    target: `${PACKAGE_ID}::judge::mint_judge_profile`,
    arguments: [],
  });

  const profileResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txProfile,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (profileResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Mint failed:', profileResult.effects?.status?.error);
    process.exit(1);
  }

  const profileObj = profileResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('judge::JudgeProfile'));
  const profileId = profileObj?.objectId;
  console.log('  ✅ profileId:', profileId);
  console.log('  tx:', profileResult.digest);

  // ── Step 2: Create Bounty (short deadline for testing) ───────────────────
  console.log('\nStep 2: Create bounty');
  const contentHash = Array.from(sha3_256('judge-test-bounty'));
  const now = Date.now();
  const submissionDeadline = now + 60_000; // 1 minute from now
  const judgingDeadline = now + 120_000;   // 2 minutes from now

  const txBounty = new TransactionBlock();
  const [coin] = txBounty.splitCoins(txBounty.gas, [txBounty.pure(10_000_000)]); // 0.01 SUI prize
  txBounty.moveCall({
    target: `${PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      coin,
      txBounty.pure(0), // bounty_type: FIXED
      txBounty.pure(Array.from(new TextEncoder().encode('judge-test-brief'))),
      txBounty.pure(contentHash),
      txBounty.pure(submissionDeadline),
      txBounty.pure(judgingDeadline),
      txBounty.pure(50),  // poster_weight
      txBounty.pure(3),   // max_judges
      txBounty.pure([50, 30, 20]), // contest_splits
      txBounty.pure(false), // is_recurring
      txBounty.pure(false), // auto_extend
      txBounty.pure(['judge-test']),
    ],
  });

  const bountyResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txBounty,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (bountyResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Bounty failed:', bountyResult.effects?.status?.error);
    process.exit(1);
  }

  const bountyObj = bountyResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('bounty::Bounty'));
  const bountyId = bountyObj?.objectId;
  console.log('  ✅ bountyId:', bountyId);
  console.log('  tx:', bountyResult.digest);

  // ── Step 3: Submit Work ──────────────────────────────────────────────────
  console.log('\nStep 3: Submit work');
  const subContent = JSON.stringify({ solution: 'judge test submission', author: sender });
  const subHash = Array.from(sha3_256(subContent));

  const txSub = new TransactionBlock();
  txSub.moveCall({
    target: `${PACKAGE_ID}::submission::submit_work`,
    arguments: [
      txSub.object(bountyId),
      txSub.pure([]), // no collaborators
      txSub.pure([]), // no splits
      txSub.pure(Array.from(new TextEncoder().encode('judge-test-sub-blob'))),
      txSub.pure(subHash),
      txSub.object('0x6'), // clock
    ],
  });

  const subResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txSub,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (subResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Submit failed:', subResult.effects?.status?.error);
    process.exit(1);
  }

  const subObj = subResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('submission::Submission'));
  const submissionId = subObj?.objectId;
  console.log('  ✅ submissionId:', submissionId);
  console.log('  tx:', subResult.digest);

  // ── Step 4: Apply as Judge ───────────────────────────────────────────────
  console.log('\nStep 4: Apply as judge (0.1 SUI stake)');
  const txApply = new TransactionBlock();
  const [stakeCoin] = txApply.splitCoins(txApply.gas, [txApply.pure(100_000_000)]); // 0.1 SUI
  txApply.moveCall({
    target: `${PACKAGE_ID}::judge::apply_as_judge`,
    arguments: [
      txApply.object(profileId),
      txApply.pure(bountyId),
      stakeCoin,
      txApply.pure([]), // no blob ID
    ],
  });

  const applyResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txApply,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (applyResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Apply failed:', applyResult.effects?.status?.error);
    process.exit(1);
  }

  const appObj = applyResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('judge::JudgeApplication'));
  const applicationId = appObj?.objectId;
  console.log('  ✅ applicationId:', applicationId);
  console.log('  tx:', applyResult.digest);

  // ── Step 5: Approve Judge ────────────────────────────────────────────────
  console.log('\nStep 5: Approve judge');
  const txApprove = new TransactionBlock();
  txApprove.moveCall({
    target: `${PACKAGE_ID}::judge::approve_judge`,
    arguments: [txApprove.object(applicationId)],
  });

  const approveResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txApprove,
      options: { showEffects: true },
    })
  );

  if (approveResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Approve failed:', approveResult.effects?.status?.error);
    process.exit(1);
  }
  console.log('  ✅ Judge approved');
  console.log('  tx:', approveResult.digest);

  // ── Step 6: Commit Vote ──────────────────────────────────────────────────
  console.log('\nStep 6: Commit vote');
  const score = 8;
  const nonce = Array.from(crypto.randomBytes(32));
  const commitHash = computeCommitHash(submissionId, score, nonce);
  console.log('  Score:', score);
  console.log('  Nonce:', nonce.join(','));
  console.log('  Hash:', commitHash.join(','));

  const txCommit = new TransactionBlock();
  txCommit.moveCall({
    target: `${PACKAGE_ID}::voting::commit_vote`,
    arguments: [
      txCommit.pure(bountyId),
      txCommit.pure(commitHash),
    ],
  });

  const commitResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txCommit,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (commitResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Commit failed:', commitResult.effects?.status?.error);
    process.exit(1);
  }

  const commitObj = commitResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('voting::VoteCommit'));
  const commitId = commitObj?.objectId;
  console.log('  ✅ commitId:', commitId);
  console.log('  tx:', commitResult.digest);

  // ── Step 7: Reveal Vote ──────────────────────────────────────────────────
  console.log('\nStep 7: Reveal vote');
  console.log('  Reveal: submissionId=' + submissionId + ', score=' + score + ', nonce=' + nonce.join(','));

  const txReveal = new TransactionBlock();
  txReveal.moveCall({
    target: `${PACKAGE_ID}::voting::reveal_vote`,
    arguments: [
      txReveal.object(commitId),
      txReveal.pure(submissionId), // submission_id: ID (BCS address)
      txReveal.pure(score),
      txReveal.pure(nonce),
    ],
  });

  const revealResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: keypair,
      transactionBlock: txReveal,
      options: { showEffects: true },
    })
  );

  if (revealResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Reveal failed:', revealResult.effects?.status?.error);
    process.exit(1);
  }
  console.log('  ✅ Vote revealed!');
  console.log('  tx:', revealResult.digest);

  // ── Step 8: Verify State ─────────────────────────────────────────────────
  console.log('\nStep 8: Verify final state');
  await sleep(2000);

  const commitData = await client.getObject({ id: commitId, options: { showContent: true } });
  const commitFields = commitData.data?.content?.fields;
  console.log('  VoteCommit revealed:', commitFields?.revealed);
  console.log('  VoteCommit score:', commitFields?.revealed_score);
  console.log('  VoteCommit submission_id:', commitFields?.revealed_submission_id);

  const profileData = await client.getObject({ id: profileId, options: { showContent: true } });
  const profileFields = profileData.data?.content?.fields;
  console.log('  JudgeProfile tier:', profileFields?.tier);
  console.log('  JudgeProfile reputation:', profileFields?.reputation_score);
  console.log('  JudgeProfile sessions_completed:', profileFields?.sessions_completed);

  const bountyData = await client.getObject({ id: bountyId, options: { showContent: true } });
  const bountyFields = bountyData.data?.content?.fields;
  console.log('  Bounty state:', bountyFields?.state);
  console.log('  Bounty submission_count:', bountyFields?.submission_count);

  // ── Summary ──────────────────────────────────────────────────────────────
  const balAfter = await client.getBalance({ owner: sender });
  const after = Number(balAfter.totalBalance) / 1_000_000_000;

  console.log('\n=== Judge Flow E2E Complete ===');
  console.log('All steps passed ✅');
  console.log('\nSummary:');
  console.log('  Profile:  ', profileId);
  console.log('  Bounty:   ', bountyId);
  console.log('  Submission:', submissionId);
  console.log('  Application:', applicationId);
  console.log('  VoteCommit:', commitId);
  console.log('  Score:    ', score);
  console.log('  Balance:  ', after.toFixed(4), 'SUI (spent', (suiBalance - after).toFixed(4), 'SUI)');
}

run().catch(e => { console.error('❌ Test failed:', e.message); process.exit(1); });
