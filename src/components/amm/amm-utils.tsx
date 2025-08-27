import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { AMM_PROGRAM_ID } from './amm-data-access'

// Helper function to derive PDAs
export function derivePoolPDA(mintA: PublicKey, mintB: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("Pool"), mintA.toBuffer(), mintB.toBuffer()],
    AMM_PROGRAM_ID
  )
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

// Helper to create initialize pool instruction
export function createInitializePoolInstruction(
  signer: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
  feeBps: number = 30, // 0.3% fee
  protoFeeBps: number = 5 // 0.05% protocol fee
) {
  const [pool] = derivePoolPDA(mintA, mintB)
  const [lpMint] = deriveLpMintPDA(pool)
  const [poolAuth] = derivePoolAuthPDA(pool)
  const [vaultA] = deriveVaultAPDA(pool)
  const [vaultB] = deriveVaultBPDA(pool)

  const accounts = {
    signer,
    mintA,
    mintB,
    pool,
    lpMint,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    poolAuth,
    vaultA,
    vaultB,
  }

  // Create instruction data
  const data = Buffer.alloc(8 + 2 + 2) // 8 bytes discriminator + 2 bytes fee_bps + 2 bytes proto_fee_bps
  
  // Initialize pool discriminator [95, 180, 10, 172, 84, 174, 232, 40]
  const discriminator = Buffer.from([95, 180, 10, 172, 84, 174, 232, 40])
  discriminator.copy(data, 0)
  
  // Write fee_bps as little-endian u16
  data.writeUInt16LE(feeBps, 8)
  
  // Write proto_fee_bps as little-endian u16
  data.writeUInt16LE(protoFeeBps, 10)

  const keys = [
    { pubkey: accounts.signer, isSigner: true, isWritable: true },
    { pubkey: accounts.mintA, isSigner: false, isWritable: false },
    { pubkey: accounts.mintB, isSigner: false, isWritable: false },
    { pubkey: accounts.pool, isSigner: false, isWritable: true },
    { pubkey: accounts.lpMint, isSigner: false, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.poolAuth, isSigner: false, isWritable: false },
    { pubkey: accounts.vaultA, isSigner: false, isWritable: true },
    { pubkey: accounts.vaultB, isSigner: false, isWritable: true },
  ]

  return new TransactionInstruction({
    keys,
    programId: AMM_PROGRAM_ID,
    data,
  })
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
