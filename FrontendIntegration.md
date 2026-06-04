# QUALLY — Frontend Integration Guide

This document provides all the technical details required to build a frontend that integrates with the Qually smart contracts and infrastructure.

---

## 1. Smart Contract Integration (Sui Move)

### 1.1 Package & Addresses

```typescript
// constants/contracts.ts
export const QUALLY_PACKAGE_ID = "0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46";
export const TREASURY_OBJECT_ID = "0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e";
export const NETWORK = "testnet";
```

| Object | Address |
|--------|---------|
| **Package ID** | `0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46` |
| **Treasury Object** | `0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e` |
| **Network** | Sui Testnet |
| **Explorer** | https://suiexplorer.com/network/testnet |

### 1.2 Core Objects (Data Schema)

#### **Bounty Object**

```typescript
interface Bounty {
  id: string;                    // UID
  poster: string;                // address
  bounty_type: number;           // 0=Fixed, 1=Contest, 2=Grant
  state: number;                 // 0=Open, 1=Review, 2=Finalized, 3=Closed
  prize_pool: bigint;            // Balance<SUI> in MIST (1 SUI = 1,000,000,000 MIST)
  brief_blob_id: number[];       // Walrus Blob ID
  brief_content_hash: number[];  // sha3_256 hash for integrity
  submission_deadline: number;   // Unix timestamp in ms
  judging_deadline: number;      // Unix timestamp in ms
  poster_weight: number;         // 30-70 (percent)
  max_judges: number;            // 1-7
  submissions_visible: boolean;  // false until Review phase
  contest_splits: number[];      // e.g. [50, 30, 20] for Contest type
  is_recurring: boolean;
  auto_extend: boolean;
  category_tags: string[];
}

// State constants
const BOUNTY_STATE = { OPEN: 0, REVIEW: 1, FINALIZED: 2, CLOSED: 3 };
const BOUNTY_TYPE = { FIXED: 0, CONTEST: 1, GRANT: 2 };
```

#### **Submission Object (NFT)**

```typescript
interface Submission {
  id: string;                    // UID
  bounty_id: string;             // ID
  lead_hunter: string;           // address
  collaborators: string[];       // addresses
  payout_splits: number[];       // must sum to 100
  blob_id: number[];             // Walrus Blob ID
  content_hash: number[];        // sha3_256 for integrity
  submitted_at: number;          // Unix timestamp in ms
  is_sealed: boolean;            // true until review phase
}
```

#### **VoteCommit Object**

```typescript
interface VoteCommit {
  id: string;                    // UID
  judge: string;                 // address
  bounty_id: string;             // ID
  commit_hash: number[];         // sha3_256(submission_id | score | nonce)
  revealed: boolean;
  revealed_score: number;
  revealed_submission_id: string;
}
```

#### **Profile Objects**

```typescript
interface PosterProfile {
  id: string;
  owner: string;
  name: string;
  bio_blob_id: number[];
  payout_rate: number;
  avg_close_time: number;
  dispute_count: number;
  total_bounties_posted: number;
  total_paid: number;
}

interface HunterProfile {
  id: string;
  owner: string;
  name: string;
  bio_blob_id: number[];
  reputation_score: number;
  total_bounties_won: number;
  total_earned: number;
  skill_tags: string[];
}

interface JudgeProfile {
  id: string;
  owner: string;
  tier: number;               // 0=New, 1=Active, 2=Trusted, 3=Elite
  reputation_score: number;
  sessions_completed: number;
  sessions_missed: number;
  history_blob_id: number[];
  staked_balance: bigint;     // Balance<SUI> in MIST
}

interface JudgeApplication {
  id: string;
  judge: address;
  bounty_id: string;
  judge_profile_id: string;
  stake_amount: bigint;
  application_blob_id: number[];
  state: number;              // 0=Pending, 1=Approved, 2=Rejected
}

interface Milestone {
  id: string;
  bounty_id: string;
  hunter: address;
  milestone_index: number;
  description_blob_id: number[];
  delivery_blob_id: number[];
  deadline: number;
  payout_amount: number;
  state: number;              // 0=Pending, 1=Submitted, 2=Approved, 3=Rejected, 4=Overdue
  submitted_at: number;
  approved_at: number;
}

// State constants
const MILESTONE_STATE = { PENDING: 0, SUBMITTED: 1, APPROVED: 2, REJECTED: 3, OVERDUE: 4 };
const APPLICATION_STATE = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
const DISPUTE_STATE = { OPEN: 0, REVIEW: 1, RESOLVED: 2, REJECTED: 3 };
const DISPUTE_OUTCOME = { NONE: 0, HUNTER_WINS: 1, POSTER_WINS: 2, SPLIT: 3 };
```

### 1.3 Entry Functions

