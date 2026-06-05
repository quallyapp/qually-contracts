#!/usr/bin/env node
/**
 * Qually Multi-Wallet E2E Test
 * Tests full flow: Poster → Hunter → Judge
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const axios = require('axios');
const crypto = require('crypto');

const PACKAGE_ID = '0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46';
const TREASURY_ID = '0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e';
const TATUM_RPC = 'https://sui-testnet.gateway.tatum.io';
const TATUM_KEY = 't-6a199d1236e87595baf39056-f0739496094940579ae1954a';

const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });

// 3 wallets
const POSTER_KEY = '3d2b8208f2be39e3f77f6375fb217a96bc85d85f92e76bf6cc9d7da73bddaa61';
const HUNTER_KEY = 'af3a99ecef93b9f9b2eabcc1adb4766deaf219a1c33eb4879f34f738f3b6e72b';
const JUDGE_KEY  = 'bbeeb717b7865aa3f30727ae576c7ea836da3d31926edc93083dea5c9de74ef3';

function getKeyPair(hex) {
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
      console.log(`  ⚠️  Attempt ${i+1}: ${e.message?.substring(0, 150)}`);
      if (i < retries - 1) await sleep(delay);
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

async function getBalance(address) {
  const bal = await client.getBalance({ owner: address });
  return Number(bal.totalBalance) / 1_000_000_000;
}

async function run() {
  const poster = getKeyPair(POSTER_KEY);
  const hunter = getKeyPair(HUNTER_KEY);
  const judge  = getKeyPair(JUDGE_KEY);

  const posterAddr = poster.getPublicKey().toSuiAddress();
  const hunterAddr = hunter.getPublicKey().toSuiAddress();
  const judgeAddr  = judge.getPublicKey().toSuiAddress();

  console.log('=== Qually Multi-Wallet E2E Test ===\n');
  console.log('Poster:', posterAddr);
  console.log('Hunter:', hunterAddr);
  console.log('Judge: ', judgeAddr);
  console.log('');

  // Check balances
  const posterBal = await getBalance(posterAddr);
  const hunterBal = await getBalance(hunterAddr);
  const judgeBal  = await getBalance(judgeAddr);
  console.log('Balances:');
  console.log('  Poster:', posterBal.toFixed(2), 'SUI');
  console.log('  Hunter:', hunterBal.toFixed(2), 'SUI');
  console.log('  Judge: ', judgeBal.toFixed(2), 'SUI');
  console.log('');

  if (posterBal < 0.2) { console.log('❌ Poster needs more SUI'); process.exit(1); }
  if (hunterBal < 0.1) { console.log('❌ Hunter needs more SUI'); process.exit(1); }
  if (judgeBal < 0.2)  { console.log('❌ Judge needs more SUI'); process.exit(1); }

  // ── Step 1: Poster creates bounty ─────────────────────────────────────
  console.log('Step 1: Poster creates bounty');
  const contentHash = Array.from(sha3_256('test-bounty-' + Date.now()));
  const now = Date.now();
  const briefBlob = 'E2E_TEST_BRIEF_' + Date.now();

  const tx = new TransactionBlock();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(1_000_000_000)]); // 1 SUI
  tx.moveCall({
    target: `${PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      coin,
      tx.pure(0), // bounty_type: fixed
      tx.pure(Array.from(new TextEncoder().encode(briefBlob))),
      tx.pure(contentHash),
      tx.pure(now + 7 * 86400000),  // submission deadline: 7 days
      tx.pure(now + 7 * 86400000 + 5 * 60000), // judging deadline: 5 min after submission
      tx.pure(50),
      tx.pure(3),
      tx.pure([]),
      tx.pure(false),
      tx.pure(false),
      tx.pure(['e2e-test']),
    ],
  });

  const bountyResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: poster,
      transactionBlock: tx,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (bountyResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Bounty creation failed:', bountyResult.effects?.status?.error);
    process.exit(1);
  }

  const bountyObj = bountyResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('bounty::Bounty'));
  const bountyId = bountyObj?.objectId;
  console.log('  ✅ Bounty created:', bountyId);
  console.log('  tx:', bountyResult.digest);

  // Cache bounty ID for frontend
  const cached = JSON.parse(localStorage?.getItem?.('qually_bounty_ids') || '[]');
  try { localStorage.setItem('qually_bounty_ids', JSON.stringify([...cached, bountyId])); } catch {}

  await sleep(2000);

  // ── Step 2: Hunter submits work ───────────────────────────────────────
  console.log('\nStep 2: Hunter submits work');
  const subContent = JSON.stringify({ solution: 'E2E test submission', author: hunterAddr });
  const subHash = Array.from(sha3_256(subContent));
  const subBlob = 'E2E_TEST_SUB_' + Date.now();

  const txSub = new TransactionBlock();
  txSub.moveCall({
    target: `${PACKAGE_ID}::submission::submit_work`,
    arguments: [
      txSub.object(bountyId),
      txSub.pure([]),
      txSub.pure([]),
      txSub.pure(Array.from(new TextEncoder().encode(subBlob))),
      txSub.pure(subHash),
      txSub.object('0x6'),
    ],
  });

  const subResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: hunter,
      transactionBlock: txSub,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (subResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Submit failed:', subResult.effects?.status?.error);
  } else {
    const subObj = subResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('submission::Submission'));
    console.log('  ✅ Submission created:', subObj?.objectId);
    console.log('  tx:', subResult.digest);
  }

  await sleep(2000);

  // ── Step 3: Judge mints profile ───────────────────────────────────────
  console.log('\nStep 3: Judge mints profile');
  const txProfile = new TransactionBlock();
  txProfile.moveCall({
    target: `${PACKAGE_ID}::judge::mint_judge_profile`,
    arguments: [
      txProfile.pure(Array.from(new TextEncoder().encode('e2e-judge-blob'))),
    ],
  });

  const profileResult = await withRetry(() =>
    client.signAndExecuteTransactionBlock({
      signer: judge,
      transactionBlock: txProfile,
      options: { showObjectChanges: true, showEffects: true },
    })
  );

  if (profileResult.effects?.status?.status !== 'success') {
    console.log('  ❌ Profile mint failed:', profileResult.effects?.status?.error);
  } else {
    const profileObj = profileResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('judge::JudgeProfile'));
    console.log('  ✅ Judge profile created:', profileObj?.objectId);
    console.log('  tx:', profileResult.digest);
  }

  await sleep(2000);

  // ── Step 4: Judge applies for bounty ──────────────────────────────────
  console.log('\nStep 4: Judge applies for bounty');
  const profileObj = profileResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('judge::JudgeProfile'));
  const profileId = profileObj?.objectId;

  if (!profileId) {
    console.log('  ⚠️  Skipping apply (no profile)');
  } else {
    const txApply = new TransactionBlock();
    const [stakeCoin] = txApply.splitCoins(txApply.gas, [txApply.pure(100_000_000)]); // 0.1 SUI
    txApply.moveCall({
      target: `${PACKAGE_ID}::judge::apply_as_judge`,
      arguments: [
        txApply.object(profileId),
        txApply.object(bountyId),
        stakeCoin,
        txApply.pure(Array.from(new TextEncoder().encode('e2e-apply-blob'))),
      ],
    });

    const applyResult = await withRetry(() =>
      client.signAndExecuteTransactionBlock({
        signer: judge,
        transactionBlock: txApply,
        options: { showObjectChanges: true, showEffects: true },
      })
    );

    if (applyResult.effects?.status?.status !== 'success') {
      console.log('  ❌ Apply failed:', applyResult.effects?.status?.error);
    } else {
      const appObj = applyResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('judge::JudgeApplication'));
      console.log('  ✅ Application created:', appObj?.objectId);
      console.log('  tx:', applyResult.digest);
    }

    await sleep(2000);

    // ── Step 5: Poster approves judge ───────────────────────────────────
    console.log('\nStep 5: Poster approves judge');
    const appObjId = appObj?.objectId;

    if (appObjId) {
      const txApprove = new TransactionBlock();
      txApprove.moveCall({
        target: `${PACKAGE_ID}::judge::approve_judge`,
        arguments: [txApprove.object(appObjId)],
      });

      const approveResult = await withRetry(() =>
        client.signAndExecuteTransactionBlock({
          signer: poster,
          transactionBlock: txApprove,
          options: { showEffects: true },
        })
      );

      if (approveResult.effects?.status?.status !== 'success') {
        console.log('  ❌ Approve failed:', approveResult.effects?.status?.error);
      } else {
        console.log('  ✅ Judge approved');
        console.log('  tx:', approveResult.digest);
      }

      await sleep(2000);

      // ── Step 6: Judge commits vote ─────────────────────────────────────
      console.log('\nStep 6: Judge commits vote');
      const submissionObj = subResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('submission::Submission'));
      const submissionId = submissionObj?.objectId;

      if (submissionId) {
        const score = 85;
        const nonce = crypto.randomBytes(32);
        const hashInput = Buffer.concat([
          Buffer.from(submissionId.replace('0x', ''), 'hex'),
          Buffer.alloc(8), // score as LE u64
          nonce,
        ]);
        hashInput.writeBigUInt64LE(BigInt(score), 32);
        const commitHash = Array.from(sha3_256(hashInput));

        const txCommit = new TransactionBlock();
        txCommit.moveCall({
          target: `${PACKAGE_ID}::voting::commit_vote`,
          arguments: [
            txCommit.object(bountyId),
            txCommit.pure(commitHash),
          ],
        });

        const commitResult = await withRetry(() =>
          client.signAndExecuteTransactionBlock({
            signer: judge,
            transactionBlock: txCommit,
            options: { showObjectChanges: true, showEffects: true },
          })
        );

        if (commitResult.effects?.status?.status !== 'success') {
          console.log('  ❌ Commit failed:', commitResult.effects?.status?.error);
        } else {
          const commitObj = commitResult.objectChanges?.find(c => c.type === 'created' && c.objectType?.includes('voting::VoteCommit'));
          console.log('  ✅ Vote committed:', commitObj?.objectId);
          console.log('  tx:', commitResult.digest);
          console.log('  (Score:', score, ', Nonce:', nonce.toString('hex').slice(0, 16) + '...)');

          await sleep(2000);

          // ── Step 7: Judge reveals vote ─────────────────────────────────
          console.log('\nStep 7: Judge reveals vote');
          const txReveal = new TransactionBlock();
          txReveal.moveCall({
            target: `${PACKAGE_ID}::voting::reveal_vote`,
            arguments: [
              txReveal.object(commitObj?.objectId),
              txReveal.object(submissionId),
              txReveal.pure(score),
              txReveal.pure(Array.from(nonce)),
            ],
          });

          const revealResult = await withRetry(() =>
            client.signAndExecuteTransactionBlock({
              signer: judge,
              transactionBlock: txReveal,
              options: { showEffects: true },
            })
          );

          if (revealResult.effects?.status?.status !== 'success') {
            console.log('  ❌ Reveal failed:', revealResult.effects?.status?.error);
          } else {
            console.log('  ✅ Vote revealed');
            console.log('  tx:', revealResult.digest);
          }
        }
      }
    }
  }

  // ── Final: Read bounty state ──────────────────────────────────────────
  console.log('\n=== Final State ===');
  await sleep(2000);
  const bounty = await client.getObject({ id: bountyId, options: { showContent: true } });
  const fields = bounty.data?.content?.fields;
  console.log('  State:', fields?.state);
  console.log('  Prize:', Number(fields?.prize_pool) / 1_000_000_000, 'SUI');
  console.log('  Submissions:', fields?.submission_count);
  console.log('  Judge count:', fields?.judge_count);

  const finalPosterBal = await getBalance(posterAddr);
  const finalHunterBal = await getBalance(hunterAddr);
  const finalJudgeBal  = await getBalance(judgeAddr);
  console.log('\nFinal Balances:');
  console.log('  Poster:', finalPosterBal.toFixed(2), 'SUI (spent:', (posterBal - finalPosterBal).toFixed(2), ')');
  console.log('  Hunter:', finalHunterBal.toFixed(2), 'SUI');
  console.log('  Judge: ', finalJudgeBal.toFixed(2), 'SUI (spent:', (judgeBal - finalJudgeBal).toFixed(2), ')');

  console.log('\n=== E2E Test Complete ===');
  console.log('\nBounty ID:', bountyId);
}

run().catch(e => { console.error('❌ Test failed:', e.message); process.exit(1); });
