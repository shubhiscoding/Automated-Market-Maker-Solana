'use client'

import { useState } from 'react'
import { UiWalletAccount, useWalletAccountTransactionSendingSigner, useWalletUi } from '@wallet-ui/react'
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { address, Address } from '@solana/addresses';
import { AMM_PROGRAM_ID } from './amm-data-access'
import { 
  createInitializePoolInstruction, 
  isValidPublicKey, 
  normalizeTokenOrder,
  derivePoolPDA, 
  deriveLpMintPDA,
  derivePoolAuthPDA,
  deriveVaultAPDA,
  deriveVaultBPDA
} from './amm-utils'
import { getInitializePoolInstruction, getInitializePoolInstructionAsync } from '../../../anchor/src/client/js/generated'
import { createTransaction, getBase58Decoder, signAndSendTransactionMessageWithSigners } from 'gill'
import { useWalletUiSigner } from '../solana/use-wallet-ui-signer'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

export function AmmFeature() {
  const { account, client, cluster } = useWalletUi()
  const signer = useWalletAccountTransactionSendingSigner(account as UiWalletAccount, cluster.id)
  const [isLoading, setIsLoading] = useState(false)
  
  // Pool initialization state
  const [tokenMintA, setTokenMintA] = useState('')
  const [tokenMintB, setTokenMintB] = useState('')
  
  // Liquidity state
  const [liquidityAmountA, setLiquidityAmountA] = useState('')
  const [liquidityAmountB, setLiquidityAmountB] = useState('')
  
  // Swap state
  const [swapAmount, setSwapAmount] = useState('')
  const [selectedPool, setSelectedPool] = useState('')

  if (!account) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">AMM Interface</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please connect your wallet to interact with the AMM
        </p>
      </div>
    )
  }

  const handleInitPool = async () => {
    if (!tokenMintA || !tokenMintB) {
      toast.error('Please provide both token mint addresses')
      return
    }

    // Validate public keys
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

    if (!account?.publicKey) {
      toast.error('Wallet not connected')
      return
    }

    setIsLoading(true)
    try {
      // Normalize token order for consistent pool addresses
      const [mintA, mintB] = normalizeTokenOrder(tokenMintA, tokenMintB)
      
      // Derive the pool address to show user
      const [poolAddress] = derivePoolPDA(mintA, mintB)
      
      // Create the initialize pool instruction
      const instruction = createInitializePoolInstruction(
        new PublicKey(account.publicKey),
        mintA,
        mintB,
        30, // 0.3% fee
        5   // 0.05% protocol fee
      )

      const [pool] = derivePoolPDA(mintA, mintB)
      const [lpMint] = deriveLpMintPDA(pool)
      const [poolAuth] = derivePoolAuthPDA(pool)
      const [vaultA] = deriveVaultAPDA(pool)
      const [vaultB] = deriveVaultBPDA(pool)
      const mintAAddress = address(mintA.toBase58());

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
      });

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      // Create transaction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: [ix],
      });

      const simulation = await client.simulateTransaction(transaction);
      console.log('Simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs);

      toast.info('Please confirm the transaction in your wallet...')

      // Note: In a real implementation with proper wallet integration, you would:
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
        const decoder = getBase58Decoder()
        const sig58 = decoder.decode(signature)
        console.log(sig58)
      
      // For now, we'll simulate success and show the transaction details
      console.log('Pool initialization transaction created:', {
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        poolAddress: poolAddress.toBase58(),
        transaction: sig58
      })

      toast.success(
        `Pool initialized successfully! Pool address: ${poolAddress.toBase58().slice(0, 8)}...`
      )
      
      // Update the selected pool for other operations
      setSelectedPool(poolAddress.toBase58())
      
      // Clear form
      setTokenMintA('')
      setTokenMintB('')

    } catch (error) {
      console.error('Error initializing pool:', error)
      toast.error('Error initializing pool: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLiquidity = async () => {
    if (!liquidityAmountA || !liquidityAmountB || !selectedPool) {
      toast.error('Please provide amounts and select a pool')
      return
    }

    setIsLoading(true)
    try {
      toast.success('Liquidity addition simulated successfully!')
      console.log('Adding liquidity:', { 
        liquidityAmountA, 
        liquidityAmountB, 
        selectedPool,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey 
      })
      
      // Clear form
      setLiquidityAmountA('')
      setLiquidityAmountB('')
    } catch (error) {
      console.error('Error adding liquidity:', error)
      toast.error('Error adding liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwap = async () => {
    if (!swapAmount || !selectedPool) {
      toast.error('Please provide swap amount and select a pool')
      return
    }

    setIsLoading(true)
    try {
      toast.success('Token swap simulated successfully!')
      console.log('Swapping:', { 
        swapAmount, 
        selectedPool,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey 
      })
      
      // Clear form
      setSwapAmount('')
    } catch (error) {
      console.error('Error swapping:', error)
      toast.error('Error swapping: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!selectedPool) {
      toast.error('Please select a pool')
      return
    }

    setIsLoading(true)
    try {
      toast.success('Liquidity removal simulated successfully!')
      console.log('Removing liquidity from:', { 
        selectedPool,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey 
      })
    } catch (error) {
      console.error('Error removing liquidity:', error)
      toast.error('Error removing liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">AMM Interface</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Interact with the Automated Market Maker on Solana Devnet
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Program ID: {AMM_PROGRAM_ID.toBase58()}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Connected: {account.publicKey}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Initialize Pool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏊 Initialize Pool
            </CardTitle>
            <CardDescription>Create a new liquidity pool between two tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tokenA">Token A Mint Address</Label>
              <Input
                id="tokenA"
                placeholder="e.g., So11111111111111111111111111111111111111112"
                value={tokenMintA}
                onChange={(e) => setTokenMintA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tokenB">Token B Mint Address</Label>
              <Input
                id="tokenB"
                placeholder="e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                value={tokenMintB}
                onChange={(e) => setTokenMintB(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleInitPool} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Initializing...' : 'Initialize Pool'}
            </Button>
          </CardFooter>
        </Card>

        {/* Add Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💧 Add Liquidity
            </CardTitle>
            <CardDescription>Provide liquidity to earn trading fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="poolSelect">Pool Address</Label>
              <Input
                id="poolSelect"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amountA">Amount A</Label>
              <Input
                id="amountA"
                type="number"
                placeholder="Amount of Token A"
                value={liquidityAmountA}
                onChange={(e) => setLiquidityAmountA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amountB">Amount B</Label>
              <Input
                id="amountB"
                type="number"
                placeholder="Amount of Token B"
                value={liquidityAmountB}
                onChange={(e) => setLiquidityAmountB(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleAddLiquidity} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Adding...' : 'Add Liquidity'}
            </Button>
          </CardFooter>
        </Card>

        {/* Swap Tokens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔄 Swap Tokens
            </CardTitle>
            <CardDescription>Exchange tokens through the AMM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="swapPool">Pool Address</Label>
              <Input
                id="swapPool"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="swapAmount">Swap Amount</Label>
              <Input
                id="swapAmount"
                type="number"
                placeholder="Amount to swap"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSwap} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Swapping...' : 'Swap Tokens'}
            </Button>
          </CardFooter>
        </Card>

        {/* Remove Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏃 Remove Liquidity
            </CardTitle>
            <CardDescription>Withdraw your liquidity from a pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="removePool">Pool Address</Label>
              <Input
                id="removePool"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleRemoveLiquidity} 
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? 'Removing...' : 'Remove Liquidity'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Information Panel */}
      <Card>
        <CardHeader>
          <CardTitle>📖 How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Initialize Pool</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create a new liquidity pool by providing the mint addresses of two tokens. 
                This creates a trading pair that others can trade against.
              </p>
              
              <h4 className="font-semibold mb-2">2. Add Liquidity</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Provide equal value of both tokens to earn trading fees. 
                You'll receive LP tokens representing your share of the pool.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3. Swap Tokens</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Exchange one token for another using the pool's liquidity. 
                The AMM automatically calculates the exchange rate.
              </p>
              
              <h4 className="font-semibold mb-2">4. Remove Liquidity</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Withdraw your liquidity and earned fees by burning your LP tokens 
                to receive the underlying tokens back.
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> This is a demo interface. In production, you would need 
              proper error handling, slippage protection, real transaction building, 
              and account validation. The buttons currently simulate the actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
