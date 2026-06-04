module qually::bounty {
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use std::string::String;

    /// Error codes
    const E_INVALID_WEIGHT: u64 = 0;
    const E_INVALID_STATE: u64 = 1;
    const E_UNAUTHORIZED: u64 = 2;
    const E_DEADLINE_NOT_REACHED: u64 = 3;
    const E_INVALID_BOUNTY_TYPE: u64 = 4;
    const E_INVALID_SPLITS: u64 = 5;
    const E_JUDGE_NOT_APPROVED: u64 = 6;
    const E_NO_WINNERS: u64 = 7;
    const E_HAS_SUBMISSIONS: u64 = 8;
    const E_NOT_ALLOWED: u64 = 9;
    const E_ALREADY_SUBMITTED: u64 = 10;
    const E_VETO_WINDOW_CLOSED: u64 = 11;
    const E_AUTO_EXTEND_NOT_CONFIGURED: u64 = 12;
    const E_MIN_SUBMISSIONS_NOT_MET: u64 = 13;

    /// Bounty types
    #[allow(unused_const)]
    const TYPE_FIXED: u8 = 0;
    #[allow(unused_const)]
    const TYPE_CONTEST: u8 = 1;
    #[allow(unused_const)]
    const TYPE_GRANT: u8 = 2;

    /// Bounty states
    const STATE_OPEN: u8 = 0;
    const STATE_REVIEW: u8 = 1;
    const STATE_FINALIZED: u8 = 2;
    const STATE_CLOSED: u8 = 3;

    /// Core Bounty object
    public struct Bounty has key, store {
        id: UID,
        poster: address,
        bounty_type: u8,
        state: u8,
        prize_pool: Balance<SUI>,
        brief_blob_id: vector<u8>,
        brief_content_hash: vector<u8>,
        submission_deadline: u64,
        judging_deadline: u64,
        poster_weight: u8,
        max_judges: u8,
        submissions_visible: bool,
        contest_splits: vector<u8>,
        is_recurring: bool,
        auto_extend: bool,
        category_tags: vector<String>,
        approved_judges: vector<address>,
        judge_count: u8,
        veto_used: bool,
        submission_count: u64,
        is_gated: bool,
        allowed_submitters: vector<address>,
        submitted_addresses: vector<address>,
    }

    /// Create a new Bounty
    public fun create_bounty(
        payment: Coin<SUI>,
        bounty_type: u8,
        brief_blob_id: vector<u8>,
        brief_content_hash: vector<u8>,
        submission_deadline: u64,
        judging_deadline: u64,
        poster_weight: u8,
        max_judges: u8,
        contest_splits: vector<u8>,
        is_recurring: bool,
        auto_extend: bool,
        category_tags: vector<String>,
        ctx: &mut TxContext
    ) {
        assert!(bounty_type <= TYPE_GRANT, E_INVALID_BOUNTY_TYPE);
        assert!(poster_weight >= 30 && poster_weight <= 70, E_INVALID_WEIGHT);
        assert!(max_judges >= 1 && max_judges <= 7, E_INVALID_WEIGHT);
        assert!(submission_deadline > ctx.epoch_timestamp_ms(), E_DEADLINE_NOT_REACHED);
        assert!(judging_deadline > submission_deadline, E_DEADLINE_NOT_REACHED);

        if (bounty_type == TYPE_CONTEST && vector::length(&contest_splits) > 0) {
            let mut total_split = 0u8;
            let mut i = 0;
            while (i < vector::length(&contest_splits)) {
                total_split = total_split + *vector::borrow(&contest_splits, i);
                i = i + 1;
            };
            assert!(total_split == 100, E_INVALID_SPLITS);
        };

        let poster = ctx.sender();
        let prize_pool = payment.into_balance();

        let bounty = Bounty {
            id: object::new(ctx),
            poster,
            bounty_type,
            state: STATE_OPEN,
            prize_pool,
            brief_blob_id,
            brief_content_hash,
            submission_deadline,
            judging_deadline,
            poster_weight,
            max_judges,
            submissions_visible: false,
            contest_splits,
            is_recurring,
            auto_extend,
            category_tags,
            approved_judges: vector[],
            judge_count: 0,
            veto_used: false,
            submission_count: 0,
            is_gated: false,
            allowed_submitters: vector[],
            submitted_addresses: vector[],
        };

        transfer::share_object(bounty);
    }

    /// Poster approves a judge for this bounty
    public fun approve_judge_for_bounty(
        bounty: &mut Bounty,
        judge: address,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);
        assert!(bounty.judge_count < bounty.max_judges, E_JUDGE_NOT_APPROVED);

        // Check judge not already approved
        let mut i = 0;
        while (i < vector::length(&bounty.approved_judges)) {
            assert!(*vector::borrow(&bounty.approved_judges, i) != judge, E_JUDGE_NOT_APPROVED);
            i = i + 1;
        };

        vector::push_back(&mut bounty.approved_judges, judge);
        bounty.judge_count = bounty.judge_count + 1;
    }

    /// Transition bounty to REVIEW state
    public fun start_review(
        bounty: &mut Bounty,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);
        assert!(clock.timestamp_ms() >= bounty.submission_deadline, E_DEADLINE_NOT_REACHED);

        bounty.state = STATE_REVIEW;
        bounty.submissions_visible = true;
    }

    /// Finalize bounty after judging complete
    public fun finalize_bounty(
        bounty: &mut Bounty,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_REVIEW, E_INVALID_STATE);
        assert!(clock.timestamp_ms() >= bounty.judging_deadline, E_DEADLINE_NOT_REACHED);

        bounty.state = STATE_FINALIZED;
    }

    /// Poster vetoes the outcome (one-time only, within 48h of finalization)
    public fun veto_result(
        bounty: &mut Bounty,
        finalized_at: u64,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_FINALIZED, E_INVALID_STATE);
        assert!(!bounty.veto_used, E_INVALID_STATE);

        // 48h = 172,800,000 ms
        let veto_deadline = finalized_at + 172_800_000;
        assert!(clock.timestamp_ms() <= veto_deadline, E_VETO_WINDOW_CLOSED);

        bounty.veto_used = true;
        bounty.state = STATE_REVIEW; // Return to review
    }

    /// Close bounty after payout
    public fun close_bounty(
        bounty: &mut Bounty,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_FINALIZED, E_INVALID_STATE);

        bounty.state = STATE_CLOSED;
    }

    /// Anyone can add SUI to a live bounty's prize pool (before judging starts)
    public fun boost_prize_pool(
        bounty: &mut Bounty,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);

        let boost_balance = payment.into_balance();
        balance::join(&mut bounty.prize_pool, boost_balance);
    }

    /// Auto-extend deadline if fewer than 2 submissions received (poster only, near deadline)
    public fun auto_extend(
        bounty: &mut Bounty,
        extension_ms: u64,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);
        assert!(bounty.auto_extend, E_AUTO_EXTEND_NOT_CONFIGURED);
        assert!(bounty.submission_count < 2, E_MIN_SUBMISSIONS_NOT_MET);

        // Only allow extend if within 24h of deadline
        assert!(clock.timestamp_ms() + 86_400_000 >= bounty.submission_deadline, E_DEADLINE_NOT_REACHED);

        bounty.submission_deadline = bounty.submission_deadline + extension_ms;
    }

    /// Refund empty bounty (no submissions) - poster only
    public fun refund_empty_bounty(
        bounty: &mut Bounty,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);
        assert!(balance::value(&bounty.prize_pool) > 0, E_INVALID_STATE);
        assert!(bounty.submission_count == 0, E_HAS_SUBMISSIONS);

        let total = balance::value(&bounty.prize_pool);
        let refund = balance::split(&mut bounty.prize_pool, total);
        transfer::public_transfer(coin::from_balance(refund, ctx), bounty.poster);

        bounty.state = STATE_CLOSED;
    }

    /// Auto-refund: anyone can call if deadline passed and no submissions
    public fun refund_expired_bounty(
        bounty: &mut Bounty,
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ) {
        assert!(bounty.state == STATE_OPEN, E_INVALID_STATE);
        assert!(balance::value(&bounty.prize_pool) > 0, E_INVALID_STATE);
        assert!(bounty.submission_count == 0, E_HAS_SUBMISSIONS);
        assert!(clock.timestamp_ms() > bounty.submission_deadline, E_DEADLINE_NOT_REACHED);

        let total = balance::value(&bounty.prize_pool);
        let refund = balance::split(&mut bounty.prize_pool, total);
        transfer::public_transfer(coin::from_balance(refund, ctx), bounty.poster);

        bounty.state = STATE_CLOSED;
    }

    /// Increment submission count (called by submission module)
    public(package) fun increment_submission_count(bounty: &mut Bounty) {
        bounty.submission_count = bounty.submission_count + 1;
    }

    /// Set gated mode on a bounty (poster only, before any submissions)
    public fun set_gated(
        bounty: &mut Bounty,
        is_gated: bool,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.submission_count == 0, E_HAS_SUBMISSIONS);
        bounty.is_gated = is_gated;
    }

    /// Add an address to the allowed submitters list (poster only)
    public fun add_allowed_submitter(
        bounty: &mut Bounty,
        submitter: address,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.is_gated, E_INVALID_STATE);

        let mut i = 0;
        while (i < vector::length(&bounty.allowed_submitters)) {
            assert!(*vector::borrow(&bounty.allowed_submitters, i) != submitter, E_NOT_ALLOWED);
            i = i + 1;
        };

        vector::push_back(&mut bounty.allowed_submitters, submitter);
    }

    /// Remove an address from the allowed submitters list (poster only)
    public fun remove_allowed_submitter(
        bounty: &mut Bounty,
        submitter: address,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty.poster, E_UNAUTHORIZED);
        assert!(bounty.is_gated, E_INVALID_STATE);

        let mut i = 0;
        while (i < vector::length(&bounty.allowed_submitters)) {
            if (*vector::borrow(&bounty.allowed_submitters, i) == submitter) {
                vector::remove(&mut bounty.allowed_submitters, i);
                return
            };
            i = i + 1;
        };
    }

    /// Check if a submitter is allowed to submit
    public fun is_submitter_allowed(bounty: &Bounty, submitter: address): bool {
        if (!bounty.is_gated) return true;

        let mut i = 0;
        while (i < vector::length(&bounty.allowed_submitters)) {
            if (*vector::borrow(&bounty.allowed_submitters, i) == submitter) return true;
            i = i + 1;
        };
        false
    }

    /// Check if an address has already submitted (duplicate prevention)
    public fun has_submitted(bounty: &Bounty, submitter: address): bool {
        let mut i = 0;
        while (i < vector::length(&bounty.submitted_addresses)) {
            if (*vector::borrow(&bounty.submitted_addresses, i) == submitter) return true;
            i = i + 1;
        };
        false
    }

    /// Record that an address has submitted (called by submission module)
    public(package) fun record_submission(bounty: &mut Bounty, submitter: address) {
        vector::push_back(&mut bounty.submitted_addresses, submitter);
    }

    // Accessors
    public fun state(bounty: &Bounty): u8 {
        bounty.state
    }

    public fun poster(bounty: &Bounty): address {
        bounty.poster
    }

    public fun prize_pool_value(bounty: &Bounty): u64 {
        balance::value(&bounty.prize_pool)
    }

    public fun submissions_visible(bounty: &Bounty): bool {
        bounty.submissions_visible
    }

    public fun bounty_type(bounty: &Bounty): u8 {
        bounty.bounty_type
    }

    public fun poster_weight(bounty: &Bounty): u8 {
        bounty.poster_weight
    }

    public fun submission_deadline(bounty: &Bounty): u64 {
        bounty.submission_deadline
    }

    public fun judging_deadline(bounty: &Bounty): u64 {
        bounty.judging_deadline
    }

    public fun contest_splits(bounty: &Bounty): vector<u8> {
        bounty.contest_splits
    }

    public fun approved_judges(bounty: &Bounty): vector<address> {
        bounty.approved_judges
    }

    public fun judge_count(bounty: &Bounty): u8 {
        bounty.judge_count
    }

    public fun max_judges(bounty: &Bounty): u8 {
        bounty.max_judges
    }

    public fun veto_used(bounty: &Bounty): bool {
        bounty.veto_used
    }

    public fun submission_count(bounty: &Bounty): u64 {
        bounty.submission_count
    }

    public fun has_submissions(bounty: &Bounty): bool {
        bounty.submission_count > 0
    }

    public fun is_gated(bounty: &Bounty): bool {
        bounty.is_gated
    }

    public fun allowed_submitters(bounty: &Bounty): vector<address> {
        bounty.allowed_submitters
    }

    public fun submitted_addresses(bounty: &Bounty): vector<address> {
        bounty.submitted_addresses
    }

    public fun id(bounty: &Bounty): ID {
        object::id(bounty)
    }

    /// Internal: get mutable reference to prize pool
    public(package) fun prize_pool_mut(bounty: &mut Bounty): &mut Balance<SUI> {
        &mut bounty.prize_pool
    }
}
