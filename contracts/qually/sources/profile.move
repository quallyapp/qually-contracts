module qually::profile {
    use std::string::String;

    /// PosterProfile object created on-chain, tracking payout rate, 
    /// average close time, and dispute history.
    public struct PosterProfile has key, store {
        id: UID,
        owner: address,
        name: String,
        bio_blob_id: vector<u8>,        // Walrus blob ID for bio/portfolio
        payout_rate: u64,               // Percentage (scaled)
        avg_close_time: u64,            // In seconds
        dispute_count: u64,
        total_bounties_posted: u64,
        total_paid: u64,
    }

    /// Hunter stats and reputation scoring
    public struct HunterProfile has key, store {
        id: UID,
        owner: address,
        name: String,
        bio_blob_id: vector<u8>,        // Walrus blob ID
        reputation_score: u64,
        total_bounties_won: u64,
        total_earned: u64,
        skill_tags: vector<String>,
    }

    /// Create a new PosterProfile
    #[allow(lint(self_transfer))]
    public fun create_poster_profile(
        name: String,
        bio_blob_id: vector<u8>,
        ctx: &mut TxContext
    ) {
        let profile = PosterProfile {
            id: object::new(ctx),
            owner: ctx.sender(),
            name,
            bio_blob_id,
            payout_rate: 0,
            avg_close_time: 0,
            dispute_count: 0,
            total_bounties_posted: 0,
            total_paid: 0,
        };
        transfer::public_transfer(profile, ctx.sender());
    }

    /// Create a new HunterProfile
    #[allow(lint(self_transfer))]
    public fun create_hunter_profile(
        name: String,
        bio_blob_id: vector<u8>,
        skill_tags: vector<String>,
        ctx: &mut TxContext
    ) {
        let profile = HunterProfile {
            id: object::new(ctx),
            owner: ctx.sender(),
            name,
            bio_blob_id,
            reputation_score: 0,
            total_bounties_won: 0,
            total_earned: 0,
            skill_tags,
        };
        transfer::public_transfer(profile, ctx.sender());
    }
}
