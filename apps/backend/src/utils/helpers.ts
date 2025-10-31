import { LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: bigint | number | string): number {
  const value = typeof lamports === 'string' ? BigInt(lamports) : BigInt(lamports);
  return Number(value) / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Parse BigInt from various input types
 */
export function parseBigInt(value: any): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  if (value?.toString) return BigInt(value.toString());
  return BigInt(0);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Truncate public key for display
 */
export function truncatePubkey(pubkey: string, chars: number = 4): string {
  if (pubkey.length <= chars * 2) return pubkey;
  return `${pubkey.slice(0, chars)}...${pubkey.slice(-chars)}`;
}

/**
 * Validate Solana public key format
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pubkey);
}

/**
 * Calculate integer square root (for quadratic voting)
 */
export function integerSqrt(n: bigint): bigint {
  if (n === 0n) return 0n;
  
  let x = n;
  let y = (x + 1n) / 2n;
  
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  
  return x;
}

/**
 * Safe division to avoid division by zero
 */
export function safeDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  return numerator / denominator;
}

/**
 * Calculate percentage with basis points
 */
export function calculateBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / 10000n;
}
