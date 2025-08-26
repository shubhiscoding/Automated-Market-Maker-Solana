use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::Pool;

#[derive(Accounts)]
#[instruction(fee_bps: u16, proto_fee_bps: u16)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint_a: Account<'info, Mint>,
    pub mint_b: Account<'info, Mint>,
    
    #[account(
        init,
        payer = signer,
        space = Pool::INIT_SPACE + Pool::DISCRIMINATOR.len(),
        seeds = [b"Pool", mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = signer,
        mint::decimals = 9,
        mint::authority = pool_auth,
        seeds = [b"lp_mint", pool.key().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,

    /// CHECK: This is a PDA derived from pool key, used as authority for token accounts
    #[account(
        seeds = [b"pool_auth", pool.key().as_ref()],
        bump
    )]
    pub pool_auth: UncheckedAccount<'info>,

    #[account(
        init,
        payer = signer,
        token::mint = mint_a,
        token::authority = pool_auth,
        seeds = [b"vault_a", pool.key().as_ref()],
        bump
    )]
    pub vault_a: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = signer,
        token::mint = mint_b,
        token::authority = pool_auth,
        seeds = [b"vault_b", pool.key().as_ref()],
        bump
    )]
    pub vault_b: Account<'info, TokenAccount>,
}

impl<'info> InitPool<'info> {
    fn init_pool(&mut self, fee_bps: u16, proto_fee_bps: u16, bump_pool: u8, program_id: Pubkey) -> Result<()> {
        let (_pool_auth, bump_auth) =
            Pubkey::find_program_address(&[b"pool_auth", self.pool.key().as_ref()], &program_id);
        self.pool.set_inner(Pool {
             mint_a: self.mint_a.key(), 
             mint_b: self.mint_b.key(), 
             vault_a: self.vault_a.key(), 
             vault_b: self.vault_b.key(), 
             lp_mint: self.lp_mint.key(), 
             fee_bps: fee_bps, 
             proto_fee_bps: proto_fee_bps, 
             admin: self.signer.key(), 
             bump_pool: bump_pool, 
             bump_auth: bump_auth
        });
        Ok(())
    }
}

pub fn handler(
    ctx: Context<InitPool>,
    fee_bps: u16,
    proto_fee_bps: u16,
) -> Result<()> {
    ctx.accounts.init_pool(fee_bps, proto_fee_bps, ctx.bumps.pool, *ctx.program_id)?;
    Ok(())
}