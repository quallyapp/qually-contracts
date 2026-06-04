module qually::payout {
    use sui::balance::{Self};
    use sui::coin;
    use qually::treasury::{Self, Treasury};
    use qually::bounty::{Self, Bounty};
    use qually::judge::{Self, JudgeProfile};

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_INVALID_STATE: u64 = 1;
    const E_INVALID_SPLIT: u64 = 2;

    /// Platform fee percentage (3%)
    const PLATFORM_FEE: u64 = 3;

    /// Finalize a Fixed bounty (100% to one winner)
    public fun finalize_fixed(
        bounty: &mut Bounty,
        winner: address,
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty::poster(bounty), E_UNAUTHORIZED);
        assert!(bounty::state(bounty) == 2, E_INVALID_STATE); // STATE_FINALIZED

        let prize_pool = bounty::prize_pool_mut(bounty);
        let total_value = balance::value(prize_pool);
        let fee_amount = (total_value * PLATFORM_FEE) / 100;
        let winner_amount = total_value - fee_amount;

        let fee = balance::split(prize_pool, fee_amount);
        treasury::deposit(treasury, fee);

        let winner_prize = balance::split(prize_pool, winner_amount);
        transfer::public_transfer(coin::from_balance(winner_prize, ctx), winner);
    }

    /// Finalize a Contest bounty (multiple winners with ranked splits)
    public fun finalize_contest(
        bounty: &mut Bounty,
        winners: vector<address>,
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty::poster(bounty), E_UNAUTHORIZED);
        assert!(bounty::state(bounty) == 2, E_INVALID_STATE); // STATE_FINALIZED

        let splits = bounty::contest_splits(bounty);
        let winner_count = vector::length(&winners);
        let split_count = vector::length(&splits);
        assert!(split_count == winner_count, E_INVALID_SPLIT);

        let prize_pool = bounty::prize_pool_mut(bounty);
        let total_value = balance::value(prize_pool);
        let fee_amount = (total_value * PLATFORM_FEE) / 100;

        let fee = balance::split(prize_pool, fee_amount);
        treasury::deposit(treasury, fee);

        let distributable = total_value - fee_amount;
        let mut i = 0;
        while (i < winner_count) {
            let split_pct = *vector::borrow(&splits, i) as u64;
            let winner_amount = (distributable * split_pct) / 100;
            let winner_prize = balance::split(prize_pool, winner_amount);
            let winner_addr = *vector::borrow(&winners, i);
            transfer::public_transfer(coin::from_balance(winner_prize, ctx), winner_addr);
            i = i + 1;
        };
    }

    /// Update judge reputation after completing a session (+10 base)
    public fun update_judge_reputation(
        judge_profile: &mut JudgeProfile,
    ) {
        judge::update_reputation_completed(judge_profile);
    }

    /// Slash a judge who missed reveal deadline (-15 rep, slash stake)
    public fun slash_judge_for_missed_reveal(
        judge_profile: &mut JudgeProfile,
        slash_amount: u64,
        ctx: &mut TxContext
    ) {
        judge::penalize_missed_reveal(judge_profile, slash_amount, ctx);
    }

    /// Milestone release for Grant type
    public fun release_milestone(
        bounty: &mut Bounty,
        hunter: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == bounty::poster(bounty), E_UNAUTHORIZED);

        let prize_pool = bounty::prize_pool_mut(bounty);
        let milestone_prize = balance::split(prize_pool, amount);
        transfer::public_transfer(coin::from_balance(milestone_prize, ctx), hunter);
    }
}
