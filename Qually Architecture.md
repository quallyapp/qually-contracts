# QUALLY
## Trustless Bounty Infrastructure on Sui

**Development & System Architecture — Version 1.0 | June 2026**

> 🎯 Targeting: **Tatum x Walrus Hackathon** | **CLAY Hackathon** by Lofi the Yeti
>
> Sui • Move • Walrus • Tatum • LI.FI • Vite + React

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Smart Contract Architecture](#2-smart-contract-architecture-move-on-sui)
3. [Walrus Integration](#3-walrus-integration)
4. [Tatum Integration](#4-tatum-integration)
5. [LI.FI Multi-Token Payment Integration](#5-lifi-multi-token-payment-integration)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Development Phases](#7-development-phases)
8. [Security Considerations](#8-security-considerations)
9. [Deployment Checklist](#9-deployment-checklist)

---

## 1. Architecture Overview

Qually is built on a strict separation of concerns across three layers:

| Layer | Responsibility |
|---|---|
| Sui Smart Contract (Move) | All trust-critical logic: escrow, voting, payout, dispute, reputation. Source of truth for ownership and state. |
| Walrus Decentralized Storage | All content: bounty briefs, submission files, profiles, judge histories. Source of truth for data. |
| Frontend (Vite + React) | User interface, wallet connection, Walrus uploads, Tatum RPC reads, LI.FI payment widget, Tatum webhook consumption. |

> **Core Architectural Principle**
> - The Move contract never stores large data. It stores only IDs, hashes, and state flags.
> - Walrus stores all content. The blob ID on-chain is the cryptographic bridge between the two.
> - Tatum handles all chain reads and event notifications — no custom indexer or polling needed.
> - LI.FI operates entirely pre-contract — the escrow always receives clean SUI.

---

## 2. Smart Contract Architecture (Move on Sui)

### 2.1 Module Structure

| Module | Responsibility |
|---|---|
| `qually::bounty` | Core Bounty object, creation, state machine, escrow management |
| `qually::submission` | Submission object, NFT minting, privacy sealing, team splits |
| `qually::judge` | JudgeProfile NFT, tier system, application and approval flow |
| `qually::voting` | Commit-reveal two-phase voting, score tallying, weighted calculation |
| `qually::payout` | Prize distribution logic: Fixed, Contest split, Grant milestones |
| `qually::dispute` | Two-sided dispute escalation, arbiter panel selection, stake slashing |
| `qually::profile` | PosterProfile, Hunter stats, reputation scoring |
| `qually::treasury` | Platform fee collection (3%), Treasury object management |

---

### 2.2 Core Objects

#### Bounty Object

```move
struct Bounty has key, store {
  id: UID,
  poster: address,
  bounty_type: BountyType,          // Fixed | Contest | Grant
  state: BountyState,               // Open | Review | Finalized | Closed
  prize_pool: Balance<SUI>,         // Locked escrow — contract-controlled
  brief_blob_id: vector<u8>,        // Walrus blob ID for full brief
  brief_content_hash: vector<u8>,   // sha3_256 hash for integrity check
  submission_deadline: u64,
  judging_deadline: u64,
  poster_weight: u8,                // 30–70 (percent)
  max_judges: u8,                   // 1–7
  submissions_visible: bool,        // false until Review phase
  contest_splits: vector<u8>,       // e.g. [50, 30, 20] for Contest type
  is_recurring: bool,
  auto_extend: bool,
  category_tags: vector<String>,
}
```

#### Submission Object (NFT)

```move
struct Submission has key, store {
  id: UID,
  bounty_id: ID,
  lead_hunter: address,
  collaborators: vector<address>,   // for team submissions
  payout_splits: vector<u8>,        // must sum to 100
  blob_id: vector<u8>,              // Walrus blob ID
  content_hash: vector<u8>,         // sha3_256 for integrity
  submitted_at: u64,
  is_sealed: bool,                  // true until review phase
}
```

#### JudgeProfile Object (Non-transferable NFT)

```move
struct JudgeProfile has key {
  id: UID,
  owner: address,
  tier: u8,                          // 0=New, 1=Active, 2=Trusted, 3=Elite
  reputation_score: u64,
  sessions_completed: u64,
  sessions_missed: u64,
  history_blob_id: vector<u8>,       // Walrus — detailed session history
}
```

#### VoteCommit Object

```move
struct VoteCommit has key, store {
  id: UID,
  judge: address,
  bounty_id: ID,
  commit_hash: vector<u8>,           // sha3_256(submission_id | score | nonce)
  revealed: bool,
  revealed_score: u64,
  revealed_submission_id: ID,
}
```

#### Milestone Object (Grant type)

```move
struct Milestone has store {
  title: String,
  description_blob_id: vector<u8>,  // Walrus
  payout_amount: u64,               // SUI amount
  state: MilestoneState,            // Pending | Submitted | Approved | Overdue
  submission_blob_id: Option<vector<u8>>,
  submitted_at: Option<u64>,
  overdue_at: Option<u64>,          // submitted_at + 7 days
}
```

---

### 2.3 State Machine

| State | Transitions |
|---|---|
| `OPEN` | → `REVIEW` (submission deadline passed, `start_review` called) \| → `CLOSED` (no submissions, refund called) |
| `REVIEW` | → `FINALIZED` (all judges revealed or judging deadline passed, `finalize` called) |
| `FINALIZED` | → `CLOSED` (payout released, veto window passed or dispute resolved) |
| `CLOSED` | Terminal state. No further transitions. |

---

### 2.4 Key Entry Functions

| Function | Module | Description |
|---|---|---|
| `create_bounty` | bounty | Creates Bounty object, locks SUI escrow, stores Walrus blob ID |
| `submit_work` | submission | Mints Submission NFT with Walrus blob ID, seals until review |
| `start_review` | bounty | Unseals submissions, transitions state to REVIEW |
| `apply_as_judge` | judge | Registers judge application on a bounty |
| `approve_judge` | judge | Poster approves judge, locks judge stake |
| `commit_vote` | voting | Stores sha3_256 commit hash on-chain |
| `reveal_vote` | voting | Verifies hash, records score, updates tally |
| `finalize` | payout | Calculates winner(s), triggers payout, updates reputations |
| `submit_milestone` | payout | Hunter submits milestone delivery with Walrus blob ID |
| `approve_milestone` | payout | Poster approves, releases milestone SUI |
| `escalate_overdue_milestone` | dispute | Hunter escalates after 7-day poster silence |
| `dispute_result` | dispute | Hunter disputes result, locks stakes, calls arbiter panel |
| `veto_result` | dispute | Poster overrides community verdict within 48h, locks stake |
| `refund_empty_bounty` | bounty | Returns full prize if no submissions. Fee waived. |
| `boost_prize_pool` | bounty | Anyone adds SUI to prize pool before judging |

---

### 2.5 Voting & Scoring Algorithm

The final score for each submission is calculated as:

```
final_score(S) = (poster_score(S) × poster_weight) + (avg_judge_score(S) × (1 - poster_weight))

Where:
  poster_weight    = configured at bounty creation (0.30 – 0.70)
  avg_judge_score  = mean of all revealed judge scores for submission S
  All scores are integers 1–100

Tie-breaking: earlier submission timestamp wins.
Contest type: top N submissions by final_score receive ranked prize splits.
```

---

### 2.6 Judge Reputation Scoring

| Event | Reputation Effect |
|---|---|
| Session completed on time | +10 base points |
| Alignment bonus (score within 15% of final consensus) | +5 additional points |
| Winning streak (3+ consecutive completions) | +15% multiplier applied |
| Missed reveal deadline | -15 points, stake slashed |
| Found dishonest in dispute arbitration | -30 points, larger stake slash |
| Tier upgrade (0→1) | 200 points threshold |
| Tier upgrade (1→2) | 500 points threshold |
| Tier upgrade (2→3 Elite) | 1000 points + 10 completed sessions minimum |

---

## 3. Walrus Integration

### 3.1 Write Flow

All Walrus writes happen client-side before any Sui transaction is signed. The blob ID is passed as a parameter to the contract function.

> **Step-by-step write flow**
> 1. User action triggers upload (create bounty, submit work, update profile)
> 2. Frontend serializes content to `Uint8Array` (`JSON.stringify` → `TextEncoder`)
> 3. `WalrusClient.writeBlob()` called with blob, epochs, deletable flag, and signer keypair
> 4. Walrus SDK splits blob into slivers via RedStuff erasure coding
> 5. Slivers distributed across ~100 Walrus storage nodes
> 6. Proof-of-Availability (PoA) certificate written to Sui automatically by protocol
> 7. `blobId` returned to client
> 8. `sha3_256(blobId)` computed on client for on-chain integrity hash
> 9. Sui transaction signed with `blobId` + `contentHash` as parameters
> 10. Contract stores both. Move object now permanently linked to Walrus content.

---

### 3.2 Read Flow

All Walrus reads happen client-side after fetching the blob ID from the Sui object via Tatum RPC.

> **Step-by-step read flow**
> 1. Page load triggers Tatum RPC read of the Sui object (Bounty, Submission, Profile)
> 2. `brief_blob_id` (or `submission blob_id`) extracted from object fields
> 3. `WalrusClient.readBlob({ blobId })` called
> 4. SDK fetches slivers from Walrus storage nodes and reassembles
> 5. `TextDecoder().decode()` converts bytes back to string
> 6. `JSON.parse()` reconstructs the original data structure
> 7. Optional: `sha3_256(blobId)` recomputed, compared to on-chain hash for integrity check
> 8. Content rendered in UI

---

### 3.3 Blob ID Storage Per Object Type

| Object Type | Fields on Sui | Blob Contents on Walrus |
|---|---|---|
| Bounty | `brief_blob_id`, `brief_content_hash` | Title, full description, acceptance criteria, attachments array, skill tags, category |
| Submission | `blob_id`, `content_hash` | Work files, links, notes, team info, submission description |
| PosterProfile | `profile_blob_id`, `profile_hash` | Bio, portfolio links, contact, past project descriptions |
| Hunter Profile | `profile_blob_id`, `profile_hash` | Bio, portfolio, skill evidence, past submission links |
| JudgeProfile | `history_blob_id` | Per-session: bounty ID, submission scored, commit/reveal timestamps, score, alignment result |
| Milestone | `description_blob_id`, `submission_blob_id` | Milestone spec (description blob), milestone deliverable (submission blob) |

---

### 3.4 Epoch & Storage Duration Strategy

| Content Type | Recommended Epochs |
|---|---|
| Bounty brief (active bounty) | 52 epochs (~1 year minimum) |
| Submission files (permanent proof of work) | 260 epochs (~5 years) — hunters own their history |
| Profile data | 52 epochs, renewable on profile update |
| Judge session history | 260 epochs — reputation data should be long-lived |
| Milestone deliverables | 104 epochs (~2 years) |

---

### 3.5 TypeScript SDK Implementation

```typescript
import { WalrusClient } from '@mysten/walrus';
import { sha3_256 } from '@mysten/bcs';

const walrusClient = new WalrusClient({ network: 'mainnet' });

// WRITE — store bounty brief
async function storeBrief(brief: BountyBrief): Promise<{ blobId: string; hash: string }> {
  const bytes = new TextEncoder().encode(JSON.stringify(brief));
  const { blobId } = await walrusClient.writeBlob({
    blob: bytes,
    deletable: false,
    epochs: 52,
    signer: keypair,
  });
  const hash = sha3_256(new TextEncoder().encode(blobId));
  return { blobId, hash };
}

// READ — fetch bounty brief
async function fetchBrief(blobId: string): Promise<BountyBrief> {
  const data = await walrusClient.readBlob({ blobId });
  return JSON.parse(new TextDecoder().decode(data));
}
```

---

## 4. Tatum Integration

### 4.1 RPC Gateway Setup

All `@mysten/sui` client calls are routed through Tatum's Sui RPC Gateway instead of the default public endpoint.

```typescript
import { SuiClient } from '@mysten/sui/client';

const suiClient = new SuiClient({
  url: 'https://sui-mainnet.gateway.tatum.io',
  // Tatum API key injected via environment variable
  // Set as request header: x-api-key: process.env.TATUM_API_KEY
});
```

> **Why Tatum RPC over public endpoints**
> - 99.99% uptime SLA — public Sui RPC has no guaranteed uptime
> - Global load balancing — lowest latency node selected per request
> - Smart caching — repeated reads of same objects served from cache
> - Automatic failover — if one node fails, request retried on another
> - <50ms average response time vs variable public endpoint performance
> - BYO-RPC option — can add custom nodes alongside Tatum routing

---

### 4.2 Notifications / Webhooks

Tatum Notifications replace all polling logic. Instead of querying chain state every N seconds, Qually's backend registers webhooks that fire when specific on-chain events occur.

| Webhook Event | Qually Action |
|---|---|
| Submission minted to hunter wallet | Send in-app + email notification to hunter: 'Your submission was received' |
| `finalize()` transaction executed | Notify winner: 'You won — payout incoming' |
| Payout SUI sent to hunter address | Notify hunter: 'X SUI received' |
| Judge approval transaction | Notify judge: 'You have been approved to judge [bounty]' |
| Bounty deadline approaching (24h) | Notify poster and judges |
| Dispute raised on bounty | Notify all parties |

```typescript
// Backend: register a Tatum webhook
const response = await fetch('https://api.tatum.io/v3/subscription', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.TATUM_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'INCOMING_NATIVE_TX',
    attr: {
      address: hunterWalletAddress,
      chain: 'SUI',
      url: 'https://api.qually.xyz/webhooks/tatum',
    }
  })
});
```

---

### 4.3 Data API Usage

| Data API Endpoint | Qually Use Case |
|---|---|
| `GET /wallet/{chain}/{address}/balance` | PosterProfile: total SUI held. Leaderboard: top hunter balances. |
| `GET /wallet/{chain}/{address}/transactions` | Earnings history for hunters. Payout audit trail. PosterProfile payout rate. |
| `GET /exchange-rate/{currency}` | Show USD equivalent of SUI prize amounts in the UI. |

---

### 4.4 gRPC for Activity Feed

The live activity feed on the Explore page uses Tatum's Sui gRPC endpoint for streaming chain events.

```typescript
// Subscribe to Qually contract events via Tatum gRPC
const stream = suiClient.subscribeEvent({
  filter: { Package: QUALLY_PACKAGE_ID },
  onMessage: (event) => {
    activityFeed.prepend({
      type: event.type,
      data: event.parsedJson,
      timestamp: event.timestampMs,
    });
  }
});
```

---

## 5. LI.FI Multi-Token Payment Integration

### 5.1 Architecture

LI.FI operates entirely in the frontend, before any Move contract interaction. The contract always receives and holds clean SUI. It is never aware of the source token or chain.

> **Payment Flow**
> 1. Poster enters prize amount and selects source token (USDC, USDT, ETH, SOL, etc.)
> 2. LI.FI SDK queries available routes and returns best swap path
> 3. Poster reviews the SUI-equivalent amount they will lock in escrow
> 4. Poster approves the LI.FI swap transaction in their wallet
> 5. LI.FI routes cross-chain, delivers SUI to poster's Sui wallet
> 6. Frontend detects SUI arrival (via Tatum Notification or polling)
> 7. Poster signs the `create_bounty()` Move transaction — SUI is locked in escrow
> 8. Contract state: `OPEN`. Prize pool = SUI balance. Fully trustless from this point.

---

### 5.2 SDK Implementation

```typescript
import { createConfig, getRoutes, executeRoute } from '@lifi/sdk';

createConfig({ integrator: 'qually' });

async function getPaymentRoute(
  fromToken: string,
  fromChain: number,
  suiAmount: bigint
) {
  const routes = await getRoutes({
    fromChainId: fromChain,
    toChainId: SUI_CHAIN_ID,
    fromTokenAddress: fromToken,
    toTokenAddress: SUI_TOKEN_ADDRESS,
    toAmount: suiAmount.toString(),
  });
  return routes.routes[0]; // best route
}

async function executePayment(route: Route, signer: Signer) {
  await executeRoute(route, {
    updateRouteHook: (updatedRoute) => setRoute(updatedRoute),
  });
  // After this, SUI is in poster's wallet
  // Frontend calls create_bounty() Move tx next
}
```

---

### 5.3 Supported Source Tokens (V1)

| Token | Chain |
|---|---|
| USDC | Ethereum, Arbitrum, Base, Solana |
| USDT | Ethereum, Arbitrum, BNB Chain |
| ETH | Ethereum, Arbitrum, Optimism |
| SOL | Solana |
| BNB | BNB Chain |
| MATIC / POL | Polygon |

---

## 6. Frontend Architecture

### 6.1 Project Structure

```
qually/
├── src/
│   ├── components/
│   │   ├── bounty/          # BountyCard, BountyDetail, CreateBountyForm
│   │   ├── submission/      # SubmissionUploader, SubmissionCard, TeamForm
│   │   ├── judge/           # JudgePanel, VoteCommitForm, VoteRevealForm
│   │   ├── profile/         # PosterProfile, HunterProfile, JudgeProfile
│   │   ├── lifi/            # PaymentWidget, RoutePreview
│   │   ├── walrus/          # BlobUploader, BlobViewer
│   │   └── ui/              # Shared design system components
│   ├── hooks/
│   │   ├── useBounty.ts     # Tatum RPC reads for bounty objects
│   │   ├── useSubmission.ts # Submission fetch + Walrus blob read
│   │   ├── useWalrus.ts     # Upload/download wrappers
│   │   ├── useTatum.ts      # Tatum Data API and notification hooks
│   │   └── useVoting.ts     # Commit/reveal vote flows
│   ├── lib/
│   │   ├── sui.ts           # SuiClient via Tatum RPC
│   │   ├── walrus.ts        # WalrusClient instance
│   │   ├── tatum.ts         # Tatum API wrapper
│   │   └── lifi.ts          # LI.FI SDK config
│   ├── pages/
│   │   ├── Explore.tsx      # Bounty listing + activity feed
│   │   ├── BountyDetail.tsx # Full bounty view
│   │   ├── CreateBounty.tsx # Bounty creation flow
│   │   ├── Submit.tsx       # Submission upload flow
│   │   ├── JudgePanel.tsx   # Voting interface
│   │   └── Profile.tsx      # User profile page
│   ├── store/               # Zustand global state
│   ├── types/               # TypeScript interfaces
│   └── constants/           # Contract addresses, chain IDs, config
├── contracts/               # Move source files
│   └── sources/
│       ├── bounty.move
│       ├── submission.move
│       ├── judge.move
│       ├── voting.move
│       ├── payout.move
│       ├── dispute.move
│       ├── profile.move
│       └── treasury.move
├── .env                     # TATUM_API_KEY, WALRUS_NETWORK, PACKAGE_ID
└── Move.toml
```

---

### 6.2 Key Pages & Data Flow

| Page | Data Sources |
|---|---|
| Explore | Tatum RPC: list bounty objects. Tatum gRPC: live activity feed. Walrus: brief previews for cards. |
| BountyDetail | Tatum RPC: full Bounty object + state. Walrus: full brief via blob ID. Tatum Data API: poster reputation. |
| CreateBounty | LI.FI: payment route + execution. Walrus: brief upload. Sui tx: `create_bounty()`. |
| Submit | Walrus: submission file upload. Sui tx: `submit_work()` with blob ID. |
| JudgePanel | Tatum RPC: sealed submissions (during review). Walrus: submission content for approved judges. Sui tx: `commit_vote()`, `reveal_vote()`. |
| Profile | Tatum RPC: on-chain profile object. Walrus: extended profile data. Tatum Data API: earnings history. |

---

### 6.3 Environment Configuration

```bash
# .env
VITE_TATUM_API_KEY=your_tatum_api_key_here
VITE_SUI_RPC_URL=https://sui-mainnet.gateway.tatum.io
VITE_WALRUS_NETWORK=mainnet
VITE_QUALLY_PACKAGE_ID=0x...
VITE_TREASURY_ADDRESS=0x...
VITE_LIFI_INTEGRATOR=qually
```

---

## 7. Development Phases

### Phase 1 — Contract Foundation
*Owner: Full-stack dev (Smart Contract)*

- Scaffold Move project with `Move.toml` and module structure
- Implement `qually::bounty` — Bounty object, `create_bounty()`, state machine
- Implement `qually::submission` — Submission NFT, `submit_work()`, sealing logic
- Implement `qually::judge` — JudgeProfile NFT, application, approval, stake lock
- Implement `qually::treasury` — Treasury object, 3% fee collection
- Write unit tests for all Phase 1 modules
- Deploy to Sui Devnet. Capture Package ID.

> **Phase 1 Deliverable**
> Working Move contracts on Devnet: create bounty, submit work, mint NFTs, lock escrow.
> All Walrus blob IDs accepted as parameters and stored correctly in objects.

---

### Phase 2 — Voting, Payout & LI.FI
*Owner: Full-stack dev (Smart Contract)*

- Implement `qually::voting` — `commit_vote()`, `reveal_vote()`, weighted tally
- Implement `qually::payout` — `finalize()`, Fixed payout, Contest split, Grant milestone release
- Implement `qually::dispute` — `veto_result()`, `dispute_result()`, arbiter flow, stake slash
- Integrate LI.FI SDK in frontend — PaymentWidget component, route preview, execution
- Test full bounty lifecycle on Devnet: create (with LI.FI) → submit → vote → finalize → payout
- Deploy updated contracts to Devnet.

> **Phase 2 Deliverable**
> Full end-to-end lifecycle working on Devnet including LI.FI payment and automatic payout.
> All three bounty types (Fixed, Contest, Grant) functional.

---

### Phase 3 — Frontend Core
*Owner: Frontend Developer*

- Set up Vite + React + TypeScript + Tailwind project structure
- Configure `@mysten/dapp-kit` for wallet connection
- Configure Tatum RPC — SuiClient pointed to Tatum gateway
- Implement Explore page with bounty listing and filter system
- Implement CreateBounty page — form, Walrus upload, LI.FI widget integration
- Implement BountyDetail page — Tatum RPC reads, Walrus brief fetch
- Implement Submit page — Walrus file uploader, team submission form
- Implement JudgePanel page — commit and reveal voting flows
- Implement Profile page — Tatum Data API earnings history

> **Phase 3 Deliverable**
> Fully functional UI connected to Devnet contracts.
> All P0 user flows working: create, submit, judge, payout.

---

### Phase 4 — Tatum Notifications + Mainnet
*Owner: Full-stack dev*

- Set up lightweight backend (Node.js / Express) to receive Tatum webhooks
- Register Tatum notification subscriptions for key bounty events
- Implement in-app notification system consuming webhook payloads
- Integrate Tatum gRPC streaming for live activity feed on Explore page
- Integrate Tatum Data API for leaderboard and earnings history
- Full QA pass on Testnet — all flows, edge cases, error states
- Deploy contracts to Sui Mainnet. Update Package ID in frontend config.
- Deploy frontend to production hosting.

> **Phase 4 Deliverable — Hackathon Demo Ready** ✅
> - ✅ Live on Sui Mainnet
> - ✅ Walrus blobs stored with verified PoA certificates
> - ✅ Tatum RPC powering all chain reads
> - ✅ Tatum Notification webhook firing live in demo
> - ✅ LI.FI multi-token payment demonstrated
> - ✅ At least 1 complete bounty lifecycle on Mainnet

---

### Phase 5 — P1 Features (Post-Hackathon)

- Prize pool boosting — anyone can top up a live bounty
- Recurring bounties — auto-recreate on close
- Auto-extend on low submissions
- Hunter tipping — discretionary post-bounty tip
- Tatum gRPC full streaming integration
- JudgeProfile history on Walrus
- Skill tags on profiles with poster browse-by-skill
- On-chain category tags for composability

---

## 8. Security Considerations

| Risk | Mitigation |
|---|---|
| Escrow drain / rug by admin | No admin withdraw function exists. Prize pool only releasable by contract logic (payout, refund, dispute verdict). |
| Walrus blob tampering | `sha3_256` content hash stored on-chain alongside blob ID. Any modification detectable on read. |
| Commit-reveal gaming (judge copies another's vote) | Commit phase hides scores until all judges have committed. Reveal only opens after all commits submitted. |
| Poster veto abuse | Veto requires stake deposit. Repeated veto abuse slashes stake and decreases PosterProfile rating visibly to future hunters. |
| Fake judge stake | Judge stake locked in contract, not just checked. Cannot be withdrawn until session is honestly completed. |
| Sybil attack on judging | Tier system limits high-trust bounties to Tier 2/3 judges. Reaching Tier 2 requires 500 rep points across many sessions. |
| LI.FI bridge exploit | Qually uses LI.FI as read-only widget. If swap fails, no Sui funds are sent, and `create_bounty` is never called. Contract is never at risk. |
| Walrus availability | RedStuff erasure coding ensures data survives up to 1/3 of nodes being offline or Byzantine. PoA certificate verifies the blob is safely distributed. |

---

## 9. Deployment Checklist

### 9.1 Pre-Mainnet

- [ ] All Move modules compiled with `sui move build` — zero warnings
- [ ] Unit tests pass: `sui move test`
- [ ] Full lifecycle tested on Testnet with real Tatum API key (testnet)
- [ ] Walrus blobs written and read on Walrus Mainnet (not testnet)
- [ ] LI.FI swap tested end-to-end: USDC → SUI → `create_bounty`
- [ ] Tatum webhook endpoint live and receiving test events
- [ ] Package ID captured post-deployment
- [ ] Frontend environment variables updated with Mainnet Package ID

---

### 9.2 Hackathon Submission Requirements

| Requirement | Status |
|---|---|
| Public GitHub repository with full source | Required |
| Demo video (3–5 min, YouTube preferred) | Required |
| Project logo (1:1, JPG or PNG) | Required |
| Sui Mainnet Package ID | Required |
| Tatum API key used (free tier from dashboard.tatum.io) | Required for Tatum x Walrus |
| Walrus integration is core, not bolt-on | Required for Tatum x Walrus |
| Project deployed on Sui Mainnet or Testnet | Required |
| GitBook / README documentation | Strongly recommended |

---

*Qually — Development & System Architecture v1.0 | June 2026*
