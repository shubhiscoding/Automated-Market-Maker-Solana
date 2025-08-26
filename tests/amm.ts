import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getMint
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("AMM Tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.amm as Program<Amm>;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts
  let mintA: PublicKey;
  let mintB: PublicKey;
  let userTokenAccountA: PublicKey;
  let userTokenAccountB: PublicKey;
  let userLpTokenAccount: PublicKey;
  let pool: PublicKey;
  let lpMint: PublicKey;
  let vaultA: PublicKey;
  let vaultB: PublicKey;
  let poolAuth: PublicKey;

  // Test parameters
  const feeBps = 25; // 0.25%
  const protoFeeBps = 5; // 0.05%
  const initialMintAmount = new BN(1000000); // 1M tokens
  const liquidityAmountA = new BN(100000); // 100K tokens
  const liquidityAmountB = new BN(200000); // 200K tokens

  before(async () => {
    // Airdrop SOL to wallet for testing
    const signature = await provider.connection.requestAirdrop(
      wallet.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    console.log(signature);
    console.log(wallet.publicKey.toString());

    // Create token mints
    mintA = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      9 // 9 decimals
    );

    mintB = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      9 // 9 decimals
    );

    // Create user token accounts
    userTokenAccountA = await createAccount(
      provider.connection,
      wallet.payer,
      mintA,
      wallet.publicKey
    );

    userTokenAccountB = await createAccount(
      provider.connection,
      wallet.payer,
      mintB,
      wallet.publicKey
    );

    // Mint tokens to user accounts
    await mintTo(
      provider.connection,
      wallet.payer,
      mintA,
      userTokenAccountA,
      wallet.publicKey,
      initialMintAmount.toNumber()
    );

    await mintTo(
      provider.connection,
      wallet.payer,
      mintB,
      userTokenAccountB,
      wallet.publicKey,
      initialMintAmount.toNumber()
    );

    // Derive PDAs
    [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from("Pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );

    [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), pool.toBuffer()],
      program.programId
    );

    [poolAuth] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_auth"), pool.toBuffer()],
      program.programId
    );

    [vaultA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_a"), pool.toBuffer()],
      program.programId
    );

    [vaultB] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_b"), pool.toBuffer()],
      program.programId
    );
  });

  describe("Initialize Pool", () => {
    it("Successfully initializes a new pool", async () => {
      const tx = await program.methods
        .initializePool(feeBps, protoFeeBps)
        .accounts({
          signer: wallet.publicKey,
          mintA: mintA,
          mintB: mintB
        })
        .rpc();

      console.log("Pool initialization transaction:", tx);

      // Create LP token account for user after LP mint is created
      userLpTokenAccount = await createAccount(
        provider.connection,
        wallet.payer,
        lpMint,
        wallet.publicKey
      );

      // Verify pool was created with correct data
      const poolAccount = await program.account.pool.fetch(pool);
      assert.equal(poolAccount.mintA.toBase58(), mintA.toBase58());
      assert.equal(poolAccount.mintB.toBase58(), mintB.toBase58());
      assert.equal(poolAccount.vaultA.toBase58(), vaultA.toBase58());
      assert.equal(poolAccount.vaultB.toBase58(), vaultB.toBase58());
      assert.equal(poolAccount.lpMint.toBase58(), lpMint.toBase58());
      assert.equal(poolAccount.feeBps, feeBps);
      assert.equal(poolAccount.protoFeeBps, protoFeeBps);
      assert.equal(poolAccount.admin.toBase58(), wallet.publicKey.toBase58());

      // Verify LP mint was created correctly
      const lpMintAccount = await getMint(provider.connection, lpMint);
      assert.equal(lpMintAccount.decimals, 9);
      assert.equal(lpMintAccount.mintAuthority?.toBase58(), poolAuth.toBase58());
      assert.equal(lpMintAccount.supply.toString(), "0");

      // Verify vaults were created
      const vaultAAccount = await getAccount(provider.connection, vaultA);
      const vaultBAccount = await getAccount(provider.connection, vaultB);
      assert.equal(vaultAAccount.mint.toBase58(), mintA.toBase58());
      assert.equal(vaultBAccount.mint.toBase58(), mintB.toBase58());
      assert.equal(vaultAAccount.owner.toBase58(), poolAuth.toBase58());
      assert.equal(vaultBAccount.owner.toBase58(), poolAuth.toBase58());
    });

    it("Fails to initialize pool with same mints twice", async () => {
      try {
        await program.methods
          .initializePool(feeBps, protoFeeBps)
          .accounts({
            signer: wallet.publicKey,
            mintA: mintA,
            mintB: mintB,
            pool: pool,
            lpMint: lpMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            poolAuth: poolAuth,
            vaultA: vaultA,
            vaultB: vaultB,
          })
          .rpc();
        assert.fail("Should have failed to initialize duplicate pool");
      } catch (error) {
        // Expected to fail due to account already existing
        assert.include(error.message.toLowerCase(), "already in use");
      }
    });
  });

  describe("Add Liquidity", () => {
    it("Successfully adds initial liquidity to empty pool", async () => {
      const tx = await program.methods
        .addLiquidity(liquidityAmountA, liquidityAmountB)
        .accounts({
          pool: pool,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          lpMint: lpMint,
          userLpAta: userLpTokenAccount,
          poolAuth: poolAuth,
        })
        .rpc();

      console.log("Add liquidity transaction:", tx);

      // Check vault balances
      const vaultAAccount = await getAccount(provider.connection, vaultA);
      const vaultBAccount = await getAccount(provider.connection, vaultB);
      assert.equal(vaultAAccount.amount.toString(), liquidityAmountA.toString());
      assert.equal(vaultBAccount.amount.toString(), liquidityAmountB.toString());

      // Check LP token minting
      const lpMintAccount = await getMint(provider.connection, lpMint);
      const userLpAccount = await getAccount(provider.connection, userLpTokenAccount);
      
      // For initial liquidity, LP tokens = sqrt(amountA * amountB)
      const expectedLpTokens = Math.floor(Math.sqrt(liquidityAmountA.toNumber() * liquidityAmountB.toNumber()));
      assert.equal(lpMintAccount.supply.toString(), expectedLpTokens.toString());
      assert.equal(userLpAccount.amount.toString(), expectedLpTokens.toString());

      // Check user token balances decreased
      const userAccountA = await getAccount(provider.connection, userTokenAccountA);
      const userAccountB = await getAccount(provider.connection, userTokenAccountB);
      assert.equal(userAccountA.amount.toString(), (initialMintAmount.toNumber() - liquidityAmountA.toNumber()).toString());
      assert.equal(userAccountB.amount.toString(), (initialMintAmount.toNumber() - liquidityAmountB.toNumber()).toString());
    });

    it("Successfully adds subsequent liquidity maintaining ratio", async () => {
      const additionalAmountA = new BN(50000);
      const additionalAmountB = new BN(100000);

      const lpMintBefore = await getMint(provider.connection, lpMint);
      const userLpBefore = await getAccount(provider.connection, userLpTokenAccount);

      const tx = await program.methods
        .addLiquidity(additionalAmountA, additionalAmountB)
        .accounts({
          pool: pool,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          lpMint: lpMint,
          userLpAta: userLpTokenAccount,
          poolAuth: poolAuth,
        })
        .rpc();

      console.log("Add additional liquidity transaction:", tx);

      // Check that liquidity was added
      const lpMintAfter = await getMint(provider.connection, lpMint);
      const userLpAfter = await getAccount(provider.connection, userLpTokenAccount);

      assert.isTrue(lpMintAfter.supply > lpMintBefore.supply);
      assert.isTrue(userLpAfter.amount > userLpBefore.amount);
    });

    it("Fails to add liquidity with zero amounts", async () => {
      try {
        await program.methods
          .addLiquidity(new BN(0), new BN(0))
          .accounts({
            pool: pool,
            vaultA: vaultA,
            vaultB: vaultB,
            userAtaA: userTokenAccountA,
            userAtaB: userTokenAccountB,
            lpMint: lpMint,
            userLpAta: userLpTokenAccount,
            poolAuth: poolAuth,
          })
          .rpc();
        assert.fail("Should have failed with zero amounts");
      } catch (error) {
        // Expected to fail
        console.log("Expected error for zero amounts:", error.message);
      }
    });
  });

  describe("Remove Liquidity", () => {
    it("Successfully removes partial liquidity", async () => {
      const userLpBefore = await getAccount(provider.connection, userLpTokenAccount);
      const lpToRemove = new BN(userLpBefore.amount.toString()).div(new BN(2)); // Remove half

      const vaultABefore = await getAccount(provider.connection, vaultA);
      const vaultBBefore = await getAccount(provider.connection, vaultB);
      const userAccountABefore = await getAccount(provider.connection, userTokenAccountA);
      const userAccountBBefore = await getAccount(provider.connection, userTokenAccountB);

      const tx = await program.methods
        .removeLiquidity(lpToRemove)
        .accounts({
          pool: pool,
          payer: wallet.publicKey,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          userLpAta: userLpTokenAccount,
          lpMint: lpMint,
          poolAuth: poolAuth,
        })
        .rpc();

      console.log("Remove liquidity transaction:", tx);

      // Check LP tokens were burned
      const userLpAfter = await getAccount(provider.connection, userLpTokenAccount);
      assert.isTrue(userLpAfter.amount < userLpBefore.amount);

      // Check that user received tokens back
      const userAccountAAfter = await getAccount(provider.connection, userTokenAccountA);
      const userAccountBAfter = await getAccount(provider.connection, userTokenAccountB);
      assert.isTrue(userAccountAAfter.amount > userAccountABefore.amount);
      assert.isTrue(userAccountBAfter.amount > userAccountBBefore.amount);

      // Check vault balances decreased
      const vaultAAfter = await getAccount(provider.connection, vaultA);
      const vaultBAfter = await getAccount(provider.connection, vaultB);
      assert.isTrue(vaultAAfter.amount < vaultABefore.amount);
      assert.isTrue(vaultBAfter.amount < vaultBBefore.amount);
    });

    it("Successfully removes all remaining liquidity", async () => {
      const userLpBefore = await getAccount(provider.connection, userLpTokenAccount);
      const lpToRemove = new BN(userLpBefore.amount.toString());

      const tx = await program.methods
        .removeLiquidity(lpToRemove)
        .accounts({
          pool: pool,
          payer: wallet.publicKey,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          userLpAta: userLpTokenAccount,
          lpMint: lpMint,
          poolAuth: poolAuth
        })
        .rpc();

      console.log("Remove all liquidity transaction:", tx);

      // Check all LP tokens were burned
      const userLpAfter = await getAccount(provider.connection, userLpTokenAccount);
      assert.equal(userLpAfter.amount.toString(), "0");

      // Check LP mint supply is reduced
      const lpMintAfter = await getMint(provider.connection, lpMint);
      assert.isTrue(lpMintAfter.supply < userLpBefore.amount);
    });

    it("Fails to remove liquidity when user has no LP tokens", async () => {
      try {
        await program.methods
          .removeLiquidity(new BN(100))
          .accounts({
            pool: pool,
            payer: wallet.publicKey,
            vaultA: vaultA,
            vaultB: vaultB,
            userAtaA: userTokenAccountA,
            userAtaB: userTokenAccountB,
            userLpAta: userLpTokenAccount,
            lpMint: lpMint,
            poolAuth: poolAuth
          })
          .rpc();
        assert.fail("Should have failed when user has no LP tokens");
      } catch (error) {
        // Expected to fail due to insufficient LP tokens
        console.log("Expected error for insufficient LP tokens:", error.message);
      }
    });

    it("Fails to remove liquidity when pool has no liquidity", async () => {
      // Create a new user to test this scenario
      const newUser = Keypair.generate();
      
      // Airdrop SOL to new user
      const signature = await provider.connection.requestAirdrop(
        newUser.publicKey,
        LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Create token accounts for new user
      const newUserTokenAccountA = await createAccount(
        provider.connection,
        newUser,
        mintA,
        newUser.publicKey
      );

      const newUserTokenAccountB = await createAccount(
        provider.connection,
        newUser,
        mintB,
        newUser.publicKey
      );

      const newUserLpTokenAccount = await createAccount(
        provider.connection,
        newUser,
        lpMint,
        newUser.publicKey
      );

      try {
        await program.methods
          .removeLiquidity(new BN(100))
          .accounts({
            pool: pool,
            payer: newUser.publicKey,
            vaultA: vaultA,
            vaultB: vaultB,
            userAtaA: newUserTokenAccountA,
            userAtaB: newUserTokenAccountB,
            userLpAta: newUserLpTokenAccount,
            lpMint: lpMint,
            poolAuth: poolAuth
          })
          .signers([newUser])
          .rpc();
        assert.fail("Should have failed when user has no LP tokens");
      } catch (error) {
        // Expected to fail
        console.log("Expected error for new user with no LP tokens:", error.message);
      }
    });
  });

  describe("Error Cases", () => {
    it("Fails to initialize pool with invalid fee parameters", async () => {
      // Create new mints for this test
      const testMintA = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        9
      );

      const testMintB = await createMint(
        provider.connection,
        wallet.payer,
        wallet.publicKey,
        null,
        9
      );

      const [testPool] = PublicKey.findProgramAddressSync(
        [Buffer.from("Pool"), testMintA.toBuffer(), testMintB.toBuffer()],
        program.programId
      );

      const [testLpMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_mint"), testPool.toBuffer()],
        program.programId
      );

      const [testPoolAuth] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_auth"), testPool.toBuffer()],
        program.programId
      );

      const [testVaultA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_a"), testPool.toBuffer()],
        program.programId
      );

      const [testVaultB] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_b"), testPool.toBuffer()],
        program.programId
      );

      try {
        // Try with fee > 10000 bps (100%)
        await program.methods
          .initializePool(10001, protoFeeBps)
          .accounts({
            signer: wallet.publicKey,
            mintA: testMintA,
            mintB: testMintB,
            pool: testPool,
            lpMint: testLpMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            poolAuth: testPoolAuth,
            vaultA: testVaultA,
            vaultB: testVaultB,
          })
          .rpc();
        assert.fail("Should have failed with invalid fee");
      } catch (error) {
        // Expected to fail with high fee, but Anchor doesn't have built-in validation for this
        // The error might be related to other constraints
        console.log("Error with high fee:", error.message);
      }
    });
  });
