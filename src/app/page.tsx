'use client'

import { PoolList } from '@/components/amm/pool-list'
import { useWalletUi } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ArrowUpDown, Wallet } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { account, cluster } = useWalletUi()
  
  if (!account || !cluster) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome to Solana AMM
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
            Connect your wallet to start trading, providing liquidity, and managing your positions
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          Please connect your wallet to use the AMM features
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          Solana AMM
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Trade tokens, provide liquidity, and earn fees on the fastest blockchain
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-500" />
              Create Pool
            </CardTitle>
            <CardDescription>
              Initialize a new liquidity pool with two tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/amm/create-pool">
              <Button className="w-full" size="lg">
                Create New Pool
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-green-500" />
              Swap Tokens
            </CardTitle>
            <CardDescription>
              Trade tokens instantly with minimal slippage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/amm/swap">
              <Button className="w-full" size="lg" variant="outline">
                Start Swapping
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-500" />
              Your Positions
            </CardTitle>
            <CardDescription>
              View and manage your liquidity positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/amm/positions">
              <Button className="w-full" size="lg" variant="outline">
                View Positions
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Pool List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Available Pools
          </h2>
          <Link href="/amm/create-pool">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Pool
            </Button>
          </Link>
        </div>
        <PoolList />
      </div>
    </div>
  )
}
