import { useWalletUi } from '@wallet-ui/react'
import { PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor'
import ammIdl from '@/lib/amm.json'

// AMM Program ID (deployed on devnet)
export const AMM_PROGRAM_ID = new PublicKey('HFRstgCb2NeFoGPV5iuoQ6nbrfawKuh1qy9zzN2uBCyb')

export function useAmmProgram() {
  const { client, account } = useWalletUi()

  // Create a provider-like object for Anchor
  const provider = {
    connection: client.rpc,
    publicKey: account?.publicKey,
  }

  return { 
    programId: AMM_PROGRAM_ID,
    connection: client.rpc, 
    publicKey: account?.publicKey,
    provider,
    idl: ammIdl as Idl
  }
}
