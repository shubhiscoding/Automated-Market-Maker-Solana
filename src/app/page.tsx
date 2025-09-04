'use client'

import { AmmFeature } from '@/components/amm/amm-feature-enhanced'
import { useWalletUi } from '@wallet-ui/react';

export default function Home() {
  const { account, cluster } = useWalletUi()
  if(!account || !cluster) return null;
  return <AmmFeature />
}
