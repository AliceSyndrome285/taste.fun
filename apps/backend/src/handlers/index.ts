import { db } from '../database';
import { logger } from '../utils/logger';
import { parseBigInt } from '../utils/helpers';
import {
  ThemeCreatedEvent,
  TokensSwappedEvent,
  BuybackExecutedEvent,
  IdeaCreatedEvent,
  SponsoredIdeaCreatedEvent,
  ImagesGeneratedEvent,
  VoteCastEvent,
  VotingSettledEvent,
  WinningsWithdrawnEvent,
  IdeaCancelledEvent,
  VotingCancelledEvent,
  RefundWithdrawnEvent,
  IdeaStatus,
  GenerationStatus,
  VotingMode,
  ThemeStatus,
} from '../types';
import { config } from '../config';
import { WebSocketService } from '../services/websocket';
import { QueueService } from '../services/queue';

/**
 * Handle ThemeCreated event
 */
export async function handleThemeCreated(
  event: any,  // Use any because Anchor returns snake_case from IDL
  signature: string
): Promise<void> {
  try {
    // Debug: log the raw event object
    logger.debug('Raw ThemeCreated event', {
      event: JSON.stringify(event, null, 2),
      eventKeys: Object.keys(event),
      signature,
    });

    // Anchor EventParser returns snake_case field names from IDL
    // IDL has: token_mint, voting_mode, total_supply
    const theme = event.theme;
    const creator = event.creator;
    const tokenMint = event.token_mint || event.tokenMint;  // Try both
    const eventVotingMode = event.voting_mode || event.votingMode;  // Renamed to avoid conflict
    const totalSupply = event.total_supply || event.totalSupply;

    // Safely check if fields exist
    if (!theme || !creator || !tokenMint) {
      logger.error('Missing required fields in ThemeCreated event', {
        hasTheme: !!theme,
        hasCreator: !!creator,
        hasTokenMint: !!tokenMint,
        event: JSON.stringify(event),
        signature,
      });
      throw new Error('Missing required fields in ThemeCreated event');
    }

    logger.info('Handling ThemeCreated event', {
      theme: theme.toString(),
      creator: creator.toString(),
      tokenMint: tokenMint.toString(),
      signature,
    });

    // Fetch theme account data from chain to get full details
    // Note: Theme account might not be fully initialized immediately after event
    // Add retry logic with exponential backoff
    let themeAccountInfo = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelays = [500, 1000, 2000, 4000, 8000]; // ms

    while (retryCount < maxRetries && !themeAccountInfo) {
      if (retryCount > 0) {
        logger.info('Retrying theme account fetch', {
          theme: theme.toString(),
          attempt: retryCount + 1,
          delay: retryDelays[retryCount - 1],
        });
        await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount - 1]));
      }
      
      themeAccountInfo = await fetchThemeAccountData(theme.toString());
      retryCount++;
    }

    if (!themeAccountInfo) {
      throw new Error('Failed to fetch theme account data after ' + maxRetries + ' attempts');
    }

    // Convert voting mode enum
    let votingMode: VotingMode;
    if ('classic' in eventVotingMode) votingMode = VotingMode.Classic;
    else if ('reverse' in eventVotingMode) votingMode = VotingMode.Reverse;
    else votingMode = VotingMode.MiddleWay;

    // Insert into database
    await db.query(
      `INSERT INTO themes (
        pubkey, theme_id, creator_pubkey, name, description,
        token_mint, total_supply, circulating_supply, creator_reserve,
        token_reserves, sol_reserves, buyback_pool, voting_mode, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
      [
        theme.toString(),
        themeAccountInfo.themeId,
        creator.toString(),
        themeAccountInfo.name,
        themeAccountInfo.description,
        tokenMint.toString(),
        totalSupply?.toString() || '0',
        themeAccountInfo.circulatingSupply.toString(),
        themeAccountInfo.creatorReserve.toString(),
        themeAccountInfo.tokenReserves.toString(),
        themeAccountInfo.solReserves.toString(),
        themeAccountInfo.buybackPool.toString(),
        votingMode,
        ThemeStatus.Active,
      ]
    );

    // Broadcast to WebSocket clients
    WebSocketService.getInstance().broadcast({
      type: 'theme:new',
      data: {
        id: event.theme.toString(),
        creator: event.creator.toString(),
        name: themeAccountInfo.name,
        tokenMint: event.tokenMint.toString(),
        votingMode,
      },
    });

    logger.info('ThemeCreated event handled successfully', {
      theme: event.theme.toString(),
    });
  } catch (error) {
    logger.error('Error handling ThemeCreated event', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      signature 
    });
    throw error;
  }
}

/**
 * Handle TokensSwapped event
 */
export async function handleTokensSwapped(
  event: TokensSwappedEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling TokensSwapped event', {
      theme: event.theme.toString(),
      user: event.user.toString(),
      isBuy: event.isBuy,
      signature,
    });

    // Calculate price after swap
    const solReserves = parseBigInt(event.newSolReserves);
    const tokenReserves = parseBigInt(event.newTokenReserves);
    const priceAfter = tokenReserves > 0 ? solReserves / tokenReserves / 1e9 : 0; // SOL per token

    // Insert swap record
    await db.query(
      `INSERT INTO token_swaps (
        signature, theme_pubkey, user_pubkey, is_buy, sol_amount, token_amount,
        sol_reserves_after, token_reserves_after, price_after, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        signature,
        event.theme.toString(),
        event.user.toString(),
        event.isBuy,
        event.solAmount.toString(),
        event.tokenAmount.toString(),
        event.newSolReserves.toString(),
        event.newTokenReserves.toString(),
        priceAfter,
      ]
    );

    // Update theme reserves
    await db.query(
      `UPDATE themes 
       SET sol_reserves = $1, token_reserves = $2, updated_at = NOW()
       WHERE pubkey = $3`,
      [
        event.newSolReserves.toString(),
        event.newTokenReserves.toString(),
        event.theme.toString(),
      ]
    );

    // Broadcast to WebSocket clients
    WebSocketService.getInstance().broadcast({
      type: 'token:swap',
      data: {
        theme: event.theme.toString(),
        user: event.user.toString(),
        isBuy: event.isBuy,
        solAmount: event.solAmount.toString(),
        tokenAmount: event.tokenAmount.toString(),
        priceAfter,
      },
    });

    logger.info('TokensSwapped event handled successfully', {
      theme: event.theme.toString(),
      signature,
    });
  } catch (error) {
    logger.error('Error handling TokensSwapped event', { error, signature });
    throw error;
  }
}

