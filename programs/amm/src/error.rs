use anchor_lang::prelude::*;
 
#[error_code]
pub enum LpErrors {
    #[msg("No Liquidty Found")]
    NoLiquidtyFound
}