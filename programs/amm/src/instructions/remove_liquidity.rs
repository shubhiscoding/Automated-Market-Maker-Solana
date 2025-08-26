use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::state::Pool;
use crate::error::LpErrors;

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub vault_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_lp_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,

    /// CHECK: PDA authority for pool
    pub pool_auth: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> RemoveLiquidity<'info>  {
    fn remove_liquidity(&mut self, lp_amount:u64) -> Result<()> {
        let total_supply = self.lp_mint.supply;
        require!(total_supply > 0, LpErrors::NoLiquidtyFound);

        let amount_a = (lp_amount as u128)
            .checked_mul(self.vault_a.amount as u128).unwrap()
            .checked_div(total_supply as u128).unwrap() as u64;

        let amount_b = (lp_amount as u128)
            .checked_mul(self.vault_b.amount as u128).unwrap()
            .checked_div(total_supply as u128).unwrap() as u64;

        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            Burn {
                mint: self.lp_mint.to_account_info(),
                from: self.user_lp_ata.to_account_info(),
                authority: self.payer.to_account_info(),
            },
        );
        token::burn(cpi_ctx, lp_amount)?;

        let pool = &self.pool;
        let binding = pool.key();
        let seeds = &[b"pool_auth", binding.as_ref(), &[pool.bump_auth]];
        let signer = &[&seeds[..]];

        let cpi_ctx_a = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.vault_a.to_account_info(),
                to: self.user_ata_a.to_account_info(),
                authority: self.pool_auth.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx_a, amount_a)?;

        let cpi_ctx_b = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.vault_b.to_account_info(),
                to: self.user_ata_b.to_account_info(),
                authority: self.pool_auth.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx_b, amount_b)?;
        Ok(())
    }
    
}

pub fn handler(
    ctx: Context<RemoveLiquidity>,
    lp_amount: u64
) -> Result<()> {
    ctx.accounts.remove_liquidity(lp_amount)?;
    Ok(())
}