module qually::treasury {
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin;

    /// Error codes
    const E_UNAUTHORIZED: u64 = 0;
    const E_INSUFFICIENT_BALANCE: u64 = 1;

    /// Platform Treasury object
    public struct Treasury has key {
        id: UID,
        balance: Balance<SUI>,
        admin: address,
    }

    /// Module initializer to create the Treasury
    fun init(ctx: &mut TxContext) {
        let treasury = Treasury {
            id: object::new(ctx),
            balance: balance::zero(),
            admin: ctx.sender(),
        };
        transfer::share_object(treasury);
    }

    /// Get current treasury balance
    public fun balance(treasury: &Treasury): u64 {
        balance::value(&treasury.balance)
    }

    /// Get admin address
    public fun admin(treasury: &Treasury): address {
        treasury.admin
    }

    /// Deposit fees into the treasury (package-level access)
    public(package) fun deposit(treasury: &mut Treasury, fee: Balance<SUI>) {
        balance::join(&mut treasury.balance, fee);
    }

    /// Admin withdrawal - only callable by treasury admin
    public fun withdraw(
        treasury: &mut Treasury,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(ctx.sender() == treasury.admin, E_UNAUTHORIZED);
        assert!(amount <= balance::value(&treasury.balance), E_INSUFFICIENT_BALANCE);

        let withdrawal = balance::split(&mut treasury.balance, amount);
        transfer::public_transfer(coin::from_balance(withdrawal, ctx), treasury.admin);
    }

    #[test_only]
    public fun create_for_testing(ctx: &mut TxContext): Treasury {
        Treasury {
            id: object::new(ctx),
            balance: balance::zero(),
            admin: ctx.sender(),
        }
    }

    #[test_only]
    public fun destroy_for_testing(treasury: Treasury) {
        let Treasury { id, balance, admin: _ } = treasury;
        object::delete(id);
        balance::destroy_for_testing(balance);
    }
}
