use anchor_lang::prelude::*;

mod state;
mod error;
mod instructions;

use instructions::*;

declare_id!("HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitPool>,
        fee_bps: u16,
        proto_fee_bps: u16,
    ) -> Result<()> {
        init_pool::handler(ctx, fee_bps, proto_fee_bps)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        add_liquidity::handler(ctx, amount_a, amount_b)
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64
    ) -> Result<()> {
        remove_liquidity::handler(ctx, lp_amount)
    }
}