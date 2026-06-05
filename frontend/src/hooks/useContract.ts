import { useDappKit } from '@/components/Providers';
import { useState, useCallback } from 'react';
import {
  buildCreateBountyTx, buildStartReviewTx, buildCloseBountyTx,
  buildRefundEmptyBountyTx, buildRefundExpiredBountyTx, buildVetoResultTx,
  buildBoostPrizePoolTx, buildAutoExtendTx, buildApproveJudgeForBountyTx,
  buildSetGatedTx, buildAddAllowedSubmitterTx, buildRemoveAllowedSubmitterTx,
  buildSubmitWorkTx, buildMintJudgeProfileTx, buildApplyAsJudgeTx,
  buildApproveJudgeTx, buildReleaseStakeTx, buildCommitVoteTx,
  buildRevealVoteTx, buildFinalizeFixedTx, buildFinalizeContestTx,
  buildFinalizeGradedTx, buildReleaseMilestoneTx, buildUpdateJudgeReputationTx,
  buildSlashJudgeForMissedRevealTx, buildCreateMilestoneTx,
  buildSubmitMilestoneTx, buildApproveMilestoneTx, buildRejectMilestoneTx,
  buildEscalateOverdueTx, buildOpenDisputeTx, buildSubmitEvidenceTx,
  buildAssignArbiterTx, buildResolveDisputeTx, buildRejectDisputeTx,
  buildCreatePosterProfileTx, buildCreateHunterProfileTx, buildWithdrawTx,
} from '../lib/transactions';
import type { CreateBountyParams } from '../lib/types';

interface TxResult {
  success: boolean;
  digest?: string;
  error?: string;
  createdObjects?: string[];
}

