/**
 * Taste & Earn Model - TypeScript Types
 * 对应 lib-v3.rs 的类型定义
 */

import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Enums
// ============================================================================

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
// Account Types
// ============================================================================

export interface Idea {
  // 核心字段
  initiator: PublicKey;
  ideaId: number;
  prompt: string;
  createdAt: number;

  // DePIN 相关
  imageUris: string[];
  generationStatus: GenerationStatus;
  generationDeadline: number;
  depinProvider: PublicKey;

  // 赞助竞赛相关
  sponsor?: PublicKey;
  initialPrizePool: number;

  // 质押池参数
  totalStaked: number;
  minStake: number;
  curatorFeeBps: number;

  // 投票统计 (存储投票权重，非票数)
  votes: [number, number, number, number]; // 4张图片的投票权重
  rejectAllWeight: number; // RejectAll 投票权重
  totalVoters: number;
  winningImageIndex: number | null;

  // 结算数据
  curatorFeeCollected: number;
  platformFeeCollected: number;
  penaltyPoolAmount: number;
  winnerCount: number;

  // 时间控制
  votingDeadline: number;

  // 状态与 bumps
  status: IdeaStatus;
  vaultBump: number;
  ideaBump: number;
}

export interface Vote {
  idea: PublicKey;
  voter: PublicKey;
  imageChoice: number; // 0-3 对应图 A-D, 255 = RejectAll
  stakeAmount: number;
  voteWeight: number; // 二次方投票权重
  ts: number;
}

export interface ReviewerStake {
  idea: PublicKey;
  reviewer: PublicKey;
  totalStaked: number;
  isWinner: boolean;
  winnings: number;
  bump: number;
}

export interface Vault {
  idea: PublicKey;
  bump: number;
}

// ============================================================================
// Constants (from lib-v3.rs)
// ============================================================================

export const CONSTANTS = {
  BPS_DENOMINATOR: 10_000,
  MIN_REVIEWERS: 10,
  CURATOR_FEE_BPS: 100, // 1%
  PLATFORM_FEE_BPS: 200, // 2%
  PENALTY_BPS: 5_000, // 50%

  MAX_PROMPT_LEN: 512,
  MAX_IMAGE_URI_LEN: 200,

  MIN_STAKE: 10_000_000, // 0.01 SOL
  CREATION_FEE: 5_000_000, // 0.005 SOL

  IMAGE_GENERATION_TIMEOUT: 24 * 3600, // 24 hours
  DEFAULT_VOTING_DURATION: 72 * 3600, // 72 hours

  // 时间加权参数
  EARLY_BIRD_BONUS_BPS: 2_000, // 早期投票20%奖励
  EARLY_BIRD_THRESHOLD: 24 * 3600, // 第一天算早期

  // RejectAll 阈值
  REJECT_ALL_THRESHOLD_BPS: 6_667, // 2/3 = 66.67%
} as const;

// ============================================================================
// UI Helper Types
// ============================================================================

export interface IdeaCardData {
  id: string;
  publicKey?: PublicKey;
  title: string;
  prompt?: string;
  coverImage?: string;
  imageUris?: string[];
  status: IdeaStatus;
  initiator: string;
  totalStaked: number;
  totalVoters: number;
  votingDeadline?: number;
  winningImageIndex?: number | null;
  createdAt: number;
}

export interface VoteData {
  ideaId: string;
  imageChoice: ImageChoice;
  stakeAmount: number; // in lamports
  voter: PublicKey;
}

export interface VoteResultData {
  idea: PublicKey;
  voter: PublicKey;
  isWinner: boolean;
  totalStaked: number;
  winnings: number;
  canWithdraw: boolean;
}

// ============================================================================
// Instruction Input Types
// ============================================================================

export interface CreateIdeaParams {
  prompt: string;
  depinProvider: PublicKey;
  votingDurationHours?: number; // 默认 72
}

export interface VoteForImageParams {
  ideaPublicKey: PublicKey;
  imageIndex: ImageChoice;
  stakeAmountSol: number; // 前端用 SOL，转换为 lamports
}

export interface WithdrawWinningsParams {
  ideaPublicKey: PublicKey;
}

export interface CancelIdeaParams {
  ideaPublicKey: PublicKey;
}

export interface WithdrawRefundParams {
  ideaPublicKey: PublicKey;
}

// ============================================================================
// Event Types (对应合约 Events)
// ============================================================================

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
  initialPrizePool: number;
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
  stakeAmount: number;
}

export interface VotingSettledEvent {
  idea: PublicKey;
  winningImageIndex: number;
  totalStaked: number;
  curatorFee: number;
  platformFee: number;
  penaltyPool: number;
  winnerCount: number;
}

export interface WinningsWithdrawnEvent {
  idea: PublicKey;
  reviewer: PublicKey;
  amount: number;
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
  amount: number;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ConsensusError {
  InvalidPrompt = 'InvalidPrompt',
  InvalidVotingDuration = 'InvalidVotingDuration',
  InvalidState = 'InvalidState',
  InvalidImageCount = 'InvalidImageCount',
  UnauthorizedDePIN = 'UnauthorizedDePIN',
  InvalidImageUri = 'InvalidImageUri',
  InvalidImageIndex = 'InvalidImageIndex',
  StakeTooLow = 'StakeTooLow',
  VotingEnded = 'VotingEnded',
  VotingNotEnded = 'VotingNotEnded',
  AlreadyWithdrawn = 'AlreadyWithdrawn',
  NotWinner = 'NotWinner',
  NoWinner = 'NoWinner',
  DivisionByZero = 'DivisionByZero',
  Overflow = 'Overflow',
  Unauthorized = 'Unauthorized',
  AlreadyVoted = 'AlreadyVoted',
  GenerationTimeout = 'GenerationTimeout',
  NoRefundAvailable = 'NoRefundAvailable',
}

// ============================================================================
// Helper Functions
// ============================================================================

export const lamportsToSol = (lamports: number): number => {
  return lamports / 1_000_000_000;
};

export const solToLamports = (sol: number): number => {
  return Math.floor(sol * 1_000_000_000);
};

export const formatTimeRemaining = (deadline: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = deadline - now;

  if (remaining <= 0) return 'Ended';

  const days = Math.floor(remaining / (24 * 3600));
  const hours = Math.floor((remaining % (24 * 3600)) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const getStatusBadge = (status: IdeaStatus): { text: string; color: string } => {
  switch (status) {
    case IdeaStatus.GeneratingImages:
      return { text: '🎨 Generating Images', color: 'bg-blue-500/20 text-blue-300' };
    case IdeaStatus.Voting:
      return { text: '⚖️ Voting Open', color: 'bg-green-500/20 text-green-300' };
    case IdeaStatus.Completed:
      return { text: '✅ Completed', color: 'bg-purple-500/20 text-purple-300' };
    case IdeaStatus.Cancelled:
      return { text: '❌ Cancelled', color: 'bg-red-500/20 text-red-300' };
    default:
      return { text: 'Unknown', color: 'bg-zinc-500/20 text-zinc-300' };
  }
};

export const getImageChoiceLabel = (choice: ImageChoice): string => {
  switch (choice) {
    case ImageChoice.ImageA:
      return 'Image A';
    case ImageChoice.ImageB:
      return 'Image B';
    case ImageChoice.ImageC:
      return 'Image C';
    case ImageChoice.ImageD:
      return 'Image D';
    case ImageChoice.RejectAll:
      return 'Reject All';
    default:
      return 'Unknown';
  }
};
