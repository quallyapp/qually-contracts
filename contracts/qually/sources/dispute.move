module qually::dispute {
    use sui::clock::Clock;
    use sui::balance::{Self};
    use sui::coin;
    use qually::bounty::{Self, Bounty};

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_INVALID_STATE: u64 = 1;
    const E_DEADLINE_NOT_REACHED: u64 = 2;
    const E_ALREADY_DISPUTED: u64 = 3;

    /// Dispute states
    const STATE_OPEN: u8 = 0;
    const STATE_REVIEW: u8 = 1;
    const STATE_RESOLVED: u8 = 2;
    const STATE_REJECTED: u8 = 3;

    /// Dispute outcomes
    const OUTCOME_NONE: u8 = 0;
    const OUTCOME_HUNTER_WINS: u8 = 1;
    const OUTCOME_POSTER_WINS: u8 = 2;
    const OUTCOME_SPLIT: u8 = 3;

    /// Dispute object
    public struct Dispute has key, store {
        id: UID,
        hunter: address,
        bounty_id: ID,
        submission_id: ID,
        reason_blob_id: vector<u8>,
        evidence_blob_id: vector<u8>,
        state: u8,
        arbiter: address,
        outcome: u8,
        resolved_at: u64,
        dispute_fee: u64,
    }

    /// Initiate a dispute (by hunter)
    public fun open_dispute(
        bounty_id: ID,
        submission_id: ID,
        reason_blob_id: vector<u8>,
        dispute_fee: u64,
        ctx: &mut TxContext
    ) {
        let dispute = Dispute {
            id: object::new(ctx),
            hunter: ctx.sender(),
            bounty_id,
            submission_id,
            reason_blob_id,
            evidence_blob_id: vector[],
            state: STATE_OPEN,
            arbiter: @0x0,
            outcome: OUTCOME_NONE,
            resolved_at: 0,
            dispute_fee,
        };

        transfer::share_object(dispute);
    }

    /// Submit additional evidence (by hunter)
    public fun submit_evidence(
        dispute: &mut Dispute,
        evidence_blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == dispute.hunter, E_UNAUTHORIZED);
        assert!(dispute.state == STATE_OPEN || dispute.state == STATE_REVIEW, E_INVALID_STATE);

        dispute.evidence_blob_id = evidence_blob_id;
    }

    /// Assign arbiter to dispute
    public fun assign_arbiter(
        dispute: &mut Dispute,
        arbiter: address,
        ctx: &mut TxContext
    ) {
        assert!(dispute.state == STATE_OPEN, E_INVALID_STATE);
        // Note: In production, verify caller is authorized (DAO or trusted arbiter)

        dispute.arbiter = arbiter;
        dispute.state = STATE_REVIEW;
    }

    /// Resolve dispute (by arbiter) — transfers funds based on outcome
    public fun resolve_dispute(
        dispute: &mut Dispute,
        bounty: &mut Bounty,
        outcome: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == dispute.arbiter, E_UNAUTHORIZED);
        assert!(dispute.state == STATE_REVIEW, E_INVALID_STATE);
        assert!(outcome >= 1 && outcome <= 3, E_INVALID_STATE);

        dispute.outcome = outcome;
        dispute.state = STATE_RESOLVED;
        dispute.resolved_at = clock.timestamp_ms();

        // Transfer funds based on outcome
        let prize_pool = bounty::prize_pool_mut(bounty);
        let pool_value = balance::value(prize_pool);

        if (outcome == OUTCOME_HUNTER_WINS) {
            // All funds go to hunter
            if (pool_value > 0) {
                let payout = balance::split(prize_pool, pool_value);
                transfer::public_transfer(coin::from_balance(payout, ctx), dispute.hunter);
            };
        } else if (outcome == OUTCOME_POSTER_WINS) {
            // All funds go back to poster
            if (pool_value > 0) {
                let payout = balance::split(prize_pool, pool_value);
                transfer::public_transfer(coin::from_balance(payout, ctx), bounty::poster(bounty));
            };
        };
        // OUTCOME_SPLIT: funds remain in bounty for poster to finalize normally
    }

    /// Reject dispute (by arbiter - insufficient evidence)
    public fun reject_dispute(
        dispute: &mut Dispute,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == dispute.arbiter, E_UNAUTHORIZED);
        assert!(dispute.state == STATE_REVIEW, E_INVALID_STATE);

        dispute.state = STATE_REJECTED;
    }

    // Accessors
    public fun state(dispute: &Dispute): u8 {
        dispute.state
    }

    public fun hunter(dispute: &Dispute): address {
        dispute.hunter
    }

    public fun bounty_id(dispute: &Dispute): ID {
        dispute.bounty_id
    }

    public fun submission_id(dispute: &Dispute): ID {
        dispute.submission_id
    }

    public fun outcome(dispute: &Dispute): u8 {
        dispute.outcome
    }

    public fun arbiter(dispute: &Dispute): address {
        dispute.arbiter
    }

    public fun resolved_at(dispute: &Dispute): u64 {
        dispute.resolved_at
    }

    public fun dispute_fee(dispute: &Dispute): u64 {
        dispute.dispute_fee
    }

    /// Check if hunter won the dispute
    public fun hunter_wins(dispute: &Dispute): bool {
        dispute.outcome == OUTCOME_HUNTER_WINS
    }

    /// Check if poster won the dispute
    public fun poster_wins(dispute: &Dispute): bool {
        dispute.outcome == OUTCOME_POSTER_WINS
    }

    #[test_only]
    public fun create_for_testing(
        bounty_id: ID,
        submission_id: ID,
        ctx: &mut TxContext
    ): Dispute {
        Dispute {
            id: object::new(ctx),
            hunter: ctx.sender(),
            bounty_id,
            submission_id,
            reason_blob_id: vector[],
            evidence_blob_id: vector[],
            state: STATE_OPEN,
            arbiter: @0x0,
            outcome: OUTCOME_NONE,
            resolved_at: 0,
            dispute_fee: 100_000_000,
        }
    }

    #[test_only]
    public fun destroy_for_testing(dispute: Dispute) {
        let Dispute { id, hunter: _, bounty_id: _, submission_id: _, reason_blob_id: _, evidence_blob_id: _, state: _, arbiter: _, outcome: _, resolved_at: _, dispute_fee: _ } = dispute;
        object::delete(id);
    }
}
