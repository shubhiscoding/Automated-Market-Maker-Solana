'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWalletUi } from '@wallet-ui/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { address } from '@solana/addresses'
import { AMM_PROGRAM_ID } from './amm-data-access'
import { fetchPool } from '../../../anchor/src/client/js/generated'
import { deriveVaultAPDA, deriveVaultBPDA } from './amm-utils'
import { PublicKey } from '@solana/web3.js'

interface PoolInfo {
  address: string
  [key: string]: unknown
}

interface DetailedPoolInfo extends PoolInfo {
  mintA?: string
  mintB?: string
  vaultABalance?: number
  vaultBBalance?: number
  vaultAAddress?: string
  vaultBAddress?: string
  TokenADecimal?: number
  TokenBDecimal?: number
  isLoading?: boolean
  error?: string
  feeBps?: number
}

// Helper function to format token amounts
function formatTokenAmount(amount: number, decimals: number = 9): string {
  return (amount / Math.pow(10, decimals)).toFixed(4)
}

interface prop {
  setSelectedPool?: (poolAddress: string) => void
  containerSize?: 'compact' | 'full' // New prop to control layout
}

// Standalone PoolList component for display purposes
export function PoolList(prop?: prop) {
  const { setSelectedPool, containerSize = 'full' } = prop || {};
  const { client } = useWalletUi()
  const [pools, setPools] = useState<DetailedPoolInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Determine if we should use compact layout
  const isCompact = containerSize === 'compact'

  useEffect(() => {
    async function fetchPools() {
      if (!client?.rpc) {
        setIsLoading(false)
        return
      }

      try {
        // Replace with your program ID
        const PROGRAM_ID = AMM_PROGRAM_ID
        // Fetch all pool accounts
        const poolAccounts = await client.rpc.getProgramAccounts(address(PROGRAM_ID.toBase58()), { encoding: 'base64' }).send()
        
        // Set initial pool data with loading state
        const initialPools: DetailedPoolInfo[] = poolAccounts.map((p) => ({
          address: p.pubkey,
          isLoading: true,
          ...p.account?.data
        }))
        setPools(initialPools)

        // Fetch detailed information for each pool
        const detailedPools = await Promise.all(
          poolAccounts.map(async (p) => {
            try {
              // Fetch pool data
              const poolData = await fetchPool(client.rpc, address(p.pubkey))
              const mintA = poolData.data.mintA
              const mintB = poolData.data.mintB

              // Derive vault addresses
              const [vaultAAddress] = deriveVaultAPDA(new PublicKey(p.pubkey))
              const [vaultBAddress] = deriveVaultBPDA(new PublicKey(p.pubkey))

              // Fetch vault balances
              const [vaultAInfo, vaultBInfo] = await Promise.all([
                client.rpc.getAccountInfo(address(vaultAAddress.toBase58()), {encoding: 'base64'}).send().catch(() => null),
                client.rpc.getAccountInfo(address(vaultBAddress.toBase58()), {encoding: 'base64'}).send().catch(() => null)
              ])

              console.log('Vault A Info:', vaultAInfo)
              console.log('Vault B Info:', vaultBInfo)

              // Extract token balances (simplified - in reality you'd parse the token account data)
              let vaultABalance = 0
              let vaultBBalance = 0
              let TokenADecimal = 0
              let TokenBDecimal = 0

              if (vaultAInfo?.value) {
                try {
                  // This is a simplified balance extraction - in reality you'd need to properly decode the token account
                  const tokenBalance = await client.rpc.getTokenAccountBalance(address(vaultAAddress.toBase58())).send()
                  console.log('Token Balance A:', tokenBalance)
                  vaultABalance = Number(tokenBalance.value.amount)
                  TokenADecimal = Number(tokenBalance.value.decimals)
                } catch (e) {
                  console.log('Could not fetch vault A balance:', e)
                }
              }

              if (vaultBInfo?.value) {
                try {
                  const tokenBalance = await client.rpc.getTokenAccountBalance(address(vaultBAddress.toBase58())).send()
                  vaultBBalance = Number(tokenBalance.value.amount)
                  console.log('Token Balance B:', tokenBalance)
                  TokenBDecimal = Number(tokenBalance.value.decimals)
                } catch (e) {
                  console.log('Could not fetch vault B balance:', e)
                }
              }

              return {
                address: p.pubkey,
                mintA,
                mintB,
                vaultABalance,
                vaultBBalance,
                vaultAAddress: vaultAAddress.toBase58(),
                vaultBAddress: vaultBAddress.toBase58(),
                TokenADecimal,
                TokenBDecimal,
                isLoading: false,
                ...p.account?.data,
                feeBps: poolData.data.feeBps
              } as DetailedPoolInfo
            } catch (error) {
              console.error(`Error fetching details for pool ${p.pubkey}:`, error)
              return {
                address: p.pubkey,
                isLoading: false,
                error: 'Failed to load pool details',
                ...p.account?.data
              } as DetailedPoolInfo
            }
          })
        )

        setPools(detailedPools)
      } catch (err) {
        console.error('Error fetching pools:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPools()
  }, [client])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pools...
          </div>
        </CardContent>
      </Card>
    )
  }

  if(isCompact){
    return (
      <PoolListWithProps onSelectPool={setSelectedPool!} pools={pools} selectedPool={''} />
    )
  }

  return (
    <Card>
      <CardHeader>
        {/* <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          🏊‍♂️ Available Pools
        </CardTitle> */}
      </CardHeader>
      <CardContent>
        {pools.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No pools found. Create the first pool to get started!
            </p>
            <Link href="/create-pool">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Pool
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Found {pools.length} active pool(s):
            </p> */}
            <div className="grid gap-3 sm:gap-4">
              {pools.map((pool, index) => (
                <div 
                  key={pool.address} 
                  className="p-3 sm:p-4 border rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Pool Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className='flex-1 flex items-start gap-3'>
                        <div className="min-w-0 pt-1">
                          <p className={`font-mono mb-1 truncate ${
                            isCompact ? 'text-xs' : 'text-xs sm:text-sm'
                          }`}>
                            {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                          </p>
                          <p className="text-xs text-gray-500">Pool #{index + 1}</p>
                        </div>
                        <Button size="sm" variant="outline" className={`!bg-transparent max-w-fit ${
                          isCompact ? 'text-xs px-2 py-1 h-auto' : 'w-full sm:w-auto'
                        }`}>
                          Fee: {pool.feeBps ? `${pool.feeBps/100}%` : 'N/A'}
                        </Button>
                      </div>
                      {!isCompact &&<div className="flex gap-2 w-full sm:w-auto">
                        <Link href={`/swap?pool=${pool.address}`} className="flex-1 sm:flex-none">
                          <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedPool && setSelectedPool(pool.address)}>
                            Swap
                          </Button>
                        </Link>
                        <Link href={`/positions?pool=${pool.address}`} className="flex-1 sm:flex-none">
                          <Button size="sm" variant="outline" className="w-full sm:w-auto">
                            Add LP
                          </Button>
                        </Link>
                      </div>}
                    </div>

                    {/* Pool Details */}
                    {pool.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading pool details...
                      </div>
                    ) : pool.error ? (
                      <div className="text-sm text-red-500">
                        {pool.error}
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {/* Token Pair */}
                        <div className={`grid gap-3 ${
                          isCompact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                        }`}>
                          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <p className="text-xs text-gray-500 uppercase mb-1">Token A</p>
                            <p className="font-mono text-xs break-all">
                              {pool.mintA ? `${pool.mintA.slice(0, 6)}...${pool.mintA.slice(-6)}` : 'Unknown'}
                            </p>
                            {pool.vaultABalance !== undefined && (
                              <p className="text-xs text-green-600 mt-1">
                                Balance: {formatTokenAmount(pool.vaultABalance, pool.TokenADecimal)}
                              </p>
                            )}
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <p className="text-xs text-gray-500 uppercase mb-1">Token B</p>
                            <p className="font-mono text-xs break-all">
                              {pool.mintB ? `${pool.mintB.slice(0, 6)}...${pool.mintB.slice(-6)}` : 'Unknown'}
                            </p>
                            {pool.vaultBBalance !== undefined && (
                              <p className="text-xs text-green-600 mt-1">
                                Balance: {formatTokenAmount(pool.vaultBBalance, pool.TokenBDecimal)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Vault Addresses */}
                        {/* {pool.vaultAAddress && pool.vaultBAddress && (
                          <div className="pt-2 border-t">
                            <p className="text-xs text-gray-500 mb-2">Vault Addresses:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                              <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                <span className="text-gray-400">A: </span>
                                <span className="break-all">{pool.vaultAAddress.slice(0, 6)}...{pool.vaultAAddress.slice(-6)}</span>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                                <span className="text-gray-400">B: </span>
                                <span className="break-all">{pool.vaultBAddress.slice(0, 6)}...{pool.vaultBAddress.slice(-6)}</span>
                              </div>
                            </div>
                          </div>
                        )} */}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Props-based PoolList component for use in other components
interface PoolListWithPropsProps {
  pools: DetailedPoolInfo[] // Changed from PoolInfo to DetailedPoolInfo
  selectedPool: string
  onSelectPool: (poolAddress: string) => void
}

export function PoolListWithProps({ pools, selectedPool, onSelectPool }: PoolListWithPropsProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        {/* <CardTitle className="flex items-center gap-2">
          🏊‍♂️ Available Pools
        </CardTitle> */}
      </CardHeader>
      <CardContent>
        {pools.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No pools found. Create the first pool to get started!
            </p>
            <p className="text-sm text-gray-400">
              Once pools are created, they will appear here for selection.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Found {pools.length} pool(s). Click to select for operations:
            </p> */}
            <div className="grid gap-3">
              {pools.map((pool, index) => (
                <div 
                  key={pool.address} 
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPool === pool.address 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => onSelectPool(pool.address)}
                >
                  <div className="space-y-3">
                    {/* Pool Header */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs truncate">
                            {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                          </p>
                          <p className="text-xs text-gray-500">Pool #{index + 1}</p>
                        </div>
                        <div className="flex gap-2">
                          {pool.feeBps && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              Fee: {pool.feeBps/100}%
                            </span>
                          )}
                          <Button 
                            size="sm" 
                            variant={selectedPool === pool.address ? "default" : "outline"}
                            className="text-xs px-2 py-1 h-auto"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectPool(pool.address)
                            }}
                          >
                            {selectedPool === pool.address ? 'Selected' : 'Select'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Token Information */}
                    {(pool.mintA || pool.mintB) && (
                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-gray-500 uppercase mb-1">Token A</p>
                              <p className="font-mono break-all">
                                {pool.mintA ? `${pool.mintA.slice(0, 6)}...${pool.mintA.slice(-6)}` : 'Unknown'}
                              </p>
                              {pool.vaultABalance !== undefined && (
                                <p className="text-green-600 mt-1">
                                  Bal: {formatTokenAmount(pool.vaultABalance, pool.TokenADecimal)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-500 uppercase mb-1">Token B</p>
                              <p className="font-mono break-all">
                                {pool.mintB ? `${pool.mintB.slice(0, 6)}...${pool.mintB.slice(-6)}` : 'Unknown'}
                              </p>
                              {pool.vaultBBalance !== undefined && (
                                <p className="text-green-600 mt-1">
                                  Bal: {formatTokenAmount(pool.vaultBBalance, pool.TokenBDecimal)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
