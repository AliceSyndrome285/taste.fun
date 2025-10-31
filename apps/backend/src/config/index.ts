import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    env: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },

  // Solana Configuration
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL!,
    wssUrl: process.env.SOLANA_WSS_URL!,
    // Core program (idea creation, voting)
    coreProgramId: process.env.CORE_PROGRAM_ID || 'D5Cb9JvycX4Sgyu4iYxBSsnDpWEtZRg7fDZTUVMN9avU',
    // Settlement program (voting settlement, withdrawals)
    settlementProgramId: process.env.SETTLEMENT_PROGRAM_ID || 'Ep2FC52vgZd4VVGwKH4YLyxQtorNMbz2N33VaL2pidYK',
    // Token program (theme tokens, bonding curve)
    tokenProgramId: process.env.TOKEN_PROGRAM_ID || '3vRrmiTYYqrhdFUPf2ioBnmZQQB66yfKwKCBKFSVvdkg',
    // Legacy program ID for backward compatibility
    programId: process.env.PROGRAM_ID || process.env.CORE_PROGRAM_ID || 'D5Cb9JvycX4Sgyu4iYxBSsnDpWEtZRg7fDZTUVMN9avU',
    network: process.env.NETWORK || 'devnet',
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'taste_fun',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20, // connection pool max
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // IPFS Configuration
  ipfs: {
    // Pinata SDK configuration
    pinataJwt: process.env.PINATA_JWT || process.env.IPFS_API_KEY,
    gateway: process.env.PINATA_GATEWAY || process.env.IPFS_GATEWAY || 'gateway.pinata.cloud',
    // Legacy fields for backward compatibility
    apiKey: process.env.IPFS_API_KEY,
    secretKey: process.env.IPFS_SECRET_KEY,
    projectId: process.env.IPFS_PROJECT_ID,
    projectSecret: process.env.IPFS_PROJECT_SECRET,
  },

  // DePIN Configuration
  depin: {
    apiUrl: process.env.DEPIN_API_URL || 'https://cf-ai-image.943113638.workers.dev',
    apiKey: process.env.DEPIN_API_KEY || '', // Used as password for Cloudflare Worker (default: admin123)
    servicePubkey: process.env.DEPIN_SERVICE_PUBKEY!,
    servicePrivateKey: process.env.DEPIN_SERVICE_PRIVATE_KEY!,
  },

  // Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.MAX_FILES || '4', 10),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  },

  // WebSocket Configuration
  websocket: {
    port: parseInt(process.env.WS_PORT || '3002', 10),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // Monitoring
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
  },

  // Contract Constants (from lib.rs)
  constants: {
    BPS_DENOMINATOR: 10_000,
    MIN_REVIEWERS: 10,
    CURATOR_FEE_BPS: 100, // 1%
    PLATFORM_FEE_BPS: 200, // 2%
    PENALTY_BPS: 5_000, // 50%
    MAX_PROMPT_LEN: 512,
    MAX_IMAGE_URI_LEN: 200,
    MIN_STAKE: 10_000_000, // 0.01 SOL in lamports
    CREATION_FEE: 5_000_000, // 0.005 SOL in lamports
    IMAGE_GENERATION_TIMEOUT: 24 * 3600, // 24 hours
    DEFAULT_VOTING_DURATION: 72 * 3600, // 72 hours
    EARLY_BIRD_BONUS_BPS: 2_000, // 20%
    EARLY_BIRD_THRESHOLD: 24 * 3600, // 24 hours
    REJECT_ALL_THRESHOLD_BPS: 6_667, // 66.67%
  },
};

// Validation
const requiredEnvVars = [
  'SOLANA_RPC_URL',
  'SOLANA_WSS_URL',
  'PROGRAM_ID',
  'DB_PASSWORD',
  'DEPIN_API_URL',
  // DEPIN_API_KEY is optional - Cloudflare Worker doesn't need API Key
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export default config;
