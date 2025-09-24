'use client'

import { useWalletUi } from '@wallet-ui/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Wallet } from 'lucide-react'

export default function AmmLayout({ children }: { children: React.ReactNode }) {
  const { account, cluster } = useWalletUi()

  if (!account || !cluster) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 p-6">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <Wallet className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Wallet Connection Required
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md">
                Please connect your wallet to access AMM features including trading, 
                providing liquidity, and managing your positions.
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
      </div>
    )
  }

  // If wallet is connected, render the children
  return <>{children}</>
}