'use client'

import { useState } from 'react'
import { useWalletUi } from '@wallet-ui/react'
import { useAmmProgram } from './amm-data-access'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export function AmmFeature() {
  const { account } = useWalletUi()
  const { programId } = useAmmProgram()
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
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">AMM Interface</h2>
        <p>Please connect your wallet to interact with the AMM</p>
      </div>
    )
  }

  const handleInitPool = async () => {
    if (!tokenMintA || !tokenMintB) {
      alert('Please provide both token mint addresses')
      return
    }

    setIsLoading(true)
    try {
      // This is a simplified version - in a real implementation you'd need to:
      // 1. Create the proper accounts
      // 2. Handle token mints properly
      // 3. Add proper error handling
      console.log('Initializing pool with:', { tokenMintA, tokenMintB })
      alert('Pool initialization would happen here (simplified for demo)')
    } catch (error) {
      console.error('Error initializing pool:', error)
      alert('Error initializing pool: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLiquidity = async () => {
    if (!liquidityAmountA || !liquidityAmountB || !selectedPool) {
      alert('Please provide amounts and select a pool')
      return
    }

    setIsLoading(true)
    try {
      console.log('Adding liquidity:', { liquidityAmountA, liquidityAmountB, selectedPool })
      alert('Add liquidity would happen here (simplified for demo)')
    } catch (error) {
      console.error('Error adding liquidity:', error)
      alert('Error adding liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwap = async () => {
    if (!swapAmount || !selectedPool) {
      alert('Please provide swap amount and select a pool')
      return
    }

    setIsLoading(true)
    try {
      console.log('Swapping:', { swapAmount, selectedPool })
      alert('Swap would happen here (simplified for demo)')
    } catch (error) {
      console.error('Error swapping:', error)
      alert('Error swapping: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">AMM Interface</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Interact with the Automated Market Maker on Solana Devnet
        </p>
        <p className="text-sm text-gray-500">
          Program ID: {programId.toBase58()}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Initialize Pool */}
        <Card>
          <CardHeader>
            <CardTitle>Initialize Pool</CardTitle>
            <CardDescription>Create a new liquidity pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tokenA">Token A Mint Address</Label>
              <Input
                id="tokenA"
                placeholder="Token A mint address"
                value={tokenMintA}
                onChange={(e) => setTokenMintA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tokenB">Token B Mint Address</Label>
              <Input
                id="tokenB"
                placeholder="Token B mint address"
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
            <CardTitle>Add Liquidity</CardTitle>
            <CardDescription>Provide liquidity to earn fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="poolSelect">Pool Address</Label>
              <Input
                id="poolSelect"
                placeholder="Pool address"
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

        {/* Swap */}
        <Card>
          <CardHeader>
            <CardTitle>Swap Tokens</CardTitle>
            <CardDescription>Exchange tokens through the AMM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="swapPool">Pool Address</Label>
              <Input
                id="swapPool"
                placeholder="Pool address"
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
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1. Initialize Pool:</strong> Create a new liquidity pool with two token mints</p>
            <p><strong>2. Add Liquidity:</strong> Provide equal value of both tokens to earn trading fees</p>
            <p><strong>3. Swap Tokens:</strong> Exchange one token for another using the pool</p>
            <p><strong>Note:</strong> This is a basic interface. In production, you&apos;d need proper token handling, slippage protection, and error handling.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
