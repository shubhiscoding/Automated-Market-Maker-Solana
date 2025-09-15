'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useWalletUi } from '@wallet-ui/react'
import { address } from '@solana/addresses'
import { fetchPool } from '../../../anchor/src/client/js/generated'
import { deriveVaultAPDA, deriveVaultBPDA } from '@/components/amm/amm-utils'
import { PublicKey } from '@solana/web3.js'

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
  const { client } = useWalletUi()
  const [inputAmount, setInputAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState<'A' | 'B'>('A')
  const [calculatedAmount, setCalculatedAmount] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [poolRatio, setPoolRatio] = useState<{ vaultA: number, vaultB: number, decimalsA: number, decimalsB: number } | null>(null)
  const [error, setError] = useState('')
  const [isEmptyPool, setIsEmptyPool] = useState(false)
  
  // For empty pool - dual token input
  const [tokenAAmount, setTokenAAmount] = useState('')
  const [tokenBAmount, setTokenBAmount] = useState('')

  // Fetch pool info and calculate ratios when pool changes
  useEffect(() => {
    const fetchPoolRatio = async () => {
      if (!selectedPool || !client?.rpc) {
        setPoolRatio(null)
        setCalculatedAmount('')
        setError('')
        return
      }

      try {
        const poolData = await fetchPool(client.rpc, address(selectedPool))
        const [vaultA] = deriveVaultAPDA(new PublicKey(selectedPool))
        const [vaultB] = deriveVaultBPDA(new PublicKey(selectedPool))

        const vaultAInfo = await client.rpc.getTokenAccountBalance(address(vaultA.toBase58())).send()
        const vaultBInfo = await client.rpc.getTokenAccountBalance(address(vaultB.toBase58())).send()

        const vaultABalance = parseInt(vaultAInfo.value.amount)
        const vaultBBalance = parseInt(vaultBInfo.value.amount)
        const decimalsA = vaultAInfo.value.decimals
        const decimalsB = vaultBInfo.value.decimals

        if (vaultABalance === 0 || vaultBBalance === 0) {
          setError('Pool is empty - this will be initial liquidity')
          setPoolRatio(null)
          setIsEmptyPool(true)
        } else {
          setPoolRatio({
            vaultA: vaultABalance,
            vaultB: vaultBBalance,
            decimalsA,
            decimalsB
          })
          setError('')
          setIsEmptyPool(false)
        }
      } catch (err) {
        console.error('Error fetching pool data:', err)
        setError('Error loading pool data')
        setPoolRatio(null)
      }
    }

    fetchPoolRatio()
  }, [selectedPool, client])

  // Calculate required amount when input changes
  useEffect(() => {
    const calculateRequiredAmount = () => {
      if (!inputAmount || !poolRatio || parseFloat(inputAmount) <= 0) {
        setCalculatedAmount('')
        return
      }

      setIsCalculating(true)
      
      try {
        const inputValue = parseFloat(inputAmount)
        
        if (selectedToken === 'A') {
          // User provided Token A, calculate Token B needed
          const inputLamports = Math.floor(inputValue * (10 ** poolRatio.decimalsA))
          const requiredBLamports = Math.floor((inputLamports * poolRatio.vaultB) / poolRatio.vaultA)
          const requiredB = requiredBLamports / (10 ** poolRatio.decimalsB)
          setCalculatedAmount(requiredB.toFixed(poolRatio.decimalsB))
        } else {
          // User provided Token B, calculate Token A needed
          const inputLamports = Math.floor(inputValue * (10 ** poolRatio.decimalsB))
          const requiredALamports = Math.floor((inputLamports * poolRatio.vaultA) / poolRatio.vaultB)
          const requiredA = requiredALamports / (10 ** poolRatio.decimalsA)
          setCalculatedAmount(requiredA.toFixed(poolRatio.decimalsA))
        }
      } catch (err) {
        console.error('Calculation error:', err)
        setCalculatedAmount('')
      } finally {
        setIsCalculating(false)
      }
    }

    calculateRequiredAmount()
  }, [inputAmount, selectedToken, poolRatio])

  const handleSubmit = async () => {
    if (!selectedPool.trim()) {
      toast.error('Please select or enter a pool address')
      return
    }

    if (!inputAmount.trim()) {
      toast.error('Please enter an amount')
      return
    }

    const inputValue = parseFloat(inputAmount)
    if (inputValue <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    if (isEmptyPool) {
      // For empty pool, both amounts are required
      if (!calculatedAmount || parseFloat(calculatedAmount) <= 0) {
        toast.error('For initial liquidity, please provide both token amounts')
        return
      }
      
      // For empty pool, use inputAmount as Token A and calculatedAmount as Token B
      await onAddLiquidity(inputAmount, calculatedAmount)
    } else {
      // For existing pool, calculate the required amount for the other token
      if (!calculatedAmount) {
        toast.error('Please wait for the required amount to be calculated')
        return
      }
      
      // Determine which amounts to pass based on selected token
      const amountA = selectedToken === 'A' ? inputAmount : calculatedAmount
      const amountB = selectedToken === 'B' ? inputAmount : calculatedAmount
      
      await onAddLiquidity(amountA, amountB)
    }
    
    // Clear amounts on success
    setInputAmount('')
    setCalculatedAmount('')
  }

  const getCurrentRatio = () => {
    if (!poolRatio) return null
    const ratioAToB = (poolRatio.vaultA / (10 ** poolRatio.decimalsA)) / (poolRatio.vaultB / (10 ** poolRatio.decimalsB))
    const ratioBToA = (poolRatio.vaultB / (10 ** poolRatio.decimalsB)) / (poolRatio.vaultA / (10 ** poolRatio.decimalsA))
    return { ratioAToB, ratioBToA }
  }

  const ratio = getCurrentRatio()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💧 Add Liquidity
        </CardTitle>
        <CardDescription>
          {isEmptyPool 
            ? "Set the initial pool ratio by providing both tokens"
            : "Enter amount for one token - we'll calculate the required amount for the other token"
          }
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

        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ {error}
            </p>
          </div>
        )}

        {ratio && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">📊 Current Pool Ratio</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <div>1 Token A = {ratio.ratioAToB.toFixed(6)} Token B</div>
              <div>1 Token B = {ratio.ratioBToA.toFixed(6)} Token A</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {isEmptyPool ? (
            // Empty Pool - Dual Token Input
            <>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">🏗️ Initial Pool Setup</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This pool is empty. You&apos;ll establish the initial exchange rate by providing both tokens.
                </p>
              </div>

              {/* Token A Input */}
              <div>
                <Label htmlFor="tokenAAmount" className="text-sm font-medium">
                  Token A Amount
                </Label>
                <Input
                  id="tokenAAmount"
                  type="number"
                  step="0.000001"
                  placeholder="e.g., 1000"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Token B Input */}
              <div>
                <Label htmlFor="tokenBAmount" className="text-sm font-medium">
                  Token B Amount
                </Label>
                <Input
                  id="tokenBAmount"
                  type="number"
                  step="0.000001"
                  placeholder="e.g., 1"
                  value={calculatedAmount}
                  onChange={(e) => setCalculatedAmount(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Initial Price Display */}
              {inputAmount && calculatedAmount && parseFloat(inputAmount) > 0 && parseFloat(calculatedAmount) > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💱 Initial Exchange Rate</h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <div>1 Token A = {(parseFloat(calculatedAmount) / parseFloat(inputAmount)).toFixed(6)} Token B</div>
                    <div>1 Token B = {(parseFloat(inputAmount) / parseFloat(calculatedAmount)).toFixed(6)} Token A</div>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    This ratio will be used for all future swaps in this pool
                  </div>
                </div>
              )}
            </>
          ) : (
            // Existing Pool - Single Token Input
            <>
              {/* Token Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Which token do you want to provide?</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={selectedToken === 'A' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedToken('A')}
                    className="flex-1"
                  >
                    Token A
                  </Button>
                  <Button 
                    variant={selectedToken === 'B' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedToken('B')}
                    className="flex-1"
                  >
                    Token B
                  </Button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <Label htmlFor="inputAmount" className="text-sm font-medium">
                  Amount of Token {selectedToken}
                </Label>
                <Input
                  id="inputAmount"
                  type="number"
                  step="0.000001"
                  placeholder="e.g., 1.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the amount of Token {selectedToken} you want to provide
                </p>
              </div>

              {/* Calculated Amount Display */}
              {inputAmount && parseFloat(inputAmount) > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Required Token {selectedToken === 'A' ? 'B' : 'A'}:
                    </span>
                    {isCalculating && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {calculatedAmount ? parseFloat(calculatedAmount).toFixed(6) : '0.000000'} Token {selectedToken === 'A' ? 'B' : 'A'}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-1">
                    Calculated based on current pool ratio
                  </div>
                </div>
              )}
            </>
          )}

          {/* Summary */}
          {inputAmount && parseFloat(inputAmount) > 0 && (isEmptyPool ? calculatedAmount && parseFloat(calculatedAmount) > 0 : true) && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">📝 Transaction Summary</h4>
              <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                {isEmptyPool ? (
                  <>
                    <div>• You will provide: {parseFloat(inputAmount).toFixed(6)} Token A</div>
                    <div>• You will provide: {parseFloat(calculatedAmount || '0').toFixed(6)} Token B</div>
                    <div>• This will establish the initial pool ratio</div>
                  </>
                ) : (
                  <>
                    <div>• You will provide: {parseFloat(inputAmount).toFixed(6)} Token {selectedToken}</div>
                    {calculatedAmount && (
                      <div>• Required Token {selectedToken === 'A' ? 'B' : 'A'}: {parseFloat(calculatedAmount).toFixed(6)}</div>
                    )}
                  </>
                )}
                <div>• You will receive LP tokens representing your pool share</div>
                <div>• You&apos;ll earn trading fees proportional to your position</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleSubmit} 
          disabled={
            isLoading || 
            !selectedPool.trim() || 
            !inputAmount.trim() || 
            parseFloat(inputAmount || '0') <= 0 ||
            (isEmptyPool ? (!calculatedAmount || parseFloat(calculatedAmount || '0') <= 0) : !calculatedAmount)
          }
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
        </Button>
      </CardFooter>
    </Card>
  )
}
