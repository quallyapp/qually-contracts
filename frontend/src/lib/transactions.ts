import { Transaction } from '@mysten/sui/transactions';
import { QUALLY_PACKAGE_ID, TREASURY_OBJECT_ID, SUI_CLOCK, QUALLY_BOUNTY_REGISTRY } from './contracts';
import type { CreateBountyParams } from './types';

// ═══════════════════════════════════════════════════════════════════
// BOUNTY MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildCreateBountyTx(params: CreateBountyParams): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(params.prizeAmountMist)]);
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::create_bounty`,
    arguments: [
      tx.object(QUALLY_BOUNTY_REGISTRY),
      coin,
      tx.pure.u8(params.bounty_type),
      tx.pure.vector('u8', params.brief_blob_id),
      tx.pure.vector('u8', params.brief_content_hash),
      tx.pure.u64(params.submission_deadline),
      tx.pure.u64(params.judging_deadline),
      tx.pure.u8(params.poster_weight),
      tx.pure.u8(params.max_judges),
      tx.pure.vector('u8', params.contest_splits),
      tx.pure.bool(params.is_recurring),
      tx.pure.bool(params.auto_extend),
      tx.pure.vector('string', params.category_tags),
    ],
  });
  return tx;
}

export function buildStartReviewTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::start_review`,
    arguments: [tx.object(bountyId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildCloseBountyTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::close_bounty`,
    arguments: [tx.object(bountyId)],
  });
  return tx;
}

export function buildRefundEmptyBountyTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::refund_empty_bounty`,
    arguments: [tx.object(bountyId)],
  });
  return tx;
}

export function buildRefundExpiredBountyTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::refund_expired_bounty`,
    arguments: [tx.object(bountyId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildVetoResultTx(bountyId: string, finalizedAt: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::veto_result`,
    arguments: [tx.object(bountyId), tx.pure.u64(finalizedAt), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildBoostPrizePoolTx(bountyId: string, amountMist: number): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::boost_prize_pool`,
    arguments: [tx.object(bountyId), coin],
  });
  return tx;
}

export function buildAutoExtendTx(bountyId: string, extensionMs: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::auto_extend`,
    arguments: [tx.object(bountyId), tx.pure.u64(extensionMs), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildApproveJudgeForBountyTx(bountyId: string, judgeAddress: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::approve_judge_for_bounty`,
    arguments: [tx.object(bountyId), tx.pure.address(judgeAddress)],
  });
  return tx;
}

export function buildSetGatedTx(bountyId: string, isGated: boolean): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::set_gated`,
    arguments: [tx.object(bountyId), tx.pure.bool(isGated)],
  });
  return tx;
}

export function buildAddAllowedSubmitterTx(bountyId: string, submitter: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::add_allowed_submitter`,
    arguments: [tx.object(bountyId), tx.pure.address(submitter)],
  });
  return tx;
}

export function buildRemoveAllowedSubmitterTx(bountyId: string, submitter: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::bounty::remove_allowed_submitter`,
    arguments: [tx.object(bountyId), tx.pure.address(submitter)],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// SUBMISSION MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildSubmitWorkTx(
  bountyObjectId: string,
  collaborators: string[],
  payoutSplits: number[],
  blobId: number[],
  contentHash: number[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::submission::submit_work`,
    arguments: [
      tx.object(bountyObjectId),
      tx.pure.vector('address', collaborators),
      tx.pure.vector('u8', payoutSplits),
      tx.pure.vector('u8', blobId),
      tx.pure.vector('u8', contentHash),
      tx.object(SUI_CLOCK),
    ],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// JUDGE MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildMintJudgeProfileTx(): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::judge::mint_judge_profile`,
    arguments: [],
  });
  return tx;
}

export function buildApplyAsJudgeTx(
  judgeProfileId: string,
  bountyId: string,
  stakeAmountMist: number,
  applicationBlobId: number[],
): Transaction {
  const tx = new Transaction();
  const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeAmountMist)]);
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::judge::apply_as_judge`,
    arguments: [
      tx.object(judgeProfileId),
      tx.pure.id(bountyId),
      stakeCoin,
      tx.pure.vector('u8', applicationBlobId),
    ],
  });
  return tx;
}

export function buildApproveJudgeTx(judgeApplicationId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::judge::approve_judge`,
    arguments: [tx.object(judgeApplicationId)],
  });
  return tx;
}

export function buildReleaseStakeTx(judgeProfileId: string, amountMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::judge::release_stake`,
    arguments: [tx.object(judgeProfileId), tx.pure.u64(amountMist)],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// VOTING MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildCommitVoteTx(bountyId: string, commitHash: number[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::voting::commit_vote`,
    arguments: [tx.pure.id(bountyId), tx.pure.vector('u8', commitHash)],
  });
  return tx;
}

