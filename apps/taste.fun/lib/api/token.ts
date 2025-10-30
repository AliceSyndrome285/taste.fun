import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from '@solana/spl-token';
import { AnchorProvider, Program, BN, web3, Idl } from '@coral-xyz/anchor';
import tasteFunTokenIdl from '../idl/taste_fun_token.json';

const TASTE_FUN_TOKEN_PROGRAM_ID = new PublicKey(tasteFunTokenIdl.address);

// Type alias for the program
type TasteFunTokenProgram = Program<Idl>;

export enum VotingMode {
  Classic = 'classic',
  Reverse = 'reverse',
  MiddleWay = 'middleWay',
}

export interface Theme {
  creator: PublicKey;
  themeId: BN;
  name: string;
  description: string;
  createdAt: BN;
  tokenMint: PublicKey;
  totalSupply: BN;
  circulatingSupply: BN;
  creatorReserve: BN;
  tokenReserves: BN;
  solReserves: BN;
  buybackPool: BN;
  // 移除的字段：totalIdeasCount, totalTradedVolume, platformFeeCollected, creatorFeeCollected
  votingMode: VotingMode;
  status: 'active' | 'migrated' | 'paused';
  vaultBump: number;
  themeBump: number;
}

export interface ThemeWithPda extends Theme {
  publicKey: PublicKey;
  tokenPrice: number; // Current price in SOL
}

/**
 * Get theme PDA
 */
export function getThemePda(
  creator: PublicKey,
  themeId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('theme'),
      creator.toBuffer(),
      themeId.toArrayLike(Buffer, 'le', 8),
    ],
    TASTE_FUN_TOKEN_PROGRAM_ID
  );
}

/**
 * Get theme vault PDA
 */
export function getThemeVaultPda(
  creator: PublicKey,
  themeId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('theme_vault'),
      creator.toBuffer(),
      themeId.toArrayLike(Buffer, 'le', 8),
    ],
    TASTE_FUN_TOKEN_PROGRAM_ID
  );
}

/**
 * Get theme token mint PDA
 */
export function getThemeTokenMintPda(
  creator: PublicKey,
  themeId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('theme_mint'),
      creator.toBuffer(),
      themeId.toArrayLike(Buffer, 'le', 8),
    ],
    TASTE_FUN_TOKEN_PROGRAM_ID
  );
}

/**
 * Get trading configuration PDA
 */
export function getTradingConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('trading_config')],
    TASTE_FUN_TOKEN_PROGRAM_ID
  );
}

/**
 * Fetch a theme by its public key
 */
export async function fetchTheme(
  connection: Connection,
  themePubkey: PublicKey
): Promise<ThemeWithPda | null> {
  try {
    const provider = new AnchorProvider(connection, {} as any, {});
    const program = new Program(
      tasteFunTokenIdl as Idl,
      provider
    );

    const themeAccount: any = await (program.account as any).theme.fetch(themePubkey);
    
    // Calculate current token price
    const tokenPrice = calculateTokenPrice(
      themeAccount.solReserves,
      themeAccount.tokenReserves
    );

    return {
      ...themeAccount,
      publicKey: themePubkey,
      tokenPrice,
    } as ThemeWithPda;
  } catch (error) {
    console.error('Error fetching theme:', error);
    return null;
  }
}

/**
 * Fetch all themes
 */
