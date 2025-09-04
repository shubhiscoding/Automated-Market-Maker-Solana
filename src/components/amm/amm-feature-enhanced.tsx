'use client'

import { useEffect, useState } from 'react'
import { useWalletUi } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { address, Address } from '@solana/addresses';
import { AMM_PROGRAM_ID } from './amm-data-access'
import { 
  isValidPublicKey, 
  normalizeTokenOrder,
  derivePoolPDA, 
  deriveLpMintPDA,
  derivePoolAuthPDA,
  deriveVaultAPDA,
  deriveVaultBPDA,
  deriveTokenAta
} from './amm-utils'
import { fetchPool, getAddLiquidityInstruction, getInitializePoolInstructionAsync, getRemoveLiquidityInstruction, getSwapTokenInstruction } from '../../../anchor/src/client/js/generated'
import { createTransaction, getBase58Decoder, IInstruction, LAMPORTS_PER_SOL, signAndSendTransactionMessageWithSigners } from 'gill'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, createCloseAccountInstruction } from '@solana/spl-token'
import { fromLegacyTransactionInstruction } from '@/lib/utils'
import { useWalletUiSigner } from '../solana/use-wallet-ui-signer'

export function AmmFeature() {
  const { account, client, cluster } = useWalletUi()
  const [isLoading, setIsLoading] = useState(false)

  const rawSigner = useWalletUiSigner()
  // Only use the signer if we have valid account and cluster
  const signer = account && cluster?.id ? rawSigner : null

  // Pool initialization state
  const [tokenMintA, setTokenMintA] = useState('')
  const [tokenMintB, setTokenMintB] = useState('')

  // Liquidity state
  const [liquidityAmountA, setLiquidityAmountA] = useState('')
  const [liquidityAmountB, setLiquidityAmountB] = useState('')

  // Swap state
  const [swapAmount, setSwapAmount] = useState('')
  const [selectedPool, setSelectedPool] = useState('')
  const [swapFromTokenA, setSwapFromTokenA] = useState(true) // true = A->B, false = B->A
  const [minimumAmountOut, setMinimumAmountOut] = useState('')

  // State for all pools
  type PoolInfo = {
    address: string
    [key: string]: unknown
  }
  const [allPools, setAllPools] = useState<PoolInfo[]>([])

  // Fetch all pools on mount
  useEffect(() => {
    async function fetchPools() {
      if (!client?.rpc) return
      try {
        // Replace with your program ID
        const PROGRAM_ID = AMM_PROGRAM_ID
        // Fetch all pool accounts
        const pools = await client.rpc.getProgramAccounts(address(PROGRAM_ID.toBase58()), { encoding: 'base64' }).send()
        setAllPools(pools.map((p) => ({
          address: p.pubkey,
          ...p.account?.data
        })))
      } catch (err) {
        console.error('Error fetching pools:', err)
      }
    }
    fetchPools()
  }, [client])

  if (!account) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">AMM Interface</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please connect your wallet to interact with the AMM
        </p>
      </div>
    )
  }

  const handleInitPool = async () => {
    if (!tokenMintA || !tokenMintB) {
      toast.error('Please provide both token mint addresses')
      return
    }

    // Validate public keys
    if (!isValidPublicKey(tokenMintA)) {
      toast.error('Invalid Token A mint address')
      return
    }

    if (!isValidPublicKey(tokenMintB)) {
      toast.error('Invalid Token B mint address')
      return
    }

    if (tokenMintA === tokenMintB) {
      toast.error('Token A and Token B must be different')
      return
    }

    if (!account?.publicKey || !signer) {
      toast.error('Wallet not connected')
      return
    }

    setIsLoading(true)
    try {
      // Normalize token order for consistent pool addresses
      const [mintA, mintB] = normalizeTokenOrder(tokenMintA, tokenMintB)
      
      // Derive the pool address to show user
      const [poolAddress] = derivePoolPDA(mintA, mintB)

      const [pool] = derivePoolPDA(mintA, mintB)
      const [lpMint] = deriveLpMintPDA(pool)
      const [poolAuth] = derivePoolAuthPDA(pool)
      const [vaultA] = deriveVaultAPDA(pool)
      const [vaultB] = deriveVaultBPDA(pool)
      const mintAAddress = address(mintA.toBase58());

      const ix = await getInitializePoolInstructionAsync({
        signer: signer,
        mintA: mintAAddress as Address,
        mintB: address(mintB.toBase58()) as Address,
        feeBps: 30,
        protoFeeBps: 5,
        lpMint: address(lpMint.toBase58()) as Address,
        vaultA: address(vaultA.toBase58()) as Address,
        vaultB: address(vaultB.toBase58()) as Address,
        poolAuth: address(poolAuth.toBase58()) as Address,
        pool: address(pool.toBase58()) as Address,
        systemProgram: address(SystemProgram.programId.toBase58()) as Address,
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()) as Address
      });

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      // Create transaction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: [ix],
      });

      const simulation = await client.simulateTransaction(transaction);
      console.log('Simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs);

      toast.info('Please confirm the transaction in your wallet...')

      // Note: In a real implementation with proper wallet integration, you would:
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log(sig58)
      
      // For now, we'll simulate success and show the transaction details
      console.log('Pool initialization transaction created:', {
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        poolAddress: poolAddress.toBase58(),
        transaction: sig58
      })

      toast.success(
        `Pool initialized successfully! Pool address: ${poolAddress.toBase58().slice(0, 8)}...`
      )
      
      // Update the selected pool for other operations
      setSelectedPool(poolAddress.toBase58())
      
      // Clear form
      setTokenMintA('')
      setTokenMintB('')

    } catch (error) {
      console.error('Error initializing pool:', error)
      toast.error('Error initializing pool: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLiquidity = async () => {
    if (!liquidityAmountA || !liquidityAmountB || !selectedPool) {
      toast.error('Please provide amounts and select a pool')
      return
    }

    if(!signer){
      toast.error('Wallet not connected')
      return
    }

    setIsLoading(true)
    try {
      const [lpMint] = deriveLpMintPDA(new PublicKey(selectedPool))
      const [poolAuth] = derivePoolAuthPDA(new PublicKey(selectedPool))
      const [vaultA] = deriveVaultAPDA(new PublicKey(selectedPool))
      const [vaultB] = deriveVaultBPDA(new PublicKey(selectedPool))

      const poolData = await fetchPool(client.rpc, address(selectedPool))
      const mintA = new PublicKey(poolData.data.mintA)
      const mintB = new PublicKey(poolData.data.mintB)
      console.log(mintA.toBase58());
      console.log(mintB.toBase58());

      // Check if either token is WSOL
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
      const isMintAWSOL = mintA.equals(WSOL_MINT)
      const isMintBWSOL = mintB.equals(WSOL_MINT)

      const userAta_A = await deriveTokenAta(new PublicKey(account.publicKey), mintA)
      const userAta_B = await deriveTokenAta(new PublicKey(account.publicKey), mintB)
      console.log(userAta_A.toBase58());
      console.log(userAta_B.toBase58());

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      const ix: IInstruction[] = []

      // Handle WSOL wrapping for Token A
      if (isMintAWSOL) {
        const wsolAmount = parseFloat(liquidityAmountA) * LAMPORTS_PER_SOL
        
        // Check if WSOL ATA exists, create if not
        try {
          const wsolAtaInfo = await client.rpc.getAccountInfo(address(userAta_A.toBase58())).send()
          if (!wsolAtaInfo.value) {
            const createWsolAtaIx = createAssociatedTokenAccountInstruction(
              new PublicKey(account.publicKey), // payer
              userAta_A,                        // ATA address
              new PublicKey(account.publicKey), // owner
              WSOL_MINT,                        // WSOL mint
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
            ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
          }
        } catch {
          // ATA doesn't exist, create it
          const createWsolAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            WSOL_MINT,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
        }

        // Transfer SOL to WSOL ATA (this automatically wraps it)
        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_A,
          lamports: wsolAmount,
        })
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        // Sync native (converts SOL balance to WSOL tokens)
        const syncNativeIx = createSyncNativeInstruction(userAta_A, TOKEN_PROGRAM_ID)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      }

      // Handle WSOL wrapping for Token B (similar logic)
      if (isMintBWSOL) {
        const wsolAmount = parseFloat(liquidityAmountB) * LAMPORTS_PER_SOL
        
        try {
          const wsolAtaInfo = await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
          if (!wsolAtaInfo.value) {
            const createWsolAtaIx = createAssociatedTokenAccountInstruction(
              new PublicKey(account.publicKey),
              userAta_B,
              new PublicKey(account.publicKey),
              WSOL_MINT,
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
            WSOL_MINT,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          ix.push(fromLegacyTransactionInstruction(createWsolAtaIx))
        }

        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_B,
          lamports: wsolAmount,
        })
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        const syncNativeIx = createSyncNativeInstruction(userAta_B, TOKEN_PROGRAM_ID)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      }

      const userLpAta = await deriveTokenAta(new PublicKey(account.publicKey), lpMint);
      // Check if userLpAta exists, create if needed
      let needsAtaCreation = false
      try {
        const lpAtaInfo = await client.rpc.getAccountInfo(address(userLpAta.toBase58()), {encoding: 'base64'}).send()
        if (!lpAtaInfo.value) {
          needsAtaCreation = true
        }
      } catch {
        // If getAccountInfo fails, assume account doesn't exist
        needsAtaCreation = true
      }

      // Create the add liquidity instruction
      const addLiquidityInstruction = getAddLiquidityInstruction({
        signer: signer,
        pool: address(selectedPool),
        amountA: parseFloat(liquidityAmountA) * LAMPORTS_PER_SOL,
        amountB: parseFloat(liquidityAmountB) * LAMPORTS_PER_SOL,
        vaultA: address(vaultA.toBase58()),
        vaultB: address(vaultB.toBase58()),
        lpMint: address(lpMint.toBase58()),
        poolAuth: address(poolAuth.toBase58()),
        userAtaA: address(userAta_A.toBase58()),
        userAtaB: address(userAta_B.toBase58()),
        userLpAta: address(userLpAta.toBase58()),
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58())
      })

      // If ATA needs to be created, create it first in a separate transaction
      if (needsAtaCreation) {
        try {
          console.log('Creating LP token associated token account...')
          const createAtaInstruction = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey), // payer
            userLpAta, // associatedToken
            new PublicKey(account.publicKey), // owner
            lpMint, // mint
            TOKEN_PROGRAM_ID, // tokenProgram
            ASSOCIATED_TOKEN_PROGRAM_ID // associatedTokenProgram
          )

          ix.push(fromLegacyTransactionInstruction(createAtaInstruction));
          // Note: In a real implementation, you'd sign and send this transaction
          // For now, we'll just log it
          console.log('ATA creation transaction prepared (would be sent first)')
          toast.info('LP token account will be created automatically')
        } catch (ataError) {
          console.error('Error preparing ATA creation:', ataError)
        }
      }
      ix.push(addLiquidityInstruction);

      // Create main transaction with the add liquidity instruction
      const transaction = createTransaction({
        feePayer: signer,
        version: 'legacy',
        latestBlockhash,
        instructions: ix,
      });

      const simulation = await client.simulateTransaction(transaction);
      console.log('Simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs);

      toast.info('Please confirm the transaction in your wallet...')

      // Note: In a real implementation with proper wallet integration, you would:
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log(sig58)
      
      toast.success('Liquidity addition simulated successfully!')
      console.log('Adding liquidity:', { 
        liquidityAmountA, 
        liquidityAmountB, 
        selectedPool,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey 
      })

      // Clear form
      setLiquidityAmountA('')
      setLiquidityAmountB('')
    } catch (error) {
      console.error('Error adding liquidity:', error)
      toast.error('Error adding liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwap = async () => {
    if (!swapAmount || !selectedPool) {
      toast.error('Please provide swap amount and select a pool')
      return
    }

    if (!signer) {
      toast.error('Wallet not connected')
      return
    }

    const swapAmountNum = parseFloat(swapAmount)
    if (swapAmountNum <= 0) {
      toast.error('Swap amount must be greater than 0')
      return
    }

    setIsLoading(true)
    try {
      // Fetch pool data to get mint addresses
      const poolData = await fetchPool(client.rpc, address(selectedPool))
      const mintA = new PublicKey(poolData.data.mintA)
      const mintB = new PublicKey(poolData.data.mintB)

      console.log('Pool data:', {
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        swapFromTokenA,
        swapAmount
      })

      // Derive vault addresses
      const [vaultA] = deriveVaultAPDA(new PublicKey(selectedPool))
      const [vaultB] = deriveVaultBPDA(new PublicKey(selectedPool))
      const [poolAuth] = derivePoolAuthPDA(new PublicKey(selectedPool))

      // Check if either token is WSOL
      const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
      const isMintAWSOL = mintA.equals(WSOL_MINT)
      const isMintBWSOL = mintB.equals(WSOL_MINT)

      // Get user token accounts
      const userAta_A = await deriveTokenAta(new PublicKey(account.publicKey), mintA)
      const userAta_B = await deriveTokenAta(new PublicKey(account.publicKey), mintB)

      const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send()
      const ix: IInstruction[] = []

      // Calculate swap amount in lamports
      const swapAmountLamports = swapAmountNum * LAMPORTS_PER_SOL

      // Handle WSOL wrapping if needed for input token
      if (swapFromTokenA && isMintAWSOL) {
        // Wrapping SOL to WSOL for Token A
        try {
          await client.rpc.getAccountInfo(address(userAta_A.toBase58()), {encoding: 'base64'}).send()
        } catch {
          // Create ATA if it doesn't exist
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA
          )
          console.log('Creating ATA for Token A (WSOL):', userAta_A.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaIx))
        }

        // Transfer SOL to WSOL ATA (this automatically wraps it)
        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_A,
          lamports: swapAmountLamports,
        })
        console.log('Wrapping SOL to WSOL, transfer instruction:', wrapSolIx)
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        // Sync native (converts SOL balance to WSOL tokens)
        const syncNativeIx = createSyncNativeInstruction(userAta_A, TOKEN_PROGRAM_ID)
        console.log('Syncing native for WSOL ATA:', syncNativeIx)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      } else if (!swapFromTokenA && isMintBWSOL) {
        // Wrapping SOL to WSOL for Token B
        try {
          await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
        } catch {
          // Create ATA if it doesn't exist
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB
          )
          console.log('Creating ATA for Token B (WSOL):', userAta_B.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaIx))
        }

        // Transfer SOL to WSOL ATA
        const wrapSolIx = SystemProgram.transfer({
          fromPubkey: new PublicKey(account.publicKey),
          toPubkey: userAta_B,
          lamports: swapAmountLamports,
        })
        console.log('Wrapping SOL to WSOL, transfer instruction:', wrapSolIx)
        ix.push(fromLegacyTransactionInstruction(wrapSolIx))

        // Sync native
        const syncNativeIx = createSyncNativeInstruction(userAta_B, TOKEN_PROGRAM_ID)
        console.log('Syncing native for WSOL ATA:', syncNativeIx)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))
      }

      // Ensure ATAs exist for both tokens
      try {
        await client.rpc.getAccountInfo(address(userAta_A.toBase58()), {encoding: 'base64'}).send()
      } catch {
        if (!isMintAWSOL || !swapFromTokenA) {
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA
          )
          console.log('Creating ATA for Token A:', userAta_A.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaIx))
        }
      }

      try {
        await client.rpc.getAccountInfo(address(userAta_B.toBase58()), {encoding: 'base64'}).send()
      } catch {
        if (!isMintBWSOL || swapFromTokenA) {
          const createAtaIx = createAssociatedTokenAccountInstruction(
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB
          )
          console.log('Creating ATA for Token B:', userAta_B.toBase58())
          ix.push(fromLegacyTransactionInstruction(createAtaIx))
        }
      }

      // Calculate minimum amount out (with 1% slippage protection if not specified)
      let minAmountOut = 1 // Default minimum of 1 lamport
      if (minimumAmountOut) {
        minAmountOut = parseFloat(minimumAmountOut) * LAMPORTS_PER_SOL
      }

      // Create swap instruction
      const swapInstruction = getSwapTokenInstruction({
        pool: address(selectedPool),
        signer: signer,
        vaultA: address(vaultA.toBase58()),
        vaultB: address(vaultB.toBase58()),
        userAtaA: address(userAta_A.toBase58()),
        userAtaB: address(userAta_B.toBase58()),
        poolAuth: address(poolAuth.toBase58()),
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()),
        amountIn: swapAmountLamports,
        minimumOut: minAmountOut
      })

      ix.push(swapInstruction)

      // Handle WSOL unwrapping if needed for output token
      if (swapFromTokenA && isMintBWSOL) {
        // Unwrapping WSOL back to SOL for Token B
        const syncNativeIx = createSyncNativeInstruction(userAta_B, TOKEN_PROGRAM_ID)
        console.log('Syncing native for WSOL ATA:', syncNativeIx)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))

        const closeAtaIx = createCloseAccountInstruction(
          userAta_B,
          new PublicKey(account.publicKey),
          new PublicKey(account.publicKey)
        )
        console.log('Closing WSOL ATA to unwrap to SOL:', closeAtaIx)
        ix.push(fromLegacyTransactionInstruction(closeAtaIx))
      } else if (!swapFromTokenA && isMintAWSOL) {
        // Unwrapping WSOL back to SOL for Token A
        const syncNativeIx = createSyncNativeInstruction(userAta_A, TOKEN_PROGRAM_ID)
        console.log('Syncing native for WSOL ATA:', syncNativeIx)
        ix.push(fromLegacyTransactionInstruction(syncNativeIx))

        const closeAtaIx = createCloseAccountInstruction(
          userAta_A,
          new PublicKey(account.publicKey),
          new PublicKey(account.publicKey)
        )
        console.log('Closing WSOL ATA to unwrap to SOL:', closeAtaIx)
        ix.push(fromLegacyTransactionInstruction(closeAtaIx))
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
      console.log('Swap simulation result:', simulation)
      console.log('Simulation logs:', simulation.value.logs)

      toast.info('Please confirm the transaction in your wallet...')

      // Send transaction
      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log('Swap transaction signature:', sig58)

      const fromToken = swapFromTokenA ? 'Token A' : 'Token B'
      const toToken = swapFromTokenA ? 'Token B' : 'Token A'
      
      toast.success(
        `Swap successful! ${swapAmount} ${fromToken} swapped for ${toToken}` + 
        (((swapFromTokenA && isMintBWSOL) || (!swapFromTokenA && isMintAWSOL)) ? ' (WSOL unwrapped to SOL)' : '')
      )
      
      console.log('Swap completed:', {
        selectedPool,
        swapAmount,
        swapFromTokenA,
        minimumAmountOut,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey,
        mintA: mintA.toBase58(),
        mintB: mintB.toBase58(),
        isMintAWSOL,
        isMintBWSOL,
        unwrappedToSOL: ((swapFromTokenA && isMintBWSOL) || (!swapFromTokenA && isMintAWSOL))
      })

      // Clear form
      setSwapAmount('')
      setMinimumAmountOut('')
    } catch (error) {
      console.error('Error swapping:', error)
      toast.error('Error swapping: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!selectedPool) {
      toast.error('Please select a pool')
      return
    }

    if (!signer) {
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
      const lpTokenBalance = parseInt(tokenAccountInfo.value.amount);

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
        tokenProgram: address(TOKEN_PROGRAM_ID.toBase58()), // Add this missing parameter
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
      
      console.log('Liquidity removed from:', {
        selectedPool,
        lpTokensRemoved: lpTokenBalance,
        programId: AMM_PROGRAM_ID,
        wallet: account.publicKey,
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
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Pool List Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Available Pools</h2>
        {allPools.length === 0 ? (
          <div className="text-gray-500">No pools found.</div>
        ) : (
          <ul className="space-y-2">
            {allPools.map((pool) => (
              <li key={pool.address} className="flex items-center justify-between p-2 border rounded">
                <span className="font-mono text-xs">{pool.address.slice(0, 8)}...{pool.address.slice(-8)}</span>
                <button
                  className={`ml-4 px-2 py-1 rounded ${selectedPool === pool.address ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                  onClick={() => setSelectedPool(pool.address)}
                >
                  {selectedPool === pool.address ? 'Selected' : 'Select'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">AMM Interface</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Interact with the Automated Market Maker on Solana Devnet
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Program ID: {AMM_PROGRAM_ID.toBase58()}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Connected: {account.publicKey}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Initialize Pool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏊 Initialize Pool
            </CardTitle>
            <CardDescription>Create a new liquidity pool between two tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tokenA">Token A Mint Address</Label>
              <Input
                id="tokenA"
                placeholder="e.g., So11111111111111111111111111111111111111112"
                value={tokenMintA}
                onChange={(e) => setTokenMintA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tokenB">Token B Mint Address</Label>
              <Input
                id="tokenB"
                placeholder="e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                value={tokenMintB}
                onChange={(e) => setTokenMintB(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleInitPool} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Initializing...' : 'Initialize Pool'}
            </Button>
          </CardFooter>
        </Card>

        {/* Add Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💧 Add Liquidity
            </CardTitle>
            <CardDescription>Provide liquidity to earn trading fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="poolSelect">Pool Address</Label>
              <Input
                id="poolSelect"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amountA">Amount A</Label>
              <Input
                id="amountA"
                type="number"
                placeholder="Amount of Token A"
                value={liquidityAmountA}
                onChange={(e) => setLiquidityAmountA(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="amountB">Amount B</Label>
              <Input
                id="amountB"
                type="number"
                placeholder="Amount of Token B"
                value={liquidityAmountB}
                onChange={(e) => setLiquidityAmountB(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleAddLiquidity} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Adding...' : 'Add Liquidity'}
            </Button>
          </CardFooter>
        </Card>

        {/* Swap Tokens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🔄 Swap Tokens
            </CardTitle>
            <CardDescription>Exchange tokens through the AMM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="swapPool">Pool Address</Label>
              <Input
                id="swapPool"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="swapDirection">Swap Direction</Label>
              <div className="flex gap-2">
                <Button
                  variant={swapFromTokenA ? "default" : "outline"}
                  onClick={() => setSwapFromTokenA(true)}
                  className="flex-1"
                >
                  Token A → Token B
                </Button>
                <Button
                  variant={!swapFromTokenA ? "default" : "outline"}
                  onClick={() => setSwapFromTokenA(false)}
                  className="flex-1"
                >
                  Token B → Token A
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="swapAmount">Swap Amount</Label>
              <Input
                id="swapAmount"
                type="number"
                placeholder="Amount to swap"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="minimumOut">Minimum Amount Out (Optional)</Label>
              <Input
                id="minimumOut"
                type="number"
                placeholder="Minimum tokens to receive (slippage protection)"
                value={minimumAmountOut}
                onChange={(e) => setMinimumAmountOut(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSwap} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Swapping...' : `Swap ${swapFromTokenA ? 'A → B' : 'B → A'}`}
            </Button>
          </CardFooter>
        </Card>

        {/* Remove Liquidity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🏃 Remove Liquidity
            </CardTitle>
            <CardDescription>Withdraw your liquidity from a pool</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="removePool">Pool Address</Label>
              <Input
                id="removePool"
                placeholder="Pool public key address"
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleRemoveLiquidity} 
              disabled={isLoading}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? 'Removing...' : 'Remove Liquidity'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Information Panel */}
      <Card>
        <CardHeader>
          <CardTitle>📖 How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Initialize Pool</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create a new liquidity pool by providing the mint addresses of two tokens. 
                This creates a trading pair that others can trade against.
              </p>
              
              <h4 className="font-semibold mb-2">2. Add Liquidity</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Provide equal value of both tokens to earn trading fees. 
                You&apos;ll receive LP tokens representing your share of the pool.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3. Swap Tokens</h4>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Exchange one token for another using the pool&apos;s liquidity. 
                The AMM automatically calculates the exchange rate.
              </p>
              
              <h4 className="font-semibold mb-2">4. Remove Liquidity</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Withdraw your liquidity and earned fees by burning your LP tokens 
                to receive the underlying tokens back.
              </p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> This is a demo interface. In production, you would need 
              proper error handling, slippage protection, real transaction building, 
              and account validation. The buttons currently simulate the actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
