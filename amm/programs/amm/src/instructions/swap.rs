use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::state::Pool;
use crate::error::LpErrors;

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub vault_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_b: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata_a: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata_b: Account<'info, TokenAccount>,

    /// CHECK: PDA authority for pool
    pub pool_auth: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapParams {
    pub amount_in: u64,    // How much user is giving
    pub minimum_out: u64,  // Slippage protection
}


impl <'info> Swap<'info> {
    fn swap(&mut self, params: SwapParams)->Result<()>{
        let pool = &self.pool;
        let fee = params.amount_in * pool.fee_bps as u64/ 10_000;
        let amount_in_after_fee = params.amount_in - fee;
        

        let (vault_in, vault_out, user_source, user_dest) =
            if self.user_ata_a.mint == self.vault_a.mint {
                (&self.vault_a, &self.vault_b,
                &self.user_ata_a, &self.user_ata_b)
            } else if self.user_ata_a.mint == self.vault_b.mint {
                (&self.vault_b, &self.vault_a, &self.user_ata_a, &self.user_ata_b)
            } else {
                panic!("user_ata_a mint does not match vault_a or vault_b mint");
            };
        let numerator = amount_in_after_fee * vault_out.amount;
        let denominator = amount_in_after_fee + vault_in.amount;
        let amount_out = numerator/denominator;

        require!(amount_out >= params.minimum_out, LpErrors::SlippageExceeded);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: user_source.to_account_info(),
                    to: vault_in.to_account_info(),
                    authority: self.signer.to_account_info(),
                },
            ),
            params.amount_in,
        )?;

        let binding = pool.key();
        let seeds = &[b"pool_auth", binding.as_ref(), &[pool.bump_auth]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(), 
                token::Transfer { 
                    from: vault_out.to_account_info(), 
                    to: user_dest.to_account_info(), 
                    authority: self.pool_auth.to_account_info(), 
                    },
                    signer,
                ), 
            amount_out
        )?;
        Ok(())
    }
}

pub fn handler(ctx: Context<Swap>, params: SwapParams) -> Result<()> {
    ctx.accounts.swap(params)?;
    Ok(())
}