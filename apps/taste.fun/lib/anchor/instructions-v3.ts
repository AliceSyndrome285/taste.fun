/**
 * Taste & Earn Model - Anchor Integration
 * 与 lib-v3.rs 智能合约交互的前端函数
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  CreateIdeaParams,
  VoteForImageParams,
  WithdrawWinningsParams,
  CancelIdeaParams,
  WithdrawRefundParams,
  CONSTANTS,
  solToLamports,
} from '@/lib/types/consensus-v3';

// 临时 Program ID (替换为实际部署的地址)
export const CONSENSUS_V3_PROGRAM_ID = new PublicKey(
  'ConsenSu5Progr4m1111111111111111111111111111'
);

// 协议国库地址 (替换为实际地址)
export const PROTOCOL_TREASURY = new PublicKey(
  'Treasury11111111111111111111111111111111111'
);

// DePIN 提供商地址 (默认 Render Network)
export const DEFAULT_DEPIN_PROVIDER = new PublicKey(
  'RenderDePIN111111111111111111111111111111111'
);

/**
 * 生成 PDA (Program Derived Address)
 */
export function getIdeaPda(initiator: PublicKey, ideaId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('idea'),
      initiator.toBuffer(),
      new BN(ideaId).toArrayLike(Buffer, 'le', 8),
    ],
    CONSENSUS_V3_PROGRAM_ID
  );
}

export function getVaultPda(ideaPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), ideaPda.toBuffer()],
    CONSENSUS_V3_PROGRAM_ID
  );
}

export function getVotePda(ideaPda: PublicKey, voter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vote'), ideaPda.toBuffer(), voter.toBuffer()],
    CONSENSUS_V3_PROGRAM_ID
  );
}

export function getReviewerStakePda(
  ideaPda: PublicKey,
  reviewer: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reviewer_stake'), ideaPda.toBuffer(), reviewer.toBuffer()],
    CONSENSUS_V3_PROGRAM_ID
  );
}

/**
 * 创建新创意 (提交 AI 生图 Prompt)
 */