| Function | Module | Parameters | Auth | Description |
|---|---|---|---|---|
| `create_poster_profile` | `profile` | `name: String`, `bio_blob_id: vector<u8>` | Sender | Create poster identity |
| `create_hunter_profile` | `profile` | `name: String`, `bio_blob_id: vector<u8>`, `skill_tags: vector<String>` | Sender | Create hunter identity |
| `mint_judge_profile` | `judge` | None | Sender | Mint judge NFT (starts Tier 0) |
| `apply_as_judge` | `judge` | `profile: &mut JudgeProfile`, `bounty_id: ID`, `stake: Coin<SUI>`, `application_blob_id: vector<u8>` | Sender | Apply for bounty with stake |
| `approve_judge` | `judge` | `application: &mut JudgeApplication` | Poster | Approve judge application |
| `release_stake` | `judge` | `profile: &mut JudgeProfile`, `amount: u64` | Sender | Withdraw staked SUI |
| `create_bounty` | `bounty` | See §1.4 | Sender | Create bounty with escrow |
| `approve_judge_for_bounty` | `bounty` | `bounty: &mut Bounty`, `judge: address` | Poster | Add judge to bounty |
| `veto_result` | `bounty` | `bounty: &mut Bounty`, `finalized_at: u64`, `clock: &Clock` | Poster | Override outcome (one-time, within 48h) |
| `submit_work` | `submission` | `bounty: &mut Bounty`, `collaborators: vector<address>`, `payout_splits: vector<u8>`, `blob_id: vector<u8>`, `content_hash: vector<u8>`, `clock: &Clock` | Sender | Submit work (validates bounty state, deadline, gating, duplicate) |
| `start_review` | `bounty` | `bounty: &mut Bounty`, `clock: &Clock` | Poster only | Open submissions for review |
| `finalize_bounty` | `bounty` | `bounty: &mut Bounty`, `clock: &Clock` | Poster only | Mark bounty as finalized |
| `close_bounty` | `bounty` | `bounty: &mut Bounty` | Poster only | Close bounty after payout |
| `refund_empty_bounty` | `bounty` | `bounty: &mut Bounty` | Poster only | Refund if no submissions |
| `refund_expired_bounty` | `bounty` | `bounty: &mut Bounty`, `clock: &Clock` | Anyone | Auto-refund after deadline if no submissions |
| `commit_vote` | `voting` | `bounty_id: ID`, `commit_hash: vector<u8>` | Sender | Commit hashed vote |
| `reveal_vote` | `voting` | `commit: &mut VoteCommit`, `submission_id: ID`, `score: u64`, `nonce: vector<u8>` | Judge only | Reveal vote with hash verification |
| `finalize_fixed` | `payout` | `bounty: &mut Bounty`, `winner: address`, `treasury: &mut Treasury` | Poster only | Payout 100% to winner |
| `finalize_contest` | `payout` | `bounty: &mut Bounty`, `winners: vector<address>`, `treasury: &mut Treasury` | Poster only | Payout to multiple winners |
| `release_milestone` | `payout` | `bounty: &mut Bounty`, `hunter: address`, `amount: u64` | Poster only | Release grant milestone |
| `create_milestone` | `milestone` | `bounty_id: ID`, `hunter: address`, `milestone_index: u8`, `description_blob_id: vector<u8>`, `deadline: u64`, `payout_amount: u64` | Sender | Create milestone for grant |
| `submit_milestone` | `milestone` | `milestone: &mut Milestone`, `delivery_blob_id: vector<u8>`, `clock: &Clock` | Hunter | Submit milestone completion |
| `approve_milestone` | `milestone` | `milestone: &mut Milestone`, `clock: &Clock` | Poster | Approve milestone |
| `reject_milestone` | `milestone` | `milestone: &mut Milestone` | Poster | Reject milestone (allows resubmit) |
| `escalate_overdue` | `milestone` | `milestone: &mut Milestone`, `clock: &Clock` | Anyone | Mark overdue milestone |
| `open_dispute` | `dispute` | `bounty_id: ID`, `submission_id: ID`, `reason_blob_id: vector<u8>`, `dispute_fee: u64` | Sender | Initiate dispute |
| `submit_evidence` | `dispute` | `dispute: &mut Dispute`, `evidence_blob_id: vector<u8>` | Hunter | Submit additional evidence |
| `assign_arbiter` | `dispute` | `dispute: &mut Dispute`, `arbiter: address` | Authorized | Assign arbiter to dispute |
| `resolve_dispute` | `dispute` | `dispute: &mut Dispute`, `bounty: &mut Bounty`, `outcome: u8`, `clock: &Clock` | Arbiter | Resolve dispute (1=hunter wins, 2=poster wins, 3=split) — transfers funds |
| `reject_dispute` | `dispute` | `dispute: &mut Dispute` | Arbiter | Reject dispute (insufficient evidence) |
| `withdraw` | `treasury` | `treasury: &mut Treasury`, `amount: u64` | Admin only | Withdraw platform fees |
| `set_gated` | `bounty` | `bounty: &mut Bounty`, `is_gated: bool` | Poster | Enable/disable gated submissions |
| `add_allowed_submitter` | `bounty` | `bounty: &mut Bounty`, `submitter: address` | Poster | Add address to allowed list |
| `remove_allowed_submitter` | `bounty` | `bounty: &mut Bounty`, `submitter: address` | Poster | Remove address from allowed list |
| `boost_prize_pool` | `bounty` | `bounty: &mut Bounty`, `payment: Coin<SUI>` | Anyone | Add SUI to a live bounty's prize pool |
| `auto_extend` | `bounty` | `bounty: &mut Bounty`, `extension_ms: u64`, `clock: &Clock` | Poster | Extend deadline if <2 submissions near close |
| `update_judge_reputation` | `payout` | `judge_profile: &mut JudgeProfile` | Poster/Anyone | Update judge rep after session (+10 base) |
| `slash_judge_for_missed_reveal` | `payout` | `judge_profile: &mut JudgeProfile`, `slash_amount: u64` | Poster/Anyone | Slash judge for missed reveal (-15 rep + stake) |

