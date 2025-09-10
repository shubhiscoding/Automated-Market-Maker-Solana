'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InfoPanelProps {
  programId: string
  walletAddress: string
}

export function InfoPanel({ programId, walletAddress }: InfoPanelProps) {
  const steps = [
    {
      number: 1,
      title: "Initialize Pool",
      description: "Create a new liquidity pool by providing the mint addresses of two tokens. This creates a trading pair that others can trade against.",
      icon: "🏗️"
    },
    {
      number: 2,
      title: "Add Liquidity",
      description: "Provide equal value of both tokens to earn trading fees. You'll receive LP tokens representing your share of the pool.",
      icon: "💧"
    },
    {
      number: 3,
      title: "Swap Tokens",
      description: "Exchange one token for another using the pool's liquidity. The AMM automatically calculates the exchange rate based on the constant product formula.",
      icon: "🔄"
    },
    {
      number: 4,
      title: "Remove Liquidity",
      description: "Withdraw your liquidity and earned fees by burning your LP tokens to receive the underlying tokens back.",
      icon: "🏧"
    }
  ]

  const features = [
    { label: "Automated Market Making", description: "Constant product formula (x * y = k)" },
    { label: "Fee Generation", description: "0.3% trading fees for liquidity providers" },
    { label: "WSOL Support", description: "Automatic wrapping/unwrapping of SOL" },
    { label: "Slippage Protection", description: "Minimum amount out parameters" },
    { label: "Deterministic Pools", description: "Same token pairs = same pool address" }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📖 AMM Guide & Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Connection Status */}
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-green-800 dark:text-green-200">🟢 Connected</h4>
            <span className="px-2.5 py-0.5 text-xs font-medium border rounded-full bg-white dark:bg-gray-800">
              Solana Devnet
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Wallet:</span> 
              <code className="ml-2 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
              </code>
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Program:</span> 
              <code className="ml-2 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded">
                {programId.slice(0, 8)}...{programId.slice(-8)}
              </code>
            </p>
          </div>
        </div>

        {/* How to Use */}
        <div className="mb-6">
          <h4 className="font-semibold mb-4 text-lg">How to Use the AMM</h4>
          <div className="grid gap-4">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-sm font-semibold text-blue-800 dark:text-blue-200">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h5 className="font-medium mb-1 flex items-center gap-2">
                    <span>{step.icon}</span>
                    {step.title}
                  </h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-6">
          <h4 className="font-semibold mb-4 text-lg">AMM Features</h4>
          <div className="grid gap-3">
            {features.map((feature, index) => (
              <div key={index} className="flex justify-between items-center p-2 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
                <span className="font-medium text-sm">{feature.label}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{feature.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            ⚠️ Important Notes
          </h5>
          <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
            <li>• This is running on Solana Devnet - not real money</li>
            <li>• Always verify pool addresses before large transactions</li>
            <li>• Consider price impact for large trades</li>
            <li>• LP tokens represent your ownership in the pool</li>
            <li>• Impermanent loss can occur with volatile asset pairs</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
