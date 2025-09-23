'use client'

import { PoolList } from '@/components/amm/pool-list'
import { useWalletUi } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ArrowUpDown, Wallet, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { account, cluster } = useWalletUi()

  if (!account || !cluster) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8 p-6">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Wallet className="h-12 w-12 text-blue-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Welcome to Solana AMM
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
              Connect your wallet to start trading, providing liquidity, and managing your positions
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-md">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              What you can do with AMM:
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
              <li>• Create new liquidity pools</li>
              <li>• Swap tokens instantly</li>
              <li>• Provide liquidity and earn fees</li>
              <li>• Manage your LP positions</li>
            </ul>
          </div>

          <div className="text-sm text-gray-500">
            Use the wallet button in the top navigation to connect your wallet
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8">
      {/* Enhanced Hero Section */}
      <div className="text-center space-y-4 sm:space-y-6 bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-2 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100">
            🌊 AMM Dashboard
          </h1>
          <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Manage liquidity pools, trade tokens, and earn fees on the Solana blockchain with our automated market maker
          </p>
        </div>
      </div>

      <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 justify-between'>
        {/* Enhanced Pool List Section */}
        <div className="w-full lg:flex-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="w-full sm:w-auto">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  🏊‍♂️ Available Pools
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                  Discover and interact with active liquidity pools
                </p>
              </div>
              <Link href="/create-pool">
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Pool
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="sm:p-6 overflow-auto">
            <PoolList />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full lg:flex-1 flex flex-col gap-4 sm:gap-6 lg:gap-8">
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-3 text-lg sm:text-xl text-gray-900 dark:text-gray-100">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                Create Pool
              </CardTitle>
              <CardDescription className="text-sm">
                Initialize a new liquidity pool with two tokens and start earning fees from every trade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/create-pool">
                <Button className="w-full" size="lg">
                  Create New Pool
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-3 text-lg sm:text-xl text-gray-900 dark:text-gray-100">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ArrowUpDown className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                Swap Tokens
              </CardTitle>
              <CardDescription className="text-sm">
                Trade tokens instantly with minimal slippage using available liquidity pools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/swap">
                <Button className="w-full" size="lg" variant="outline">
                  Start Swapping
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-3 text-lg sm:text-xl text-gray-900 dark:text-gray-100">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                Your Positions
              </CardTitle>
              <CardDescription className="text-sm">
                View and manage your liquidity positions, add or remove liquidity to maximize earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/positions">
                <Button className="w-full" size="lg" variant="outline">
                  Manage Positions
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Section */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Pools
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  --
                </p>
                <p className="text-xs text-gray-500 mt-1">Active liquidity pools</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Value Locked
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  --
                </p>
                <p className="text-xs text-gray-500 mt-1">Across all pools</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Wallet className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  24h Volume
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  --
                </p>
                <p className="text-xs text-gray-500 mt-1">Trading volume</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <ArrowUpDown className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div> */}
    </div>
  )
}
