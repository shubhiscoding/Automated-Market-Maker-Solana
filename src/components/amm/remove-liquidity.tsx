'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface RemoveLiquidityProps {
  selectedPool: string
  onPoolChange: (poolAddress: string) => void
  onRemoveLiquidity: () => Promise<void>
  isLoading: boolean
}

export function RemoveLiquidity({
  selectedPool,
  onPoolChange,
  onRemoveLiquidity,
  isLoading
}: RemoveLiquidityProps) {
  const handleSubmit = async () => {
    if (!selectedPool.trim()) {
      toast.error('Please select or enter a pool address')
      return
    }

    await onRemoveLiquidity()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🏧 Remove Liquidity
        </CardTitle>
        <CardDescription>
          Withdraw your liquidity and claim earned fees
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="removePool">Pool Address</Label>
          <Input
            id="removePool"
            placeholder="Enter pool public key address or select from list above"
            value={selectedPool}
            onChange={(e) => onPoolChange(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            The pool you want to remove liquidity from
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>⚠️ Complete Withdrawal:</strong> This will remove ALL your liquidity 
            from the selected pool and burn all your LP tokens for that pool.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 What you'll receive:</strong>
          </p>
          <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
            <li>• Your proportional share of Token A</li>
            <li>• Your proportional share of Token B</li>
            <li>• All accumulated trading fees</li>
            <li>• WSOL will be automatically unwrapped to SOL</li>
          </ul>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !selectedPool.trim()}
          className="w-full"
          size="lg"
          variant="destructive"
        >
          {isLoading ? 'Removing Liquidity...' : 'Remove All Liquidity'}
        </Button>
      </CardFooter>
    </Card>
  )
}
