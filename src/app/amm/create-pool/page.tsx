'use client'

import { useState } from 'react'
import { InitializePool } from '@/components/amm/initialize-pool'
import { useWalletUi } from '@wallet-ui/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { address, Address } from '@solana/addresses'
import { 
  isValidPublicKey, 
  normalizeTokenOrder,
  derivePoolPDA, 
  deriveLpMintPDA,
  derivePoolAuthPDA,
  deriveVaultAPDA,
  deriveVaultBPDA
} from '@/components/amm/amm-utils'
import { getInitializePoolInstructionAsync } from '../../../../anchor/src/client/js/generated'
import { createTransaction, getBase58Decoder, signAndSendTransactionMessageWithSigners } from 'gill'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'

export default function CreatePoolPage() {
  const { account, client } = useWalletUi()
  const [isLoading, setIsLoading] = useState(false)
  const rawSigner = useWalletUiSigner()
  const signer = account ? rawSigner : null

  const handleInitializePool = async (tokenMintA: string, tokenMintB: string) => {
    // Validate inputs
    if (!isValidPublicKey(tokenMintA)) {
      toast.error('Invalid Token A mint address')
      return
    }

    if (!isValidPublicKey(tokenMintB)) {
      toast.error('Invalid Token B mint address')
      return
    }

    if (tokenMintA === tokenMintB) {
      toast.error('Token A and Token B must be different')
      return
    }

    if (!account?.publicKey || !signer) {
      toast.error('Wallet not connected')
      return
    }

    setIsLoading(true)
    try {
      // Normalize token order for consistent pool addresses
      const [mintA, mintB] = normalizeTokenOrder(tokenMintA, tokenMintB)
      
      // Derive the pool address to show user
      const [poolAddress] = derivePoolPDA(mintA, mintB)

      const [pool] = derivePoolPDA(mintA, mintB)
      const [lpMint] = deriveLpMintPDA(pool)
      const [poolAuth] = derivePoolAuthPDA(pool)
      const [vaultA] = deriveVaultAPDA(pool)
      const [vaultB] = deriveVaultBPDA(pool)
      const mintAAddress = address(mintA.toBase58())

      const ix = await getInitializePoolInstructionAsync({
        signer: signer,
        mintA: mintAAddress as Address,
        mintB: address(mintB.toBase58()) as Address,
        feeBps: 30,
        protoFeeBps: 5,
        lpMint: address(lpMint.toBase58()) as Address,
        vaultA: address(vaultA.toBase58()) as Address,
        vaultB: address(vaultB.toBase58()) as Address,
        poolAuth: address(poolAuth.toBase58()) as Address,
        pool: address(pool.toBase58()) as Address,
        systemProgram: address(SystemProgram.programId.toBase58()) as Address,
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()) as Address
      })

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      // Create transaction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: [ix],
      })

      const simulation = await client.simulateTransaction(transaction)
      console.log('Simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs)

      toast.info('Please confirm the transaction in your wallet...')

      // Send the transaction
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log('Transaction signature:', sig58)
      
      console.log('Pool initialization transaction created:', {
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        poolAddress: poolAddress.toBase58(),
        transaction: sig58
      })

      toast.success(
        `Pool initialized successfully! Pool address: ${poolAddress.toBase58().slice(0, 8)}...`
      )
      
      // Redirect to the AMM page to see the new pool
      setTimeout(() => {
        window.location.href = '/amm'
      }, 2000)

    } catch (error) {
      console.error('Error initializing pool:', error)
      toast.error('Error initializing pool: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Enhanced Navigation Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Link href="/amm">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AMM
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              🏗️ Create New Pool
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Initialize a new liquidity pool with two tokens
            </p>
          </div>
        </div>
      </div>

      {/* Pool Creation Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
            💰 Trading Fees
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Pool will charge 0.3% trading fee on all swaps
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
            🏛️ Protocol Fees
          </h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">
            Additional 0.05% protocol fee for platform maintenance
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
            🔄 Token Order
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300">
            Token order will be normalized automatically
          </p>
        </div>
      </div>

      {/* Create Pool Component */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-white dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            🏗️ Pool Initialization
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure your new liquidity pool parameters
          </p>
        </div>
        
        <div className="p-8">
          <InitializePool 
            onInitializePool={handleInitializePool}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Process Steps */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          📋 Pool Creation Process
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Input Tokens</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Enter token mint addresses</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Validation</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Check token validity</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Transaction</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Sign & send to blockchain</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <div>
              <div className="font-medium text-gray-800 dark:text-gray-200">Pool Ready</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Start adding liquidity</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}