# Qually — Trustless Bounty Infrastructure on Sui

> Store. Judge. Ship. A decentralized bounty platform where every piece of data — briefs, submissions, judge credentials, profiles — lives on **Walrus**, with all chain interactions powered by **Tatum RPCs**.

## What is Qually?

Qually is a trustless bounty infrastructure on Sui where:

- **Posters** create bounties with SUI escrowed in a Move smart contract
- **Hunters** submit work stored on Walrus decentralized storage
- **Judges** apply with on-chain stake, vote via commit-reveal, and earn reputation
- **Payouts** are automatic and trustless — no middleman, no dispute resolution needed

Every piece of data is stored on **Walrus** — making briefs, submissions, profiles, and dispute evidence verifiable, censorship-resistant, and permanently accessible.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  TanStack Router · TanStack Query · dapp-kit · shadcn   │
├─────────────────────────────────────────────────────────┤
│                   Tatum Sui RPC                         │
│          https://sui-testnet.gateway.tatum.io            │
├─────────────────────────────────────────────────────────┤
│                  Walrus Storage                          │
│  Publisher → /v1/blobs  |  Aggregator → /v1/blobs/:id  │
│  Briefs · Submissions · Profiles · Judge Credentials    │
├─────────────────────────────────────────────────────────┤
│              Sui Move Smart Contracts                    │
│  bounty · submission · judge · voting · payout · dispute │
│              Package: 0xc6a5bdf...                       │
└─────────────────────────────────────────────────────────┘
```

## Walrus Integration (Core Feature)

Walrus is not an add-on — it's the **data layer** of the entire platform. Every piece of user-generated content is stored on Walrus:

| What | Stored on Walrus | On-Chain Reference |
|------|-----------------|-------------------|
| **Bounty Briefs** | Title, description, category, requirements | `brief_blob_id` in Bounty object |
| **Submissions** | Work title, description, file references | `blob_id` in Submission object |
| **User Profiles** | Nickname, bio, skills, social links | localStorage cache + Walrus blob |
| **Judge Profiles** | Credentials, motivation, experience | `blob_id` in JudgeProfile object |
| **Judge Applications** | Application details per bounty | `application_blob_id` |
| **Dispute Evidence** | Reason, supporting evidence | `evidence_blob_id` |
| **Milestone Deliveries** | Delivery description, links | `blob_id` in Milestone object |

### How Walrus is Used

```
1. Upload:   JSON → WALRUS_PUBLISHER/v1/blobs?epochs=5 → { blobId, blobHash }
2. On-Chain: blobId (32 bytes) stored in Move struct fields
3. Read:     WALRUS_AGGREGATOR/v1/blobs/{blobId} → raw data → parse JSON
```

**Upload flow:**
```typescript
import { uploadJson } from '@/lib/walrus';

const result = await uploadJson({
  title: "Fix login bug",
  description: "The auth token expires too quickly...",
  category: "Development",
});
// result.blobId → stored on-chain in Bounty.brief_blob_id
// result.blobHash → content hash for integrity verification
```

**Read flow:**
```typescript
import { readJsonFromWalrus } from '@/lib/walrus';

const brief = await readJsonFromWalrus(bounty.brief_blob_id);
// { title: "Fix login bug", description: "...", category: "Development" }
```

### Walrus Storage Map

```
Qually Data Layer (all on Walrus)
├── Bounty Briefs (JSON)
│   └── { title, description, category, requirements, createdAt }
├── Submission Work (JSON)
│   └── { title, description, collaborators, submittedAt }
├── User Profiles (JSON)
│   └── { address, nickname, bio, type, skills, website, x, github }
├── Judge Profiles (JSON)
│   └── { address, x, github, linkedin, portfolio, motivation, experience }
├── Judge Applications (JSON)
│   └── { judgeAddress, bountyId, stakeAmount, appliedAt }
├── Dispute Evidence (Text)
│   └── reason + evidence documents
└── Milestone Deliveries (Text)
    └── delivery description + links
```

## Tatum Integration

All Sui RPC calls go through **Tatum's enterprise-grade infrastructure**:

```typescript
// src/lib/config.ts
export const SUI_RPC_URL = "https://sui-testnet.gateway.tatum.io";

