import { UiWalletAccount, useWalletAccountTransactionSendingSigner, useWalletUi } from '@wallet-ui/react'

export function useWalletUiSigner() {
  const { account, cluster } = useWalletUi()
  
  // Find the Solana chain that matches the current cluster
  const solanaChain = account?.chains?.find(chain => 
    typeof chain === 'string' && 
    chain === cluster?.id && 
    chain.startsWith('solana:')
  ) as `solana:${string}` | undefined
  
  // Always call the hook - pass fallback values when needed
  const signer = useWalletAccountTransactionSendingSigner(
    account || {} as UiWalletAccount, 
    solanaChain || 'solana:devnet' as `solana:${string}`
  )
  
  // Return null if validation fails
  if (!account || 
      !cluster?.id || 
      !account.chains || 
      !Array.isArray(account.chains) || 
      account.chains.length === 0 ||
      !solanaChain) {
    return null
  }
  
  return signer
}