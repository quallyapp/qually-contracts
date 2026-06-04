# QUALLY
## Trustless Bounty Infrastructure on Sui

**Product Requirements Document — Version 2.0 | June 2026**

> 🎯 Targeting: **Tatum x Walrus Hackathon** (May 23 – June 6, 2026) &nbsp;|&nbsp; **CLAY Hackathon** by Lofi the Yeti
>
> Built on Sui • Powered by Walrus • Tatum RPC • LI.FI

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Hackathon Alignment](#2-hackathon-alignment)
3. [Product Overview](#3-product-overview)
4. [Full Application Workflow](#4-full-application-workflow)
5. [Technology Stack](#5-technology-stack)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Success Metrics](#8-success-metrics)

---

## 1. Executive Summary

Qually is a trustless, decentralized bounty and work marketplace built natively on the Sui blockchain. It enables project sponsors to post bounties — from quick tasks to multi-milestone grants — with prize pools locked in on-chain escrow, judged by a hybrid panel of community judges and the poster, and paid out automatically by smart contract.

Unlike existing bounty platforms that rely on off-chain trust and centralized mediation, Qually enforces all rules through Move smart contracts on Sui. Every submission is permanently stored on Walrus decentralized storage and minted as a portable NFT. Every payout is triggered by contract logic, not platform discretion.

> **The Core Problem**
>
> Superteam Earn (Solana) has 186,000+ users and has distributed $1.7M+ in bounties. It works — but it is built entirely on trust.
> - Sponsors can ghost after receiving work. No escrow, no enforcement.
> - Judging is done solely by the poster — single point of bias or manipulation.
> - Submissions disappear when the platform goes down. Hunters have no portable proof of work.
> - There is no dispute mechanism for hunters who believe they were treated unfairly.
>
> **Qually makes trust unnecessary. The Sui + Walrus + Tatum stack is what makes this possible.**

---

### 1.1 What Changed in V2

This document is the V2 PRD. The following major updates have been made from V1:

| Feature | V1 Status | V2 Status |
|---|---|---|
| Multi-token payment via LI.FI | Not included | ✅ P0 — core V1 feature |
| Submission privacy (sealed until review) | Not included | ✅ P0 — new core feature |
| PosterProfile reputation object | Not included | ✅ P0 — new core feature |
| Team submissions with on-chain split | Not included | ✅ P0 — new core feature |
| Hunter dispute path (two-sided) | Poster veto only | ✅ P0 — full dispute system |
| Contest bounty type (multi-winner) | P1 stretch goal | ✅ P0 — promoted to core |
| Milestone overdue auto-escalation | Not included | ✅ P0 — Grant type upgrade |
| Prize pool boosting (anyone can top up) | Not included | ✅ P1 |
| Recurring bounties (auto-recreate) | Not included | ✅ P1 |
| Tatum RPC as node provider | Not included | ✅ P0 — replaces public RPC |
| Tatum Notifications (webhooks) | Polling P2 | ✅ P0 — real-time events |
| Tatum gRPC for activity feed | Not included | ✅ P1 |
| Walrus for all content storage | Brief only (P0) | ✅ P0 — all content on Walrus |
| JudgeProfile extended history on Walrus | Not included | ✅ P1 |
| Skills/category tags on profiles | Not included | ✅ P1 |
| Bounty templates (preset types) | Not included | ✅ P2 |

---

## 2. Hackathon Alignment

### 2.1 Tatum x Walrus Hackathon

**Dates:** May 23 – June 6, 2026 | **Prize pool:** $2,000 USD | **Format:** Remote, global

> **Why Qually is a Natural Fit**
> - The hackathon requires meaningful, core integration of both Tatum and Walrus — not bolt-on usage.
> - Qually uses Walrus as the foundational data layer that makes the trust model work.
> - Qually uses Tatum as the RPC provider, notification engine, and data API — not just an endpoint swap.
> - The eligible category 'Infra and Tooling' maps directly to a trustless bounty marketplace.
> - The partnership announcement (April 14, 2026) is the exact use case: Tatum for chain state, Walrus for content.

| Judging Criterion | Qually Coverage |
|---|---|
| Walrus + Tatum Integration (30%) | Walrus stores ALL content (briefs, submissions, profiles). Tatum RPC handles all chain reads. Tatum Notifications fire real-time webhooks on bounty events. |
| Technical Quality (30%) | Clean Move contracts, Tatum Sui RPC integration, TypeScript SDK with proper error handling, deployed on Sui Mainnet. |
| Innovation (est. 20%) | First trustless bounty platform on Sui. Commit-reveal blind voting. Portable submission NFTs. Two-sided dispute system. LI.FI multi-token payments. |
| Real-World Utility (est. 20%) | Directly addresses Superteam Earn's trust gaps. Targets Sui ecosystem builders and African Web3 communities who depend on reliable bounty payouts. |

---

### 2.2 CLAY Hackathon (Lofi the Yeti)

Quarterly community hackathon for the Sui ecosystem. Round 2 prizes: **$1,500 (1st)**, **$750 (2nd)**, **$250 (3rd)**.

> **CLAY Stack Requirements vs Qually**
> - ✅ Sui Network (Move) — entire smart contract written in Move on Sui
> - ✅ Walrus — core data layer for all content, not optional
> - ⬜ DeepBook — not applicable to a bounty platform
> - ✅ Builder economy theme — Qually IS infrastructure for the Sui builder community
> - ✅ Submission requirements: GitHub repo (public), demo video (3–5 min), project logo, package ID on-chain

**CLAY submission angle:** Qually is the bounty platform that the Sui builder community deserves. The demo should open with a live contest bounty — multiple submissions, blind judging, automatic ranked payout — showing judges exactly what their own hackathon could look like running on-chain.

---

## 3. Product Overview

### 3.1 Vision

To become the canonical trustless bounty infrastructure layer for the Sui ecosystem and African Web3 communities — where every piece of work is verifiable, every payout is guaranteed, and every participant owns their reputation.

---

### 3.2 Target Users

| User Type | Description |
|---|---|
| Bounty Poster / Sponsor | Sui ecosystem projects, DAOs, startups, and individuals who need work done — smart contract audits, design work, written content, feature development. Also African Web3 projects needing reliable contractor payouts without traditional banking infrastructure. |
| Hunter / Contributor | Developers, designers, writers, and researchers who contribute work in exchange for SUI rewards. Particularly relevant for African Web3 builders who hold crypto but lack access to traditional payment rails. |
| Community Judge | Experienced ecosystem participants who opt into reviewing submissions. Earn reputation and stake-based rewards for honest, timely judging. |

---

### 3.3 Bounty Types

| Type | Description | Payout Logic |
|---|---|---|
| Fixed | Single winner takes the full prize. Poster + judges score submissions. | Top score wins 100% of pool minus 3% fee. |
| Contest ✨ NEW | Multiple winners share the pool in ranked splits. | Top N ranked submissions receive pre-defined % splits (e.g. 50/30/20). |
| Grant | Longer project split into milestones. Funds released incrementally. | Each milestone approval releases its allocated portion. Auto-escalation if poster is silent >7 days. |

---

## 4. Full Application Workflow

### Phase 1 — Onboarding & Profile Setup
*Actors: Poster, Hunter, Judge*

- User connects Sui wallet via `@mysten/dapp-kit`. All major Sui wallets supported.
- User creates a profile: display name, bio, skill tags (Move dev, UI/UX, writing, research), social links.
- **`Walrus`** Profile content uploaded to Walrus. Only the blob ID + content hash stored on-chain.
- **`NEW`** Any user opting into judging mints a JudgeProfile NFT — non-transferable, starts at Tier 0 (New).
- **`NEW`** PosterProfile object created on-chain, tracking payout rate, average close time, and dispute history — visible to hunters before they invest work.

---

### Phase 2 — Creating a Bounty
*Actor: Poster*

- Poster fills bounty creation form: title, type (Fixed/Contest/Grant), acceptance criteria, skill tags, submission deadline, judging deadline, poster weight (30–70%), max judges (1–7).
- **`Walrus`** Full bounty brief and any attachment files are uploaded to Walrus. Only the blob ID goes on-chain — bounty descriptions can be thousands of words with zero extra gas cost.
- **`LI.FI`** Poster selects payment token — USDC, USDT, ETH, SOL, or any supported asset.
- **`LI.FI`** LI.FI routes the payment cross-chain, swaps to SUI, and delivers it to the escrow. Poster sees a final SUI-equivalent quote before signing.
- **`On-chain`** Bounty object is created on Sui. SUI prize pool is locked — immovable until the contract releases it. State = `OPEN`.
- **`NEW`** Poster may optionally set recurring flag — on closure, an identical bounty is auto-created.
- **`NEW`** Anyone (community, sponsors, other builders) can top up the prize pool before judging begins.

---

### Phase 3 — Discovery & Submission
*Actor: Hunter*

- **`Tatum`** Hunter browses the Explore page: filter by type, category, skill tags, prize range, deadline. Activity feed shows live on-chain events via Tatum gRPC.
- **`Walrus + Tatum`** Hunter views bounty detail: full brief loaded from Walrus using the stored blob ID, poster reputation score (from PosterProfile), current submission count, and judge panel.
- **`Walrus`** Hunter uploads work files via drag-and-drop. Files are stored on Walrus. Blob ID returned.
- **`NEW`** Submission is sealed until the submission deadline. Other hunters cannot read the work — only the poster and approved judges can access it. This prevents copying.
- **`On-chain`** A Submission NFT is minted to the hunter's wallet containing the blob ID, timestamp, and bounty reference. Permanent proof of participation — portable and platform-independent.
- **`NEW`** For team submissions: lead wallet registers collaborator addresses. Payout split is defined on-chain at submission time. All members receive Submission NFTs.

---

### Phase 4 — Judge Panel Assembly
*Actors: Judge, Poster*

- Any wallet with a JudgeProfile can apply to judge a bounty. Platform surfaces their tier, reputation score, and past history to the poster.
- **`On-chain`** Poster approves up to `max_judges` from applicants. Each approval is an on-chain transaction. Panel is locked when the submission deadline passes.
- **`On-chain`** Approved judges lock a small SUI stake deposit — returned on honest completion, slashed if they miss deadline or are found to have judged dishonestly.

---

### Phase 5 — Review & Blind Voting
*Actors: Poster, Judges*

- `start_review` is called after submission deadline. State = `REVIEW`. Submissions become visible to poster and judges only.
- **`On-chain`** Commit phase: each judge selects a submission, sets a score (1–100), and signs a commit: `sha3_256(submission_id + score + nonce)`. Actual score hidden on-chain.
- **`On-chain`** Reveal phase: after all commits, each judge reveals their score and nonce. Contract verifies hash match. Scores tallied with poster weight and community weight applied.
- **`On-chain`** Winner determined by highest weighted score (Fixed), or top N ranked submissions for Contest split. All math is verifiable on-chain.

---

### Phase 6 — Payout, Dispute & Resolution
*Actors: Poster, Hunter, Judges, Platform Treasury*

- `finalize` is called after all reveals or the judging deadline. Winner(s) determined. Payout queued.
- **`On-chain`** Fixed: winner receives prize minus 3% platform fee. Contest: ranked payouts in one transaction. Grant: milestone-by-milestone release. 3% fee goes to Treasury.
- **`On-chain`** Poster veto window (48h): poster can override community verdict by paying a stake deposit within 48 hours.
- **`NEW`** Hunter dispute path: hunter may dispute a result within the same window. Both parties lock stake. A panel of Tier 3 (Elite) judges review as arbiters. Loser's stake is slashed. Verdict is binding.
- **`NEW`** Poster may send a discretionary tip to any non-winning submission they found valuable. No contract enforcement — goodwill only.
- **`On-chain`** JudgeProfile scores updated: alignment bonus, deadline penalty, streak multiplier. PosterProfile payout rate updated. State = `CLOSED`.

---

### Phase 7 — Grant Milestones
*Actors: Poster, Hunter*

- Milestones defined at bounty creation: titles, descriptions, individual payout amounts. Total must equal full prize pool.
- **`Walrus`** For each milestone, hunter uploads deliverable to Walrus and signs a milestone submission transaction. A Milestone NFT is minted.
- Poster reviews deliverable fetched from Walrus and approves on-chain. That milestone's SUI is instantly released to hunter.
- **`NEW`** Milestone overdue escalation: if poster has not responded within 7 days of a milestone submission, contract flags it as overdue. Hunter may trigger community judge review to force resolution.

---

### Phase 8 — Edge Cases

- **No submissions:** if submission deadline passes with zero valid entries, poster calls `refund_empty_bounty`. Full prize returned. 3% fee waived. State = `CLOSED`.
- **`NEW` Auto-extend:** if poster configured auto-extend and fewer than 2 submissions are received near deadline, the bounty automatically extends.
- **`On-chain`** Judge missed deadline: judge who committed but did not reveal by the judging deadline has stake slashed, loses 15 reputation points, and is removed from the panel. Remaining votes are tallied.
- **`NEW` Recurring bounty:** on closure of a recurring bounty, a new identical Bounty object is created with reset state and fresh deadlines. No poster action required.

---

## 5. Technology Stack

### 5.1 Core Infrastructure

| Layer | Technology & Role |
|---|---|
| Smart Contract | Move on Sui Mainnet — all escrow, voting, payout, and state logic |
| Decentralized Storage | Walrus — all content (bounty briefs, submissions, profiles, judge histories) |
| RPC / Chain Reads | Tatum Sui RPC Gateway (`sui-mainnet.gateway.tatum.io`) — load balanced, <50ms, auto-failover |
| Real-time Events | Tatum Notifications — webhook-based alerts for bounty events, replacing polling |
| Activity Feed | Tatum gRPC for Sui — streaming chain events for the live explore feed |
| Chain Data | Tatum Data API — wallet balances, payout history, leaderboard stats |
| Multi-token Payments | LI.FI — cross-chain swap any token to SUI before escrow lock |
| Frontend Framework | Vite + React + TypeScript |
| Wallet Integration | `@mysten/dapp-kit` — Sui wallet connection and transaction signing |
| Walrus SDK | `@mysten/walrus` — TypeScript SDK for blob write/read operations |
| State Management | TanStack Query — server state, chain data caching |
| Styling | Tailwind CSS |

---

### 5.2 How Walrus Is Used

Walrus is not a file storage widget in Qually — it is the foundational data layer that makes the trust model work. The separation of concerns is:

- **Sui contract** = source of truth for *who owns what, who won, how much is owed, and what the rules are.*
- **Walrus** = source of truth for *the actual content: briefs, submissions, profiles, judge histories.*
- The **blob ID stored on-chain** is the cryptographic link between the two layers.

| Content Type | How Walrus Is Used |
|---|---|
| Bounty brief + attachments | Uploaded on bounty creation. Blob ID stored in Bounty object. Fetched on detail page. Any size, zero extra gas. |
| Hunter submission files | Uploaded on submission. Blob ID embedded in Submission NFT. Hunter's proof of work survives platform shutdown. |
| Hunter + poster profiles | Extended profile data (bio, portfolio, skill descriptions) on Walrus. Only blob ID + hash on-chain. |
| JudgeProfile history | Detailed judging session history on Walrus. Hash stored on-chain for integrity verification. |
| Grant milestone deliverables | Each milestone submission uploaded separately. Ordered permanent record of project development. |

---

### 5.3 How Tatum Is Used

| Tatum Product | Qually Usage |
|---|---|
| Sui RPC Gateway | All `@mysten/sui` client calls routed through Tatum's gateway. Load balancing, caching, and failover out of the box. |
| Notifications / Webhooks | Real-time alerts: payout sent, judge approved, bounty deadline approaching. Eliminates polling entirely. |
| Data API | Poster and hunter earnings history, leaderboard stats, PosterProfile payout rate calculation. |
| Sui gRPC | Live activity feed on Explore page — streaming on-chain events without polling. |

---

### 5.4 How LI.FI Is Used

LI.FI handles multi-token payment into SUI escrow. The Move contract is never aware of the source token — it always receives and holds SUI.

1. Poster selects prize amount and payment token (USDC, USDT, ETH, SOL, etc.) in the creation form.
2. LI.FI widget calculates route and presents a SUI-equivalent quote to the poster.
3. Poster approves the swap. LI.FI routes cross-chain, delivers SUI to the poster's wallet.
4. Poster signs the `create_bounty` transaction. SUI is locked in contract escrow.
5. Hunters always receive SUI payouts. No oracle dependency. Contract stays clean.

---

## 6. Functional Requirements

### 6.1 Priority Definitions

| Priority | Definition |
|---|---|
| P0 — Must Have | Required for V1 hackathon submission. Platform does not function without these. |
| P1 — Should Have | Strong additions that meaningfully improve the product. Ship if time permits. |
| P2 — Nice to Have | Future roadmap. Not required for V1 or hackathon demo. |

---

### 6.2 P0 Requirements (V1 Core)

| # | Feature | Description |
|---|---|---|
| P0-01 | Wallet connection | Sui wallet connect/disconnect via `@mysten/dapp-kit` |
| P0-02 | Profile creation | Create profile with skills, bio, links. Stored on Walrus. |
| P0-03 | PosterProfile object | `[NEW]` On-chain payout rate, avg close time, dispute history |
| P0-04 | JudgeProfile NFT | Non-transferable. Tier system (0–3). Required for judging. |
| P0-05 | Bounty creation (Fixed) | Form, Walrus upload, LI.FI payment, on-chain escrow lock |
| P0-06 | Bounty creation (Contest) | `[PROMOTED]` Multi-winner with ranked prize splits |
| P0-07 | Bounty creation (Grant) | Milestone-based with on-chain partial releases |
| P0-08 | LI.FI integration | `[NEW]` Any-token payment → SUI escrow |
| P0-09 | Walrus brief storage | Bounty brief + attachments on Walrus. Blob ID on-chain. |
| P0-10 | Submission with privacy | `[NEW]` Sealed submissions until review phase opens |
| P0-11 | Walrus submission storage | All submission files on Walrus. Blob ID in Submission NFT. |
| P0-12 | Submission NFT mint | Minted to hunter on every submission. Permanent record. |
| P0-13 | Team submission | `[NEW]` Lead + collaborators. On-chain split. All get NFTs. |
| P0-14 | Judge application + approval | Apply, poster approves, stake locked |
| P0-15 | Commit-reveal voting | Two-phase blind scoring. sha3_256 commit. On-chain tally. |
| P0-16 | Weighted scoring | Poster weight (30–70%) + community judge weight applied |
| P0-17 | Automatic payout | Contract releases funds to winner(s) on finalize |
| P0-18 | Contest split payout | `[PROMOTED]` Ranked multi-winner payout in one transaction |
| P0-19 | Poster veto (48h window) | Stake-based override within 48h of finalization |
| P0-20 | Hunter dispute path | `[NEW]` Two-sided dispute. Elite judge arbiters. Stake slash. |
| P0-21 | Milestone overdue escalation | `[NEW]` 7-day timeout triggers community review for Grants |
| P0-22 | Empty bounty refund | Full refund if zero submissions. Fee waived. |
| P0-23 | Tatum RPC integration | `[NEW]` All chain reads via Tatum gateway |
| P0-24 | Tatum Notifications | `[NEW]` Webhook-based real-time alerts for bounty events |
| P0-25 | 3% platform fee | Deducted from prize on payout. Sent to Treasury object. |

---

### 6.3 P1 Requirements

| # | Feature | Description |
|---|---|---|
| P1-01 | Prize pool boosting | `[NEW]` Anyone can add SUI to a live bounty's prize pool |
| P1-02 | Recurring bounties | `[NEW]` Auto-recreate identical bounty on close |
| P1-03 | Auto-extend on low submissions | `[NEW]` Extend deadline if <2 submissions near close |
| P1-04 | Hunter tipping | `[NEW]` Poster sends discretionary tip to non-winning work |
| P1-05 | Tatum gRPC activity feed | `[NEW]` Live on-chain event stream on Explore page |
| P1-06 | Tatum Data API leaderboard | `[NEW]` Earnings, payout rate, top hunter stats |
| P1-07 | JudgeProfile history on Walrus | `[NEW]` Full judging history stored on Walrus |
| P1-08 | Skill tags on profiles | `[NEW]` Self-tagged skills. Posters can browse by skill. |
| P1-09 | On-chain category tags | Categories stored on Bounty object for composability |

---

### 6.4 P2 Requirements (Future Roadmap)

| # | Feature | Description |
|---|---|---|
| P2-01 | Bounty templates | Pre-built templates for common task types with defaults |
| P2-02 | Hunter invitations | Poster invites specific hunters to private bounties |
| P2-03 | Multi-chain bounty posters | Allow non-Sui wallets to post bounties via LI.FI bridge |
| P2-04 | DAO governance for fee | WAL/SUI governance vote on platform fee rate |
| P2-05 | Mobile responsive UI | Full mobile optimization for African mobile-first users |

---

## 7. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Uptime / Availability | 99.9%+ frontend uptime. Tatum RPC provides 99.99% node uptime with automatic failover. |
| Response time | <200ms for page loads. <50ms for Tatum RPC chain reads. Tatum gRPC streaming for real-time data. |
| Data permanence | All Walrus blobs stored for minimum 52 epochs (~1 year) at creation. Renewal mechanism for long-lived bounties. |
| Contract security | All prize pool funds held in Move escrow objects. No admin key can unilaterally withdraw funds. Open source. |
| Submission integrity | Content hash stored on-chain alongside Walrus blob ID. Any tampering with Walrus blob is detectable on-chain. |
| Gas efficiency | Content stored off-chain on Walrus. On-chain objects store only IDs and metadata. Minimizes transaction costs. |
| Scalability | Tatum RPC load balancing handles traffic spikes. Walrus distributed storage scales horizontally. |

---

## 8. Success Metrics

### 8.1 Hackathon Demo Targets

| Metric | Target |
|---|---|
| Bounties created on Mainnet | ≥ 3 live bounties deployed on Sui Mainnet |
| Walrus blobs stored | ≥ 5 blobs (briefs + submissions) with verified PoA |
| Tatum RPC calls demonstrated | Live chain reads visible in demo video |
| Tatum Notification fired | At least 1 live webhook event shown in demo |
| Submission NFTs minted | ≥ 2 Submission NFTs minted to hunter wallets |
| End-to-end payout | At least 1 complete bounty lifecycle: create → submit → judge → payout |

---

### 8.2 Post-Launch V1 Targets

| Metric | Target |
|---|---|
| Total bounties created | 50 within 60 days of launch |
| Total SUI in escrow (peak) | > 500 SUI |
| Unique hunters submitting | > 100 wallets |
| Unique posters | > 20 projects or individuals |
| Submission NFTs minted | > 200 |
| Average bounty close time | < 14 days |
| Platform fee revenue | > 15 SUI |

---

*Qually — Product Requirements Document v2.0 | June 2026*