export async function createIdea(
  program: Program,
  params: CreateIdeaParams
): Promise<{ ideaPda: PublicKey; signature: string }> {
  const provider = program.provider as AnchorProvider;
  const initiator = provider.wallet.publicKey;

  // 生成唯一 ideaId (使用时间戳)
  const ideaId = Date.now();

  const [ideaPda] = getIdeaPda(initiator, ideaId);
  const [vaultPda] = getVaultPda(ideaPda);

  const votingDurationHours = params.votingDurationHours || 72;

  const signature = await program.methods
    .createIdea(
      new BN(ideaId),
      params.prompt,
      params.depinProvider || DEFAULT_DEPIN_PROVIDER,
      votingDurationHours
    )
    .accounts({
      idea: ideaPda,
      vault: vaultPda,
      initiator: initiator,
      protocolTreasury: PROTOCOL_TREASURY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { ideaPda, signature };
}

/**
 * 创建赞助竞赛 (赞助商注入初始奖池)
 */
export async function createSponsoredIdea(
  program: Program,
  params: CreateIdeaParams & { initialPrizePoolSol: number; sponsor?: PublicKey }
): Promise<{ ideaPda: PublicKey; signature: string }> {
  const provider = program.provider as AnchorProvider;
  const initiator = provider.wallet.publicKey;
  const sponsor = params.sponsor || initiator; // 默认发起者即赞助商

  // 生成唯一 ideaId (使用时间戳)
  const ideaId = Date.now();

  const [ideaPda] = getIdeaPda(initiator, ideaId);
  const [vaultPda] = getVaultPda(ideaPda);

  const votingDurationHours = params.votingDurationHours || 72;
  const initialPrizePool = solToLamports(params.initialPrizePoolSol);

  const signature = await program.methods
    .createSponsoredIdea(
      new BN(ideaId),
      params.prompt,
      params.depinProvider || DEFAULT_DEPIN_PROVIDER,
      votingDurationHours,
      new BN(initialPrizePool)
    )
    .accounts({
      idea: ideaPda,
      vault: vaultPda,
      initiator: initiator,
      sponsor: sponsor,
      protocolTreasury: PROTOCOL_TREASURY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { ideaPda, signature };
}

/**
 * 质押并投票选择图片
 */
export async function voteForImage(
  program: Program,
  params: VoteForImageParams
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const voter = provider.wallet.publicKey;

  const ideaPda = params.ideaPublicKey;
  const [vaultPda] = getVaultPda(ideaPda);
  const [votePda] = getVotePda(ideaPda, voter);
  const [reviewerStakePda] = getReviewerStakePda(ideaPda, voter);

  const stakeAmountLamports = solToLamports(params.stakeAmountSol);

  const signature = await program.methods
    .voteForImage(params.imageIndex, new BN(stakeAmountLamports))
    .accounts({
      idea: ideaPda,
      vote: votePda,
      reviewerStake: reviewerStakePda,
      vault: vaultPda,
      voter: voter,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * 结算投票 (任何人都可以调用)
 */
export async function settleVoting(
  program: Program,
  ideaPda: PublicKey
): Promise<string> {
  const provider = program.provider as AnchorProvider;

  // 获取 idea 账户以获取 initiator
  const ideaAccount = await program.account.idea.fetch(ideaPda);
  const initiator = ideaAccount.initiator as PublicKey;

  const [vaultPda] = getVaultPda(ideaPda);

  const signature = await program.methods
    .settleVoting()
    .accounts({
      idea: ideaPda,
      vault: vaultPda,
      initiator: initiator,
      protocolTreasury: PROTOCOL_TREASURY,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * 提取奖金 (仅赢家可调用)
 */
export async function withdrawWinnings(
  program: Program,
  params: WithdrawWinningsParams
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const reviewer = provider.wallet.publicKey;

  const ideaPda = params.ideaPublicKey;
  const [vaultPda] = getVaultPda(ideaPda);
  const [votePda] = getVotePda(ideaPda, reviewer);
  const [reviewerStakePda] = getReviewerStakePda(ideaPda, reviewer);

  const signature = await program.methods
    .withdrawWinnings()
    .accounts({
      idea: ideaPda,
      vote: votePda,
      reviewerStake: reviewerStakePda,
      vault: vaultPda,
      reviewer: reviewer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * 取消创意 (发起者或超时后任何人)
 */
export async function cancelIdea(
  program: Program,
  params: CancelIdeaParams
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const authority = provider.wallet.publicKey;

  const signature = await program.methods
    .cancelIdea()
    .accounts({
      idea: params.ideaPublicKey,
      authority: authority,
    })
    .rpc();

  return signature;
}

/**
 * 提取退款 (仅在取消时可用)
 */
export async function withdrawRefund(
  program: Program,
  params: WithdrawRefundParams
): Promise<string> {
  const provider = program.provider as AnchorProvider;
  const reviewer = provider.wallet.publicKey;

  const ideaPda = params.ideaPublicKey;
  const [vaultPda] = getVaultPda(ideaPda);
  const [votePda] = getVotePda(ideaPda, reviewer);
  const [reviewerStakePda] = getReviewerStakePda(ideaPda, reviewer);

  const signature = await program.methods
    .withdrawRefund()
    .accounts({
      idea: ideaPda,
      vote: votePda,
      reviewerStake: reviewerStakePda,
      vault: vaultPda,
      reviewer: reviewer,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return signature;
}

/**
 * 获取 Idea 账户数据
 */
export async function fetchIdea(program: Program, ideaPda: PublicKey): Promise<any> {
  return await program.account.idea.fetch(ideaPda);
}

/**
 * 获取 Vote 账户数据
 */
export async function fetchVote(
  program: Program,
  ideaPda: PublicKey,
  voter: PublicKey
): Promise<any> {
  const [votePda] = getVotePda(ideaPda, voter);
  try {
    return await program.account.vote.fetch(votePda);
  } catch {
    return null; // 用户未投票
  }
}

/**
 * 获取 ReviewerStake 账户数据
 */
export async function fetchReviewerStake(
  program: Program,
  ideaPda: PublicKey,
  reviewer: PublicKey
): Promise<any> {
  const [reviewerStakePda] = getReviewerStakePda(ideaPda, reviewer);
  try {
    return await program.account.reviewerStake.fetch(reviewerStakePda);
  } catch {
    return null; // 用户未质押
  }
}

/**
 * 获取所有活跃的 Ideas
 */
export async function fetchAllIdeas(program: Program): Promise<any[]> {
  return await program.account.idea.all();
}

/**
 * 获取用户创建的所有 Ideas
 */
export async function fetchIdeasByInitiator(
  program: Program,
  initiator: PublicKey
): Promise<any[]> {
  return await program.account.idea.all([
    {
      memcmp: {
        offset: 8, // discriminator
        bytes: initiator.toBase58(),
      },
    },
  ]);
}

/**
 * 监听 Idea 账户变化
 */
export function subscribeToIdea(
  program: Program,
  ideaPda: PublicKey,
  callback: (idea: any) => void
): number {
  return program.account.idea.subscribe(ideaPda, 'confirmed').on('change', callback);
}

/**
 * 取消订阅
 */
export async function unsubscribeFromIdea(
  program: Program,
  subscriptionId: number
): Promise<void> {
  await program.account.idea.unsubscribe(subscriptionId);
}
