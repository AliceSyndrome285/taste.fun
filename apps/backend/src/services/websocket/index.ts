import WebSocket, { WebSocketServer } from 'ws';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { WSMessage } from '../../types';

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Start WebSocket server
   */
  public start(): void {
    this.wss = new WebSocketServer({
      port: config.websocket.port,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error });
    });

    logger.info('WebSocket server started', {
      port: config.websocket.port,
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    logger.info('New WebSocket client connected', {
      totalClients: this.clients.size,
    });

    // Send welcome message
    this.send(ws, {
      type: 'stats:global',
      data: { message: 'Connected to taste.fun backend' },
    });

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Error parsing WebSocket message', { error });
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info('WebSocket client disconnected', {
        totalClients: this.clients.size,
      });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error', { error });
      this.clients.delete(ws);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, message: any): void {
    // Handle client subscriptions, ping/pong, etc.
    logger.debug('Received WebSocket message', { message });
  }

  /**
   * Send message to a specific client
   */
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WSMessage): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
        sentCount++;
      }
    });

    logger.debug('Broadcast message', {
      type: message.type,
      sentTo: sentCount,
      totalClients: this.clients.size,
    });
  }

  /**
   * Stop WebSocket server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.clients.forEach((client) => {
          client.close();
        });
        this.clients.clear();

        this.wss.close(() => {
          logger.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get connection statistics
   */
  public getStats(): { totalClients: number } {
    return {
      totalClients: this.clients.size,
    };
  }
}

export default WebSocketService;