/**
 * Handle BuybackExecuted event
 */
export async function handleBuybackExecuted(
  event: BuybackExecutedEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling BuybackExecuted event', {
      theme: event.theme.toString(),
      tokensBurned: event.tokensBurned.toString(),
      signature,
    });

    // Update theme data
    await db.query(
      `UPDATE themes 
       SET token_reserves = $1, 
           circulating_supply = circulating_supply - $2,
           updated_at = NOW()
       WHERE pubkey = $3`,
      [
        event.newTokenReserves.toString(),
        event.tokensBurned.toString(),
        event.theme.toString(),
      ]
    );

    // Broadcast to WebSocket clients
    WebSocketService.getInstance().broadcast({
      type: 'token:buyback',
      data: {
        theme: event.theme.toString(),
        tokensBurned: event.tokensBurned.toString(),
        solSpent: event.solSpent.toString(),
      },
    });

    logger.info('BuybackExecuted event handled successfully', {
      theme: event.theme.toString(),
    });
  } catch (error) {
    logger.error('Error handling BuybackExecuted event', { error, signature });
    throw error;
  }
}

/**
 * Helper function to fetch theme account data
 */
async function fetchThemeAccountData(themePubkey: string): Promise<any> {
  try {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const { Program, AnchorProvider } = await import('@coral-xyz/anchor');
    const fs = await import('fs');
    const path = await import('path');

    logger.debug('Fetching theme account data', { 
      themePubkey,
      rpcUrl: config.solana.rpcUrl 
    });

    const connection = new Connection(config.solana.rpcUrl);
    const idlPath = path.join(__dirname, '../../idl/taste_fun_token.json');
    const idlContent = fs.readFileSync(idlPath, 'utf-8');
    const idl = JSON.parse(idlContent);

    logger.debug('IDL loaded', { 
      programId: idl.address || idl.metadata?.address,
      accountTypes: Object.keys(idl.accounts || {})
    });

    const provider = new AnchorProvider(connection, {} as any, {});
    const program = new Program(idl, provider);

    logger.debug('Attempting to fetch theme account', { themePubkey });

    const themeAccount: any = await (program.account as any).theme.fetch(
      new PublicKey(themePubkey)
    );

    logger.debug('Theme account fetched successfully', { 
      themePubkey,
      accountData: JSON.stringify(themeAccount, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    });

    // Anchor returns snake_case field names from IDL
    // IDL fields: theme_id, token_mint, total_supply, circulating_supply, creator_reserve,
    //             token_reserves, sol_reserves, buyback_pool
    
    // Convert name and description from byte arrays to strings
    const nameArray = themeAccount.name || themeAccount.name;
    const descArray = themeAccount.description || themeAccount.description;
    
    const name = Buffer.from(nameArray).toString('utf8').replace(/\0/g, '');
    const description = Buffer.from(descArray).toString('utf8').replace(/\0/g, '');

    return {
      themeId: (themeAccount.theme_id || themeAccount.themeId).toString(),
      name,
      description,
      circulatingSupply: (themeAccount.circulating_supply || themeAccount.circulatingSupply).toString(),
      creatorReserve: (themeAccount.creator_reserve || themeAccount.creatorReserve).toString(),
      tokenReserves: (themeAccount.token_reserves || themeAccount.tokenReserves).toString(),
      solReserves: (themeAccount.sol_reserves || themeAccount.solReserves).toString(),
      buybackPool: (themeAccount.buyback_pool || themeAccount.buybackPool).toString(),
    };
  } catch (error) {
    logger.error('Error fetching theme account data', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorDetails: JSON.stringify(error),
      themePubkey 
    });
    return null;
  }
}

