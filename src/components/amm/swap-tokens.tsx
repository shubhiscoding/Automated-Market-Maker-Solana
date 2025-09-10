'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ArrowUpDown } from 'lucide-react'

interface SwapTokensProps {
  selectedPool: string
  swapFromTokenA: boolean
  swapAmount: string
  minimumAmountOut: string
  onPoolChange: (poolAddress: string) => void
  onSwapDirectionChange: (fromTokenA: boolean) => void
  onSwapAmountChange: (amount: string) => void
  onMinimumAmountOutChange: (amount: string) => void
  onSwap: () => Promise<void>
  isLoading: boolean
}

export function SwapTokens({
  selectedPool,
  swapFromTokenA,
  swapAmount,
  minimumAmountOut,
  onPoolChange,
  onSwapDirectionChange,
  onSwapAmountChange,
  onMinimumAmountOutChange,
  onSwap,
  isLoading
}: SwapTokensProps) {
  const handleSubmit = async () => {
    if (!selectedPool.trim()) {
      toast.error('Please select or enter a pool address')
      return
    }

    if (!swapAmount.trim()) {
      toast.error('Please enter swap amount')
      return
    }

    const amount = parseFloat(swapAmount)
    if (amount <= 0) {
      toast.error('Swap amount must be greater than 0')
      return
    }

    await onSwap()
  }

  const flipSwapDirection = () => {
    onSwapDirectionChange(!swapFromTokenA)
    toast.info(`Swapping direction flipped to ${!swapFromTokenA ? 'Token A → Token B' : 'Token B → Token A'}`)
  }

  const setMaxSlippage = (slippagePercent: number) => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) {
      toast.error('Please enter swap amount first')
      return
    }
    
    const amount = parseFloat(swapAmount)
    const minOut = amount * (1 - slippagePercent / 100)
    onMinimumAmountOutChange(minOut.toFixed(6))
    toast.info(`Set ${slippagePercent}% slippage protection`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔄 Swap Tokens
        </CardTitle>
        <CardDescription>
          Exchange tokens through the automated market maker
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="swapPool">Pool Address</Label>
          <Input
            id="swapPool"
            placeholder="Enter pool public key address or select from list above"
            value={selectedPool}
            onChange={(e) => onPoolChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            The pool to execute the swap against
          </p>
        </div>

        <div>
          <Label htmlFor="swapDirection" className="flex items-center justify-between">
            <span>Swap Direction</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={flipSwapDirection}
              className="text-xs"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Flip
            </Button>
          </Label>
          <div className="flex gap-2 mt-2">
            <Button
              variant={swapFromTokenA ? "default" : "outline"}
              onClick={() => onSwapDirectionChange(true)}
              className="flex-1"
            >
              Token A → Token B
            </Button>
            <Button
              variant={!swapFromTokenA ? "default" : "outline"}
              onClick={() => onSwapDirectionChange(false)}
              className="flex-1"
            >
              Token B → Token A
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {swapFromTokenA ? 'Selling Token A for Token B' : 'Selling Token B for Token A'}
          </p>
        </div>

        <div>
          <Label htmlFor="swapAmount">
            Swap Amount ({swapFromTokenA ? 'Token A' : 'Token B'})
          </Label>
          <Input
            id="swapAmount"
            type="number"
            step="0.1"
            placeholder="Amount to swap"
            value={swapAmount}
            onChange={(e) => onSwapAmountChange(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Amount of {swapFromTokenA ? 'Token A' : 'Token B'} to swap
          </p>
        </div>

        <div>
          <Label htmlFor="minimumOut" className="flex items-center justify-between">
            <span>Minimum Amount Out (Optional)</span>
            <div className="flex gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMaxSlippage(1)}
                className="text-xs px-2"
              >
                1%
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMaxSlippage(3)}
                className="text-xs px-2"
              >
                3%
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMaxSlippage(5)}
                className="text-xs px-2"
              >
                5%
              </Button>
            </div>
          </Label>
          <Input
            id="minimumOut"
            type="number"
            step="0.000001"
            placeholder="Minimum tokens to receive (slippage protection)"
            value={minimumAmountOut}
            onChange={(e) => onMinimumAmountOutChange(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Protects against high slippage - transaction will fail if you receive less
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>⚡ Price Impact:</strong> Large swaps may have significant price impact. 
            Consider breaking large trades into smaller parts.
          </p>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !selectedPool.trim() || !swapAmount.trim()}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Swapping...' : `Swap ${swapFromTokenA ? 'A → B' : 'B → A'}`}
        </Button>
      </CardFooter>
    </Card>
  )
}