### 1.4 Create Bounty Parameters

```typescript
interface CreateBountyParams {
  payment: Coin<SUI>;           // SUI coin to lock as prize
  bounty_type: number;          // 0=Fixed, 1=Contest, 2=Grant
  brief_blob_id: number[];      // Walrus blob ID from upload
  brief_content_hash: number[]; // sha3_256(blobId)
  submission_deadline: number;  // Unix timestamp ms
  judging_deadline: number;     // Must be after submission_deadline
  poster_weight: number;        // 30-70 (percent weight for poster's score)
  max_judges: number;           // 1-7
  contest_splits: number[];     // Must sum to 100 for Contest type
  is_recurring: boolean;
  auto_extend: boolean;
  category_tags: string[];
}
```

---

## 2. Transaction Building (TypeScript)

### 2.1 Setup Sui Client

```typescript
// lib/sui.ts
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/bcs';

const NETWORK = 'testnet';

export const suiClient = new SuiClient({
  url: getFullnodeUrl(NETWORK),
  // For Tatum RPC, use: url: 'https://sui-testnet.gateway.tatum.io'
});

// Load keypair from private key (stored securely in env)
export function loadKeypair(privateKeyBase64: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(fromBase64(privateKeyBase64));
}
```

### 2.2 Create Bounty Transaction

```typescript
// transactions/bounty.ts
import { Transaction } from '@mysten/sui/transactions';
import { QUALLY_PACKAGE_ID, TREASURY_OBJECT_ID } from '../constants/contracts';

export async function buildCreateBountyTx(
  params: CreateBountyParams,
  sender: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  // Convert deadlines to MIST-compatible timestamps
  const submissionDeadline = BigInt(params.submission_deadline);
  const judgingDeadline = BigInt(params.judging_deadline);
  
  // Build category tags vector
  const categoryTags = params.category_tags.map(tag => 
    tx.pure.string(tag)
  );
  
  // Build contest splits vector
  const contestSplits = params.contest_splits.map(split => 
    tx.pure.u8(split)
  );
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      tx.object(params.payment),           // Coin<SUI>
      tx.pure.u8(params.bounty_type),      // bounty_type
      tx.pure.vector('u8', params.brief_blob_id),      // brief_blob_id
      tx.pure.vector('u8', params.brief_content_hash), // brief_content_hash
      tx.pure.u64(submissionDeadline),     // submission_deadline
      tx.pure.u64(judgingDeadline),        // judging_deadline
      tx.pure.u8(params.poster_weight),    // poster_weight (30-70)
      tx.pure.u8(params.max_judges),       // max_judges
      contestSplits.length > 0 ? tx.pure.vector('u8', contestSplits) : tx.pure.vector('u8', []), // contest_splits
      tx.pure.bool(params.is_recurring),   // is_recurring
      tx.pure.bool(params.auto_extend),    // auto_extend
      categoryTags.length > 0 ? tx.pure.vector('string', categoryTags) : tx.pure.vector('string', []), // category_tags
    ],
  });
  
  return tx;
}
```

### 2.3 Submit Work Transaction

