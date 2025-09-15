'use client'

import { useState, useEffect } from 'react'
import { AddLiquidity } from '@/components/amm/add-liquidity'
import { RemoveLiquidity } from '@/components/amm/remove-liquidity'
import { PoolListWithProps } from '@/components/amm/pool-list'
import { useWalletUi } from '@wallet-ui/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { address } from '@solana/addresses'
import { AMM_PROGRAM_ID } from '@/components/amm/amm-data-access'
import { fetchPool, getAddLiquidityInstruction, getRemoveLiquidityInstruction, Pool } from '../../../../anchor/src/client/js/generated'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, createCloseAccountInstruction } from '@solana/spl-token'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { 
  deriveVaultAPDA, 
  deriveVaultBPDA, 
  deriveLpMintPDA,
  derivePoolAuthPDA,
  deriveTokenAta
} from '@/components/amm/amm-utils'
import { createTransaction, IInstruction, LAMPORTS_PER_SOL, signAndSendTransactionMessageWithSigners, getBase58Decoder } from 'gill'
import { fromLegacyTransactionInstruction } from '@/lib/utils'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'

interface PoolInfo {
  address: string
  [key: string]: unknown
}

interface UserPosition {
  poolAddress: string
  pool: Pool
  lpTokenBalance: number
  mintAAddress: string
  mintBAddress: string
  lpMintAddress: string
}

