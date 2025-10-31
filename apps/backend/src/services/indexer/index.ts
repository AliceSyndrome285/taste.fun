import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { Program, BorshCoder, EventParser } from '@coral-xyz/anchor';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { db } from '../../database';
import { sleep, retryWithBackoff } from '../../utils/helpers';
import {
  IdeaCreatedEvent,
  SponsoredIdeaCreatedEvent,
  ImagesGeneratedEvent,
  VoteCastEvent,
  VotingSettledEvent,
  WinningsWithdrawnEvent,
  IdeaCancelledEvent,
  VotingCancelledEvent,
  RefundWithdrawnEvent,
} from '../../types';
import EventHandlers from '../../handlers';
import * as fs from 'fs';
import * as path from 'path';

export class BlockchainIndexer {
  private connection: Connection;
  private coreProgramId: PublicKey;
  private settlementProgramId: PublicKey;
  private tokenProgramId: PublicKey;
  private coreProgram: Program | null = null;
  private settlementProgram: Program | null = null;
  private tokenProgram: Program | null = null;
  private coreEventParser: EventParser | null = null;
  private settlementEventParser: EventParser | null = null;
  private tokenEventParser: EventParser | null = null;
  private wsConnection: WebSocket | null = null;
  private coreSubscriptionId: number | null = null;
  private settlementSubscriptionId: number | null = null;
  private tokenSubscriptionId: number | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private lastProcessedSlot: number = 0;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: config.solana.wssUrl,
    });
    this.coreProgramId = new PublicKey(config.solana.coreProgramId);
    this.settlementProgramId = new PublicKey(config.solana.settlementProgramId);
    this.tokenProgramId = new PublicKey(config.solana.tokenProgramId);
  }

  /**
   * Initialize the indexer with program IDLs
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing blockchain indexer...');

      // Load Core Program IDL
      const coreIdlPath = path.join(__dirname, '../../../idl/taste_fun_core.json');
      if (!fs.existsSync(coreIdlPath)) {
        throw new Error(`Core IDL file not found at ${coreIdlPath}`);
      }
      const coreIdlContent = fs.readFileSync(coreIdlPath, 'utf-8');
      const coreIdl = JSON.parse(coreIdlContent);

      // Create core program instance
      this.coreProgram = new Program(coreIdl, this.coreProgramId);
      const coreCoder = new BorshCoder(coreIdl);
      this.coreEventParser = new EventParser(this.coreProgramId, coreCoder);

      // Load Settlement Program IDL
      const settlementIdlPath = path.join(__dirname, '../../../idl/taste_fun_settlement.json');
      if (!fs.existsSync(settlementIdlPath)) {
        throw new Error(`Settlement IDL file not found at ${settlementIdlPath}`);
      }
      const settlementIdlContent = fs.readFileSync(settlementIdlPath, 'utf-8');
      const settlementIdl = JSON.parse(settlementIdlContent);

      // Create settlement program instance
      this.settlementProgram = new Program(settlementIdl, this.settlementProgramId);
      const settlementCoder = new BorshCoder(settlementIdl);
      this.settlementEventParser = new EventParser(this.settlementProgramId, settlementCoder);

      // Load Token Program IDL
      const tokenIdlPath = path.join(__dirname, '../../../idl/taste_fun_token.json');
      if (!fs.existsSync(tokenIdlPath)) {
        throw new Error(`Token IDL file not found at ${tokenIdlPath}`);
      }
      const tokenIdlContent = fs.readFileSync(tokenIdlPath, 'utf-8');
      const tokenIdl = JSON.parse(tokenIdlContent);

      // Create token program instance
      this.tokenProgram = new Program(tokenIdl, this.tokenProgramId);
      const tokenCoder = new BorshCoder(tokenIdl);
      this.tokenEventParser = new EventParser(this.tokenProgramId, tokenCoder);

      // Load last processed slot from database
      await this.loadLastProcessedSlot();

      logger.info('Blockchain indexer initialized successfully', {
        coreProgramId: this.coreProgramId.toString(),
        settlementProgramId: this.settlementProgramId.toString(),
        tokenProgramId: this.tokenProgramId.toString(),
        lastProcessedSlot: this.lastProcessedSlot,
      });
    } catch (error) {
      logger.error('Failed to initialize blockchain indexer', { error });
      throw error;
    }
  }

  /**
   * Load last processed slot from database
   */
  private async loadLastProcessedSlot(): Promise<void> {
    try {
      const result = await db.query(
        'SELECT last_processed_slot FROM sync_state WHERE id = 1'
      );
      
      if (result.rows.length > 0) {
        this.lastProcessedSlot = result.rows[0].last_processed_slot;
        logger.info('Loaded last processed slot', {
          slot: this.lastProcessedSlot,
        });
      }
    } catch (error) {
      logger.error('Failed to load last processed slot', { error });
    }
  }

  /**
   * Update last processed slot in database
   */
  private async updateLastProcessedSlot(
    slot: number,
    signature?: string
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE sync_state 
         SET last_processed_slot = $1, 
             last_processed_signature = $2, 
             updated_at = NOW() 
         WHERE id = 1`,
        [slot, signature || null]
      );
      this.lastProcessedSlot = slot;
    } catch (error) {
      logger.error('Failed to update last processed slot', { error });
    }
  }

  /**
   * Start the indexer
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Indexer is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting blockchain indexer...');

    // Start WebSocket subscription
    await this.subscribeToLogs();

    // Start historical sync if needed
    await this.syncHistoricalData();

    logger.info('Blockchain indexer started successfully');
  }

  /**
   * Stop the indexer
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('Stopping blockchain indexer...');

    if (this.coreSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.coreSubscriptionId);
        this.coreSubscriptionId = null;
      } catch (error) {
        logger.error('Error removing core logs listener', { error });
      }
    }

    if (this.settlementSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.settlementSubscriptionId);
        this.settlementSubscriptionId = null;
      } catch (error) {
        logger.error('Error removing settlement logs listener', { error });
      }
    }

    if (this.tokenSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.tokenSubscriptionId);
        this.tokenSubscriptionId = null;
      } catch (error) {
        logger.error('Error removing token logs listener', { error });
      }
    }

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    logger.info('Blockchain indexer stopped');
  }

  /**
   * Subscribe to both program logs via WebSocket
   */
  private async subscribeToLogs(): Promise<void> {
    try {
      logger.info('Subscribing to program logs...');

      // Subscribe to core program
      this.coreSubscriptionId = this.connection.onLogs(
        this.coreProgramId,
        async (logs: any, ctx: { slot: number }) => {
          await this.handleLog(logs, ctx, 'core');
        },
        'confirmed'
      );

      // Subscribe to settlement program
      this.settlementSubscriptionId = this.connection.onLogs(
        this.settlementProgramId,
        async (logs: any, ctx: { slot: number }) => {
          await this.handleLog(logs, ctx, 'settlement');
        },
        'confirmed'
      );

      // Subscribe to token program
      this.tokenSubscriptionId = this.connection.onLogs(
        this.tokenProgramId,
        async (logs: any, ctx: { slot: number }) => {
          await this.handleLog(logs, ctx, 'token');
        },
        'confirmed'
      );

      logger.info('Successfully subscribed to program logs', {
        coreSubscriptionId: this.coreSubscriptionId,
        settlementSubscriptionId: this.settlementSubscriptionId,
        tokenSubscriptionId: this.tokenSubscriptionId,
      });
    } catch (error) {
      logger.error('Failed to subscribe to logs', { error });
      
      // Attempt to reconnect
      if (this.isRunning && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        logger.info(`Attempting to reconnect in ${delay}ms...`, {
          attempt: this.reconnectAttempts,
        });
        await sleep(delay);
        await this.subscribeToLogs();
      } else {
        logger.error('Max reconnection attempts reached', {
          attempts: this.reconnectAttempts,
        });
        throw error;
      }
    }
  }

  /**
   * Handle incoming log
   */
  private async handleLog(
    logs: any,
    ctx: { slot: number },
    programType: 'core' | 'settlement' | 'token'
  ): Promise<void> {
    try {
      const signature = logs.signature;
      const slot = ctx.slot;

      // Check if already processed (idempotency)
      const existing = await db.query(
        'SELECT id FROM processed_signatures WHERE signature = $1',
        [signature]
      );

      if (existing.rows.length > 0) {
        logger.debug('Transaction already processed', { signature });
        return;
      }

      // Fetch full transaction details
      const tx = await retryWithBackoff(async () => {
        return await this.connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
      });

      if (!tx) {
        logger.warn('Transaction not found', { signature });
        return;
      }

      // Parse and handle events
      await this.parseAndHandleEvents(tx, signature, slot, programType);

      // Mark as processed
      await db.query(
        'INSERT INTO processed_signatures (signature, slot) VALUES ($1, $2)',
        [signature, slot]
      );

      // Update last processed slot
      await this.updateLastProcessedSlot(slot, signature);

      // Reset reconnection attempts on success
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error('Error handling log', { error, signature: logs.signature });
    }
  }

  /**
   * Parse events from transaction and dispatch to handlers
   */
  private async parseAndHandleEvents(
    tx: ParsedTransactionWithMeta,
    signature: string,
    slot: number,
    programType: 'core' | 'settlement' | 'token'
  ): Promise<void> {
    const eventParser = programType === 'core' 
      ? this.coreEventParser 
      : programType === 'settlement'
      ? this.settlementEventParser
      : this.tokenEventParser;
    
    if (!eventParser) {
      logger.error('Event parser not initialized', { programType });
      return;
    }

    try {
      // Parse events from transaction
      const events = eventParser.parseLogs(tx.meta?.logMessages || []);

      for (const event of events) {
        logger.info('Processing event', {
          name: event.name,
          programType,
          signature,
          slot,
        });

        // Dispatch to appropriate handler
        await this.dispatchEvent(event.name, event.data, signature);
      }
    } catch (error) {
      logger.error('Error parsing events', { error, signature, programType });
    }
  }

  /**
   * Dispatch event to appropriate handler
   */
  private async dispatchEvent(
    eventName: string,
    eventData: any,
    signature: string
  ): Promise<void> {
    try {
      switch (eventName) {
        case 'ThemeCreated':
          await EventHandlers.handleThemeCreated(
            eventData as any,
            signature
          );
          break;

        case 'TokensSwapped':
          await EventHandlers.handleTokensSwapped(
            eventData as any,
            signature
          );
          break;

        case 'BuybackExecuted':
          await EventHandlers.handleBuybackExecuted(
            eventData as any,
            signature
          );
          break;

        case 'IdeaCreated':
          await EventHandlers.handleIdeaCreated(
            eventData as IdeaCreatedEvent,
            signature
          );
          break;

        case 'SponsoredIdeaCreated':
          await EventHandlers.handleSponsoredIdeaCreated(
            eventData as SponsoredIdeaCreatedEvent,
            signature
          );
          break;

        case 'ImagesGenerated':
          await EventHandlers.handleImagesGenerated(
            eventData as ImagesGeneratedEvent,
            signature
          );
          break;

        case 'VoteCast':
          await EventHandlers.handleVoteCast(
            eventData as VoteCastEvent,
            signature
          );
          break;

        case 'VotingSettled':
          await EventHandlers.handleVotingSettled(
            eventData as VotingSettledEvent,
            signature
          );
          break;

        case 'WinningsWithdrawn':
          await EventHandlers.handleWinningsWithdrawn(
            eventData as WinningsWithdrawnEvent,
            signature
          );
          break;

        case 'IdeaCancelled':
          await EventHandlers.handleIdeaCancelled(
            eventData as IdeaCancelledEvent,
            signature
          );
          break;

        case 'VotingCancelled':
          await EventHandlers.handleVotingCancelled(
            eventData as VotingCancelledEvent,
            signature
          );
          break;

        case 'RefundWithdrawn':
          await EventHandlers.handleRefundWithdrawn(
            eventData as RefundWithdrawnEvent,
            signature
          );
          break;

        default:
          logger.warn('Unknown event type', { eventName });
      }
    } catch (error) {
      logger.error('Error dispatching event', {
        error,
        eventName,
        signature,
      });
      throw error;
    }
  }

  /**
   * Sync historical data (missed transactions during downtime)
   */
  private async syncHistoricalData(): Promise<void> {
    try {
      const currentSlot = await this.connection.getSlot('confirmed');
      
      if (this.lastProcessedSlot === 0 || currentSlot - this.lastProcessedSlot < 100) {
        logger.info('No historical sync needed');
        return;
      }

      logger.info('Starting historical data sync', {
        fromSlot: this.lastProcessedSlot,
        toSlot: currentSlot,
        gap: currentSlot - this.lastProcessedSlot,
      });

      // Sync both core and settlement programs
      const programsToSync = [
        { id: this.coreProgramId, type: 'core' as const },
        { id: this.settlementProgramId, type: 'settlement' as const },
        { id: this.tokenProgramId, type: 'token' as const },
      ];

      for (const program of programsToSync) {
        // Get signatures for program account transactions in the gap
        const signatures = await this.connection.getSignaturesForAddress(
          program.id,
          {
            limit: 1000,
            until: this.lastProcessedSlot.toString(),
          }
        );

        logger.info(`Found ${signatures.length} transactions to sync for ${program.type}`);

        // Process each signature
        for (const sigInfo of signatures) {
          try {
            // Check if already processed
            const existing = await db.query(
              'SELECT id FROM processed_signatures WHERE signature = $1',
              [sigInfo.signature]
            );

            if (existing.rows.length > 0) {
              continue;
            }

            const tx = await retryWithBackoff(async () => {
              return await this.connection.getParsedTransaction(
                sigInfo.signature,
                {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0,
                }
              );
            });

            if (tx) {
              await this.parseAndHandleEvents(
                tx,
                sigInfo.signature,
                sigInfo.slot,
                program.type
              );

              await db.query(
                'INSERT INTO processed_signatures (signature, slot) VALUES ($1, $2)',
                [sigInfo.signature, sigInfo.slot]
              );
            }

            // Small delay to avoid rate limiting
            await sleep(100);
          } catch (error) {
            logger.error('Error processing historical transaction', {
              error,
              signature: sigInfo.signature,
              programType: program.type,
            });
          }
        }
      }

      await this.updateLastProcessedSlot(currentSlot);
      logger.info('Historical data sync completed');
    } catch (error) {
      logger.error('Error syncing historical data', { error });
    }
  }
}

export default BlockchainIndexer;
