'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface AddLiquidityProps {
  selectedPool: string
  onAddLiquidity: (amountA: string, amountB: string) => Promise<void>
  onPoolChange: (poolAddress: string) => void
  isLoading: boolean
}

export function AddLiquidity({ 
  selectedPool, 
  onAddLiquidity, 
  onPoolChange, 
  isLoading 
}: AddLiquidityProps) {
  const [liquidityAmountA, setLiquidityAmountA] = useState('')
  const [liquidityAmountB, setLiquidityAmountB] = useState('')

  const handleSubmit = async () => {
    if (!selectedPool.trim()) {
      toast.error('Please select or enter a pool address')
      return
    }

    if (!liquidityAmountA.trim() || !liquidityAmountB.trim()) {
      toast.error('Please provide amounts for both tokens')
      return
    }

    const amountA = parseFloat(liquidityAmountA)
    const amountB = parseFloat(liquidityAmountB)

    if (amountA <= 0 || amountB <= 0) {
      toast.error('Amounts must be greater than 0')
      return
    }

    await onAddLiquidity(liquidityAmountA, liquidityAmountB)
    
    // Clear amounts on success
    setLiquidityAmountA('')
    setLiquidityAmountB('')
  }

  const setEqualAmounts = () => {
    if (liquidityAmountA) {
      setLiquidityAmountB(liquidityAmountA)
    } else if (liquidityAmountB) {
      setLiquidityAmountA(liquidityAmountB)
    } else {
      setLiquidityAmountA('1.0')
      setLiquidityAmountB('1.0')
    }
    toast.info('Set equal amounts for both tokens')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💧 Add Liquidity
        </CardTitle>
        <CardDescription>
          Provide liquidity to earn trading fees and receive LP tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="poolSelect" className='mb-1'>Pool Address</Label>
          <Input
            id="poolSelect"
            placeholder="Enter pool public key address or select from list above"
            value={selectedPool}
            onChange={(e) => onPoolChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            The pool you want to provide liquidity to
          </p>
        </div>

        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Token Amounts</Label>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={setEqualAmounts}
            className="text-xs"
          >
            Set Equal Amounts
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {/* <Label htmlFor="amountA">Amount A (SOL)</Label> */}
            <Input
              id="amountA"
              type="number"
              step="0.1"
              placeholder="e.g., 1.0"
              value={liquidityAmountA}
              onChange={(e) => setLiquidityAmountA(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Amount of first token
            </p>
          </div>
          
          <div>
            {/* <Label htmlFor="amountB">Amount B (SOL)</Label> */}
            <Input
              id="amountB"
              type="number"
              step="0.1"
              placeholder="e.g., 1.0"
              value={liquidityAmountB}
              onChange={(e) => setLiquidityAmountB(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Amount of second token
            </p>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            <strong>💰 Earnings:</strong> As a liquidity provider, you'll earn a portion 
            of all trading fees proportional to your share of the pool.
          </p>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !selectedPool.trim() || !liquidityAmountA.trim() || !liquidityAmountB.trim()}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
        </Button>
      </CardFooter>
    </Card>
  )
}