export default function PositionsPage() {
  const { client, account } = useWalletUi()
  const [selectedPool, setSelectedPool] = useState('')
  const [allPools, setAllPools] = useState<PoolInfo[]>([])
  const [userPositions, setUserPositions] = useState<UserPosition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPositions, setIsLoadingPositions] = useState(false)
  const [liquidityMode, setLiquidityMode] = useState<'add' | 'remove'>('add')
  const [viewMode, setViewMode] = useState<'positions' | 'all-pools'>('positions')
  
  const rawSigner = useWalletUiSigner()
  const signer = account ? rawSigner : null
  
  // Get pool from URL params if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const poolParam = urlParams.get('pool')
      if (poolParam) {
        setSelectedPool(poolParam)
      }
    }
  }, [])

  // Fetch pools on mount
  useEffect(() => {
    async function fetchPools() {
      if (!client?.rpc) return
      try {
        // Replace with your program ID
        const PROGRAM_ID = AMM_PROGRAM_ID
        // Fetch all pool accounts
        const poolAccounts = await client.rpc.getProgramAccounts(address(PROGRAM_ID.toBase58()), { encoding: 'base64' }).send()
        const poolsData = poolAccounts.map((p) => ({
          address: p.pubkey,
          ...p.account?.data
        }))
        setAllPools(poolsData)
        console.log('Fetched pools:', poolsData)
      } catch (err) {
        console.error('Error fetching pools:', err)
      }
    }
    fetchPools()
  }, [client])

  // Fetch user positions when wallet is connected
  useEffect(() => {
    async function fetchUserPositions() {
      if (!client?.rpc || !account?.publicKey) {
        setUserPositions([])
        return
      }

      setIsLoadingPositions(true)
      try {
        const positions: UserPosition[] = []
        
        // Get all pool accounts
        const PROGRAM_ID = AMM_PROGRAM_ID
        const poolAccounts = await client.rpc.getProgramAccounts(address(PROGRAM_ID.toBase58()), { encoding: 'base64' }).send()
        console.log(poolAccounts);
        for (const poolAccount of poolAccounts) {
          try {
            // Fetch detailed pool data
            const pool = await fetchPool(client.rpc, address(poolAccount.pubkey))
            console.log("pool", pool);
            
            const userLpAta = await deriveTokenAta(new PublicKey(account.publicKey), new PublicKey(pool.data.lpMint))
            console.log(userLpAta.toBase58());
            const tokenAccountInfo = await client.rpc.getTokenAccountBalance(address(userLpAta.toBase58())).send()
            console.log("info", tokenAccountInfo);
            // // Check if user has LP tokens for this pool
            // const walletAddress = typeof account.publicKey === 'string' ? account.publicKey : account.publicKey.toString()
            // const tokenAccounts = await client.rpc.getTokenAccountsByOwner(
            //   address(walletAddress),
            //   { 
            //     mint: pool.data.lpMint,
            //     programId: address(TOKEN_PROGRAM_ID.toBase58())
            //   },
            //   { encoding: 'jsonParsed' }
            // ).send()

            // console.log(tokenAccounts);

            if (tokenAccountInfo.value) {
              const tokenAccount = tokenAccountInfo.value;
              const balance = tokenAccount.uiAmountString;
              
              if (balance !== null && Number(balance) > 0) {
                positions.push({
                  poolAddress: poolAccount.pubkey,
                  pool: pool.data,
                  lpTokenBalance: Number(balance),
                  mintAAddress: pool.data.mintA,
                  mintBAddress: pool.data.mintB,
                  lpMintAddress: pool.data.lpMint
                })
              }
            }
          } catch (err) {
            console.warn(`Error fetching data for pool ${poolAccount.pubkey}:`, err)
          }
        }
        
        setUserPositions(positions)
      } catch (err) {
        console.error('Error fetching user positions:', err)
        toast.error('Failed to load your positions')
      } finally {
        setIsLoadingPositions(false)
      }
    }

    fetchUserPositions()
  }, [client, account])

  // Add this function before the handleAddLiquidity function
  const calculateOptimalLiquidity = (
    desiredAmountA: number,
    desiredAmountB: number,
    vaultABalance: number,
    vaultBBalance: number,
    supply: number,
    decimalsA: number,
    decimalsB: number
  ) => {
    // Convert to lamports
    const amountALamports = Math.floor(desiredAmountA * (10 ** decimalsA))
    const amountBLamports = Math.floor(desiredAmountB * (10 ** decimalsB))
    
    if (supply === 0) {
      // Initial liquidity - both required
      if (amountALamports === 0 || amountBLamports === 0) {
        throw new Error('Both tokens are required for initial liquidity')
      }
      return {
        actualAmountA: amountALamports,
        actualAmountB: amountBLamports,
        lpTokens: Math.floor(Math.sqrt(amountALamports * amountBLamports)),
        excessA: 0,
        excessB: 0
      }
    }
    
    // Subsequent liquidity
    if (vaultABalance === 0 || vaultBBalance === 0) {
      throw new Error('Pool vaults are empty')
    }
    
    const ratioA = amountALamports > 0 ? Math.floor((amountALamports * supply) / vaultABalance) : Number.MAX_SAFE_INTEGER
    const ratioB = amountBLamports > 0 ? Math.floor((amountBLamports * supply) / vaultBBalance) : Number.MAX_SAFE_INTEGER
    
    const lpAmount = Math.min(ratioA, ratioB)
    
    if (lpAmount === 0) {
      throw new Error('Insufficient liquidity amount')
    }
    
    const neededAmountA = Math.floor((lpAmount * vaultABalance) / supply)
    const neededAmountB = Math.floor((lpAmount * vaultBBalance) / supply)
    
    if (amountALamports < neededAmountA) {
      throw new Error(`Insufficient Token A provided. Need ${neededAmountA / (10 ** decimalsA)}, got ${desiredAmountA}`)
    }
    
    if (amountBLamports < neededAmountB) {
      throw new Error(`Insufficient Token B provided. Need ${neededAmountB / (10 ** decimalsB)}, got ${desiredAmountB}`)
    }
    
    return {
      actualAmountA: neededAmountA,
      actualAmountB: neededAmountB,
      lpTokens: lpAmount,
      excessA: amountALamports - neededAmountA,
      excessB: amountBLamports - neededAmountB
    }
  }

  const handleAddLiquidity = async (amountA: string, amountB: string) => {
    if (!selectedPool) {
      toast.error('Please select a pool first')
      return
    }

    if (!signer || !account || !client) {
      toast.error('Wallet not connected')
      return
    }

    // Validate inputs - now we accept when one amount is calculated
    const amountANum = parseFloat(amountA)
    const amountBNum = parseFloat(amountB)
    
    if (amountANum < 0 || amountBNum < 0) {
      toast.error('Amounts cannot be negative')
      return
    }
    
    if (amountANum === 0 && amountBNum === 0) {
      toast.error('Please provide at least one token amount')
      return
    }

    setIsLoading(true)
    try {
      const [vaultA] = deriveVaultAPDA(new PublicKey(selectedPool))
      const [vaultB] = deriveVaultBPDA(new PublicKey(selectedPool))
      const [lpMint] = deriveLpMintPDA(new PublicKey(selectedPool))
      const [poolAuth] = derivePoolAuthPDA(new PublicKey(selectedPool))

      const poolData = await fetchPool(client.rpc, address(selectedPool))
      const mintA = new PublicKey(poolData.data.mintA)
      const mintB = new PublicKey(poolData.data.mintB)
      
      // Get vault balances and token info
      const vaultAInfo = await client.rpc.getTokenAccountBalance(address(vaultA.toBase58())).send()
      const vaultBInfo = await client.rpc.getTokenAccountBalance(address(vaultB.toBase58())).send()
      const lpSupplyInfo = await client.rpc.getTokenSupply(address(lpMint.toBase58())).send()
      
      const vaultABalance = parseInt(vaultAInfo.value.amount)
      const vaultBBalance = parseInt(vaultBInfo.value.amount)
      const lpSupply = parseInt(lpSupplyInfo.value.amount)
      const decimalsA = vaultAInfo.value.decimals
      const decimalsB = vaultBInfo.value.decimals
      
      console.log('Pool info:', {
        vaultABalance,
        vaultBBalance,
        lpSupply,
        decimalsA,
        decimalsB
      })

      // Calculate optimal liquidity amounts using the new logic
      let optimalAmounts
      try {
        optimalAmounts = calculateOptimalLiquidity(
          amountANum,
          amountBNum,
          vaultABalance,
          vaultBBalance,
          lpSupply,
          decimalsA,
          decimalsB
        )
        
        // Show user what will actually happen
        const actualAmountADisplay = optimalAmounts.actualAmountA / (10 ** decimalsA)
        const actualAmountBDisplay = optimalAmounts.actualAmountB / (10 ** decimalsB)
        const lpTokensDisplay = optimalAmounts.lpTokens / (10 ** 9) // LP tokens usually have 9 decimals
        
        // Check if the amounts match what user provided (within reasonable precision)
        const amountADiff = Math.abs(actualAmountADisplay - amountANum)
        const amountBDiff = Math.abs(actualAmountBDisplay - amountBNum)
        const tolerance = 0.000001 // 1 millionth precision
        
        if (amountADiff > tolerance || amountBDiff > tolerance) {
          toast.info(
            `Adjusted amounts: ${actualAmountADisplay.toFixed(6)} Token A, ${actualAmountBDisplay.toFixed(6)} Token B. ` +
            `You'll receive ${lpTokensDisplay.toFixed(6)} LP tokens.`
          )
        } else {
          toast.info(
            `Adding ${actualAmountADisplay.toFixed(6)} Token A and ${actualAmountBDisplay.toFixed(6)} Token B, ` +
            `receiving ${lpTokensDisplay.toFixed(6)} LP tokens.`
          )
        }
        
      } catch (error) {
        toast.error(`Liquidity calculation error: ${(error as Error).message}`)
        return
      }
      
      // Check if either token is WSOL
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
      const isMintAWSOL = mintA.equals(WSOL_MINT)
      const isMintBWSOL = mintB.equals(WSOL_MINT)

      const userAta_A = await deriveTokenAta(new PublicKey(account.publicKey), mintA)
      const userAta_B = await deriveTokenAta(new PublicKey(account.publicKey), mintB)

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      const ix: IInstruction[] = []

      // Check and create ATA for Token A
      try {
        const ataAInfo = await client.rpc.getAccountInfo(address(userAta_A.toBase58()), {encoding: 'base64'}).send()
        if (!ataAInfo.value && !isMintAWSOL) {
          const createAtaAIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createAtaAIx))
        }
      } catch {
        if (!isMintAWSOL) {
          const createAtaAIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createAtaAIx))
        }
      }

      // Handle WSOL Token A only if we need it
      if (isMintAWSOL && optimalAmounts.actualAmountA > 0) {
        try {
          const wsolAtaInfo = await client.rpc.getAccountInfo(address(userAta_A.toBase58()), {encoding: 'base64'}).send()
          if (!wsolAtaInfo.value) {
            const createWsolAtaIx = createAssociatedTokenAccountInstruction(
              new PublicKey(account.publicKey),
              userAta_A,
              new PublicKey(account.publicKey),
              mintA,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
            ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
          }
        } catch {
          const createWsolAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
        }

        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_A,
          lamports: optimalAmounts.actualAmountA,
        })
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        const syncNativeIx = createSyncNativeInstruction(userAta_A, TOKEN_PROGRAM_ID)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      }

      // Check and create ATA for Token B
      try {
        const ataBInfo = await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
        if (!ataBInfo.value && !isMintBWSOL) {
          const createAtaBIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createAtaBIx))
        }
      } catch {
        if (!isMintBWSOL) {
          const createAtaBIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createAtaBIx))
        }
      }

      // Handle WSOL Token B only if we need it
      if (isMintBWSOL && optimalAmounts.actualAmountB > 0) {
        try {
          const wsolAtaInfo = await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
          if (!wsolAtaInfo.value) {
            const createWsolAtaIx = createAssociatedTokenAccountInstruction(
              new PublicKey(account.publicKey),
              userAta_B,
              new PublicKey(account.publicKey),
              mintB,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
            ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
          }
        } catch {
          const createWsolAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
        }

        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_B,
          lamports: optimalAmounts.actualAmountB,
        })
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        const syncNativeIx = createSyncNativeInstruction(userAta_B, TOKEN_PROGRAM_ID)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      }

      const userLpAta = await deriveTokenAta(new PublicKey(account.publicKey), lpMint)
      
      // Check if userLpAta exists, create if needed
      let needsAtaCreation = false
      try {
        const lpAtaInfo = await client.rpc.getAccountInfo(address(userLpAta.toBase58()), {encoding: 'base64'}).send()
        if (!lpAtaInfo.value) {
          needsAtaCreation = true
        }
      } catch {
        needsAtaCreation = true
      }

      // Create LP ATA if needed
      if (needsAtaCreation) {
        const createAtaInstruction = createAssociatedTokenAccountInstruction(
          new PublicKey(account.publicKey),
          userLpAta,
          new PublicKey(account.publicKey),
          lpMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
        ix.push(fromLegacyTransactionInstruction(createAtaInstruction))
      }

      console.log('Sending optimal amounts to contract:', {
        amountA: optimalAmounts.actualAmountA,
        amountB: optimalAmounts.actualAmountB,
        expectedLP: optimalAmounts.lpTokens
      })

      // Create the add liquidity instruction with OPTIMAL amounts
      const addLiquidityInstruction = getAddLiquidityInstruction({
        signer: signer,
        pool: address(selectedPool),
        amountA: optimalAmounts.actualAmountA, // Use calculated optimal amount
        amountB: optimalAmounts.actualAmountB, // Use calculated optimal amount
        vaultA: address(vaultA.toBase58()),
        vaultB: address(vaultB.toBase58()),
        lpMint: address(lpMint.toBase58()),
        poolAuth: address(poolAuth.toBase58()),
        userAtaA: address(userAta_A.toBase58()),
        userAtaB: address(userAta_B.toBase58()),
        userLpAta: address(userLpAta.toBase58()),
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58())
      })

      ix.push(addLiquidityInstruction)

      // Create transaction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: ix,
      })

      const simulation = await client.simulateTransaction(transaction)
      console.log('Simulation result:', simulation)

      toast.info('Please confirm the transaction in your wallet...')

      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log('Add liquidity transaction signature:', sig58)

      // Enhanced success message with actual amounts used
      const actualAmountADisplay = optimalAmounts.actualAmountA / (10 ** decimalsA)
      const actualAmountBDisplay = optimalAmounts.actualAmountB / (10 ** decimalsB)
      const lpTokensDisplay = optimalAmounts.lpTokens / (10 ** 9)
      
      toast.success(
        `Liquidity added successfully! Used ${actualAmountADisplay.toFixed(6)} Token A and ` +
        `${actualAmountBDisplay.toFixed(6)} Token B. Received ${lpTokensDisplay.toFixed(6)} LP tokens.` +
        (isMintAWSOL || isMintBWSOL ? ' SOL has been wrapped to WSOL.' : '')
      )
      
      // Refresh user positions after successful transaction
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (error) {
      console.error('Error adding liquidity:', error)
      toast.error('Error adding liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!selectedPool) {
      toast.error('Please select a pool first')
      return
    }

    if (!signer || !account || !client) {
      toast.error('Wallet not connected')
      return
    }

    setIsLoading(true)
    try {
      const [vaultA] = deriveVaultAPDA(new PublicKey(selectedPool))
      const [vaultB] = deriveVaultBPDA(new PublicKey(selectedPool))
      const [lpMint] = deriveLpMintPDA(new PublicKey(selectedPool))
      const [poolAuth] = derivePoolAuthPDA(new PublicKey(selectedPool))

      const poolData = await fetchPool(client.rpc, address(selectedPool))
      const mintA = new PublicKey(poolData.data.mintA)
      const mintB = new PublicKey(poolData.data.mintB)
      
      // Check if either token is WSOL
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
      const isMintAWSOL = mintA.equals(WSOL_MINT)
      const isMintBWSOL = mintB.equals(WSOL_MINT)

      const userAta_A = await deriveTokenAta(new PublicKey(account.publicKey), mintA)
      const userAta_B = await deriveTokenAta(new PublicKey(account.publicKey), mintB)
      const userLpAta = await deriveTokenAta(new PublicKey(account.publicKey), lpMint)

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      const ix: IInstruction[] = []

      // Check if user has LP tokens and get the balance properly
      const tokenAccountInfo = await client.rpc.getTokenAccountBalance(address(userLpAta.toBase58())).send()
      if (!tokenAccountInfo.value) {
        toast.error('You have no LP tokens to remove')
        return
      }
      const lpTokenBalance = parseInt(tokenAccountInfo.value.amount)

      // Create ATAs if they don't exist (simplified logic)
      // Check and create ATA for Token A
      try {
        const ataAInfo = await client.rpc.getAccountInfo(address(userAta_A.toBase58()), {encoding: 'base64'}).send()
        if (!ataAInfo.value) {
          const createAtaAIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey), // payer
            userAta_A,                        // ATA address
            new PublicKey(account.publicKey), // owner
            mintA,                            // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          console.log('Creating ATA for Token A:', userAta_A.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaAIx))
        }
      } catch {
        // ATA doesn't exist, create it
        const createAtaAIx = createAssociatedTokenAccountInstruction(
          new PublicKey(account.publicKey),
          userAta_A,
          new PublicKey(account.publicKey),
          mintA,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
        console.log('In catch Creating ATA for Token A:', userAta_A.toBase58())
        ix.push(fromLegacyTransactionInstruction(createAtaAIx))
      }

      // Check and create ATA for Token B
      try {
        const ataBInfo = await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
        if (!ataBInfo.value) {
          const createAtaBIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey), // payer
            userAta_B,                        // ATA address
            new PublicKey(account.publicKey), // owner
            mintB,                            // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          console.log('Creating ATA for Token B:', userAta_B.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaBIx))
        }
      } catch {
        // ATA doesn't exist, create it
        const createAtaBIx = createAssociatedTokenAccountInstruction(
          new PublicKey(account.publicKey),
          userAta_B,
          new PublicKey(account.publicKey),
          mintB,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
        console.log('In catch Creating ATA for Token B:', userAta_B.toBase58())
        ix.push(fromLegacyTransactionInstruction(createAtaBIx))
      }

      console.log('Removing liquidity with LP token amount:', lpTokenBalance/(10**9))
      
      // Create remove liquidity instruction
      const removeLiquidityIx = getRemoveLiquidityInstruction({
        pool: address(selectedPool),
        payer: signer,
        vaultA: address(vaultA.toBase58()),
        vaultB: address(vaultB.toBase58()),
        userAtaA: address(userAta_A.toBase58()),
        userAtaB: address(userAta_B.toBase58()),
        userLpAta: address(userLpAta.toBase58()),
        lpMint: address(lpMint.toBase58()),
        poolAuth: address(poolAuth.toBase58()),
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
        lpAmount: lpTokenBalance
      })

      ix.push(removeLiquidityIx)

      // Handle WSOL unwrapping after liquidity removal
      // Unwrap WSOL back to SOL for Token A
      if (isMintAWSOL) {
        const closeAccountIx = createCloseAccountInstruction(
          userAta_A,                           // account to close
          new PublicKey(account.publicKey),    // destination for remaining SOL
          new PublicKey(account.publicKey),    // owner
          [],                                  // multisig signers (empty for single signer)
          TOKEN_PROGRAM_ID
        )
        ix.push(fromLegacyTransactionInstruction(closeAccountIx))
        console.log('Will unwrap WSOL Token A to SOL')
      }

      // Unwrap WSOL back to SOL for Token B
      if (isMintBWSOL) {
        const closeAccountIx = createCloseAccountInstruction(
          userAta_B,                           // account to close
          new PublicKey(account.publicKey),    // destination for remaining SOL
          new PublicKey(account.publicKey),    // owner
          [],                                  // multisig signers (empty for single signer)
          TOKEN_PROGRAM_ID
        )
        ix.push(fromLegacyTransactionInstruction(closeAccountIx))
        console.log('Will unwrap WSOL Token B to SOL')
      }

      // Create transaction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: ix,
      })

      // Simulate transaction
      const simulation = await client.simulateTransaction(transaction)
      console.log('Remove liquidity simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs)

      toast.info('Please confirm the transaction in your wallet...')
      
      // Send transaction
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log('Remove liquidity transaction signature:', sig58)

      toast.success('Liquidity removed successfully!' + (isMintAWSOL || isMintBWSOL ? ' WSOL has been unwrapped to SOL.' : ''))
      
      // Refresh user positions after successful transaction
      setTimeout(() => {
        window.location.reload()
      }, 2000)

      console.log('Liquidity removed from:', {
        selectedPool,
        lpTokensRemoved: lpTokenBalance,
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        isMintAWSOL,
        isMintBWSOL,
        unwrappedToSOL: isMintAWSOL || isMintBWSOL
      })

    } catch (error) {
      console.error('Error removing liquidity:', error)
      toast.error('Error removing liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-5">
      {/* Enhanced Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <Link href="/amm">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AMM
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {viewMode === 'positions' ? '💧 Liquidity Positions' : '🏊 All Pools'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {viewMode === 'positions' 
                ? 'Add liquidity to pools and earn trading fees'
                : 'Browse all available liquidity pools'
              }
            </p>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="flex gap-4">
          {viewMode === 'positions' ? (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userPositions.length}</div>
                <div className="text-xs text-gray-500">Your Positions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allPools.length}</div>
                <div className="text-xs text-gray-500">Available Pools</div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allPools.length}</div>
                <div className="text-xs text-gray-500">Total Pools</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userPositions.length}</div>
                <div className="text-xs text-gray-500">Your Positions</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - User Positions or All Pools */}
        <div className="lg:col-span-1">
          <Card className="h-fit bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    {viewMode === 'positions' ? '💎 Your Positions' : '🏊 All Pools'}
                  </CardTitle>
                  <CardDescription>
                    {viewMode === 'positions' 
                      ? 'Pools where you have provided liquidity'
                      : 'Browse and select from all available liquidity pools'
                    }
                  </CardDescription>
                </div>
                
                {/* View Toggle Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'positions' ? 'all-pools' : 'positions')}
                  className="text-xs"
                >
                  {viewMode === 'positions' ? 'View All' : 'Your Positions'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {viewMode === 'positions' ? (
                // Your Positions View
                <>
                  {isLoadingPositions ? (
                    <div className="text-center py-8">
                      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-gray-500 dark:text-gray-400">Loading your positions...</p>
                    </div>
                  ) : !account ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">👤</div>
                      <p>Connect your wallet to see your positions</p>
                    </div>
                  ) : userPositions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">📊</div>
                      <p>No liquidity positions found</p>
                      <p className="text-sm mt-1">Add liquidity to a pool to see it here</p>
                      <div className="mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setViewMode('all-pools')}
                          className="w-full"
                        >
                          Browse All Pools
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userPositions.map((position) => (
                        <div
                          key={position.poolAddress}
                          onClick={() => setSelectedPool(position.poolAddress)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedPool === position.poolAddress
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              Pool #{position.poolAddress.slice(0, 8)}...
                            </div>
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">
                              {position.lpTokenBalance.toFixed(4)} LP
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>Token A: {position.mintAAddress.slice(0, 8)}...</div>
                            <div>Token B: {position.mintBAddress.slice(0, 8)}...</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // All Pools View
                <>
                  {allPools.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">🔄</div>
                      <p>Loading pools...</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {allPools.map((pool) => {
                        const hasPosition = userPositions.some(pos => pos.poolAddress === pool.address)
                        return (
                          <div
                            key={pool.address}
                            onClick={() => setSelectedPool(pool.address)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                              selectedPool === pool.address
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {/* Pool Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                  Pool #{pool.address.slice(0, 6)}...{pool.address.slice(-4)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasPosition && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200 font-medium">
                                    💎 Your Position
                                  </span>
                                )}
                                {/* <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  selectedPool === pool.address 
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                  {selectedPool === pool.address ? '✓ Selected' : 'Click to Select'}
                                </span> */}
                              </div>
                            </div>

                            {/* Pool Info Grid */}
                            <div className="grid grid-cols-1 gap-2 mb-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400">Pool Address:</span>
                                <span className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  🏊 Pool
                                </span>
                                {/* {hasPosition && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                      💰 Active Position
                                    </span>
                                  </>
                                )} */}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">
                                  {selectedPool === pool.address ? '✓ Selected' : 'Click to Select'}
                                </span>
                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Liquidity Actions */}
        <div className="lg:col-span-2">
          {/* Liquidity Actions Card with Toggle */}
          <Card className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
            <CardHeader className='px-6 py-4'>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-gray-900 dark:text-gray-100">
                    {liquidityMode === 'add' ? '💰 Add More Liquidity' : '🔥 Remove Liquidity'}
                  </CardTitle>
                  {!selectedPool && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full border border-yellow-200">
                      Select Position First
                    </span>
                  )}
                </div>
                
                {/* Toggle Switch */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setLiquidityMode('add')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      liquidityMode === 'add'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setLiquidityMode('remove')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      liquidityMode === 'remove'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Remove
                  </button>
                </div>
              </div>
              
              <CardDescription>
                {liquidityMode === 'add' 
                  ? 'Add more liquidity to your existing position and increase your earnings'
                  : 'Withdraw liquidity from your position'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="px-6 py-4">
              {!selectedPool ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>
                    {viewMode === 'positions' 
                      ? `Select a position from the left panel to ${liquidityMode === 'add' ? 'add more' : 'remove'} liquidity`
                      : `Select a pool from the left panel to ${liquidityMode === 'add' ? 'add' : 'remove'} liquidity`
                    }
                  </p>
                  {userPositions.length === 0 && account && viewMode === 'positions' && (
                    <div className="mt-4">
                      <Button variant="outline" onClick={() => setViewMode('all-pools')}>
                        Browse All Pools
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {liquidityMode === 'add' ? (
                    <>
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">💡 Increase Your Position</h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Adding more liquidity to your existing position will increase your share of trading fees and LP token balance.
                        </p>
                      </div>
                      <AddLiquidity 
                        selectedPool={selectedPool}
                        onAddLiquidity={handleAddLiquidity}
                        onPoolChange={setSelectedPool}
                        isLoading={isLoading}
                      />
                    </>
                  ) : (
                    <>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                        <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">⚠️ Position Withdrawal</h4>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          This will remove liquidity from your position and burn your LP tokens.
                        </p>
                        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                          <div className="flex items-center gap-2">
                            <span>💰</span>
                            <span>You will receive:</span>
                          </div>
                          <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                            <li>Your proportional share of Token A</li>
                            <li>Your proportional share of Token B</li>
                            <li>All accumulated trading fees</li>
                            <li>WSOL will be automatically unwrapped to SOL</li>
                          </ul>
                        </div>
                      </div>
                      <RemoveLiquidity 
                        selectedPool={selectedPool}
                        onRemoveLiquidity={handleRemoveLiquidity}
                        onPoolChange={setSelectedPool}
                        isLoading={isLoading}
                      />
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}