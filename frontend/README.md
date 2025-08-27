# AMM Frontend

A basic frontend interface for interacting with the Automated Market Maker (AMM) program deployed on Solana Devnet.

## Features

- **Initialize Pool**: Create new liquidity pools between token pairs
- **Add Liquidity**: Provide liquidity to existing pools to earn fees
- **Swap Tokens**: Exchange tokens using the AMM
- **Remove Liquidity**: Withdraw liquidity from pools

## Program Details

- **Program ID**: `HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb`
- **Network**: Solana Devnet
- **Framework**: Built with Anchor Framework

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Wallet Integration**: @wallet-ui/react
- **Solana Libraries**: @solana/web3.js, @coral-xyz/anchor
- **UI Components**: Custom components with Radix UI primitives

## Getting Started

### Installation

#### Download the template

```shell
pnpm create solana-dapp@latest -t gh:solana-foundation/templates/gill/AMM
```

#### Install Dependencies

```shell
pnpm install
```

#### Start the web app

```shell
pnpm dev
```