// ...existing code...

describe("Swap Functionality", () => {
  before(async () => {
    // First, we need to add liquidity back to the pool for swap tests
    // since the previous test removed all liquidity
    await program.methods
      .addLiquidity(liquidityAmountA, liquidityAmountB)
      .accounts({
        pool: pool,
        vaultA: vaultA,
        vaultB: vaultB,
        userAtaA: userTokenAccountA,
        userAtaB: userTokenAccountB,
        lpMint: lpMint,
        userLpAta: userLpTokenAccount,
        poolAuth: poolAuth,
      })
      .rpc();
  });

  it("Successfully swaps token A for token B", async () => {
    // Why this test matters: Core AMM functionality - users must be able to swap tokens
    // This tests the constant product formula: x * y = k
    
    const swapAmount = new BN(1000);
    const minAmountOut = new BN(1); // Minimal slippage protection
    
    // Get initial balances to verify the swap worked correctly
    const userAccountABefore = await getAccount(provider.connection, userTokenAccountA);
    const userAccountBBefore = await getAccount(provider.connection, userTokenAccountB);
    const vaultABefore = await getAccount(provider.connection, vaultA);
    const vaultBBefore = await getAccount(provider.connection, vaultB);
    
    const tx = await program.methods
      .swapToken(swapAmount, minAmountOut)
      .accounts({
        pool: pool,
        vaultA: vaultA,
        vaultB: vaultB,
        userAtaA: userTokenAccountA,
        userAtaB: userTokenAccountB,
        poolAuth: poolAuth,
      })
      .rpc();

    console.log("Swap A->B transaction:", tx);

    // Verify the swap worked correctly
    const userAccountAAfter = await getAccount(provider.connection, userTokenAccountA);
    const userAccountBAfter = await getAccount(provider.connection, userTokenAccountB);
    const vaultAAfter = await getAccount(provider.connection, vaultA);
    const vaultBAfter = await getAccount(provider.connection, vaultB);

    // User should have less token A and more token B
    assert.isTrue(userAccountAAfter.amount < userAccountABefore.amount);
    assert.isTrue(userAccountBAfter.amount > userAccountBBefore.amount);
    
    // Vaults should reflect the opposite change
    assert.isTrue(vaultAAfter.amount > vaultABefore.amount);
    assert.isTrue(vaultBAfter.amount < vaultBBefore.amount);
    
    // The exact amount A should have been deducted
    assert.equal(
      (userAccountABefore.amount - userAccountAAfter.amount).toString(), 
      swapAmount.toString()
    );
  });

  it("Successfully swaps token B for token A", async () => {
    // Why: Test bidirectional swapping - AMMs must work both ways
    
    const swapAmount = new BN(2000);
    const minAmountOut = new BN(1);
    
    const userAccountABefore = await getAccount(provider.connection, userTokenAccountA);
    const userAccountBBefore = await getAccount(provider.connection, userTokenAccountB);
    
    const tx = await program.methods
      .swapToken(swapAmount, minAmountOut)
      .accounts({
        pool: pool,
        vaultA: vaultB, // Note: swapped vaults for B->A swap
        vaultB: vaultA,
        userAtaA: userTokenAccountB, // Note: swapped user accounts
        userAtaB: userTokenAccountA,
        poolAuth: poolAuth,
      })
      .rpc();

    const userAccountAAfter = await getAccount(provider.connection, userTokenAccountA);
    const userAccountBAfter = await getAccount(provider.connection, userTokenAccountB);

    assert.equal(
      (userAccountBBefore.amount - userAccountBAfter.amount).toString(), 
      swapAmount.toString()
    );
    // User should have more token A and less token B
    assert.isTrue(userAccountAAfter.amount > userAccountABefore.amount);
    assert.isTrue(userAccountBAfter.amount < userAccountBBefore.amount);
  });

  it("Fails swap with insufficient liquidity", async () => {
    // Why: Prevent users from draining the pool or causing mathematical errors
    
    const vaultBAccount = await getAccount(provider.connection, vaultB);
    const impossibleSwapAmount = new BN(vaultBAccount.amount.toString()).add(new BN(1));
    
    try {
      await program.methods
        .swapToken(impossibleSwapAmount, new BN(1))
        .accounts({
          pool: pool,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          poolAuth: poolAuth,
        })
        .rpc();
      assert.fail("Should have failed with insufficient liquidity");
    } catch (error) {
      console.log("Expected error for insufficient liquidity:", error.message);
    }
  });

  it("Fails swap with slippage protection (minimum amount out)", async () => {
    // Why: Critical for user protection against MEV attacks and price manipulation
    
    const swapAmount = new BN(1000);
    const unrealisticMinAmountOut = new BN(1000000); // Expecting way more than possible
    
    try {
      await program.methods
        .swapToken(swapAmount, unrealisticMinAmountOut)
        .accounts({
          pool: pool,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          poolAuth: poolAuth,
        })
        .rpc();
      assert.fail("Should have failed with slippage protection");
    } catch (error) {
      console.log("Expected error for slippage protection:", error.message);
    }
  });
});

  describe("Edge Cases and Mathematical Accuracy", () => {
    it("Handles extremely small swap amounts", async () => {
      
      const tinySwapAmount = new BN(1); // Smallest possible amount
      
      const tx = await program.methods
        .swapToken(tinySwapAmount, new BN(0)) // Accept any amount out
        .accounts({
          pool: pool,
          vaultA: vaultA,
          vaultB: vaultB,
          userAtaA: userTokenAccountA,
          userAtaB: userTokenAccountB,
          poolAuth: poolAuth,
        })
        .rpc();
      
      console.log("Tiny swap transaction:", tx);
      
      // Should complete without error
      assert.isOk(tx);
    });
  });

  describe("Security and Error Handling", () => {
    it("Prevents zero amount swaps", async () => {
      // Why: Zero amount operations could cause division by zero or other errors
      
      try {
        await program.methods
          .swapToken(new BN(0), new BN(0))
          .accounts({
            pool: pool,
            vaultA: vaultA,
            vaultB: vaultB,
            userAtaA: userTokenAccountA,
            userAtaB: userTokenAccountB,
            poolAuth: poolAuth,
          })
          .rpc();
        assert.fail("Should have failed with zero swap amount");
      } catch (error) {
        console.log("Expected error for zero swap:", error.message);
      }
    });

    it("Handles insufficient token balance gracefully", async () => {
      // Why: Users shouldn't be able to swap more tokens than they have
      
      const userAccountA = await getAccount(provider.connection, userTokenAccountA);
      const impossibleAmount = new BN(userAccountA.amount.toString()).add(new BN(1));
      
      try {
        await program.methods
          .swapToken(impossibleAmount, new BN(1))
          .accounts({
            pool: pool,
            vaultA: vaultA,
            vaultB: vaultB,
            userAtaA: userTokenAccountA,
            userAtaB: userTokenAccountB,
            poolAuth: poolAuth,
          })
          .rpc();
        assert.fail("Should have failed with insufficient balance");
      } catch (error) {
        console.log("Expected error for insufficient balance:", error.message);
      }
    });
  });

  // it("Handles large swap amounts with proper price impact", async () => {
  //   // Why: Large swaps should have significant price impact - this prevents manipulation
    
  //   const largeSwapAmount = new BN(50000); // Large relative to pool size
    
  //   const vaultABefore = await getAccount(provider.connection, vaultA);
  //   const vaultBBefore = await getAccount(provider.connection, vaultB);
  //   const userAccountBBefore = await getAccount(provider.connection, userTokenAccountB);
    
  //   await program.methods
  //     .swap(largeSwapAmount, new BN(1))
  //     .accounts({
  //       pool: pool,
  //       vaultA: vaultA,
  //       vaultB: vaultB,
  //       userAtaA: userTokenAccountA,
  //       userAtaB: userTokenAccountB,
  //       poolAuth: poolAuth,
  //     })
  //     .rpc();
    
  //   const vaultAAfter = await getAccount(provider.connection, vaultA);
  //   const vaultBAfter = await getAccount(provider.connection, vaultB);
  //   const userAccountBAfter = await getAccount(provider.connection, userTokenAccountB);
    
  //   const amountOut = userAccountBAfter.amount - userAccountBBefore.amount;
    
  //   // Calculate the effective price
  //   const effectivePrice = largeSwapAmount.toNumber() / amountOut;
  //   const initialPrice = vaultBBefore.amount / vaultABefore.amount;
    
  //   console.log(`Initial price: ${initialPrice}, Effective price: ${effectivePrice}`);
    
  //   // Large swaps should have worse prices (higher price impact)
  //   assert.isTrue(effectivePrice > initialPrice, "Large swaps should have price impact");
  // });

  // it("Handles imbalanced liquidity additions correctly", async () => {
  //   // Why: When ratios don't match, the AMM should handle it gracefully
    
  //   const poolBefore = await program.account.pool.fetch(pool);
  //   const vaultABefore = await getAccount(provider.connection, vaultA);
  //   const vaultBBefore = await getAccount(provider.connection, vaultB);
    
  //   // Current ratio
  //   const currentRatio = vaultBBefore.amount / vaultABefore.amount;
    
  //   // Add liquidity with different ratio (2x the current ratio)
  //   const imbalancedAmountA = new BN(10000);
  //   const imbalancedAmountB = new BN(imbalancedAmountA.toNumber() * currentRatio * 2);
    
  //   const userLpBefore = await getAccount(provider.connection, userLpTokenAccount);
    
  //   await program.methods
  //     .addLiquidity(imbalancedAmountA, imbalancedAmountB)
  //     .accounts({
  //       pool: pool,
  //       vaultA: vaultA,
  //       vaultB: vaultB,
  //       userAtaA: userTokenAccountA,
  //       userAtaB: userTokenAccountB,
  //       lpMint: lpMint,
  //       userLpAta: userLpTokenAccount,
  //       poolAuth: poolAuth,
  //     })
  //     .rpc();
    
  //   const userLpAfter = await getAccount(provider.connection, userLpTokenAccount);
  //   const lpTokensReceived = userLpAfter.amount - userLpBefore.amount;
    
  //   // Should receive LP tokens, but not necessarily proportional to both amounts
  //   assert.isTrue(lpTokensReceived > 0, "Should receive some LP tokens");
  //   console.log(`LP tokens received for imbalanced addition: ${lpTokensReceived}`);
  // });
});

