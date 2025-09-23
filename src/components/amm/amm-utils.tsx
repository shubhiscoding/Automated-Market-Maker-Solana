import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { AMM_PROGRAM_ID } from './amm-data-access'
import { getU16Encoder } from 'gill';
import { BN } from '@coral-xyz/anchor';

// Helper function to derive PDAs
export function derivePoolPDA(mintA: PublicKey, mintB: PublicKey, feeBps: number = 30) {
  const feeBpsBuf = new BN(feeBps).toArrayLike(Buffer, "le", 2);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("Pool"), mintA.toBuffer(), mintB.toBuffer(), feeBpsBuf],
    AMM_PROGRAM_ID
  )
}

export async function deriveTokenAta(user: PublicKey, mint: PublicKey) {
  const userAta = await getAssociatedTokenAddress(mint, user, false, TOKEN_PROGRAM_ID);
  return userAta;
}

export function deriveLpMintPDA(pool: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp_mint"), pool.toBuffer()],
    AMM_PROGRAM_ID
  )
}

export function derivePoolAuthPDA(pool: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_auth"), pool.toBuffer()],
    AMM_PROGRAM_ID
  )
}

export function deriveVaultAPDA(pool: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_a"), pool.toBuffer()],
    AMM_PROGRAM_ID
  )
}

export function deriveVaultBPDA(pool: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault_b"), pool.toBuffer()],
    AMM_PROGRAM_ID
  )
}

// Validation helpers
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

export function normalizeTokenOrder(mintA: string, mintB: string): [PublicKey, PublicKey] {
  const pubkeyA = new PublicKey(mintA)
  const pubkeyB = new PublicKey(mintB)
  
  // Ensure consistent ordering (mintA should be lexicographically smaller)
  if (pubkeyA.toBase58() < pubkeyB.toBase58()) {
    return [pubkeyA, pubkeyB]
  } else {
    return [pubkeyB, pubkeyA]
  }
}
