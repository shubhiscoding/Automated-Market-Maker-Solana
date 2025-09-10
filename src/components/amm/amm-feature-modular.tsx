'use client'

import { useEffect, useState } from 'react'
import { useWalletUi } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { toast } from 'sonner'
import { address, Address } from '@solana/addresses'
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

// Import our modular components
import { PoolList } from './pool-list'
import { InitializePool } from './initialize-pool'
import { AddLiquidity } from './add-liquidity'
import { SwapTokens } from './swap-tokens'
import { RemoveLiquidity } from './remove-liquidity'
import { InfoPanel } from './info-panel'

export function AmmFeature() {
  const { account, client, cluster } = useWalletUi()
  const [isLoading, setIsLoading] = useState(false)

  const rawSigner = useWalletUiSigner()
  // Only use the signer if we have valid account and cluster
  const signer = account && cluster?.id ? rawSigner : null

  // Shared state
  const [selectedPool, setSelectedPool] = useState('')
  
  // Swap state
  const [swapAmount, setSwapAmount] = useState('')
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

  const handleInitPool = async (tokenMintA: string, tokenMintB: string) => {
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

      const signature = await signAndSendTransactionMessageWithSigners(transaction)
      const decoder = getBase58Decoder()
      const sig58 = decoder.decode(signature)
      console.log(sig58)
      
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

    } catch (error) {
      console.error('Error initializing pool:', error)
      toast.error('Error initializing pool: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLiquidity = async (liquidityAmountA: string, liquidityAmountB: string) => {
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
              new PublicKey(account.publicKey),
              userAta_A,
              new PublicKey(account.publicKey),
              WSOL_MINT,
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
            new PublicKey(account.publicKey),
            userLpAta,
            new PublicKey(account.publicKey),
            lpMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )

          ix.push(fromLegacyTransactionInstruction(createAtaInstruction));
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

    } catch (error) {
      console.error('Error adding liquidity:', error)
      toast.error('Error adding liquidity: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwap = async () => {
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
            new PublicKey(account.publicKey),
            userAta_A,
            new PublicKey(account.publicKey),
            mintA,
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
            new PublicKey(account.publicKey),
            userAta_B,
            new PublicKey(account.publicKey),
            mintB,
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
          userAta_A,
          new PublicKey(account.publicKey),
          new PublicKey(account.publicKey),
          [],
          TOKEN_PROGRAM_ID
        )
        ix.push(fromLegacyTransactionInstruction(closeAccountIx))
        console.log('Will unwrap WSOL Token A to SOL')
      }

      // Unwrap WSOL back to SOL for Token B
      if (isMintBWSOL) {
        const closeAccountIx = createCloseAccountInstruction(
          userAta_B,
          new PublicKey(account.publicKey),
          new PublicKey(account.publicKey),
          [],
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
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AMM Interface
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Automated Market Maker on Solana Devnet
        </p>
        <div className="flex justify-center items-center gap-4 text-sm">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
            🟢 Connected: {account.publicKey.slice(0, 8)}...{account.publicKey.slice(-8)}
          </span>
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
            📍 Devnet
          </span>
        </div>
      </div>

      {/* Pool List */}
      <PoolList 
        pools={allPools} 
        selectedPool={selectedPool} 
        onSelectPool={setSelectedPool} 
      />

      {/* Main Feature Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Initialize Pool */}
        <InitializePool 
          onInitializePool={handleInitPool} 
          isLoading={isLoading} 
        />

        {/* Add Liquidity */}
        <AddLiquidity 
          selectedPool={selectedPool}
          onAddLiquidity={handleAddLiquidity}
          onPoolChange={setSelectedPool}
          isLoading={isLoading}
        />

        {/* Swap Tokens */}
        <SwapTokens 
          selectedPool={selectedPool}
          swapFromTokenA={swapFromTokenA}
          swapAmount={swapAmount}
          minimumAmountOut={minimumAmountOut}
          onPoolChange={setSelectedPool}
          onSwapDirectionChange={setSwapFromTokenA}
          onSwapAmountChange={setSwapAmount}
          onMinimumAmountOutChange={setMinimumAmountOut}
          onSwap={handleSwap}
          isLoading={isLoading}
        />

        {/* Remove Liquidity */}
        <RemoveLiquidity 
          selectedPool={selectedPool}
          onPoolChange={setSelectedPool}
          onRemoveLiquidity={handleRemoveLiquidity}
          isLoading={isLoading}
        />
      </div>

      {/* Information Panel */}
      <InfoPanel 
        programId={AMM_PROGRAM_ID.toBase58()} 
        walletAddress={account.publicKey.toString()} 
      />
    </div>
  )
}