/**
 * Handle IdeaCreated event
 */
export async function handleIdeaCreated(
  event: IdeaCreatedEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling IdeaCreated event', {
      idea: event.idea.toString(),
      initiator: event.initiator.toString(),
      signature,
    });

    // Fetch idea account data from chain to get full details
    const ideaAccountInfo = await fetchIdeaAccountData(event.idea.toString());

    if (!ideaAccountInfo) {
      throw new Error('Failed to fetch idea account data');
    }

    // Insert into database (theme_pubkey is NULL for standalone ideas)
    await db.query(
      `INSERT INTO ideas (
        pubkey, idea_id, theme_pubkey, initiator_pubkey, prompt, status,
        generation_status, generation_deadline, depin_provider,
        total_staked, min_stake, curator_fee_bps, votes,
        reject_all_weight, total_voters, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        event.idea.toString(),
        ideaAccountInfo.ideaId,
        null, // theme_pubkey - ideas are standalone
        event.initiator.toString(),
        event.prompt,
        IdeaStatus.GeneratingImages,
        GenerationStatus.Pending,
        new Date((Date.now() / 1000 + config.constants.IMAGE_GENERATION_TIMEOUT) * 1000),
        event.depinProvider.toString(),
        '0',
        config.constants.MIN_STAKE.toString(),
        config.constants.CURATOR_FEE_BPS,
        ['0', '0', '0', '0'],
        '0',
        0,
      ]
    );

    // Queue image generation task
    await QueueService.getInstance().addImageGenerationTask({
      ideaPubkey: event.idea.toString(),
      prompt: event.prompt,
      depinProvider: event.depinProvider.toString(),
      retryCount: 0,
    });

    // Broadcast to WebSocket clients
    WebSocketService.getInstance().broadcast({
      type: 'idea:new',
      data: {
        id: event.idea.toString(),
        initiator: event.initiator.toString(),
        prompt: event.prompt,
        status: IdeaStatus.GeneratingImages,
      },
    });

    logger.info('IdeaCreated event handled successfully', {
      idea: event.idea.toString(),
    });
  } catch (error) {
    logger.error('Error handling IdeaCreated event', { error, signature });
    throw error;
  }
}

/**
 * Handle SponsoredIdeaCreated event
 */
export async function handleSponsoredIdeaCreated(
  event: SponsoredIdeaCreatedEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling SponsoredIdeaCreated event', {
      idea: event.idea.toString(),
      sponsor: event.sponsor.toString(),
      prizePool: event.initialPrizePool.toString(),
      signature,
    });

    const ideaAccountInfo = await fetchIdeaAccountData(event.idea.toString());

    if (!ideaAccountInfo) {
      throw new Error('Failed to fetch idea account data');
    }

    await db.query(
      `INSERT INTO ideas (
        pubkey, idea_id, theme_pubkey, initiator_pubkey, sponsor_pubkey, prompt, status,
        generation_status, generation_deadline, depin_provider,
        total_staked, initial_prize_pool, min_stake, curator_fee_bps,
        votes, reject_all_weight, total_voters, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
      [
        event.idea.toString(),
        ideaAccountInfo.ideaId,
        null, // theme_pubkey - ideas are standalone
        event.initiator.toString(),
        event.sponsor.toString(),
        event.prompt,
        IdeaStatus.GeneratingImages,
        GenerationStatus.Pending,
        new Date((Date.now() / 1000 + config.constants.IMAGE_GENERATION_TIMEOUT) * 1000),
        event.depinProvider.toString(),
        '0',
        event.initialPrizePool.toString(),
        config.constants.MIN_STAKE.toString(),
        config.constants.CURATOR_FEE_BPS,
        ['0', '0', '0', '0'],
        '0',
        0,
      ]
    );

    await QueueService.getInstance().addImageGenerationTask({
      ideaPubkey: event.idea.toString(),
      prompt: event.prompt,
      depinProvider: event.depinProvider.toString(),
      retryCount: 0,
    });

    WebSocketService.getInstance().broadcast({
      type: 'idea:new',
      data: {
        id: event.idea.toString(),
        initiator: event.initiator.toString(),
        sponsor: event.sponsor.toString(),
        prompt: event.prompt,
        initialPrizePool: event.initialPrizePool.toString(),
        status: IdeaStatus.GeneratingImages,
      },
    });

    logger.info('SponsoredIdeaCreated event handled successfully');
  } catch (error) {
    logger.error('Error handling SponsoredIdeaCreated event', { error, signature });
    throw error;
  }
}

