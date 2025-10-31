import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Enums
// ============================================================================

export enum VotingMode {
  Classic = 'Classic',
  Reverse = 'Reverse',
  MiddleWay = 'MiddleWay',
}

export enum ThemeStatus {
  Active = 'Active',
  Migrated = 'Migrated',
  Paused = 'Paused',
}

export enum IdeaStatus {
  GeneratingImages = 'GeneratingImages',
  Voting = 'Voting',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export enum GenerationStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

export enum ImageChoice {
  ImageA = 0,
  ImageB = 1,
  ImageC = 2,
  ImageD = 3,
  RejectAll = 255,
}

// ============================================================================
// Database Models
// ============================================================================

export interface ThemeRecord {
  id: number;
  pubkey: string; // Theme PDA
  theme_id: number;
  creator_pubkey: string;
  name: string;
  description: string;
  token_mint: string;
  total_supply: string; // bigint as string
  circulating_supply: string;
  creator_reserve: string;
  token_reserves: string;
  sol_reserves: string;
  buyback_pool: string;
  voting_mode: VotingMode;
  status: ThemeStatus;
  created_at: Date;
  updated_at: Date;
}

export interface TokenSwapRecord {
  id: number;
  signature: string;
  theme_pubkey: string;
  user_pubkey: string;
  is_buy: boolean;
  sol_amount: string;
  token_amount: string;
  sol_reserves_after: string;
  token_reserves_after: string;
  price_after: number;
  created_at: Date;
}

export interface IdeaRecord {
  id: number;
  pubkey: string; // Solana account public key
  idea_id: number;
  theme_pubkey: string;
  initiator_pubkey: string;
  sponsor_pubkey?: string;
  prompt: string;
  status: IdeaStatus;
  image_uris: string[];
  generation_status: GenerationStatus;
  generation_deadline: Date;
  depin_provider: string;
  total_staked: string; // bigint as string
  initial_prize_pool: string;
  min_stake: string;
  curator_fee_bps: number;
  votes: string[]; // array of 4 vote weights as strings
  reject_all_weight: string;
  total_voters: number;
  winning_image_index?: number;
  curator_fee_collected: string;
  platform_fee_collected: string;
  penalty_pool_amount: string;
  winner_count: number;
  voting_deadline?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface VoteRecord {
  id: number;
  idea_pubkey: string;
  voter_pubkey: string;
  image_choice: number; // 0-3 or 255 for RejectAll
  stake_amount: string; // bigint as string
  vote_weight: string; // bigint as string
  created_at: Date;
  is_winner?: boolean;
  winnings_withdrawn: boolean;
}

export interface ReviewerStakeRecord {
  id: number;
  idea_pubkey: string;
  reviewer_pubkey: string;
  total_staked: string;
  is_winner: boolean;
  winnings: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProcessedSignature {
  id: number;
  signature: string;
  slot: number;
  processed_at: Date;
}

// ============================================================================
// Event Types (matching contract events)
// ============================================================================

export interface ThemeCreatedEvent {
  theme: PublicKey;
  creator: PublicKey;
  tokenMint: PublicKey;
  votingMode: VotingMode;
  totalSupply: string; // u64 as string
}

export interface TokensSwappedEvent {
  theme: PublicKey;
  user: PublicKey;
  solAmount: string; // u64 as string
  tokenAmount: string; // u64 as string
  isBuy: boolean;
  newSolReserves: string;
  newTokenReserves: string;
}

export interface BuybackExecutedEvent {
  theme: PublicKey;
  solSpent: string;
  tokensBurned: string;
  newTokenReserves: string;
}

export interface IdeaCreatedEvent {
  idea: PublicKey;
  initiator: PublicKey;
  prompt: string;
  depinProvider: PublicKey;
}

export interface SponsoredIdeaCreatedEvent {
  idea: PublicKey;
  initiator: PublicKey;
  sponsor: PublicKey;
  prompt: string;
  initialPrizePool: string; // u64 as string
  depinProvider: PublicKey;
}

export interface ImagesGeneratedEvent {
  idea: PublicKey;
  imageUris: string[];
}

export interface VoteCastEvent {
  idea: PublicKey;
  voter: PublicKey;
  imageChoice: number;
  stakeAmount: string; // u64 as string
}

export interface VotingSettledEvent {
  idea: PublicKey;
  winningImageIndex: number;
  totalStaked: string;
  curatorFee: string;
  platformFee: string;
  penaltyPool: string;
  winnerCount: string;
}

export interface WinningsWithdrawnEvent {
  idea: PublicKey;
  reviewer: PublicKey;
  amount: string;
}

export interface IdeaCancelledEvent {
  idea: PublicKey;
  reason: string;
}

export interface VotingCancelledEvent {
  idea: PublicKey;
  reason: string;
}

export interface RefundWithdrawnEvent {
  idea: PublicKey;
  reviewer: PublicKey;
  amount: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ThemeListQuery {
  creator?: string;
  status?: ThemeStatus;
  sortBy?: 'created_at' | 'sol_reserves' | 'token_reserves';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ThemeResponse {
  id: string; // pubkey
  themeId: number;
  creator: string;
  name: string;
  description: string;
  tokenMint: string;
  totalSupply: number; // in tokens with decimals
  circulatingSupply: number;
  creatorReserve: number;
  tokenReserves: number;
  solReserves: number; // in SOL
  buybackPool: number; // in SOL
  currentPrice: number; // SOL per token
  votingMode: VotingMode;
  status: ThemeStatus;
  createdAt: number; // unix timestamp
  // Stats
  totalIdeas?: number;
  totalVolume?: number; // in SOL
  priceChange24h?: number; // percentage
}

export interface TokenSwapResponse {
  signature: string;
  theme: string;
  user: string;
  isBuy: boolean;
  solAmount: number; // in SOL
  tokenAmount: number; // in tokens
  priceAfter: number; // SOL per token
  timestamp: number;
}

export interface IdeaListQuery {
  theme?: string;
  status?: IdeaStatus;
  sortBy?: 'total_staked' | 'created_at' | 'total_voters' | 'voting_deadline';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface IdeaResponse {
  id: string; // pubkey
  ideaId: number;
  theme: string; // theme pubkey
  initiator: string;
  sponsor?: string;
  prompt: string;
  status: IdeaStatus;
  imageUris: string[];
  totalStaked: number; // in SOL
  totalVoters: number;
  votingDeadline?: number; // unix timestamp
  winningImageIndex?: number;
  createdAt: number; // unix timestamp
  votes?: {
    imageIndex: number;
    weight: number;
  }[];
  rejectAllWeight?: number;
}

export interface VoteResponse {
  idea: string;
  voter: string;
  imageChoice: number;
  stakeAmount: number; // in SOL
  voteWeight: number;
  createdAt: number;
  isWinner?: boolean;
  winningsWithdrawn: boolean;
}

export interface UserActivityResponse {
  ideas: IdeaResponse[];
  votes: VoteResponse[];
  totalCreated: number;
  totalVoted: number;
  totalEarned: number; // in SOL
}

export interface StatsResponse {
  totalIdeas: number;
  activeIdeas: number;
  completedIdeas: number;
  totalStaked: number; // in SOL
  totalVotes: number;
  totalUsers: number;
}

export interface UploadResponse {
  imageUris: string[];
  cids: string[];
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export enum WSMessageType {
  IdeaNew = 'idea:new',
  IdeaUpdateStatus = 'idea:update:status',
  IdeaUpdateStats = 'idea:update:stats',
  VoteNew = 'vote:new',
  StatsGlobal = 'stats:global',
}

export interface WSMessage {
  type: WSMessageType;
  data: any;
}

// ============================================================================
// Task Queue Types
// ============================================================================

export interface ImageGenerationTask {
  ideaPubkey: string;
  prompt: string;
  depinProvider: string;
  retryCount: number;
}

export interface HistoricalSyncTask {
  fromSlot: number;
  toSlot: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
