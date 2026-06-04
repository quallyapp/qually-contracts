module qually::milestone {
    use sui::clock::Clock;

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_INVALID_STATE: u64 = 1;
    const E_DEADLINE_NOT_REACHED: u64 = 2;
    const E_NOT_OVERDUE: u64 = 3;

    /// Milestone states
    const STATE_PENDING: u8 = 0;
    const STATE_SUBMITTED: u8 = 1;
    const STATE_APPROVED: u8 = 2;
    const STATE_REJECTED: u8 = 3;
    const STATE_OVERDUE: u8 = 4;

    /// Milestone object (on-chain tracking for Grant bounties)
    public struct Milestone has key, store {
        id: UID,
        bounty_id: ID,
        hunter: address,
        milestone_index: u8,
        description_blob_id: vector<u8>,
        delivery_blob_id: vector<u8>,
        deadline: u64,
        payout_amount: u64,
        state: u8,
        submitted_at: u64,
        approved_at: u64,
    }

    /// Create a milestone (called when Grant bounty is created)
    public fun create_milestone(
        bounty_id: ID,
        hunter: address,
        milestone_index: u8,
        description_blob_id: vector<u8>,
        deadline: u64,
        payout_amount: u64,
        ctx: &mut TxContext
    ) {
        let milestone = Milestone {
            id: object::new(ctx),
            bounty_id,
            hunter,
            milestone_index,
            description_blob_id,
            delivery_blob_id: vector[],
            deadline,
            payout_amount,
            state: STATE_PENDING,
            submitted_at: 0,
            approved_at: 0,
        };

        transfer::share_object(milestone);
    }

    /// Hunter submits milestone completion
    public fun submit_milestone(
        milestone: &mut Milestone,
        delivery_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == milestone.hunter, E_UNAUTHORIZED);
        assert!(milestone.state == STATE_PENDING || milestone.state == STATE_REJECTED, E_INVALID_STATE);

        milestone.state = STATE_SUBMITTED;
        milestone.delivery_blob_id = delivery_blob_id;
        milestone.submitted_at = clock.timestamp_ms();
    }

    /// Poster approves milestone
    public fun approve_milestone(
        milestone: &mut Milestone,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Note: In production, verify caller is bounty poster via cross-module call
        assert!(milestone.state == STATE_SUBMITTED, E_INVALID_STATE);

        milestone.state = STATE_APPROVED;
        milestone.approved_at = clock.timestamp_ms();
    }

    /// Poster rejects milestone (allows resubmission)
    public fun reject_milestone(
        milestone: &mut Milestone,
        ctx: &mut TxContext
    ) {
        assert!(milestone.state == STATE_SUBMITTED, E_INVALID_STATE);

        milestone.state = STATE_REJECTED;
        milestone.delivery_blob_id = vector[];
    }

    /// Escalate overdue milestone (anyone can call after deadline)
    public fun escalate_overdue(
        milestone: &mut Milestone,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(milestone.state == STATE_PENDING || milestone.state == STATE_SUBMITTED, E_INVALID_STATE);
        assert!(clock.timestamp_ms() > milestone.deadline, E_NOT_OVERDUE);

        milestone.state = STATE_OVERDUE;
    }

    // Accessors
    public fun state(milestone: &Milestone): u8 {
        milestone.state
    }

    public fun bounty_id(milestone: &Milestone): ID {
        milestone.bounty_id
    }

    public fun hunter(milestone: &Milestone): address {
        milestone.hunter
    }

    public fun milestone_index(milestone: &Milestone): u8 {
        milestone.milestone_index
    }

    public fun deadline(milestone: &Milestone): u64 {
        milestone.deadline
    }

    public fun payout_amount(milestone: &Milestone): u64 {
        milestone.payout_amount
    }

    public fun submitted_at(milestone: &Milestone): u64 {
        milestone.submitted_at
    }

    public fun approved_at(milestone: &Milestone): u64 {
        milestone.approved_at
    }

    #[test_only]
    public fun create_for_testing(
        bounty_id: ID,
        hunter: address,
        milestone_index: u8,
        deadline: u64,
        payout_amount: u64,
        ctx: &mut TxContext
    ): Milestone {
        Milestone {
            id: object::new(ctx),
            bounty_id,
            hunter,
            milestone_index,
            description_blob_id: vector[],
            delivery_blob_id: vector[],
            deadline,
            payout_amount,
            state: STATE_PENDING,
            submitted_at: 0,
            approved_at: 0,
        }
    }

    #[test_only]
    public fun destroy_for_testing(milestone: Milestone) {
        let Milestone { id, bounty_id: _, hunter: _, milestone_index: _, description_blob_id: _, delivery_blob_id: _, deadline: _, payout_amount: _, state: _, submitted_at: _, approved_at: _ } = milestone;
        object::delete(id);
    }
}