/**
 * Handle ImagesGenerated event
 */
export async function handleImagesGenerated(
  event: ImagesGeneratedEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling ImagesGenerated event', {
      idea: event.idea.toString(),
      imageCount: event.imageUris.length,
      signature,
    });

    // Update idea with image URIs and change status to Voting
    const votingDeadline = new Date(
      (Date.now() / 1000 + config.constants.DEFAULT_VOTING_DURATION) * 1000
    );

    await db.query(
      `UPDATE ideas 
       SET image_uris = $1,
           generation_status = $2,
           status = $3,
           voting_deadline = $4,
           updated_at = NOW()
       WHERE pubkey = $5`,
      [
        event.imageUris,
        GenerationStatus.Completed,
        IdeaStatus.Voting,
        votingDeadline,
        event.idea.toString(),
      ]
    );

    // Broadcast update
    WebSocketService.getInstance().broadcast({
      type: 'idea:update:status',
      data: {
        id: event.idea.toString(),
        status: IdeaStatus.Voting,
        imageUris: event.imageUris,
        votingDeadline: votingDeadline.getTime() / 1000,
      },
    });

    logger.info('ImagesGenerated event handled successfully');
  } catch (error) {
    logger.error('Error handling ImagesGenerated event', { error, signature });
    throw error;
  }
}

/**
 * Handle VoteCast event
 */
