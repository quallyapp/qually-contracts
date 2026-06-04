module qually::submission {
    use sui::clock::Clock;
    use qually::bounty::{Self, Bounty};

    /// Error codes
    const E_INVALID_SPLITS: u64 = 0;
    const E_EMPTY_COLLABORATORS: u64 = 1;
    const E_BOUNTY_NOT_OPEN: u64 = 2;
    const E_SUBMISSION_DEADLINE_PASSED: u64 = 3;
    const E_NOT_ALLOWED: u64 = 4;
    const E_ALREADY_SUBMITTED: u64 = 5;

    /// Submission object (NFT)
    public struct Submission has key, store {
        id: UID,
        bounty_id: ID,
        lead_hunter: address,
        collaborators: vector<address>,
        payout_splits: vector<u8>,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        submitted_at: u64,
        is_sealed: bool,
    }

    /// Submit work for a bounty
    #[allow(lint(self_transfer))]
    public fun submit_work(
        bounty: &mut Bounty,
        collaborators: vector<address>,
        payout_splits: vector<u8>,
        blob_id: vector<u8>,
        content_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify bounty is open
        assert!(bounty::state(bounty) == 0, E_BOUNTY_NOT_OPEN); // STATE_OPEN

        // Verify submission deadline has not passed
        assert!(clock.timestamp_ms() < bounty::submission_deadline(bounty), E_SUBMISSION_DEADLINE_PASSED);

        // Check gated mode
        assert!(bounty::is_submitter_allowed(bounty, ctx.sender()), E_NOT_ALLOWED);

        // Prevent duplicate submissions
        assert!(!bounty::has_submitted(bounty, ctx.sender()), E_ALREADY_SUBMITTED);

        let split_count = vector::length(&payout_splits);
        let collab_count = vector::length(&collaborators);

        // If no collaborators, splits should be empty (100% to lead)
        if (collab_count == 0) {
            assert!(split_count == 0, E_INVALID_SPLITS);
        } else {
            // With collaborators, splits must sum to 100
            assert!(split_count == collab_count + 1, E_INVALID_SPLITS); // +1 for lead
            let mut total_split = 0u8;
            let mut i = 0;
            while (i < split_count) {
                total_split = total_split + *vector::borrow(&payout_splits, i);
                i = i + 1;
            };
            assert!(total_split == 100, E_INVALID_SPLITS);
        };

        let bounty_id = bounty::id(bounty);

        let submission = Submission {
            id: object::new(ctx),
            bounty_id,
            lead_hunter: ctx.sender(),
            collaborators,
            payout_splits,
            blob_id,
            content_hash,
            submitted_at: clock.timestamp_ms(),
            is_sealed: true,
        };

        // Increment bounty submission count
        bounty::increment_submission_count(bounty);

        // Record submitter for duplicate prevention
        bounty::record_submission(bounty, ctx.sender());

        transfer::public_transfer(submission, ctx.sender());
    }

    // Accessors
    public fun lead_hunter(submission: &Submission): address {
        submission.lead_hunter
    }

    public fun is_sealed(submission: &Submission): bool {
        submission.is_sealed
    }

    public fun bounty_id(submission: &Submission): ID {
        submission.bounty_id
    }

    public fun collaborators(submission: &Submission): vector<address> {
        submission.collaborators
    }

    public fun payout_splits(submission: &Submission): vector<u8> {
        submission.payout_splits
    }
}