export function buildRevealVoteTx(
  commitId: string,
  submissionId: string,
  score: number,
  nonce: number[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::voting::reveal_vote`,
    arguments: [
      tx.object(commitId),
      tx.pure.id(submissionId),
      tx.pure.u64(score),
      tx.pure.vector('u8', nonce),
    ],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// PAYOUT MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildFinalizeFixedTx(bountyId: string, winner: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::finalize_fixed`,
    arguments: [tx.object(bountyId), tx.pure.address(winner), tx.object(TREASURY_OBJECT_ID)],
  });
  return tx;
}

export function buildFinalizeContestTx(bountyId: string, winners: string[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::finalize_contest`,
    arguments: [
      tx.object(bountyId),
      tx.pure.vector('address', winners),
      tx.object(TREASURY_OBJECT_ID),
    ],
  });
  return tx;
}

export function buildFinalizeGradedTx(bountyId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::finalize_graded`,
    arguments: [tx.object(bountyId), tx.object(TREASURY_OBJECT_ID)],
  });
  return tx;
}

export function buildReleaseMilestoneTx(bountyId: string, hunter: string, amountMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::release_milestone`,
    arguments: [tx.object(bountyId), tx.pure.address(hunter), tx.pure.u64(amountMist)],
  });
  return tx;
}

export function buildUpdateJudgeReputationTx(judgeProfileId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::update_judge_reputation`,
    arguments: [tx.object(judgeProfileId)],
  });
  return tx;
}

export function buildSlashJudgeForMissedRevealTx(judgeProfileId: string, slashAmountMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::payout::slash_judge_for_missed_reveal`,
    arguments: [tx.object(judgeProfileId), tx.pure.u64(slashAmountMist)],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// MILESTONE MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildCreateMilestoneTx(
  bountyId: string,
  hunter: string,
  milestoneIndex: number,
  descriptionBlobId: number[],
  deadline: number,
  payoutAmountMist: number,
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::create_milestone`,
    arguments: [
      tx.pure.id(bountyId),
      tx.pure.address(hunter),
      tx.pure.u8(milestoneIndex),
      tx.pure.vector('u8', descriptionBlobId),
      tx.pure.u64(deadline),
      tx.pure.u64(payoutAmountMist),
    ],
  });
  return tx;
}

export function buildSubmitMilestoneTx(milestoneId: string, deliveryBlobId: number[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::submit_milestone`,
    arguments: [tx.object(milestoneId), tx.pure.vector('u8', deliveryBlobId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildApproveMilestoneTx(milestoneId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::approve_milestone`,
    arguments: [tx.object(milestoneId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildRejectMilestoneTx(milestoneId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::reject_milestone`,
    arguments: [tx.object(milestoneId)],
  });
  return tx;
}

export function buildEscalateOverdueTx(milestoneId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::milestone::escalate_overdue`,
    arguments: [tx.object(milestoneId), tx.object(SUI_CLOCK)],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// DISPUTE MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildOpenDisputeTx(
  bountyId: string,
  submissionId: string,
  reasonBlobId: number[],
  disputeFeeMist: number,
): Transaction {
  const tx = new Transaction();
  const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(disputeFeeMist)]);
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::open_dispute`,
    arguments: [
      tx.pure.id(bountyId),
      tx.pure.id(submissionId),
      tx.pure.vector('u8', reasonBlobId),
      feeCoin,
    ],
  });
  return tx;
}

export function buildSubmitEvidenceTx(disputeId: string, evidenceBlobId: number[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::submit_evidence`,
    arguments: [tx.object(disputeId), tx.pure.vector('u8', evidenceBlobId)],
  });
  return tx;
}

export function buildAssignArbiterTx(disputeId: string, arbiter: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::assign_arbiter`,
    arguments: [tx.object(disputeId), tx.pure.address(arbiter)],
  });
  return tx;
}

export function buildResolveDisputeTx(disputeId: string, bountyId: string, outcome: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::resolve_dispute`,
    arguments: [tx.object(disputeId), tx.object(bountyId), tx.pure.u8(outcome), tx.object(SUI_CLOCK)],
  });
  return tx;
}

export function buildRejectDisputeTx(disputeId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::dispute::reject_dispute`,
    arguments: [tx.object(disputeId)],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// PROFILE MODULE
// ═══════════════════════════════════════════════════════════════════

export function buildCreatePosterProfileTx(name: string, bioBlobId: number[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::profile::create_poster_profile`,
    arguments: [tx.pure.string(name), tx.pure.vector('u8', bioBlobId)],
  });
  return tx;
}

export function buildCreateHunterProfileTx(
  name: string,
  bioBlobId: number[],
  skillTags: string[],
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::profile::create_hunter_profile`,
    arguments: [
      tx.pure.string(name),
      tx.pure.vector('u8', bioBlobId),
      tx.pure.vector('string', skillTags),
    ],
  });
  return tx;
}

// ═══════════════════════════════════════════════════════════════════
// TREASURY MODULE (admin only)
// ═══════════════════════════════════════════════════════════════════

export function buildWithdrawTx(amountMist: number): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${QUALLY_PACKAGE_ID}::treasury::withdraw`,
    arguments: [tx.object(TREASURY_OBJECT_ID), tx.pure.u64(amountMist)],
  });
  return tx;
}