export async function handleVoteCast(
  event: VoteCastEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling VoteCast event', {
      idea: event.idea.toString(),
      voter: event.voter.toString(),
      imageChoice: event.imageChoice,
      stakeAmount: event.stakeAmount.toString(),
      signature,
    });

    // Calculate vote weight (square root for quadratic voting)
    const stakeAmount = parseBigInt(event.stakeAmount);
    const voteWeight = integerSqrt(stakeAmount);

    await db.transaction(async (client) => {
      // Insert vote record
      await client.query(
        `INSERT INTO votes (
          idea_pubkey, voter_pubkey, image_choice,
          stake_amount, vote_weight, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (idea_pubkey, voter_pubkey) 
        DO UPDATE SET 
          image_choice = EXCLUDED.image_choice,
          stake_amount = EXCLUDED.stake_amount,
          vote_weight = EXCLUDED.vote_weight`,
        [
          event.idea.toString(),
          event.voter.toString(),
          event.imageChoice,
          stakeAmount.toString(),
          voteWeight.toString(),
        ]
      );

      // Update idea statistics
      if (event.imageChoice === 255) {
        // RejectAll vote
        await client.query(
          `UPDATE ideas 
           SET reject_all_weight = reject_all_weight + $1,
               total_staked = total_staked + $2,
               total_voters = total_voters + 1,
               updated_at = NOW()
           WHERE pubkey = $3`,
          [voteWeight.toString(), stakeAmount.toString(), event.idea.toString()]
        );
      } else {
        // Regular image vote (0-3)
        await client.query(
          `UPDATE ideas 
           SET votes[$1] = votes[$1] + $2,
               total_staked = total_staked + $3,
               total_voters = total_voters + 1,
               updated_at = NOW()
           WHERE pubkey = $4`,
          [
            event.imageChoice + 1, // PostgreSQL arrays are 1-indexed
            voteWeight.toString(),
            stakeAmount.toString(),
            event.idea.toString(),
          ]
        );
      }

      // Upsert reviewer stake record
      await client.query(
        `INSERT INTO reviewer_stakes (
          idea_pubkey, reviewer_pubkey, total_staked
        ) VALUES ($1, $2, $3)
        ON CONFLICT (idea_pubkey, reviewer_pubkey)
        DO UPDATE SET total_staked = reviewer_stakes.total_staked + EXCLUDED.total_staked`,
        [event.idea.toString(), event.voter.toString(), stakeAmount.toString()]
      );
    });

    // Fetch updated idea stats
    const ideaResult = await db.query(
      'SELECT total_staked, total_voters FROM ideas WHERE pubkey = $1',
      [event.idea.toString()]
    );

    // Broadcast vote update
    WebSocketService.getInstance().broadcast({
      type: 'vote:new',
      data: {
        idea: event.idea.toString(),
        voter: event.voter.toString(),
        imageChoice: event.imageChoice,
        stakeAmount: stakeAmount.toString(),
      },
    });

    // Broadcast idea stats update
    WebSocketService.getInstance().broadcast({
      type: 'idea:update:stats',
      data: {
        id: event.idea.toString(),
        totalStaked: ideaResult.rows[0].total_staked,
        totalVoters: ideaResult.rows[0].total_voters,
      },
    });

    logger.info('VoteCast event handled successfully');
  } catch (error) {
    logger.error('Error handling VoteCast event', { error, signature });
    throw error;
  }
}

/**
 * Handle VotingSettled event
 */
export async function handleVotingSettled(
  event: VotingSettledEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling VotingSettled event', {
      idea: event.idea.toString(),
      winningImageIndex: event.winningImageIndex,
      totalStaked: event.totalStaked.toString(),
      signature,
    });

    await db.transaction(async (client) => {
      // Update idea with settlement data
      await client.query(
        `UPDATE ideas 
         SET status = $1,
             winning_image_index = $2,
             curator_fee_collected = $3,
             platform_fee_collected = $4,
             penalty_pool_amount = $5,
             winner_count = $6,
             updated_at = NOW()
         WHERE pubkey = $7`,
        [
          IdeaStatus.Completed,
          event.winningImageIndex,
          event.curatorFee.toString(),
          event.platformFee.toString(),
          event.penaltyPool.toString(),
          event.winnerCount.toString(),
          event.idea.toString(),
        ]
      );

      // Mark winning votes
      await client.query(
        `UPDATE votes 
         SET is_winner = TRUE
         WHERE idea_pubkey = $1 AND image_choice = $2`,
        [event.idea.toString(), event.winningImageIndex]
      );

      // Update reviewer stakes
      await client.query(
        `UPDATE reviewer_stakes rs
         SET is_winner = TRUE
         FROM votes v
         WHERE rs.idea_pubkey = v.idea_pubkey
           AND rs.reviewer_pubkey = v.voter_pubkey
           AND v.is_winner = TRUE
           AND rs.idea_pubkey = $1`,
        [event.idea.toString()]
      );
    });

    // Broadcast settlement
    WebSocketService.getInstance().broadcast({
      type: 'idea:update:status',
      data: {
        id: event.idea.toString(),
        status: IdeaStatus.Completed,
        winningImageIndex: event.winningImageIndex,
        totalStaked: event.totalStaked.toString(),
      },
    });

    logger.info('VotingSettled event handled successfully');
  } catch (error) {
    logger.error('Error handling VotingSettled event', { error, signature });
    throw error;
  }
}

