import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;
  private static instance: Database;

  private constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: config.database.max,
      idleTimeoutMillis: config.database.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.connectionTimeoutMillis,
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected database pool error', { error: err });
    });

    this.pool.on('connect', () => {
      logger.debug('New database client connected');
    });

    this.pool.on('remove', () => {
      logger.debug('Database client removed from pool');
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', {
        text: text.substring(0, 100),
        duration,
        rows: result.rowCount,
      });
      return result;
    } catch (error) {
      logger.error('Database query error', {
        error,
        query: text.substring(0, 100),
        params,
      });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      logger.info('Database connection successful', {
        time: result.rows[0].now,
      });
      return true;
    } catch (error) {
      logger.error('Database connection failed', { error });
      return false;
    }
  }

  public async end(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool ended');
  }
}

export const db = Database.getInstance();
export default db;