export function useContract() {
  const { account, suiClient, signTransaction } = useDappKit();
  const [pending, setPending] = useState(false);

  const executeTx = useCallback(async (tx: any): Promise<TxResult> => {
    if (!account) return { success: false, error: 'Not connected' };
    setPending(true);
    try {
      tx.setSender(account.address);
      const signed = await signTransaction({ transaction: tx, chain: 'sui:testnet' });
      const result: any = await Promise.race([
        suiClient.executeTransactionBlock({
          transactionBlock: signed.bytes,
          signature: signed.signature,
          options: { showEffects: true, showEvents: true },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RPC timed out after 30s')), 30000)
        ),
      ]);
      setPending(false);
      if (result.effects?.status?.status === 'success') {
        const created = (result.effects?.created ?? []).map((c: any) => c.reference?.objectId).filter(Boolean);
        return { success: true, digest: result.digest, createdObjects: created };
      }
      return { success: false, error: result.effects?.status?.error ?? 'Transaction aborted' };
    } catch (e: any) {
      setPending(false);
      console.error("[Qually] executeTx exception:", e);
      return { success: false, error: e.message };
    }
  }, [account, signTransaction, suiClient]);

  // ═══ Bounty ═══
  const createBounty = useCallback((p: CreateBountyParams) => executeTx(buildCreateBountyTx(p)), [executeTx]);
  const startReview = useCallback((id: string) => executeTx(buildStartReviewTx(id)), [executeTx]);
  const closeBounty = useCallback((id: string) => executeTx(buildCloseBountyTx(id)), [executeTx]);
  const refundEmpty = useCallback((id: string) => executeTx(buildRefundEmptyBountyTx(id)), [executeTx]);
  const refundExpired = useCallback((id: string) => executeTx(buildRefundExpiredBountyTx(id)), [executeTx]);
  const vetoResult = useCallback((id: string, at: number) => executeTx(buildVetoResultTx(id, at)), [executeTx]);
  const boostPrizePool = useCallback((id: string, amt: number) => executeTx(buildBoostPrizePoolTx(id, amt)), [executeTx]);
  const autoExtend = useCallback((id: string, ms: number) => executeTx(buildAutoExtendTx(id, ms)), [executeTx]);
  const approveJudgeForBounty = useCallback((id: string, addr: string) => executeTx(buildApproveJudgeForBountyTx(id, addr)), [executeTx]);
  const setGated = useCallback((id: string, g: boolean) => executeTx(buildSetGatedTx(id, g)), [executeTx]);
  const addAllowedSubmitter = useCallback((id: string, addr: string) => executeTx(buildAddAllowedSubmitterTx(id, addr)), [executeTx]);
  const removeAllowedSubmitter = useCallback((id: string, addr: string) => executeTx(buildRemoveAllowedSubmitterTx(id, addr)), [executeTx]);

  // ═══ Submission ═══
  const submitWork = useCallback((bountyId: string, collabs: string[], splits: number[], blobId: number[], hash: number[]) =>
    executeTx(buildSubmitWorkTx(bountyId, collabs, splits, blobId, hash)), [executeTx]);

  // ═══ Judge ═══
  const mintJudgeProfile = useCallback(() => executeTx(buildMintJudgeProfileTx()), [executeTx]);
  const applyAsJudge = useCallback((profileId: string, bountyId: string, stake: number, blobId: number[]) =>
    executeTx(buildApplyAsJudgeTx(profileId, bountyId, stake, blobId)), [executeTx]);
  const approveJudge = useCallback((appId: string) => executeTx(buildApproveJudgeTx(appId)), [executeTx]);
  const releaseStake = useCallback((profileId: string, amt: number) => executeTx(buildReleaseStakeTx(profileId, amt)), [executeTx]);

  // ═══ Voting ═══
  const commitVote = useCallback((bountyId: string, hash: number[]) =>
    executeTx(buildCommitVoteTx(bountyId, hash)), [executeTx]);
  const revealVote = useCallback((commitId: string, subId: string, score: number, nonce: number[]) =>
    executeTx(buildRevealVoteTx(commitId, subId, score, nonce)), [executeTx]);

  // ═══ Payout ═══
  const finalizeFixed = useCallback((id: string, winner: string) => executeTx(buildFinalizeFixedTx(id, winner)), [executeTx]);
  const finalizeContest = useCallback((id: string, winners: string[]) => executeTx(buildFinalizeContestTx(id, winners)), [executeTx]);
  const finalizeGraded = useCallback((id: string) => executeTx(buildFinalizeGradedTx(id)), [executeTx]);
  const releaseMilestone = useCallback((bountyId: string, hunter: string, amt: number) =>
    executeTx(buildReleaseMilestoneTx(bountyId, hunter, amt)), [executeTx]);
  const updateJudgeReputation = useCallback((profileId: string) => executeTx(buildUpdateJudgeReputationTx(profileId)), [executeTx]);
  const slashJudge = useCallback((profileId: string, amt: number) => executeTx(buildSlashJudgeForMissedRevealTx(profileId, amt)), [executeTx]);

  // ═══ Milestone ═══
  const createMilestone = useCallback((bountyId: string, hunter: string, idx: number, descBlobId: number[], deadline: number, amt: number) =>
    executeTx(buildCreateMilestoneTx(bountyId, hunter, idx, descBlobId, deadline, amt)), [executeTx]);
  const submitMilestone = useCallback((id: string, blobId: number[]) => executeTx(buildSubmitMilestoneTx(id, blobId)), [executeTx]);
  const approveMilestone = useCallback((id: string) => executeTx(buildApproveMilestoneTx(id)), [executeTx]);
  const rejectMilestone = useCallback((id: string) => executeTx(buildRejectMilestoneTx(id)), [executeTx]);
  const escalateOverdue = useCallback((id: string) => executeTx(buildEscalateOverdueTx(id)), [executeTx]);

  // ═══ Dispute ═══
  const openDispute = useCallback((bountyId: string, subId: string, reasonBlobId: number[], fee: number) =>
    executeTx(buildOpenDisputeTx(bountyId, subId, reasonBlobId, fee)), [executeTx]);
  const submitEvidence = useCallback((disputeId: string, blobId: number[]) => executeTx(buildSubmitEvidenceTx(disputeId, blobId)), [executeTx]);
  const assignArbiter = useCallback((disputeId: string, arbiter: string) => executeTx(buildAssignArbiterTx(disputeId, arbiter)), [executeTx]);
  const resolveDispute = useCallback((disputeId: string, bountyId: string, outcome: number) =>
    executeTx(buildResolveDisputeTx(disputeId, bountyId, outcome)), [executeTx]);
  const rejectDispute = useCallback((id: string) => executeTx(buildRejectDisputeTx(id)), [executeTx]);

  // ═══ Profile ═══
  const createPosterProfile = useCallback((name: string, bioBlobId: number[]) =>
    executeTx(buildCreatePosterProfileTx(name, bioBlobId)), [executeTx]);
  const createHunterProfile = useCallback((name: string, bioBlobId: number[], skills: string[]) =>
    executeTx(buildCreateHunterProfileTx(name, bioBlobId, skills)), [executeTx]);

  // ═══ Treasury (admin) ═══
  const withdraw = useCallback((amt: number) => executeTx(buildWithdrawTx(amt)), [executeTx]);

  return {
    connected: !!account,
    address: account?.address,
    pending,
    // Bounty
    createBounty, startReview, closeBounty, refundEmpty, refundExpired,
    vetoResult, boostPrizePool, autoExtend, approveJudgeForBounty,
    setGated, addAllowedSubmitter, removeAllowedSubmitter,
    // Submission
    submitWork,
    // Judge
    mintJudgeProfile, applyAsJudge, approveJudge, releaseStake,
    // Voting
    commitVote, revealVote,
    // Payout
    finalizeFixed, finalizeContest, finalizeGraded, releaseMilestone,
    updateJudgeReputation, slashJudge,
    // Milestone
    createMilestone, submitMilestone, approveMilestone, rejectMilestone, escalateOverdue,
    // Dispute
    openDispute, submitEvidence, assignArbiter, resolveDispute, rejectDispute,
    // Profile
    createPosterProfile, createHunterProfile,
    // Treasury
    withdraw,
  };
}
