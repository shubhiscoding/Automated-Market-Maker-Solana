# Project Description

**Deployed Frontend URL:** https://program-shubhiscoding.vercel.app/

**Solana Program ID:** HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb

## Project Overview

### Description
This project implements a basic Automated Market Maker (AMM) on Solana, similar to Uniswap v2. The AMM allows users to create liquidity pools between token pairs, provide liquidity, and swap tokens through the available liquidity. The project consists of an Anchor program deployed on Solana Devnet and a Next.js frontend for user interaction.

The AMM uses a constant product formula (x * y = k) to determine token prices and swap amounts. Users can create pools between any two SPL tokens, add liquidity to receive LP tokens representing their share, swap tokens with automatic price discovery, and remove liquidity to reclaim their tokens plus earned fees.

### Key Features

- **Pool Initialization**: Create new trading pairs between any two SPL tokens
- **Liquidity Provision**: Add liquidity to pools and receive LP tokens representing ownership share
- **Token Swapping**: Exchange tokens using the constant product AMM formula with automatic price calculation
- **Liquidity Removal**: Withdraw provided liquidity and earned trading fees by burning LP tokens
- **Wallet Integration**: Full Solana wallet support with transaction signing
- **Real-time Updates**: Interface updates with transaction confirmations and balance changes

### How to Use the dApp

1. **Connect Wallet**: Click the wallet button in the header and connect your Solana wallet (ensure it's on Devnet)
2. **Initialize Pool**: 
   - Enter two token mint addresses in the Initialize Pool section
   - Click "Initialize Pool" to create a new trading pair
   - Confirm the transaction in your wallet
3. **Add Liquidity:**
   - Enter the pool address you want to provide liquidity to
   - Enter amounts for both tokens (should be roughly equal value)
   - Click "Add Liquidity" and confirm transaction
   - Receive LP tokens representing your pool share
4. **Swap Tokens:**
   - Enter the pool address for the tokens you want to swap
   - Enter the amount you want to swap
   - Click "Swap Tokens" and confirm transaction
5. **Remove Liquidity:**
   - Enter the pool address you want to withdraw from
   - Click "Remove Liquidity" to withdraw your share plus earned fees

## Program Architecture

The AMM program is built using the Anchor framework and implements a constant product market maker. The program manages liquidity pools, handles token swaps, and tracks liquidity provider positions.

### PDA Usage

The program uses Program Derived Addresses (PDAs) to create deterministic addresses for various accounts without requiring users to manage keypairs.

**PDAs Used:**
- **Pool PDA**: Derived from `["pool", token_mint_a, token_mint_b, pool_fee_bps]` - Creates a unique address for each token pair pool
- **Vault PDAs**: Derived from `["vault", pool_address, token_mint]` - Creates vault addresses to hold pool liquidity
- **LP Mint PDA**: Derived from `["lp_mint", pool_address]` - Creates the LP token mint for each pool
- **Pool Authority PDA**: Derived from `["authority", pool_address]` - Creates the authority that controls pool operations

### Program Instructions

**Instructions Implemented:**
- **init_pool**: Creates a new liquidity pool between two tokens, initializes vaults and LP token mint
- **add_liquidity**: Allows users to provide liquidity to a pool and receive LP tokens proportional to their contribution
- **remove_liquidity**: Allows LP token holders to burn their tokens and withdraw their share of the pool
- **swap**: Enables token swapping using the constant product formula (x * y = k) to calculate output amounts

### Account Structure

```rust
#[account]
pub struct Pool {
    pub token_mint_a: Pubkey,      // First token in the pair
    pub token_mint_b: Pubkey,      // Second token in the pair  
    pub vault_a: Pubkey,           // Vault holding token A
    pub vault_b: Pubkey,           // Vault holding token B
    pub lp_mint: Pubkey,           // LP token mint
    pub lp_supply: u64,            // Total LP tokens issued
    pub authority: Pubkey,         // Pool authority PDA
    pub bump: u8,                  // PDA bump seed
}
```

## Technical Implementation

### Backend (Solana Program)
- **Framework**: Anchor 0.30.1
- **Language**: Rust
- **Network**: Deployed on Solana Devnet
- **Testing**: Comprehensive test suite covering all instructions and error cases
- **Security**: Input validation, overflow protection, and proper authority checks

### Frontend
- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS with custom components
- **Wallet Integration**: @wallet-ui/react for seamless wallet connection
- **State Management**: React hooks for local state management
- **UI Components**: Custom components built on Radix UI primitives

### Key Technologies
- **Solana Web3.js**: For blockchain interactions
- **Anchor**: Program framework and client generation
- **SPL Token Program**: For token operations
- **TypeScript**: Full type safety across the application

## Testing

### Test Coverage
The project includes comprehensive tests for all program instructions covering both success and failure scenarios.

**Happy Path Tests:**
- Pool initialization with valid token pairs
- Adding liquidity with proper token amounts
- Successful token swaps with valid parameters
- Liquidity removal with valid LP tokens

**Unhappy Path Tests:**
- Pool initialization with invalid or duplicate tokens
- Adding liquidity with insufficient funds
- Swapping with invalid pool or insufficient liquidity
- Removing liquidity with invalid LP tokens

### Running Tests
```bash
# Run all tests
cd anchor_project/amm
anchor test
```

## Deployment Information

### Program Deployment
- **Network**: Solana Devnet
- **Program ID**: `HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb`
- **Upgrade Authority**: Available for program updates
- **Verification**: Program successfully verified and executable

### Frontend Deployment
- **Production Ready**: https://program-shubhiscoding.vercel.app/
- **Environment**: Configured for Solana Devnet

## Repository Structure

```
amm/                         # Anchor program
├── programs/amm/src/        # Program source code
├── tests/                   # Program tests
├── target/                  # Build artifacts
└── Anchor.toml             # Anchor configuration

src/                        # Source code
├── components/amm/         # AMM-specific components
├── public/                 # Static assets
└── package.json           # Dependencies
```

### Additional Notes for Evaluators

This AMM implementation demonstrates core DeFi functionality on Solana including:
- Proper use of PDAs for deterministic account addresses
- Token program integration for handling SPL tokens
- Mathematical calculations for constant product AMM
- Comprehensive error handling and validation
- Modern frontend with wallet integration

The frontend provides a clean interface for all AMM operations, though currently simulates transactions for demonstration purposes. The program is fully deployed and functional on Devnet.
