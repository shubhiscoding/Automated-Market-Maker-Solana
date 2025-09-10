'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface InitializePoolProps {
  onInitializePool: (tokenMintA: string, tokenMintB: string) => Promise<void>
  isLoading: boolean
}

export function InitializePool({ onInitializePool, isLoading }: InitializePoolProps) {
  const [tokenMintA, setTokenMintA] = useState('')
  const [tokenMintB, setTokenMintB] = useState('')

  const handleSubmit = async () => {
    if (!tokenMintA.trim() || !tokenMintB.trim()) {
      toast.error('Please provide both token mint addresses')
      return
    }

    if (tokenMintA.trim() === tokenMintB.trim()) {
      toast.error('Token A and Token B must be different')
      return
    }

    await onInitializePool(tokenMintA.trim(), tokenMintB.trim())
    
    // Clear form on success
    setTokenMintA('')
    setTokenMintB('')
  }

  const populateExampleTokens = () => {
    // Popular Solana devnet token examples
    setTokenMintA('So11111111111111111111111111111111111111112') // WSOL
    setTokenMintB('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') // USDC
    toast.info('Populated with WSOL and USDC addresses')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏗️ Initialize Pool
        </CardTitle>
        <CardDescription>
          Create a new liquidity pool between two tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={populateExampleTokens}
            className="text-xs"
          >
            Use WSOL/USDC Example
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="tokenA">Token A Mint Address</Label>
            <Input
              id="tokenA"
              placeholder="e.g., So11111111111111111111111111111111111111112 (WSOL)"
              value={tokenMintA}
              onChange={(e) => setTokenMintA(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              The first token in the trading pair
            </p>
          </div>
          
          <div>
            <Label htmlFor="tokenB">Token B Mint Address</Label>
            <Input
              id="tokenB"
              placeholder="e.g., 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (USDC)"
              value={tokenMintB}
              onChange={(e) => setTokenMintB(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              The second token in the trading pair
            </p>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> Pool addresses are deterministic based on token order. 
            The same token pair will always generate the same pool address.
          </p>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !tokenMintA.trim() || !tokenMintB.trim()}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Initializing Pool...' : 'Initialize Pool'}
        </Button>
      </CardFooter>
    </Card>
  )
}