```typescript
export async function buildSubmitWorkTx(
  bountyObjectId: string,      // Must pass &mut Bounty object, not just ID
  collaborators: string[],
  payoutSplits: number[],
  blobId: number[],
  contentHash: number[],
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  // Get clock object
  const clock = tx.object(clockRef);
  
  // Build collaborators vector
  const collaboratorArgs = collaborators.map(addr => 
    tx.pure.address(addr)
  );
  
  // Build payout splits vector
  const splitArgs = payoutSplits.map(split => 
    tx.pure.u8(split)
  );
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::submission::submit_work`,
    arguments: [
      tx.object(bountyObjectId),                  // &mut Bounty (must be object ref)
      collaboratorArgs.length > 0 ? tx.pure.vector('address', collaboratorArgs) : tx.pure.vector('address', []),
      splitArgs.length > 0 ? tx.pure.vector('u8', splitArgs) : tx.pure.vector('u8', []),
      tx.pure.vector('u8', blobId),
      tx.pure.vector('u8', contentHash),
      clock,
    ],
  });
  
  return tx;
}
```

### 2.3b Gated Submission Transaction

```typescript
// Enable gated mode on a bounty
export async function buildSetGatedTx(
  bountyObjectId: string,
  isGated: boolean
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::set_gated`,
    arguments: [
      tx.object(bountyObjectId),
      tx.pure.bool(isGated),
    ],
  });
  
  return tx;
}

// Add an allowed submitter
export async function buildAddAllowedSubmitterTx(
  bountyObjectId: string,
  submitter: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::add_allowed_submitter`,
    arguments: [
      tx.object(bountyObjectId),
      tx.pure.address(submitter),
    ],
  });
  
  return tx;
}
```

### 2.4 Vote Commit Transaction

```typescript
export async function buildCommitVoteTx(
  bountyId: string,
  commitHash: number[]
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::voting::commit_vote`,
    arguments: [
      tx.pure.id(bountyId),                    // bounty_id
      tx.pure.vector('u8', commitHash),        // commit_hash
    ],
  });
  
  return tx;
}
```

### 2.5 Vote Reveal Transaction

```typescript
export async function buildRevealVoteTx(
  commitId: string,
  submissionId: string,
  score: number,
  nonce: number[]
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::voting::reveal_vote`,
    arguments: [
      tx.object(commitId),                     // &mut VoteCommit
      tx.pure.id(submissionId),                // submission_id
      tx.pure.u64(BigInt(score)),              // score
      tx.pure.vector('u8', nonce),             // nonce
    ],
  });
  
  return tx;
}
```

### 2.6 Finalize Fixed Bounty

```typescript
export async function buildFinalizeFixedTx(
  bountyId: string,
  winnerAddress: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::finalize_fixed`,
    arguments: [
      tx.object(bountyId),                     // &mut Bounty
      tx.pure.address(winnerAddress),          // winner
      tx.object(TREASURY_OBJECT_ID),           // &mut Treasury
    ],
  });
  
  return tx;
}
```

### 2.7 Apply as Judge (with Stake)

```typescript
export async function buildApplyAsJudgeTx(
  judgeProfileId: string,
  bountyId: string,
  stakeAmount: number,        // in MIST
  applicationBlobId: number[]
): Promise<Transaction> {
  const tx = new Transaction();
  
  // Create stake coin from gas
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(stakeAmount))]);
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::judge::apply_as_judge`,
    arguments: [
      tx.object(judgeProfileId),               // &mut JudgeProfile
      tx.pure.id(bountyId),                    // bounty_id
      stakeCoin,                               // Coin<SUI>
      tx.pure.vector('u8', applicationBlobId), // application_blob_id
    ],
  });
  
  return tx;
}
```

### 2.8 Approve Judge for Bounty

```typescript
export async function buildApproveJudgeForBountyTx(
  bountyId: string,
  judgeAddress: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::approve_judge_for_bounty`,
    arguments: [
      tx.object(bountyId),                     // &mut Bounty
      tx.pure.address(judgeAddress),           // judge
    ],
  });
  
  return tx;
}
```

### 2.9 Veto Result

```typescript
export async function buildVetoResultTx(
  bountyId: string,
  finalizedAt: number,  // timestamp when bounty was finalized (ms)
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::veto_result`,
    arguments: [
      tx.object(bountyId),                     // &mut Bounty
      tx.pure.u64(finalizedAt),                // finalized_at
      tx.object(clockRef),                      // &Clock
    ],
  });
  
  return tx;
}
```

### 2.10 Submit Milestone

```typescript
export async function buildSubmitMilestoneTx(
  milestoneId: string,
  deliveryBlobId: number[],
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::submit_milestone`,
    arguments: [
      tx.object(milestoneId),                  // &mut Milestone
      tx.pure.vector('u8', deliveryBlobId),    // delivery_blob_id
      tx.object(clockRef),                     // &Clock
    ],
  });
  
  return tx;
}
```

### 2.11 Approve Milestone

```typescript
export async function buildApproveMilestoneTx(
  milestoneId: string,
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::approve_milestone`,
    arguments: [
      tx.object(milestoneId),                  // &mut Milestone
      tx.object(clockRef),                     // &Clock
    ],
  });
  
  return tx;
}
```

### 2.12 Open Dispute

```typescript
export async function buildOpenDisputeTx(
  bountyId: string,
  submissionId: string,
  reasonBlobId: number[],
  disputeFee: number         // in MIST
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::open_dispute`,
    arguments: [
      tx.pure.id(bountyId),                    // bounty_id
      tx.pure.id(submissionId),                // submission_id
      tx.pure.vector('u8', reasonBlobId),      // reason_blob_id
      tx.pure.u64(BigInt(disputeFee)),         // dispute_fee
    ],
  });
  
  return tx;
}
```

### 2.13 Resolve Dispute

```typescript
export async function buildResolveDisputeTx(
  disputeId: string,
  bountyId: string,
  outcome: number,           // 1=hunter wins, 2=poster wins, 3=split
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::resolve_dispute`,
    arguments: [
      tx.object(disputeId),                     // &mut Dispute
      tx.object(bountyId),                      // &mut Bounty
      tx.pure.u8(outcome),                      // outcome
      tx.object(clockRef),                      // &Clock
    ],
  });
  
  return tx;
}
```

### 2.14 Boost Prize Pool

```typescript
export async function buildBoostPrizePoolTx(
  bountyId: string,
  paymentCoin: string,   // Coin<SUI> object ID
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::boost_prize_pool`,
    arguments: [
      tx.object(bountyId),                     // &mut Bounty
      tx.object(paymentCoin),                   // Coin<SUI>
    ],
  });
  
  return tx;
}
```

### 2.15 Auto Extend Deadline

```typescript
export async function buildAutoExtendTx(
  bountyId: string,
  extensionMs: number,
  clockRef: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::auto_extend`,
    arguments: [
      tx.object(bountyId),                     // &mut Bounty
      tx.pure.u64(extensionMs),                // extension in ms
      tx.object(clockRef),                      // &Clock
    ],
  });
  
  return tx;
}
```

### 2.16 Update Judge Reputation

```typescript
export async function buildUpdateJudgeReputationTx(
  judgeProfileId: string
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::update_judge_reputation`,
    arguments: [
      tx.object(judgeProfileId),               // &mut JudgeProfile
    ],
  });
  
  return tx;
}
```

### 2.17 Slash Judge for Missed Reveal

```typescript
export async function buildSlashJudgeTx(
  judgeProfileId: string,
  slashAmount: number    // in MIST
): Promise<Transaction> {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::slash_judge_for_missed_reveal`,
    arguments: [
      tx.object(judgeProfileId),               // &mut JudgeProfile
      tx.pure.u64(slashAmount),                // slash amount in MIST
    ],
  });
  
  return tx;
}
```

---

## 3. Hash Generation (Commit-Reveal)

### 3.1 Generate Commit Hash

```typescript
// lib/voting.ts
import { sha3_256 } from '@mysten/bcs';
import { toBase64 } from '@mysten/bcs';

