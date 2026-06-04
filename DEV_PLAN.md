# QUALLY — Development Plan

> **Phase 0: Current** | **Status: Initializing**

---

## Roadmap Overview

| Phase | Title | Focus | Status |
|---|---|---|---|
| Phase 1 | **Contract Foundation** | Core Move objects (Bounty, Submission, Profile) | ✅ COMPLETED |
| Phase 2 | **Voting & Payout** | Commit-reveal logic, fee management, multi-winner payouts | ✅ COMPLETED |
| Phase 3 | **Integration Support & Backend** | Walrus/Tatum/LI.FI integration docs, webhook listeners | ✅ COMPLETED |
| Phase 4 | **Deployment & Audit** | Mainnet deployment, final system verification | 🏗️ In Progress |
| Phase 5 | **Post-Hackathon** | Recurring bounties, tipping, reputation scaling | ⏳ Not Started |

---

## Phase 1: Contract Foundation (COMPLETED)

**Goal:** Implement the core data structures and basic lifecycle on Sui Devnet.

### 1.1 Project Scaffolding (COMPLETED)
- [x] Initialize Sui Move project (`qually` package).
- [x] Set up `Move.toml` with dependencies.
- [x] Create module structure.

### 1.2 Core Module Implementation (COMPLETED)
- [x] **`qually::profile`**: Implement `PosterProfile` and `HunterProfile` objects.
- [x] **`qually::judge`**: Implement `JudgeProfile` NFT and Tier system logic.
- [x] **`qually::bounty`**: Implement `Bounty` object, `create_bounty()` with escrow lock.
- [x] **`qually::submission`**: Implement `Submission` NFT and `submit_work()` with privacy sealing.
- [x] **`qually::treasury`**: Implement 3% fee collection logic.

### 1.3 Testing & Validation (COMPLETED)
- [x] Write unit tests for object creation and basic state transitions.
- [x] Compile and verify modules (`sui move build`).
- [x] Run unit tests (`sui move test`).

---

## Phase 2: Voting, Payout & Logic (COMPLETED)

**Goal:** Implement complex logic for judging, disputes, and on-chain tallying.

### 2.1 Judging Logic (COMPLETED)
- [x] **`qually::voting`**: Implement commit-reveal two-phase voting.
- [x] **`qually::voting`**: Implement weighted tallying (Poster vs. Community).

### 2.2 Payout & Dispute (COMPLETED)
- [x] **`qually::payout`**: Implement `finalize()` logic for Fixed splits.
- [x] **`qually::payout`**: Implement Milestone release logic for Grant type.
- [x] **`qually::dispute`**: Implement basic `Dispute` object and opening flow.
- [x] **`qually::treasury`**: Implement fee deposit and balance tracking.

---

## Phase 3: Integration Support & Backend Services (COMPLETED)

**Goal:** Provide full technical support for frontend development and implement non-contract services.

### 3.1 Documentation & SDK Guidance (COMPLETED)
- [x] Update `FrontendIntegration.md` with all new contract endpoints (Voting, Payout, Dispute).
- [x] Provide TypeScript snippets for Walrus upload/download flows.
- [x] Document LI.FI payment routing requirements for the frontend.

### 3.2 Backend Services (COMPLETED)
- [x] Implement lightweight Node.js/FastAPI service for Tatum Webhook consumption.
- [x] Configure Tatum Notification subscriptions.

---

## Phase 4: Deployment & Audit

**Goal:** Final system verification and production launch.

### 4.1 Verification
- [ ] Conduct full lifecycle audit on Testnet.
- [ ] Verify contract security and gas efficiency.

### 4.2 Production Launch
- [ ] Deploy finalized contracts to Sui Mainnet.
- [ ] Verify objects and transactions on Sui Mainnet.

---

## Acceptance Criteria for V1 (Hackathon)
- [ ] End-to-end flow: Create Bounty → Submit Work → Vote → Payout.
- [ ] All work content stored on Walrus (verified PoA).
- [ ] Real-time alerts working via Tatum Notifications.
- [ ] Cross-chain payment into escrow via LI.FI.
