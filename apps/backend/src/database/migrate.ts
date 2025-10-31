import * as fs from 'fs';
import * as path from 'path';
import { db } from './index';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    logger.info('Starting database migration...');

    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await db.query(schema);

    logger.info('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', { error });
    process.exit(1);
  }
}

runMigration();