/**
 * Generate a commit hash for vote commit-reveal
 * Hash = sha3_256(submission_id_bytes + score_bytes + nonce_bytes)
 */
export function generateCommitHash(
  submissionId: string,
  score: number,
  nonce: Uint8Array
): Uint8Array {
  // Convert submission ID to bytes (32 bytes)
  const submissionBytes = hexToBytes(submissionId);
  
  // Convert score to 8 bytes (u64 little-endian)
  const scoreBytes = new Uint8Array(8);
  const scoreView = new DataView(scoreBytes.buffer);
  scoreView.setBigUint64(0, BigInt(score), true);
  
  // Concatenate all bytes
  const data = new Uint8Array(submissionBytes.length + scoreBytes.length + nonce.length);
  data.set(submissionBytes, 0);
  data.set(scoreBytes, submissionBytes.length);
  data.set(nonce, submissionBytes.length + scoreBytes.length);
  
  // Hash with SHA3-256
  return sha3_256(data);
}

/**
 * Generate random nonce for commit
 */
export function generateNonce(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
```

### 3.2 Verify Commit Hash (Off-chain)

```typescript
/**
 * Verify that a revealed vote matches the committed hash
 */
export function verifyCommitHash(
  submissionId: string,
  score: number,
  nonce: Uint8Array,
  committedHash: Uint8Array
): boolean {
  const computedHash = generateCommitHash(submissionId, score, nonce);
  return arraysEqual(computedHash, committedHash);
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```

---

## 4. Read Operations (Tatum RPC)

### 4.1 Fetch Bounty Object

```typescript
// hooks/useBounty.ts
import { useSuiClientQuery } from '@mysten/dapp-kit';

export function useBounty(bountyId: string) {
  return useSuiClientQuery('getObject', {
    id: bountyId,
    options: {
      showContent: true,
      showType: true,
    },
  });
}

// Parse bounty from response
function parseBounty(data: any): Bounty {
  const fields = data.data.content.fields;
  return {
    id: data.data.objectId,
    poster: fields.poster,
    bounty_type: parseInt(fields.bounty_type),
    state: parseInt(fields.state),
    prize_pool: BigInt(fields.prize_pool.fields.value),
    brief_blob_id: fields.brief_blob_id,
    brief_content_hash: fields.brief_content_hash,
    submission_deadline: parseInt(fields.submission_deadline),
    judging_deadline: parseInt(fields.judging_deadline),
    poster_weight: parseInt(fields.poster_weight),
    max_judges: parseInt(fields.max_judges),
    submissions_visible: fields.submissions_visible,
    contest_splits: fields.contest_splits,
    is_recurring: fields.is_recurring,
    auto_extend: fields.auto_extend,
    category_tags: fields.category_tags,
  };
}
```

### 4.2 Fetch All Bounties

```typescript
export function useAllBounties() {
  return useSuiClientQuery('getDynamicFields', {
    parentId: TREASURY_OBJECT_ID,
  });
}

// Or query by type
export function useBountiesByState(state: number) {
  return useSuiClientQuery('getMoveObjectsByType', {
    type: `${QUALLY_PACKAGE_ID}::bounty::Bounty`,
    options: {
      showContent: true,
    },
  });
}
```

### 4.3 Fetch User's Submissions

```typescript
export function useUserSubmissions(walletAddress: string) {
  return useSuiClientQuery('getOwnedObjects', {
    owner: walletAddress,
    filter: {
      StructType: `${QUALLY_PACKAGE_ID}::submission::Submission`,
    },
    options: {
      showContent: true,
    },
  });
}
```

---

## 5. Walrus Storage Integration

All content (briefs, submissions, profiles) is stored on Walrus. The frontend is responsible for uploading files and passing the returned `blobId` to the Sui contract.

> **Important**: Walrus blobs are registered immediately but require asynchronous certification by storage nodes. After upload, there may be a delay before blobs can be read through the aggregator. On testnet, this can take 1-2 minutes. Plan your UX accordingly (show "uploading..." state, allow users to proceed with Sui transaction while certification happens in background).

### 5.1 Walrus Client Setup

```typescript
// lib/walrus.ts
import { WalrusClient } from '@mysten/walrus';

export const walrusClient = new WalrusClient({
  publisherUrl: import.meta.env.VITE_WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.walrus.space',
  aggregatorUrl: import.meta.env.VITE_WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.walrus.space',
});
```

### 5.2 Upload Brief to Walrus

```typescript
// lib/walrus.ts
import { sha3_256 } from '@mysten/bcs';

export interface BriefData {
  title: string;
  description: string;
  acceptance_criteria: string;
  attachments?: string[];
  skill_tags: string[];
}

export async function uploadBrief(brief: BriefData): Promise<{
  blobId: Uint8Array;
  contentHash: Uint8Array;
}> {
  // Serialize to JSON
  const jsonStr = JSON.stringify(brief);
  const bytes = new TextEncoder().encode(jsonStr);
  
  // Upload to Walrus
  const result = await walrusClient.writeBlob({
    blob: bytes,
    epochs: 52,         // ~1 year
    deletable: false,
  });
  
  // Compute content hash
  const contentHash = sha3_256(new TextEncoder().encode(result.blobId));
  
  return {
    blobId: new TextEncoder().encode(result.blobId),
    contentHash,
  };
}
```

### 5.3 Read Brief from Walrus

```typescript
export async function readBrief(blobId: Uint8Array): Promise<BriefData> {
  const blobIdStr = new TextDecoder().decode(blobId);
  const response = await walrusClient.readBlob({ blobId: blobIdStr });
  const text = new TextDecoder().decode(response);
  return JSON.parse(text);
}
```

### 5.4 Upload Submission

```typescript
export interface SubmissionData {
  work_files: string[];
  links: string[];
  notes: string;
  team_info?: {
    name: string;
    roles: Record<string, string>;
  };
}

export async function uploadSubmission(submission: SubmissionData): Promise<{
  blobId: Uint8Array;
  contentHash: Uint8Array;
}> {
  const jsonStr = JSON.stringify(submission);
  const bytes = new TextEncoder().encode(jsonStr);
  
  const result = await walrusClient.writeBlob({
    blob: bytes,
    epochs: 260,        // ~5 years (permanent proof of work)
    deletable: false,
  });
  
  const contentHash = sha3_256(new TextEncoder().encode(result.blobId));
  
  return {
    blobId: new TextEncoder().encode(result.blobId),
    contentHash,
  };
}
```

---

## 6. LI.FI Integration (Payments)

The frontend uses the LI.FI SDK to allow posters to pay in any token from any chain.

### 6.1 Setup LI.FI

```typescript
// lib/lifi.ts
import { createConfig, getRoutes, executeRoute } from '@lifi/sdk';

createConfig({ 
  integrator: 'qually',
  // Optional: add API key for higher rate limits
  // apiKey: import.meta.env.VITE_LIFI_API_KEY,
});

export const SUI_CHAIN_ID = 114; // Sui mainnet
export const SUI_TOKEN_ADDRESS = '0x2::sui::SUI';
```

### 6.2 Get Payment Route

```typescript
export interface PaymentRoute {
  fromToken: string;
  fromChain: number;
  toAmount: string;
  feeCosts: any[];
  gasCosts: any[];
  route: any;
}

export async function getPaymentRoute(
  fromToken: string,
  fromChain: number,
  suiAmount: bigint
): Promise<PaymentRoute> {
  const routes = await getRoutes({
    fromChainId: fromChain,
    toChainId: SUI_CHAIN_ID,
    fromTokenAddress: fromToken,
    toTokenAddress: SUI_TOKEN_ADDRESS,
    toAmount: suiAmount.toString(),
  });
  
  return {
    fromToken,
    fromChain,
    toAmount: suiAmount.toString(),
    feeCosts: routes.routes[0]?.feeCosts || [],
    gasCosts: routes.routes[0]?.gasCosts || [],
    route: routes.routes[0],
  };
}
```

### 6.3 Execute Payment

```typescript
import { useWalletKit } from '@mysten/dapp-kit';

export function useExecutePayment() {
  const { signAndExecuteTransaction } = useWalletKit();
  
  async function executePayment(route: any) {
    const execution = await executeRoute(route, {
      updateRouteHook: (updatedRoute) => {
        // Update UI with route progress
        console.log('Route updated:', updatedRoute);
      },
    });
    
    return execution;
  }
  
  return { executePayment };
}
```

### 6.4 Supported Tokens

| Token | Chains |
|-------|--------|
| USDC | Ethereum, Arbitrum, Base, Solana |
| USDT | Ethereum, Arbitrum, BNB Chain |
| ETH | Ethereum, Arbitrum, Optimism |
| SOL | Solana |
| BNB | BNB Chain |
| MATIC / POL | Polygon |

---

## 7. Tatum Integration

### 7.1 RPC Gateway Setup

```typescript
// lib/sui.ts
import { SuiClient } from '@mysten/sui/client';

// Use Tatum for production (better uptime, caching, failover)
export const suiClient = new SuiClient({
  url: 'https://sui-testnet.gateway.tatum.io',
  // Add Tatum API key as header
  headers: {
    'x-api-key': import.meta.env.VITE_TATUM_API_KEY,
  },
});
```

### 7.2 Real-time Notifications (Webhooks)

```typescript
// Backend: Register Tatum webhook (run once)
async function registerTatumWebhook(packageId: string, webhookUrl: string) {
  const response = await fetch('https://api.tatum.io/v3/notification/subscription', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.TATUM_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'ADDRESS_EVENT',
      attr: {
        address: packageId,
        chain: 'SUI',
        url: webhookUrl,
      },
    }),
  });
  
  return response.json();
}
```

### 7.3 Webhook Event Types

| Event | Action |
|-------|--------|
| Submission minted to hunter wallet | Send notification: "Your submission was received" |
| `finalize()` executed | Notify winner: "You won — payout incoming" |
| Payout SUI sent | Notify hunter: "X SUI received" |
| Judge approval | Notify judge: "You have been approved to judge [bounty]" |
| Bounty deadline approaching (24h) | Notify poster and judges |
| Dispute raised | Notify all parties |

---

## 8. Complete Integration Example

### 8.1 Create Bounty Flow

```typescript
// pages/CreateBounty.tsx
import { useState } from 'react';
import { useWalletKit } from '@mysten/dapp-kit';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';

