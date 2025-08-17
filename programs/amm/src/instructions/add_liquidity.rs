use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::state::Pool;

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub vault_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_ata_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_lp_ata: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for pool
    pub pool_auth: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> AddLiquidity<'info> {
    fn add_liquidity(&mut self, amount_a: u64, amount_b: u64) ->  Result<()> {
        let pool = &self.pool;
        
        let cpi_ctx_a = CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_ata_a.to_account_info(),
                to: self.vault_a.to_account_info(),
                authority: self.user_ata_a.to_account_info(),
            },
        );

        token::transfer(cpi_ctx_a, amount_a)?;

        let cpi_ctx_b =  CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_ata_b.to_account_info(),
                to: self.vault_b.to_account_info(),
                authority: self.user_ata_b.to_account_info(),
            }
        );

        token::transfer(cpi_ctx_b, amount_b)?;

        let supply = self.lp_mint.supply;
        let lp_to_mint = if supply == 0 {
            integer_sqrt(amount_a.checked_mul(amount_b).unwrap())
        } else {
            let share_a = amount_a
                .checked_mul(supply)
                .unwrap()
                / self.vault_a.amount;
            let share_b = amount_b
                .checked_mul(supply)
                .unwrap()
                / self.vault_b.amount;
            share_a.min(share_b)
        };

        let binding = pool.key();
        let seeds = &[b"pool_auth", binding.as_ref(), &[pool.bump_auth]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            MintTo {
                mint: self.lp_mint.to_account_info(),
                to: self.user_lp_ata.to_account_info(),
                authority: self.pool_auth.to_account_info(),
            },
            signer,
        );

        token::mint_to(cpi_ctx, lp_to_mint)?;

        Ok(())
    }
}

fn integer_sqrt(value: u64) -> u64 {
    (value as f64).sqrt() as u64
}

pub fn handler(ctx: Context<AddLiquidity>, amount_a: u64, amount_b:u64) -> Result<()> {
    ctx.accounts.add_liquidity(amount_a, amount_b)?;
    Ok(())
}