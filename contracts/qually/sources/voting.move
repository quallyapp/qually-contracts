module qually::voting {
    use std::hash;
    use sui::bcs;

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_ALREADY_REVEALED: u64 = 1;
    const E_HASH_MISMATCH: u64 = 2;

    /// VoteCommit object
    public struct VoteCommit has key, store {
        id: UID,
        judge: address,
        bounty_id: ID,
        commit_hash: vector<u8>,
        revealed: bool,
        revealed_score: u64,
        revealed_submission_id: ID,
    }

    /// Commit a vote (hashed score and submission ID)
    #[allow(lint(self_transfer))]
    public fun commit_vote(
        bounty_id: ID,
        commit_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        let commit = VoteCommit {
            id: object::new(ctx),
            judge: ctx.sender(),
            bounty_id,
            commit_hash,
            revealed: false,
            revealed_score: 0,
            revealed_submission_id: object::id_from_address(@0x0),
        };

        transfer::public_transfer(commit, ctx.sender());
    }

    /// Reveal a previously committed vote
    public fun reveal_vote(
        commit: &mut VoteCommit,
        submission_id: ID,
        score: u64,
        nonce: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Only the judge who committed can reveal
        assert!(ctx.sender() == commit.judge, E_UNAUTHORIZED);
        assert!(!commit.revealed, E_ALREADY_REVEALED);

        // Verify hash: sha3_256(submission_id + score + nonce) == commit_hash
        let mut data = bcs::to_bytes(&submission_id);
        vector::append(&mut data, bcs::to_bytes(&score));
        vector::append(&mut data, nonce);
        let computed_hash = hash::sha3_256(data);
        assert!(computed_hash == commit.commit_hash, E_HASH_MISMATCH);

        commit.revealed = true;
        commit.revealed_score = score;
        commit.revealed_submission_id = submission_id;
    }

    // Accessors
    public fun judge(commit: &VoteCommit): address {
        commit.judge
    }

    public fun is_revealed(commit: &VoteCommit): bool {
        commit.revealed
    }

    public fun revealed_score(commit: &VoteCommit): u64 {
        commit.revealed_score
    }

    public fun bounty_id(commit: &VoteCommit): ID {
        commit.bounty_id
    }

    /// Calculate final score for a submission (Weighted: Poster vs Community)
    public fun tally_votes(
        poster_score: u64,
        community_scores: vector<u64>,
        poster_weight: u8,
    ): u64 {
        let comm_weight = 100 - (poster_weight as u64);
        let mut total_comm_score = 0u64;
        let comm_count = vector::length(&community_scores);

        if (comm_count == 0) {
            return poster_score
        };

        let mut i = 0;
        while (i < comm_count) {
            total_comm_score = total_comm_score + *vector::borrow(&community_scores, i);
            i = i + 1;
        };

        let avg_comm_score = total_comm_score / (comm_count as u64);

        ((poster_score * (poster_weight as u64)) + (avg_comm_score * comm_weight)) / 100
    }
}