export function CreateBountyPage() {
  const { signAndExecuteTransaction } = useWalletKit();
  const [loading, setLoading] = useState(false);
  
  async function handleCreateBounty(form: CreateBountyForm) {
    setLoading(true);
    
    try {
      // 1. Upload brief to Walrus
      const { blobId, contentHash } = await uploadBrief({
        title: form.title,
        description: form.description,
        acceptance_criteria: form.acceptanceCriteria,
        skill_tags: form.skillTags,
      });
      
      // 2. Build transaction
      const tx = await buildCreateBountyTx({
        payment: form.paymentCoin,
        bounty_type: form.bountyType,
        brief_blob_id: Array.from(blobId),
        brief_content_hash: Array.from(contentHash),
        submission_deadline: form.submissionDeadline.getTime(),
        judging_deadline: form.judgingDeadline.getTime(),
        poster_weight: form.posterWeight,
        max_judges: form.maxJudges,
        contest_splits: form.contestSplits,
        is_recurring: form.isRecurring,
        auto_extend: form.autoExtend,
        category_tags: form.categoryTags,
      }, currentAccount.address);
      
      // 3. Sign and execute
      const result = await signAndExecuteTransaction({
        kind: 'moveCall',
        data: tx,
      });
      
      // 4. Wait for confirmation
      console.log('Bounty created:', result.digest);
      
    } catch (error) {
      console.error('Failed to create bounty:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    // Form UI...
  );
}
```

### 8.2 Submit Work Flow

```typescript
// pages/Submit.tsx
async function handleSubmit(bountyId: string, form: SubmissionForm) {
  // 1. Upload work to Walrus
  const { blobId, contentHash } = await uploadSubmission({
    work_files: form.fileUrls,
    links: form.links,
    notes: form.notes,
  });
  
  // 2. Build transaction
  const tx = await buildSubmitWorkTx(
    bountyId,
    form.collaborators,
    form.payoutSplits,
    Array.from(blobId),
    Array.from(contentHash),
    '0x0000000000000000000000000000000000000000000000000000000000000006', // Clock object
  );
  
  // 3. Sign and execute
  const result = await signAndExecuteTransaction({
    kind: 'moveCall',
    data: tx,
  });
  
  console.log('Submission minted:', result.digest);
}
```

### 8.3 Judge Voting Flow

```typescript
// pages/JudgePanel.tsx
async function handleCommitVote(bountyId: string, submissionId: string, score: number) {
  // 1. Generate nonce and hash
  const nonce = generateNonce();
  const commitHash = generateCommitHash(submissionId, score, nonce);
  
  // 2. Build commit transaction
  const tx = await buildCommitVoteTx(bountyId, Array.from(commitHash));
  
  // 3. Sign and execute
  const result = await signAndExecuteTransaction({
    kind: 'moveCall',
    data: tx,
  });
  
  // 4. Store nonce securely for reveal phase
  await storeNonceForReveal(result.digest, submissionId, score, nonce);
  
  console.log('Vote committed:', result.digest);
}

async function handleRevealVote(commitId: string, submissionId: string, score: number, nonce: Uint8Array) {
  // 1. Build reveal transaction
  const tx = await buildRevealVoteTx(commitId, submissionId, score, Array.from(nonce));
  
  // 2. Sign and execute
  const result = await signAndExecuteTransaction({
    kind: 'moveCall',
    data: tx,
  });
  
  console.log('Vote revealed:', result.digest);
}
```

---

## 9. Environment Variables

```bash
# .env
VITE_SUI_NETWORK=testnet
VITE_QUALLY_PACKAGE_ID=0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46
VITE_TREASURY_OBJECT_ID=0x177ca7cb6d6063c09036076b44ff19a3671a69da6d4272a30077f16896c5969e
VITE_TATUM_API_KEY=your_tatum_api_key_here
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
VITE_LIFI_INTEGRATOR=qually
```

---

## 9.5 LI.FI Multi-Token Integration

Qually contracts only accept SUI. LI.FI lets users pay with any token (USDC, ETH, SOL, etc.) — the frontend swaps to SUI before calling `create_bounty`.

### 9.5.1 Setup

```bash
npm install @lifi/sdk
```

```typescript
import { createConfig } from '@lifi/sdk';

const config = createConfig({
  integrator: 'qually',  // From env: VITE_LIFI_INTEGRATOR
  apiUrl: 'https://li.quest/v1',
});
```

### 9.5.2 Get Quote (any token → SUI)

```typescript
import { getQuote } from '@lifi/sdk';

async function getSwapQuote(
  fromToken: string,   // e.g. '0x6b175474e89094c44da98b954eedeac495271d0f' (DAI on ETH)
  fromChain: number,   // e.g. 1 (Ethereum)
  toAmount: string     // Amount in token decimals
) {
  const quote = await getQuote({
    fromToken,
    toToken: '0x2::sui::SUI',
    fromChain,
    toChain: 101,  // Sui chain ID
    fromAmount: toAmount,
    integrator: 'qually',
  });

  return {
    liFiTx: quote.transactionRequest,  // Pass to wallet for signing
    estimate: quote.estimate,
  };
}
```

### 9.5.3 Swap + Create Bounty Flow

```typescript
import { useWalletKit } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

async function handleCreateBountyWithAnyToken(
  fromToken: string,
  fromChain: number,
  amount: string,
  bountyParams: CreateBountyParams
) {
  // 1. Get LI.FI quote (any token → SUI)
  const quote = await getSwapQuote(fromToken, fromChain, amount);

  // 2. User signs LI.FI swap tx (sends fromToken, receives SUI on Sui)
  const swapResult = await signAndExecuteTransaction({
    kind: 'moveCall',  // LI.FI returns a cross-chain tx
    data: quote.liFiTx,
  });

  // 3. Wait for SUI to arrive (poll balance or use bridge status)
  await waitForBridgeCompletion(swapResult.digest);

  // 4. Build Qually create_bounty tx with received SUI
  const tx = await buildCreateBountyTx(bountyParams);

  // 5. Sign and execute
  const result = await signAndExecuteTransaction({
    kind: 'moveCall',
    data: tx,
  });

  return result;
}
```

### 9.5.4 Bridge Status Polling

```typescript
import { getBridgeStatus } from '@lifi/sdk';

async function waitForBridgeCompletion(swapTxHash: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getBridgeStatus({
      txHash: swapTxHash,
      integrator: 'qually',
    });

    if (status.status === 'DONE') return true;
    if (status.status === 'FAILED') throw new Error('Bridge failed');

    await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
  }
  throw new Error('Bridge timeout');
}
```

### 9.5.5 Supported Tokens (Popular)

| Token | Chain | Contract |
|-------|-------|----------|
| USDC | Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDC | Polygon | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| ETH | Ethereum | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| SOL | Solana | `So11111111111111111111111111111111111111112` |
| SUI | Sui | `0x2::sui::SUI` (native) |

---

## 10. Security Considerations

### 10.1 Input Validation

- `poster_weight` must be 30-70 (enforced on-chain)
- `payout_splits` must sum to 100 for team submissions (enforced on-chain)
- `contest_splits` must sum to 100 for Contest bounties (enforced on-chain)
- `submission_deadline` must be in the future (enforced on-chain)
- `judging_deadline` must be after `submission_deadline` (enforced on-chain)

### 10.2 Authorization

- Only poster can: `start_review`, `finalize_bounty`, `close_bounty`, `refund_empty_bounty`, `finalize_fixed`, `finalize_contest`, `release_milestone`, `approve_judge_for_bounty`, `veto_result`, `approve_milestone`, `reject_milestone`, `auto_extend`, `set_gated`, `add_allowed_submitter`, `remove_allowed_submitter`
- Only judge who committed can: `reveal_vote`
- Only judge owner can: `apply_as_judge`, `release_stake`
- Only arbiter can: `resolve_dispute`, `reject_dispute`
- Only hunter can: `submit_evidence`
- Only admin can: `withdraw` from treasury
- Anyone can: `escalate_overdue` (after deadline), `refund_expired_bounty` (after deadline, no submissions), `boost_prize_pool` (before judging), `update_judge_reputation`, `slash_judge_for_missed_reveal`

### 10.3 Commit-Reveal Security

- Judges must generate cryptographically secure nonces (use `crypto.getRandomValues()`)
- Never store nonces in localStorage — use secure storage or server-side
- Verify hashes off-chain before submitting reveal transaction

### 10.4 Walrus Integrity

- Content hash (`sha3_256(blobId)`) is stored on-chain for integrity verification
- Always verify hash matches after reading from Walrus

---

*Qually — Frontend Integration Guide v3.0 | June 2026*
*Package: 0xc6a5bdf14674e542a3abdcf2895325e66d4eeaf3caa85563864ee72d76ae7c46*
