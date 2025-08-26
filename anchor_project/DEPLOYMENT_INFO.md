# AMM Program Deployment Information

## Deployment Details
- **Network**: Solana Devnet
- **Program ID**: `HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb`
- **Deployment Signature**: `JsfD1VaCGLPjFKSrV2hPbXGUyULb5Hpezcm8Gvxu4nVC8C79TnGoX8u7Jf9LTCrwCAbUfTFfXCatEv8ouMxdbHB`
- **Upgrade Authority**: `FBVAeZY4qdAttQdiYtg5VaSxPA2xgF5z7mGjA9mYr74d`
- **Deploy Date**: August 27, 2025

## Program Features
The deployed AMM (Automated Market Maker) program includes the following instructions:
- `init_pool` - Initialize a new liquidity pool
- `add_liquidity` - Add liquidity to an existing pool
- `remove_liquidity` - Remove liquidity from a pool
- `swap` - Swap tokens using the AMM

## Configuration Files
- **Anchor.toml**: Updated to support devnet deployment
- **IDL**: Generated at `target/idl/amm.json`
- **Types**: TypeScript types generated at `target/types/amm.ts`

## Network Information
- **RPC URL**: https://api.devnet.solana.com
- **Cluster**: devnet
- **Wallet**: ~/.config/solana/id.json

## Next Steps
The program is now ready for frontend integration. You can use the Program ID and IDL to interact with the deployed AMM program from your frontend application.

## Verification
You can verify the deployment by running:
```bash
solana account HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb --url devnet
```
