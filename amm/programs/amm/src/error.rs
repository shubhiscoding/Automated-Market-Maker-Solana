use anchor_lang::prelude::*;
 
#[error_code]
pub enum LpErrors {
    #[msg("No Liquidty Found")]
    NoLiquidtyFound,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Invalid Liquidity Ratio")]
    InvalidLiquidityRatio,
    #[msg("Both tokens must be provided for initial liquidity")]
    BothTokensRequired,
    #[msg("At least one token must be provided")]
    NoTokensProvided,
    #[msg("Insufficient Token A provided")]
    InsufficientTokenA,
    #[msg("Insufficient Token B provided")]
    InsufficientTokenB,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("No Tokens in the pool")]
    EmptyPool
}