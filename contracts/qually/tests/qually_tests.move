#[test_only]
module qually::qually_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use std::string;

    use qually::profile::{PosterProfile, HunterProfile};
    use qually::judge::{Self, JudgeProfile};
    use qually::bounty::{Self, Bounty};
    use qually::submission::{Self, Submission};
    use qually::voting::{Self, VoteCommit};
    use qually::treasury::{Self, Treasury};
    use qually::milestone::{Self, Milestone};
    use qually::dispute::{Self, Dispute};

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;
    const ADDR3: address = @0xC;

    // =================== PROFILE TESTS ===================

    #[test]
    fun test_profile_creation() {
        let mut scenario = ts::begin(ADDR1);

        {
            qually::profile::create_poster_profile(
                string::utf8(b"Alice Poster"),
                b"poster_bio_blob_id",
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let profile = ts::take_from_sender<PosterProfile>(&scenario);
            ts::return_to_sender(&scenario, profile);
        };

        {
            let mut tags = vector[];
            vector::push_back(&mut tags, string::utf8(b"Move"));
            qually::profile::create_hunter_profile(
                string::utf8(b"Bob Hunter"),
                b"hunter_bio_blob_id",
                tags,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let profile = ts::take_from_sender<HunterProfile>(&scenario);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    // =================== JUDGE TESTS ===================

    #[test]
    fun test_judge_mint() {
        let mut scenario = ts::begin(ADDR1);

        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let profile = ts::take_from_sender<JudgeProfile>(&scenario);
            assert!(judge::tier(&profile) == 0, 0);
            assert!(judge::reputation_score(&profile) == 0, 1);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_judge_apply_and_approve() {
        let mut scenario = ts::begin(ADDR1);

        // 1. Mint judge profile
        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        // 2. Apply as judge with stake
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            let bounty_id = object::id_from_address(@0x123);
            let stake = coin::mint_for_testing<SUI>(100_000_000, ts::ctx(&mut scenario)); // 0.1 SUI

            judge::apply_as_judge(
                &mut profile,
                bounty_id,
                stake,
                b"application_blob",
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, profile);
        };

        // 3. Verify application created
        ts::next_tx(&mut scenario, ADDR1);
        {
            let application = ts::take_shared<judge::JudgeApplication>(&scenario);
            assert!(judge::application_judge(&application) == ADDR1, 0);
            assert!(judge::application_state(&application) == 0, 1); // Pending
            ts::return_shared(application);
        };

        // 4. Approve judge
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut application = ts::take_shared<judge::JudgeApplication>(&scenario);
            judge::approve_judge(&mut application, ts::ctx(&mut scenario));
            assert!(judge::application_state(&application) == 1, 2); // Approved
            ts::return_shared(application);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_judge_stake_release() {
        let mut scenario = ts::begin(ADDR1);

        // Mint and stake
        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            let bounty_id = object::id_from_address(@0x123);
            let stake = coin::mint_for_testing<SUI>(100_000_000, ts::ctx(&mut scenario));

            judge::apply_as_judge(&mut profile, bounty_id, stake, b"app", ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Release stake
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            judge::release_stake(&mut profile, 50_000_000, ts::ctx(&mut scenario));
            assert!(judge::staked_balance(&profile) == 50_000_000, 0);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    // =================== BOUNTY TESTS ===================

    #[test]
    fun test_bounty_creation() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            let mut tags = vector[];
            vector::push_back(&mut tags, string::utf8(b"Infrastructure"));

            bounty::create_bounty(
                &mut registry,
                payment,
                0,
                b"brief_blob_id",
                b"brief_hash",
                1000,
                2000,
                50,
                3,
                vector[],
                false,
                false,
                tags,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let bounty = ts::take_shared<Bounty>(&scenario);
            assert!(bounty::state(&bounty) == 0, 0);
            assert!(bounty::prize_pool_value(&bounty) == 1000, 1);
            assert!(bounty::poster(&bounty) == ADDR1, 2);
            assert!(bounty::poster_weight(&bounty) == 50, 3);
            ts::return_shared(bounty);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_INVALID_WEIGHT)]
    fun test_bounty_invalid_weight_too_low() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000,
                20,
                3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_INVALID_WEIGHT)]
    fun test_bounty_invalid_weight_too_high() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000,
                80,
                3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_bounty_approve_judge() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        // Poster approves judge
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::approve_judge_for_bounty(&mut bounty, ADDR2, ts::ctx(&mut scenario));
            assert!(bounty::judge_count(&bounty) == 1, 0);
            ts::return_shared(bounty);
        };

        // Verify judge in list
        ts::next_tx(&mut scenario, ADDR1);
        {
            let bounty = ts::take_shared<Bounty>(&scenario);
            let judges = bounty::approved_judges(&bounty);
            assert!(vector::length(&judges) == 1, 0);
            assert!(*vector::borrow(&judges, 0) == ADDR2, 1);
            ts::return_shared(bounty);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_bounty_veto() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        // Start review
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1001);
            bounty::start_review(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Finalize at time 2001
        let finalized_at = 2001u64;
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(finalized_at);
            bounty::finalize_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 2, 0);
            ts::return_shared(bounty);
        };

        // Veto within 48h (should succeed)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(finalized_at + 1000); // well within 48h
            bounty::veto_result(&mut bounty, finalized_at, &clock, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 1, 1); // Back to REVIEW
            assert!(bounty::veto_used(&bounty) == true, 2);
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_VETO_WINDOW_CLOSED)]
    fun test_bounty_veto_after_48h_fails() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        // Start review
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1001);
            bounty::start_review(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Finalize
        let finalized_at = 2001u64;
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(finalized_at);
            bounty::finalize_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Veto after 48h (should fail)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(finalized_at + 172_800_001); // 48h + 1ms
            bounty::veto_result(&mut bounty, finalized_at, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_INVALID_STATE)]
    fun test_bounty_veto_twice_fails() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create, review, finalize
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1001);
            bounty::start_review(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(2001);
            bounty::finalize_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // First veto (succeeds)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::veto_result(&mut bounty, 2001, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Finalize again
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(3001);
            bounty::finalize_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Second veto (should fail — already used)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::veto_result(&mut bounty, 3001, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== SUBMISSION TESTS ===================

    #[test]
    fun test_submission() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 500);

        // Create a real bounty first
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment,
                0,
                b"brief_blob_id",
                b"brief_hash",
                1000,
                2000,
                50,
                3,
                vector[],
                false,
                false,
                vector[],
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty,
                vector[],
                vector[],
                b"work_blob_id",
                b"work_hash",
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let sub = ts::take_from_sender<Submission>(&scenario);
            assert!(submission::is_sealed(&sub) == true, 0);
            assert!(submission::lead_hunter(&sub) == ADDR1, 1);
            ts::return_to_sender(&scenario, sub);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== VOTING TESTS ===================

    #[test]
    fun test_commit_vote() {
        let mut scenario = ts::begin(ADDR2);

        let bounty_id = object::id_from_address(@0x1);
        {
            qually::voting::commit_vote(
                bounty_id,
                b"hashed_score",
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR2);
        {
            let commit = ts::take_from_sender<VoteCommit>(&scenario);
            assert!(qually::voting::judge(&commit) == ADDR2, 0);
            assert!(qually::voting::is_revealed(&commit) == false, 1);
            assert!(qually::voting::bounty_id(&commit) == bounty_id, 2);
            ts::return_to_sender(&scenario, commit);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = voting::E_UNAUTHORIZED)]
    fun test_reveal_vote_wrong_sender() {
        let mut scenario = ts::begin(ADDR1);

        {
            qually::voting::commit_vote(
                object::id_from_address(@0x1),
                b"hashed_score",
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut commit = ts::take_from_sender<VoteCommit>(&scenario);
            transfer::public_transfer(commit, ADDR2);
        };

        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut commit = ts::take_from_sender<VoteCommit>(&scenario);
            let sub_id = object::id_from_address(@0x999);
            let nonce = b"nonce";
            let score = 85u64;

            qually::voting::reveal_vote(&mut commit, sub_id, score, nonce, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, commit);
        };

        ts::end(scenario);
    }

    // =================== BOUNTY LIFECYCLE TEST ===================

    #[test]
    fun test_bounty_lifecycle() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1001);
            bounty::start_review(&mut bounty, &clock, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 1, 0);
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(2001);
            bounty::finalize_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 2, 1);
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::close_bounty(&mut bounty, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 3, 2);
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== REFUND TEST ===================

    #[test]
    fun test_refund_empty_bounty() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::refund_empty_bounty(&mut bounty, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 3, 0);
            assert!(bounty::prize_pool_value(&bounty) == 0, 1);
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let coin = ts::take_from_address<Coin<SUI>>(&scenario, ADDR1);
            assert!(coin::value(&coin) == 1000, 2);
            ts::return_to_address(ADDR1, coin);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_refund_expired_bounty() {
        let mut scenario = ts::begin(ADDR2); // ADDR2 calls (anyone can)
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty with deadline at 1000 (epoch_timestamp_ms() is 0 in tests)
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        // Advance past deadline
        clock::set_for_testing(&mut clock, 1500);

        // Refund succeeds (ADDR2, not poster)
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::refund_expired_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            assert!(bounty::state(&bounty) == 3, 0); // STATE_CLOSED
            assert!(bounty::prize_pool_value(&bounty) == 0, 1);
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_DEADLINE_NOT_REACHED)]
    fun test_refund_expired_bounty_before_deadline() {
        let mut scenario = ts::begin(ADDR2);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty with deadline at 1000
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"b", b"h", 1000, 2000, 50, 3, vector[], false, false, vector[],
                ts::ctx(&mut scenario)
            );
        };

        // Try refund before deadline (clock at 500) - should fail
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::refund_expired_bounty(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== TREASURY TESTS ===================

    #[test]
    fun test_treasury_deposit_and_withdraw() {
        let mut scenario = ts::begin(ADDR1);

        let mut treasury = qually::treasury::create_for_testing(ts::ctx(&mut scenario));
        let deposit = sui::balance::create_for_testing<SUI>(500);
        qually::treasury::deposit(&mut treasury, deposit);

        {
            qually::treasury::withdraw(&mut treasury, 200, ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let coin = ts::take_from_address<Coin<SUI>>(&scenario, ADDR1);
            assert!(coin::value(&coin) == 200, 0);
            ts::return_to_address(ADDR1, coin);
            assert!(qually::treasury::balance(&treasury) == 300, 1);
            assert!(qually::treasury::admin(&treasury) == ADDR1, 2);
        };

        qually::treasury::destroy_for_testing(treasury);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = treasury::E_UNAUTHORIZED)]
    fun test_treasury_withdrawal_unauthorized() {
        let mut scenario = ts::begin(ADDR1);

        let mut treasury = qually::treasury::create_for_testing(ts::ctx(&mut scenario));
        let deposit = sui::balance::create_for_testing<SUI>(500);
        qually::treasury::deposit(&mut treasury, deposit);

        ts::next_tx(&mut scenario, ADDR2);
        {
            qually::treasury::withdraw(&mut treasury, 200, ts::ctx(&mut scenario));
        };

        qually::treasury::destroy_for_testing(treasury);
        ts::end(scenario);
    }

    // =================== DISPUTE TESTS ===================

    #[test]
    fun test_dispute_opening() {
        let mut scenario = ts::begin(ADDR1);
        let bounty_id = object::id_from_address(@0x1);
        let sub_id = object::id_from_address(@0x2);

        {
            qually::dispute::open_dispute(
                bounty_id,
                sub_id,
                b"reason_blob_id",
                100_000_000,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let dispute = ts::take_shared<Dispute>(&scenario);
            assert!(qually::dispute::state(&dispute) == 0, 0);
            ts::return_shared(dispute);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_dispute_evidence_and_resolve() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Open dispute
        ts::next_tx(&mut scenario, ADDR1);
        {
            let bounty = ts::take_shared<Bounty>(&scenario);
            let bounty_id = bounty::id(&bounty);
            ts::return_shared(bounty);

            qually::dispute::open_dispute(
                bounty_id,
                object::id_from_address(@0x2),
                b"reason",
                100_000_000,
                ts::ctx(&mut scenario)
            );
        };

        // Submit evidence
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut dispute = ts::take_shared<Dispute>(&scenario);
            qually::dispute::submit_evidence(&mut dispute, b"evidence_blob", ts::ctx(&mut scenario));
            ts::return_shared(dispute);
        };

        // Assign arbiter
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut dispute = ts::take_shared<Dispute>(&scenario);
            qually::dispute::assign_arbiter(&mut dispute, ADDR3, ts::ctx(&mut scenario));
            assert!(qually::dispute::state(&dispute) == 1, 0); // Under review
            ts::return_shared(dispute);
        };

        // Resolve dispute — hunter wins
        ts::next_tx(&mut scenario, ADDR3);
        {
            let mut dispute = ts::take_shared<Dispute>(&scenario);
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(5000);
            qually::dispute::resolve_dispute(&mut dispute, &mut bounty, 1, &clock, ts::ctx(&mut scenario));
            assert!(qually::dispute::state(&dispute) == 2, 1); // Resolved
            assert!(qually::dispute::outcome(&dispute) == 1, 2); // Hunter wins
            assert!(qually::dispute::hunter_wins(&dispute) == true, 3);
            // All bounty funds should be transferred to hunter
            assert!(bounty::prize_pool_value(&bounty) == 0, 4);
            ts::return_shared(dispute);
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_dispute_reject() {
        let mut scenario = ts::begin(ADDR1);

        // Open dispute
        {
            qually::dispute::open_dispute(
                object::id_from_address(@0x1),
                object::id_from_address(@0x2),
                b"reason",
                100_000_000,
                ts::ctx(&mut scenario)
            );
        };

        // Assign arbiter
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut dispute = ts::take_shared<Dispute>(&scenario);
            qually::dispute::assign_arbiter(&mut dispute, ADDR3, ts::ctx(&mut scenario));
            ts::return_shared(dispute);
        };

        // Reject dispute
        ts::next_tx(&mut scenario, ADDR3);
        {
            let mut dispute = ts::take_shared<Dispute>(&scenario);
            qually::dispute::reject_dispute(&mut dispute, ts::ctx(&mut scenario));
            assert!(qually::dispute::state(&dispute) == 3, 0); // Rejected
            ts::return_shared(dispute);
        };

        ts::end(scenario);
    }

    // =================== MILESTONE TESTS ===================

    #[test]
    fun test_milestone_lifecycle() {
        let mut scenario = ts::begin(ADDR1);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create milestone
        {
            let bounty_id = object::id_from_address(@0x1);
            milestone::create_milestone(
                bounty_id,
                ADDR1,
                0,
                b"description_blob",
                5000,
                200,
                ts::ctx(&mut scenario)
            );
        };

        // Submit milestone
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut ms = ts::take_shared<Milestone>(&scenario);
            clock.set_for_testing(1000);
            milestone::submit_milestone(&mut ms, b"delivery_blob", &clock, ts::ctx(&mut scenario));
            assert!(milestone::state(&ms) == 1, 0); // Submitted
            ts::return_shared(ms);
        };

        // Approve milestone
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut ms = ts::take_shared<Milestone>(&scenario);
            clock.set_for_testing(2000);
            milestone::approve_milestone(&mut ms, &clock, ts::ctx(&mut scenario));
            assert!(milestone::state(&ms) == 2, 1); // Approved
            ts::return_shared(ms);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_milestone_escalate_overdue() {
        let mut scenario = ts::begin(ADDR1);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create milestone with deadline at 5000
        {
            milestone::create_milestone(
                object::id_from_address(@0x1),
                ADDR1,
                0,
                b"description",
                5000,
                200,
                ts::ctx(&mut scenario)
            );
        };

        // Escalate after deadline (should succeed)
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut ms = ts::take_shared<Milestone>(&scenario);
            clock.set_for_testing(6000); // After deadline
            milestone::escalate_overdue(&mut ms, &clock, ts::ctx(&mut scenario));
            assert!(milestone::state(&ms) == 4, 0); // Overdue
            ts::return_shared(ms);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // =================== TALLY TESTS ===================

    #[test]
    fun test_tally_votes() {
        let comm_scores = vector[80u64, 90u64];
        let poster_score = 70u64;
        let poster_weight = 50u8;

        let final_score = qually::voting::tally_votes(poster_score, comm_scores, poster_weight);
        assert!(final_score == 77, 0);

        let poster_weight_high = 80u8;
        let final_score_high = qually::voting::tally_votes(poster_score, comm_scores, poster_weight_high);
        assert!(final_score_high == 73, 1);
    }

    // =================== GATED SUBMISSION TESTS ===================

    #[test]
    fun test_gated_bounty_allowed_submitter() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 500);

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Enable gating
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::set_gated(&mut bounty, true, ts::ctx(&mut scenario));
            assert!(bounty::is_gated(&bounty), 0);
            ts::return_shared(bounty);
        };

        // Add ADDR2 as allowed submitter
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::add_allowed_submitter(&mut bounty, ADDR2, ts::ctx(&mut scenario));
            assert!(bounty::is_submitter_allowed(&bounty, ADDR2), 1);
            assert!(!bounty::is_submitter_allowed(&bounty, ADDR3), 2);
            ts::return_shared(bounty);
        };

        // ADDR2 can submit
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob", b"hash", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        // Verify submission recorded
        ts::next_tx(&mut scenario, ADDR2);
        {
            let bounty = ts::take_shared<Bounty>(&scenario);
            assert!(bounty::has_submitted(&bounty, ADDR2), 3);
            assert!(!bounty::has_submitted(&bounty, ADDR3), 4);
            assert!(bounty::submission_count(&bounty) == 1, 5);
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = submission::E_NOT_ALLOWED)]
    fun test_gated_bounty_rejects_unallowed() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 500);

        // Create bounty with gating enabled at creation
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Enable gating
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::set_gated(&mut bounty, true, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // ADDR3 tries to submit (not allowed) - should fail
        ts::next_tx(&mut scenario, ADDR3);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob", b"hash", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = submission::E_ALREADY_SUBMITTED)]
    fun test_duplicate_submission_rejected() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 500);

        // Create bounty
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // First submission (should succeed)
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob1", b"hash1", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        // Duplicate submission (should fail)
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob2", b"hash2", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_remove_allowed_submitter() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Enable gating and add submitter
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::set_gated(&mut bounty, true, ts::ctx(&mut scenario));
            bounty::add_allowed_submitter(&mut bounty, ADDR2, ts::ctx(&mut scenario));
            assert!(bounty::is_submitter_allowed(&bounty, ADDR2), 0);
            ts::return_shared(bounty);
        };

        // Remove submitter
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::remove_allowed_submitter(&mut bounty, ADDR2, ts::ctx(&mut scenario));
            assert!(!bounty::is_submitter_allowed(&bounty, ADDR2), 1);
            ts::return_shared(bounty);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    fun test_disable_gating_allows_everyone() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Enable then disable gating
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            bounty::set_gated(&mut bounty, true, ts::ctx(&mut scenario));
            bounty::set_gated(&mut bounty, false, ts::ctx(&mut scenario));
            assert!(!bounty::is_gated(&bounty), 0);
            // Everyone allowed when not gated
            assert!(bounty::is_submitter_allowed(&bounty, ADDR2), 1);
            assert!(bounty::is_submitter_allowed(&bounty, ADDR3), 2);
            ts::return_shared(bounty);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== BOOST PRIZE POOL TESTS ===================

    #[test]
    fun test_boost_prize_pool() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));

        // Create bounty with 1000 SUI
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Anyone (ADDR2) boosts the prize pool
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            let boost = coin::mint_for_testing<SUI>(500, ts::ctx(&mut scenario));
            bounty::boost_prize_pool(&mut bounty, boost, ts::ctx(&mut scenario));
            assert!(bounty::prize_pool_value(&bounty) == 1500, 0);
            ts::return_shared(bounty);
        };

        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_INVALID_STATE)]
    fun test_boost_prize_pool_in_review_fails() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 1000, 2000, 50, 3,
                vector[], false, false, vector[], ts::ctx(&mut scenario)
            );
        };

        // Start review
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1001);
            bounty::start_review(&mut bounty, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        // Boost in review state (should fail)
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            let boost = coin::mint_for_testing<SUI>(500, ts::ctx(&mut scenario));
            bounty::boost_prize_pool(&mut bounty, boost, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== AUTO EXTEND TESTS ===================

    #[test]
    fun test_auto_extend() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty with auto_extend=true, deadline at 2000
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, true, vector[], ts::ctx(&mut scenario)
            );
        };

        // Within 24h of deadline, < 2 submissions — extend by 1000ms
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1500);
            bounty::auto_extend(&mut bounty, 1000, &clock, ts::ctx(&mut scenario));
            assert!(bounty::submission_deadline(&bounty) == 3000, 0); // 2000 + 1000
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = bounty::E_MIN_SUBMISSIONS_NOT_MET)]
    fun test_auto_extend_fails_with_2_submissions() {
        let mut scenario = ts::begin(ADDR1);
        let mut registry = qually::bounty::create_registry_for_testing(ts::ctx(&mut scenario));
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create bounty with auto_extend=true
        {
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            bounty::create_bounty(
                &mut registry,
                payment, 0, b"brief", b"hash", 2000, 3000, 50, 3,
                vector[], false, true, vector[], ts::ctx(&mut scenario)
            );
        };

        // Add 2 submissions
        ts::next_tx(&mut scenario, ADDR2);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob1", b"hash1", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        ts::next_tx(&mut scenario, ADDR3);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            submission::submit_work(
                &mut bounty, vector[], vector[], b"blob2", b"hash2", &clock, ts::ctx(&mut scenario)
            );
            ts::return_shared(bounty);
        };

        // Try to extend (should fail — 2 submissions)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut bounty = ts::take_shared<Bounty>(&scenario);
            clock.set_for_testing(1500);
            bounty::auto_extend(&mut bounty, 1000, &clock, ts::ctx(&mut scenario));
            ts::return_shared(bounty);
        };

        clock::destroy_for_testing(clock);
        qually::bounty::destroy_registry_for_testing(registry);
        ts::end(scenario);
    }

    // =================== JUDGE REPUTATION TESTS ===================

    #[test]
    fun test_judge_reputation_update() {
        let mut scenario = ts::begin(ADDR1);

        // Mint judge profile
        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        // Update reputation (simulates completing a session)
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            qually::judge::update_reputation_completed(&mut profile);
            assert!(judge::reputation_score(&profile) == 10, 0);
            assert!(judge::sessions_completed(&profile) == 1, 1);
            ts::return_to_sender(&scenario, profile);
        };

        // Update again — should trigger tier upgrade at 200
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            // Simulate 20 completed sessions (200 rep)
            let mut i = 0;
            while (i < 19) {
                qually::judge::update_reputation_completed(&mut profile);
                i = i + 1;
            };
            assert!(judge::reputation_score(&profile) == 200, 2);
            assert!(judge::tier(&profile) == 1, 3); // Tier 1 (Active)
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_judge_missed_reveal_penalty() {
        let mut scenario = ts::begin(ADDR1);

        // Mint and stake
        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            let bounty_id = object::id_from_address(@0x123);
            let stake = coin::mint_for_testing<SUI>(100_000_000, ts::ctx(&mut scenario));
            judge::apply_as_judge(&mut profile, bounty_id, stake, b"app", ts::ctx(&mut scenario));

            // Give some rep first
            qually::judge::update_reputation_completed(&mut profile);
            qually::judge::update_reputation_completed(&mut profile);
            assert!(judge::reputation_score(&profile) == 20, 0);
            assert!(judge::staked_balance(&profile) == 100_000_000, 1);

            // Penalize for missed reveal
            qually::judge::penalize_missed_reveal(&mut profile, 50_000_000, ts::ctx(&mut scenario));
            assert!(judge::reputation_score(&profile) == 5, 2); // 20 - 15 = 5
            assert!(judge::staked_balance(&profile) == 50_000_000, 3); // 100M - 50M

            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_judge_tier_upgrade_to_trusted() {
        let mut scenario = ts::begin(ADDR1);

        {
            judge::mint_judge_profile(ts::ctx(&mut scenario));
        };

        // Simulate 50 completed sessions (500 rep) → Tier 2
        ts::next_tx(&mut scenario, ADDR1);
        {
            let mut profile = ts::take_from_sender<JudgeProfile>(&scenario);
            let mut i = 0;
            while (i < 50) {
                qually::judge::update_reputation_completed(&mut profile);
                i = i + 1;
            };
            assert!(judge::reputation_score(&profile) == 500, 0);
            assert!(judge::tier(&profile) == 2, 1); // Tier 2 (Trusted)
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }
}
