import { config } from './config';
import { logger } from './utils/logger';
import { db } from './database';
import BlockchainIndexer from './services/indexer';
import { APIServer } from './services/api';
import { WebSocketService } from './services/websocket';
import { QueueService } from './services/queue';

/**
 * Main application entry point
 */
class Application {
  private indexer: BlockchainIndexer;
  private apiServer: APIServer;
  private wsService: WebSocketService;
  private queueService: QueueService;

  constructor() {
    this.indexer = new BlockchainIndexer();
    this.apiServer = new APIServer();
    this.wsService = WebSocketService.getInstance();
    this.queueService = QueueService.getInstance();
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing taste.fun backend...', {
      env: config.server.env,
      version: '1.0.0',
    });

    try {
      // Test database connection
      logger.info('Testing database connection...');
      const dbConnected = await db.testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      // Initialize blockchain indexer
      logger.info('Initializing blockchain indexer...');
      await this.indexer.initialize();

      logger.info('Initialization completed successfully');
    } catch (error) {
      logger.error('Initialization failed', { error });
      throw error;
    }
  }

  /**
   * Start all services
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting services...');

      // Start WebSocket server
      this.wsService.start();

      // Start API server
      this.apiServer.start();

      // Start blockchain indexer
      await this.indexer.start();

      logger.info('All services started successfully', {
        apiPort: config.server.port,
        wsPort: config.websocket.port,
      });

      // Log startup summary
      this.logStartupSummary();
    } catch (error) {
      logger.error('Failed to start services', { error });
      throw error;
    }
  }

  /**
   * Stop all services gracefully
   */
  public async stop(): Promise<void> {
    logger.info('Stopping services...');

    try {
      await this.indexer.stop();
      await this.wsService.stop();
      await this.queueService.close();
      await db.end();

      logger.info('All services stopped successfully');
    } catch (error) {
      logger.error('Error stopping services', { error });
    }
  }

  /**
   * Log startup summary
   */
  private logStartupSummary(): void {
    logger.info('='.repeat(60));
    logger.info('taste.fun Backend Service - Running');
    logger.info('='.repeat(60));
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`API Server: http://localhost:${config.server.port}`);
    logger.info(`WebSocket: ws://localhost:${config.websocket.port}`);
    logger.info(`Solana Network: ${config.solana.network}`);
    logger.info(`Core Program ID: ${config.solana.coreProgramId}`);
    logger.info(`Settlement Program ID: ${config.solana.settlementProgramId}`);
    logger.info('='.repeat(60));
  }
}

/**
 * Main function
 */
async function main() {
  const app = new Application();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await app.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    process.exit(1);
  });

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main();
}

export default Application;