/**
 * Handle WinningsWithdrawn event
 */
export async function handleWinningsWithdrawn(
  event: WinningsWithdrawnEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling WinningsWithdrawn event', {
      idea: event.idea.toString(),
      reviewer: event.reviewer.toString(),
      amount: event.amount.toString(),
      signature,
    });

    await db.query(
      `UPDATE votes 
       SET winnings_withdrawn = TRUE
       WHERE idea_pubkey = $1 AND voter_pubkey = $2`,
      [event.idea.toString(), event.reviewer.toString()]
    );

    logger.info('WinningsWithdrawn event handled successfully');
  } catch (error) {
    logger.error('Error handling WinningsWithdrawn event', { error, signature });
    throw error;
  }
}

/**
 * Handle IdeaCancelled event
 */
export async function handleIdeaCancelled(
  event: IdeaCancelledEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling IdeaCancelled event', {
      idea: event.idea.toString(),
      reason: event.reason,
      signature,
    });

    await db.query(
      `UPDATE ideas 
       SET status = $1, updated_at = NOW()
       WHERE pubkey = $2`,
      [IdeaStatus.Cancelled, event.idea.toString()]
    );

    WebSocketService.getInstance().broadcast({
      type: 'idea:update:status',
      data: {
        id: event.idea.toString(),
        status: IdeaStatus.Cancelled,
        reason: event.reason,
      },
    });

    logger.info('IdeaCancelled event handled successfully');
  } catch (error) {
    logger.error('Error handling IdeaCancelled event', { error, signature });
    throw error;
  }
}

/**
 * Handle VotingCancelled event
 */
export async function handleVotingCancelled(
  event: VotingCancelledEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling VotingCancelled event', {
      idea: event.idea.toString(),
      reason: event.reason,
      signature,
    });

    await db.query(
      `UPDATE ideas 
       SET status = $1, updated_at = NOW()
       WHERE pubkey = $2`,
      [IdeaStatus.Cancelled, event.idea.toString()]
    );

    WebSocketService.getInstance().broadcast({
      type: 'idea:update:status',
      data: {
        id: event.idea.toString(),
        status: IdeaStatus.Cancelled,
        reason: event.reason,
      },
    });

    logger.info('VotingCancelled event handled successfully');
  } catch (error) {
    logger.error('Error handling VotingCancelled event', { error, signature });
    throw error;
  }
}

/**
 * Handle RefundWithdrawn event
 */
export async function handleRefundWithdrawn(
  event: RefundWithdrawnEvent,
  signature: string
): Promise<void> {
  try {
    logger.info('Handling RefundWithdrawn event', {
      idea: event.idea.toString(),
      reviewer: event.reviewer.toString(),
      amount: event.amount.toString(),
      signature,
    });

    // Mark vote as refunded (reusing winnings_withdrawn flag)
    await db.query(
      `UPDATE votes 
       SET winnings_withdrawn = TRUE
       WHERE idea_pubkey = $1 AND voter_pubkey = $2`,
      [event.idea.toString(), event.reviewer.toString()]
    );

    logger.info('RefundWithdrawn event handled successfully');
  } catch (error) {
    logger.error('Error handling RefundWithdrawn event', { error, signature });
    throw error;
  }
}

/**
 * Helper: Fetch idea account data from Solana
 */
async function fetchIdeaAccountData(ideaPubkey: string): Promise<any> {
  // TODO: Implement using Anchor program.account.idea.fetch()
  // For now, return mock structure
  return {
    ideaId: Math.floor(Math.random() * 1000000),
  };
}

/**
 * Helper: Calculate integer square root for quadratic voting
 */
function integerSqrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// Export all handlers as a single object
export default {
  handleThemeCreated,
  handleTokensSwapped,
  handleBuybackExecuted,
  handleIdeaCreated,
  handleSponsoredIdeaCreated,
  handleImagesGenerated,
  handleVoteCast,
  handleVotingSettled,
  handleWinningsWithdrawn,
  handleIdeaCancelled,
  handleVotingCancelled,
  handleRefundWithdrawn,
};
