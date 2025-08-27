use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account(discriminator = 1)]
pub struct Pool {
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub lp_mint: Pubkey,
    pub fee_bps: u16,
    pub proto_fee_bps: u16,
    pub admin: Pubkey,
    pub bump_pool: u8,
    pub bump_auth: u8
}