// src/hooks/useOnChainBounties.ts
async function suiRequest(method: string, params: any[]) {
  const resp = await fetch(SUI_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 't-6a199d1236e87595baf39056-...',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await resp.json()).result;
}
```

**Tatum RPC methods used:**
- `sui_getObject` — Fetch bounty, submission, profile objects
- `sui_queryObjects` — Discover bounties by struct type
- `sui_queryEvents` — Event-based bounty discovery
- `sui_executeTransactionBlock` — Execute signed transactions

## Smart Contracts (9 Move Modules)

| Module | Purpose |
|--------|---------|
| `bounty` | Bounty lifecycle: create, boost, veto, start_review, finalize |
| `submission` | Work submission with Walrus blob references |
| `judge` | Judge profiles, applications, approval, stake tiers |
| `voting` | Commit-reveal voting: hash → commit → reveal → tally |
| `payout` | Prize distribution, reputation updates, slashing |
| `treasury` | Admin-only treasury management |
| `dispute` | Dispute filing with evidence, resolution |
| `milestone` | Grant milestone lifecycle |
| `profile` | Poster and hunter profiles |

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Sui wallet (Slush, Sui Wallet, or Ethos)

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Contracts
```bash
cd contracts/qually
sui move build
sui move test  # 38/38 passing
```

## Demo Flow

1. **Connect Wallet** → Click "Connect Wallet" in header
2. **Create Bounty** → Fill form, set prize (0.1+ SUI), brief uploads to Walrus
3. **Submit Work** → Upload description to Walrus, submit on-chain
4. **Apply as Judge** → Mint judge profile (stored on Walrus), apply with stake
5. **Approve Judge** → Poster approves judge application
6. **Commit Vote** → Judge hashes vote (SHA3-256), commits on-chain
7. **Reveal Vote** → After judging deadline, judge reveals score
8. **Finalize** → Winner receives prize from escrow

## Tech Stack

- **Frontend:** React 19, TanStack Router, TanStack Start (SSR), shadcn/ui, Tailwind CSS 4
- **Wallet:** @mysten/dapp-kit, @mysten/sui
- **Storage:** Walrus decentralized storage (publishers + aggregators)
- **RPC:** Tatum Sui RPC nodes (testnet/mainnet)
- **Contracts:** Sui Move, 9 modules, 38 tests
- **Build:** Vite 7, TypeScript, Nitro (Vercel SSR)

## Project Structure

```
Qually/
├── contracts/
│   └── qually/
│       └── sources/         # 9 Move modules
│           ├── bounty.move
│           ├── submission.move
│           ├── judge.move
│           ├── voting.move
│           ├── payout.move
│           ├── treasury.move
│           ├── dispute.move
│           ├── milestone.move
│           └── profile.move
├── frontend/
│   └── src/
│       ├── routes/           # 10 pages
│       │   ├── index.tsx          # Landing
│       │   ├── explore.tsx        # Bounty marketplace
│       │   ├── create.tsx         # Create bounty
│       │   ├── bounty.$id.tsx     # Bounty detail + timeline
│       │   ├── bounty.$id.submit.tsx  # Submit work
│       │   ├── submission.$bountyId.tsx  # View submission
│       │   ├── leaderboard.tsx    # Rankings
│       │   ├── judges.tsx         # Apply as judge
│       │   ├── judging.tsx        # Judging queue
│       │   ├── dashboard.tsx      # User dashboard
│       │   └── profile.$address.tsx  # Public profiles
│       ├── components/
│       │   ├── bounty/        # PosterActions, JudgeActions, etc.
│       │   └── ui/            # shadcn components
│       ├── hooks/
│       │   ├── useContract.ts     # All contract interactions
│       │   ├── useWallet.ts       # Wallet state
│       │   └── useOnChainBounties.ts  # Bounty data fetching
│       └── lib/
│           ├── config.ts          # Tatum RPC + Walrus URLs (single source)
│           ├── walrus.ts          # Upload/read from Walrus
│           ├── transactions.ts    # Move call builders
│           ├── submissions.ts     # Submission storage (Walrus-first)
│           ├── user-profiles.ts   # User profiles (Walrus-first)
│           ├── judge-profiles.ts  # Judge profiles (Walrus-first)
│           └── judge-applications.ts  # Applications (Walrus-first)
└── services/
    ├── e2e-contracts.js       # E2E test (all phases)
    └── e2e-judge.js           # Judge flow E2E
```

## License

MIT
