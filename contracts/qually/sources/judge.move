module qually::judge {
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self};

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_INVALID_STATE: u64 = 1;
    const E_ALREADY_APPLIED: u64 = 2;
    const E_NOT_APPLIED: u64 = 3;
    const E_JUDGE_FULL: u64 = 4;
    const E_INSUFFICIENT_STAKE: u64 = 5;
    const E_INVALID_TIER: u64 = 6;

    /// Judge tiers: 0=New, 1=Active, 2=Trusted, 3=Elite
    const TIER_NEW: u8 = 0;
    #[allow(unused_const)]
    const TIER_ACTIVE: u8 = 1;
    #[allow(unused_const)]
    const TIER_TRUSTED: u8 = 2;
    #[allow(unused_const)]
    const TIER_ELITE: u8 = 3;

    /// Minimum stake amounts by tier (in MIST)
    const STAKE_NEW: u64 = 100_000_000;      // 0.1 SUI
    #[allow(unused_const)]
    const STAKE_ACTIVE: u64 = 500_000_000;    // 0.5 SUI
    #[allow(unused_const)]
    const STAKE_TRUSTED: u64 = 1_000_000_000; // 1 SUI
    #[allow(unused_const)]
    const STAKE_ELITE: u64 = 2_000_000_000;   // 2 SUI

    /// JudgeProfile object (Non-transferable NFT)
    public struct JudgeProfile has key, store {
        id: UID,
        owner: address,
        tier: u8,
        reputation_score: u64,
        sessions_completed: u64,
        sessions_missed: u64,
        history_blob_id: vector<u8>,
        staked_balance: Balance<SUI>,
    }

    /// JudgeApplication object (shared for poster to review)
    public struct JudgeApplication has key, store {
        id: UID,
        judge: address,
        bounty_id: ID,
        judge_profile_id: ID,
        stake_amount: u64,
        application_blob_id: vector<u8>,
        state: u8,  // 0=Pending, 1=Approved, 2=Rejected
    }

    /// Application states
    const APP_PENDING: u8 = 0;
    const APP_APPROVED: u8 = 1;
    #[allow(unused_const)]
    const APP_REJECTED: u8 = 2;

    /// Mint a new JudgeProfile (starts at Tier 0)
    public fun mint_judge_profile(
        ctx: &mut TxContext
    ) {
        let profile = JudgeProfile {
            id: object::new(ctx),
            owner: ctx.sender(),
            tier: TIER_NEW,
            reputation_score: 0,
            sessions_completed: 0,
            sessions_missed: 0,
            history_blob_id: vector[],
            staked_balance: balance::zero(),
        };
        transfer::transfer(profile, ctx.sender());
    }

    /// Apply as judge for a bounty (with stake)
    public fun apply_as_judge(
        profile: &mut JudgeProfile,
        bounty_id: ID,
        stake: coin::Coin<SUI>,
        application_blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify profile ownership
        assert!(ctx.sender() == profile.owner, E_UNAUTHORIZED);

        // Verify stake meets minimum for tier
        let min_stake = get_min_stake(profile.tier);
        assert!(coin::value(&stake) >= min_stake, E_INSUFFICIENT_STAKE);

        // Create application
        let application = JudgeApplication {
            id: object::new(ctx),
            judge: ctx.sender(),
            bounty_id,
            judge_profile_id: object::id(profile),
            stake_amount: coin::value(&stake),
            application_blob_id,
            state: APP_PENDING,
        };

        // Lock stake into profile
        let stake_balance = coin::into_balance(stake);
        balance::join(&mut profile.staked_balance, stake_balance);

        // Share application for poster to review
        transfer::share_object(application);
    }

    /// Poster approves a judge application
    public fun approve_judge(
        application: &mut JudgeApplication,
        ctx: &mut TxContext
    ) {
        assert!(application.state == APP_PENDING, E_INVALID_STATE);
        application.state = APP_APPROVED;
    }

    /// Release stake back to judge after bounty completes
    public fun release_stake(
        profile: &mut JudgeProfile,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == profile.owner, E_UNAUTHORIZED);
        assert!(balance::value(&profile.staked_balance) >= amount, E_INSUFFICIENT_STAKE);

        let withdrawn = balance::split(&mut profile.staked_balance, amount);
        transfer::public_transfer(coin::from_balance(withdrawn, ctx), profile.owner);
    }

    /// Slash stake (called by dispute resolution)
    public(package) fun slash_stake(
        profile: &mut JudgeProfile,
        amount: u64,
    ) {
        let slashed = balance::split(&mut profile.staked_balance, amount);
        balance::destroy_zero(slashed);
    }

    /// Update judge reputation after completing a session (+10 base)
    public(package) fun update_reputation_completed(
        profile: &mut JudgeProfile,
    ) {
        profile.sessions_completed = profile.sessions_completed + 1;
        profile.reputation_score = profile.reputation_score + 10;
        upgrade_tier_if_eligible(profile);
    }

    /// Penalize judge for missing reveal deadline (-15 rep, slash stake)
    public(package) fun penalize_missed_reveal(
        profile: &mut JudgeProfile,
        slash_amount: u64,
        ctx: &mut TxContext
    ) {
        profile.sessions_missed = profile.sessions_missed + 1;
        if (profile.reputation_score >= 15) {
            profile.reputation_score = profile.reputation_score - 15;
        } else {
            profile.reputation_score = 0;
        };
        if (slash_amount > 0 && balance::value(&profile.staked_balance) >= slash_amount) {
            let slashed = balance::split(&mut profile.staked_balance, slash_amount);
            // Transfer slashed amount to poster as penalty reward
            transfer::public_transfer(coin::from_balance(slashed, ctx), profile.owner);
        };
    }

    /// Check and upgrade tier based on reputation thresholds
    fun upgrade_tier_if_eligible(profile: &mut JudgeProfile) {
        // Tier 3 (Elite): 1000+ rep AND 10+ sessions
        if (profile.tier < 3 && profile.reputation_score >= 1000 && profile.sessions_completed >= 10) {
            profile.tier = 3;
            return
        };
        // Tier 2 (Trusted): 500+ rep
        if (profile.tier < 2 && profile.reputation_score >= 500) {
            profile.tier = 2;
            return
        };
        // Tier 1 (Active): 200+ rep
        if (profile.tier < 1 && profile.reputation_score >= 200) {
            profile.tier = 1;
        };
    }

    /// Get minimum stake for tier
    fun get_min_stake(tier: u8): u64 {
        if (tier == TIER_NEW) { STAKE_NEW }
        else if (tier == 1) { STAKE_ACTIVE }
        else if (tier == 2) { STAKE_TRUSTED }
        else { STAKE_ELITE }
    }

    // Accessors
    public fun tier(profile: &JudgeProfile): u8 {
        profile.tier
    }

    public fun reputation_score(profile: &JudgeProfile): u64 {
        profile.reputation_score
    }

    public fun owner(profile: &JudgeProfile): address {
        profile.owner
    }

    public fun staked_balance(profile: &JudgeProfile): u64 {
        balance::value(&profile.staked_balance)
    }

    public fun sessions_completed(profile: &JudgeProfile): u64 {
        profile.sessions_completed
    }

    public fun sessions_missed(profile: &JudgeProfile): u64 {
        profile.sessions_missed
    }

    public fun application_judge(application: &JudgeApplication): address {
        application.judge
    }

    public fun application_state(application: &JudgeApplication): u8 {
        application.state
    }

    public fun application_bounty_id(application: &JudgeApplication): ID {
        application.bounty_id
    }

    #[test_only]
    public fun create_for_testing(ctx: &mut TxContext): JudgeProfile {
        JudgeProfile {
            id: object::new(ctx),
            owner: ctx.sender(),
            tier: TIER_NEW,
            reputation_score: 0,
            sessions_completed: 0,
            sessions_missed: 0,
            history_blob_id: vector[],
            staked_balance: balance::zero(),
        }
    }

    #[test_only]
    public fun destroy_for_testing(profile: JudgeProfile) {
        let JudgeProfile { id, owner: _, tier: _, reputation_score: _, sessions_completed: _, sessions_missed: _, history_blob_id: _, staked_balance } = profile;
        object::delete(id);
        balance::destroy_for_testing(staked_balance);
    }
}