export async function fetchAllThemes(
  connection: Connection
): Promise<ThemeWithPda[]> {
  try {
    const provider = new AnchorProvider(connection, {} as any, {});
    const program = new Program(
      tasteFunTokenIdl as Idl,
      provider
    );

    const themes: any[] = await (program.account as any).theme.all();
    
    return themes.map((theme) => {
      const tokenPrice = calculateTokenPrice(
        theme.account.solReserves,
        theme.account.tokenReserves
      );

      return {
        ...theme.account,
        publicKey: theme.publicKey,
        tokenPrice,
      } as ThemeWithPda;
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    return [];
  }
}

/**
 * Calculate current token price based on bonding curve
 */
export function calculateTokenPrice(
  solReserves: BN,
  tokenReserves: BN
): number {
  if (tokenReserves.isZero() || solReserves.isZero()) {
    return 0;
  }
  
  // Price = SOL reserves / Token reserves
  const price = solReserves.toNumber() / tokenReserves.toNumber();
  return price;
}

/**
 * Calculate how many tokens you get for a given SOL amount
 */
export function calculateBuyTokens(
  solAmount: BN,
  tokenReserves: BN,
  solReserves: BN,
  feeBps: number = 100 // 1%
): BN {
  if (solAmount.isZero() || tokenReserves.isZero()) {
    return new BN(0);
  }

  // Apply fee
  const BPS_DENOMINATOR = 10000;
  const solAfterFee = solAmount
    .mul(new BN(BPS_DENOMINATOR - feeBps))
    .div(new BN(BPS_DENOMINATOR));

  // tokens_out = token_reserves * sol_after_fee / (sol_reserves + sol_after_fee)
  const newSolReserves = solReserves.add(solAfterFee);
  const tokensOut = tokenReserves.mul(solAfterFee).div(newSolReserves);

  return tokensOut;
}

/**
 * Calculate how much SOL you get for selling tokens
 */
export function calculateSellSol(
  tokenAmount: BN,
  tokenReserves: BN,
  solReserves: BN,
  feeBps: number = 100 // 1%
): BN {
  if (tokenAmount.isZero() || solReserves.isZero()) {
    return new BN(0);
  }

  // sol_out = sol_reserves * token_amount / (token_reserves + token_amount)
  const newTokenReserves = tokenReserves.add(tokenAmount);
  const solOut = solReserves.mul(tokenAmount).div(newTokenReserves);

  // Apply fee
  const BPS_DENOMINATOR = 10000;
  const solOutNet = solOut
    .mul(new BN(BPS_DENOMINATOR - feeBps))
    .div(new BN(BPS_DENOMINATOR));

  return solOutNet;
}

/**
 * Create a new theme - Step 1: Initialize theme accounts
 */
export async function initializeTheme(
  connection: Connection,
  wallet: any,
  themeId: BN,
  name: string,
  description: string,
  votingMode: VotingMode
): Promise<string> {
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(
    tasteFunTokenIdl as Idl,
    provider
  );

  const [themePda] = getThemePda(wallet.publicKey, themeId);
  const [vaultPda] = getThemeVaultPda(wallet.publicKey, themeId);
  const [tokenMintPda] = getThemeTokenMintPda(wallet.publicKey, themeId);

  // Convert voting mode to program format
  let votingModeArg: any;
  switch (votingMode) {
    case VotingMode.Classic:
      votingModeArg = { classic: {} };
      break;
    case VotingMode.Reverse:
      votingModeArg = { reverse: {} };
      break;
    case VotingMode.MiddleWay:
      votingModeArg = { middleWay: {} };
      break;
  }

  // Convert name and description to fixed-length byte arrays
  const MAX_THEME_NAME_LEN = 12;
  const MAX_THEME_DESCRIPTION_LEN = 48;
  
  const nameBytes = Buffer.alloc(MAX_THEME_NAME_LEN);
  Buffer.from(name).copy(nameBytes);
  
  const descriptionBytes = Buffer.alloc(MAX_THEME_DESCRIPTION_LEN);
  Buffer.from(description).copy(descriptionBytes);

  const tx = await (program.methods as any)
    .initializeTheme(
      themeId,
      Array.from(nameBytes),
      Array.from(descriptionBytes),
      votingModeArg
    )
    .accounts({
      theme: themePda,
      vault: vaultPda,
      tokenMint: tokenMintPda,
      creator: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
    ])
    .rpc();

  return tx;
}

/**
 * Create a new theme - Step 2: Mint initial tokens
 */
export async function mintInitialThemeTokens(
  connection: Connection,
  wallet: any,
  themeId: BN
): Promise<string> {
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(
    tasteFunTokenIdl as Idl,
    provider
  );

  const [themePda] = getThemePda(wallet.publicKey, themeId);
  const [vaultPda] = getThemeVaultPda(wallet.publicKey, themeId);
  const [tokenMintPda] = getThemeTokenMintPda(wallet.publicKey, themeId);

  const vaultTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    vaultPda,
    true
  );

  const creatorTokenAccount = await getAssociatedTokenAddress(
    tokenMintPda,
    wallet.publicKey
  );

  const tx = await (program.methods as any)
    .mintInitialTokens(themeId)
    .accounts({
      theme: themePda,
      vault: vaultPda,
      tokenMint: tokenMintPda,
      vaultTokenAccount,
      creatorTokenAccount,
      creator: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
    ])
    .rpc();

  return tx;
}

/**
 * Create a new theme (legacy - calls both steps)
 * @deprecated Use initializeTheme and mintInitialThemeTokens separately for better error handling
 */
export async function createTheme(
  connection: Connection,
  wallet: any,
  themeId: BN,
  name: string,
  description: string,
  votingMode: VotingMode
): Promise<{ initTx: string; mintTx: string }> {
  // Step 1: Initialize theme
  const initTx = await initializeTheme(
    connection,
    wallet,
    themeId,
    name,
    description,
    votingMode
  );

  // Wait for confirmation
  await connection.confirmTransaction(initTx, 'confirmed');

  // Step 2: Mint initial tokens
  const mintTx = await mintInitialThemeTokens(connection, wallet, themeId);

  return { initTx, mintTx };
}

/**
 * Buy theme tokens with SOL
 */
export async function buyThemeTokens(
  connection: Connection,
  wallet: any,
  themePubkey: PublicKey,
  solAmount: BN,
  minTokensOut: BN,
  slippageBps: number = 100 // 1% default slippage
): Promise<string> {
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(
    tasteFunTokenIdl as Idl,
    provider
  );

  const theme: any = await (program.account as any).theme.fetch(themePubkey);
  const [tradingConfigPda] = getTradingConfigPda();
  const [vaultPda] = getThemeVaultPda(theme.creator, theme.themeId);

  const vaultTokenAccount = await getAssociatedTokenAddress(
    theme.tokenMint,
    vaultPda,
    true
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    theme.tokenMint,
    wallet.publicKey
  );

  const tx = await (program.methods as any)
    .swapSolForTokens(solAmount, minTokensOut)
    .accounts({
      theme: themePubkey,
      vault: vaultPda,
      tokenMint: theme.tokenMint,
      vaultTokenAccount,
      userTokenAccount,
      tradingConfig: tradingConfigPda,
      user: wallet.publicKey,
      vaultSolAccount: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * Sell theme tokens for SOL
 */
export async function sellThemeTokens(
  connection: Connection,
  wallet: any,
  themePubkey: PublicKey,
  tokenAmount: BN,
  minSolOut: BN,
  slippageBps: number = 100 // 1% default slippage
): Promise<string> {
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(
    tasteFunTokenIdl as Idl,
    provider
  );

  const theme: any = await (program.account as any).theme.fetch(themePubkey);
  const [tradingConfigPda] = getTradingConfigPda();
  const [vaultPda] = getThemeVaultPda(theme.creator, theme.themeId);

  const vaultTokenAccount = await getAssociatedTokenAddress(
    theme.tokenMint,
    vaultPda,
    true
  );

  const userTokenAccount = await getAssociatedTokenAddress(
    theme.tokenMint,
    wallet.publicKey
  );

  const tx = await (program.methods as any)
    .swapTokensForSol(tokenAmount, minSolOut)
    .accounts({
      theme: themePubkey,
      vault: vaultPda,
      tokenMint: theme.tokenMint,
      vaultTokenAccount,
      userTokenAccount,
      tradingConfig: tradingConfigPda,
      user: wallet.publicKey,
      vaultSolAccount: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * Get user's token balance for a theme
 */
export async function getUserTokenBalance(
  connection: Connection,
  userPubkey: PublicKey,
  tokenMint: PublicKey
): Promise<BN> {
  try {
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      userPubkey
    );

    const balance = await connection.getTokenAccountBalance(userTokenAccount);
    return new BN(balance.value.amount);
  } catch (error) {
    // Account doesn't exist yet
    return new BN(0);
  }
}
