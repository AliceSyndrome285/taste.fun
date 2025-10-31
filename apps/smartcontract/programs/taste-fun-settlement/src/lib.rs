use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use taste_fun_shared::*;

declare_id!("EeHN1oagPFzfyaye9FPyUjNx4nbnsFy2z3xhWPetVRxH");

#[program]
pub mod taste_fun_settlement {
    use super::*;

    /// 结算投票，分配奖金 (含时间加权、平台费用、RejectAll逻辑)
    pub fn settle_voting(ctx: Context<SettleVoting>, voting_mode: VotingMode) -> Result<()> {
        let idea = &mut ctx.accounts.idea;
        require!(idea.status == IdeaStatus::Voting, ConsensusError::InvalidState);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= idea.voting_deadline,
            ConsensusError::VotingNotEnded
        );

        // 检查最小参与者数量
        if idea.total_voters < MIN_REVIEWERS {
            idea.status = IdeaStatus::Cancelled;
            emit!(VotingCancelled {
                idea: idea.key(),
                reason: "Insufficient participation".to_string(),
            });
            return Ok(());
        }

        // 计算总投票权重 (包括 RejectAll)
        let total_weight = idea.votes.iter().sum::<u64>() + idea.reject_all_weight;

        // 检查 RejectAll 是否达到 2/3 阈值
        if total_weight > 0 {
            let reject_ratio_bps = (idea.reject_all_weight as u128)
                .checked_mul(BPS_DENOMINATOR as u128)
                .and_then(|x| x.checked_div(total_weight as u128))
                .and_then(|x| u16::try_from(x).ok())
                .ok_or(ConsensusError::Overflow)?;

            if reject_ratio_bps >= REJECT_ALL_THRESHOLD_BPS {
                // RejectAll 胜出，全员退款
                idea.status = IdeaStatus::Cancelled;
                emit!(VotingCancelled {
                    idea: idea.key(),
                    reason: "Rejected by supermajority (2/3+ RejectAll votes)".to_string(),
                });
                return Ok(());
            }
        }

        // 根据投票模式决定获胜者
        let winning_index = match voting_mode {
            VotingMode::Classic => {
                // 经典模式：最多票获胜
                let max_votes = *idea.votes.iter().max().unwrap();
                let winning_indices: Vec<usize> = idea.votes
                    .iter()
                    .enumerate()
                    .filter(|(_, &v)| v == max_votes)
                    .map(|(i, _)| i)
                    .collect();

                // 如果有平局，取消投票
                if winning_indices.len() > 1 {
                    idea.status = IdeaStatus::Cancelled;
                    emit!(VotingCancelled {
                        idea: idea.key(),
                        reason: "Vote tied".to_string(),
                    });
                    return Ok(());
                }
                winning_indices[0] as u8
            }
            VotingMode::Reverse => {
                // 反向模式：最少票获胜
                let min_votes = *idea.votes.iter().min().unwrap();
                let winning_indices: Vec<usize> = idea.votes
                    .iter()
                    .enumerate()
                    .filter(|(_, &v)| v == min_votes)
                    .map(|(i, _)| i)
                    .collect();

                // 如果有平局，取消投票
                if winning_indices.len() > 1 {
                    idea.status = IdeaStatus::Cancelled;
                    emit!(VotingCancelled {
                        idea: idea.key(),
                        reason: "Vote tied (reverse mode)".to_string(),
                    });
                    return Ok(());
                }
                winning_indices[0] as u8
            }
            VotingMode::MiddleWay => {
                // 中间派模式：最多和最少都赢
                // 这种模式下，我们将最多和最少视为"联合获胜"
                // 简化处理：选择最多票的作为主获胜者
                let max_votes = *idea.votes.iter().max().unwrap();
                let winning_indices: Vec<usize> = idea.votes
                    .iter()
                    .enumerate()
                    .filter(|(_, &v)| v == max_votes)
                    .map(|(i, _)| i)
                    .collect();

                if winning_indices.len() > 1 {
                    idea.status = IdeaStatus::Cancelled;
                    emit!(VotingCancelled {
                        idea: idea.key(),
                        reason: "Vote tied (middle way mode)".to_string(),
                    });
                    return Ok(());
                }
                winning_indices[0] as u8
            }
        };

        idea.winning_image_index = Some(winning_index);

        // 计算费用分配
        let curator_fee = (idea.total_staked as u128)
            .checked_mul(idea.curator_fee_bps as u128)
            .and_then(|x| x.checked_div(BPS_DENOMINATOR as u128))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ConsensusError::Overflow)?;

        let platform_fee = (idea.total_staked as u128)
            .checked_mul(PLATFORM_FEE_BPS as u128)
            .and_then(|x| x.checked_div(BPS_DENOMINATOR as u128))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ConsensusError::Overflow)?;

        let remaining_pool = idea.total_staked
            .checked_sub(curator_fee)
            .and_then(|x| x.checked_sub(platform_fee))
            .ok_or(ConsensusError::Overflow)?;

        // 5% 进入主题回购池
        let buyback_contribution = (remaining_pool as u128)
            .checked_mul(SETTLEMENT_BUYBACK_BPS as u128)
            .and_then(|x| x.checked_div(BPS_DENOMINATOR as u128))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ConsensusError::Overflow)?;

        // 50% 惩罚比例（从剩余池中扣除回购贡献后计算）
        let penalty_pool = (remaining_pool as u128)
            .checked_sub(buyback_contribution as u128)
            .ok_or(ConsensusError::Overflow)?
            .checked_mul(PENALTY_BPS as u128)
            .and_then(|x| x.checked_div(BPS_DENOMINATOR as u128))
            .and_then(|x| u64::try_from(x).ok())
            .ok_or(ConsensusError::Overflow)?;

        let winner_count = idea.votes[winning_index as usize];

        idea.curator_fee_collected = curator_fee;
        idea.platform_fee_collected = platform_fee;
        idea.penalty_pool_amount = penalty_pool;
        idea.winner_count = winner_count;
        idea.status = IdeaStatus::Completed;

        // 转移费用（使用 SPL Token）
        let idea_key = idea.key();
        let vault_seeds = &[
            b"vault",
            idea_key.as_ref(),
            &[idea.vault_bump],
        ];
        let signer = &[&vault_seeds[..]];

        // 转策展费给发起者（代币）
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.initiator_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            curator_fee,
        )?;

        // 转平台费给协议财库（代币）
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.protocol_treasury_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            platform_fee,
        )?;

        // 转回购贡献到主题回购池（代币）
        // 注意：这里先转到主题vault，后续由theme程序管理回购
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.theme_buyback_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            buyback_contribution,
        )?;

        emit!(VotingSettled {
            idea: idea.key(),
            winning_image_index: winning_index,
            total_staked: idea.total_staked,
            curator_fee,
            platform_fee,
            penalty_pool,
            winner_count,
        });

        Ok(())
    }

    /// 提取奖金
    pub fn withdraw_winnings(ctx: Context<WithdrawWinnings>) -> Result<()> {
        let idea = &ctx.accounts.idea;
        require!(
            idea.status == IdeaStatus::Completed,
            ConsensusError::InvalidState
        );

        let vote = &ctx.accounts.vote;
        let reviewer_stake = &mut ctx.accounts.reviewer_stake;

        // 检查是否已经提取过
        require!(!reviewer_stake.is_winner, ConsensusError::AlreadyWithdrawn);

        // 检查是否是获胜方
        let winning_index = idea.winning_image_index.ok_or(ConsensusError::NoWinner)?;
        require!(
            vote.image_choice == winning_index,
            ConsensusError::NotWinner
        );

        // 计算应得奖金
        let per_winner_share = idea.penalty_pool_amount
            .checked_div(idea.winner_count)
            .ok_or(ConsensusError::DivisionByZero)?;

        let total_winnings = reviewer_stake.total_staked
            .checked_add(per_winner_share)
            .ok_or(ConsensusError::Overflow)?;

        // 转账（使用 SPL Token）
        let idea_key = idea.key();
        let vault_seeds = &[
            b"vault",
            idea_key.as_ref(),
            &[idea.vault_bump],
        ];
        let signer = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.reviewer_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            total_winnings,
        )?;

        reviewer_stake.is_winner = true;
        reviewer_stake.winnings = total_winnings;

        emit!(WinningsWithdrawn {
            idea: idea.key(),
            reviewer: ctx.accounts.reviewer.key(),
            amount: total_winnings,
        });

        Ok(())
    }

    /// 提取退款 (仅在取消时可用)
    pub fn withdraw_refund(ctx: Context<WithdrawRefund>) -> Result<()> {
        let idea = &ctx.accounts.idea;
        require!(
            idea.status == IdeaStatus::Cancelled,
            ConsensusError::InvalidState
        );

        let _vote = &ctx.accounts.vote;
        let reviewer_stake = &mut ctx.accounts.reviewer_stake;

        require!(!reviewer_stake.is_winner, ConsensusError::AlreadyWithdrawn);

        let refund_amount = reviewer_stake.total_staked;

        // 转账退款（使用 SPL Token）
        let idea_key = idea.key();
        let vault_seeds = &[
            b"vault",
            idea_key.as_ref(),
            &[idea.vault_bump],
        ];
        let signer = &[&vault_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.reviewer_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            refund_amount,
        )?;

        reviewer_stake.is_winner = true; // 标记为已处理

        emit!(RefundWithdrawn {
            idea: idea.key(),
            reviewer: ctx.accounts.reviewer.key(),
            amount: refund_amount,
        });

        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Contexts
// -----------------------------------------------------------------------------

#[derive(Accounts)]
pub struct SettleVoting<'info> {
    #[account(mut)]
    pub idea: Account<'info, Idea>,

    #[account(mut, seeds = [b"vault", idea.key().as_ref()], bump = idea.vault_bump)]
    pub vault: Account<'info, Vault>,

    /// CHECK: Theme token mint - validated through token program operations
    #[account(mut)]
    pub token_mint: AccountInfo<'info>,

    /// Vault token account holding staked tokens
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Initiator's token account to receive curator fee
    #[account(mut)]
    pub initiator_token_account: Account<'info, TokenAccount>,

    /// Protocol treasury token account to receive platform fee
    #[account(mut)]
    pub protocol_treasury_token_account: Account<'info, TokenAccount>,

    /// Theme buyback token account to receive buyback contribution
    #[account(mut)]
    pub theme_buyback_token_account: Account<'info, TokenAccount>,

    /// CHECK: Initiator to receive curator fee
    #[account(mut)]
    pub initiator: UncheckedAccount<'info>,

    /// CHECK: Protocol treasury to receive platform fee
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawWinnings<'info> {
    #[account(mut)]
    pub idea: Account<'info, Idea>,

    #[account(
        seeds = [b"vote", idea.key().as_ref(), reviewer.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,

    #[account(
        mut,
        seeds = [b"reviewer_stake", idea.key().as_ref(), reviewer.key().as_ref()],
        bump = reviewer_stake.bump
    )]
    pub reviewer_stake: Account<'info, ReviewerStake>,

    #[account(mut, seeds = [b"vault", idea.key().as_ref()], bump = idea.vault_bump)]
    pub vault: Account<'info, Vault>,

    /// Vault token account
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Reviewer's token account to receive winnings
    #[account(mut)]
    pub reviewer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reviewer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawRefund<'info> {
    #[account(mut)]
    pub idea: Account<'info, Idea>,

    #[account(
        seeds = [b"vote", idea.key().as_ref(), reviewer.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,

    #[account(
        mut,
        seeds = [b"reviewer_stake", idea.key().as_ref(), reviewer.key().as_ref()],
        bump = reviewer_stake.bump
    )]
    pub reviewer_stake: Account<'info, ReviewerStake>,

    #[account(mut, seeds = [b"vault", idea.key().as_ref()], bump = idea.vault_bump)]
    pub vault: Account<'info, Vault>,

    /// Vault token account
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Reviewer's token account to receive refund
    #[account(mut)]
    pub reviewer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reviewer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

#[event]
pub struct VotingSettled {
    pub idea: Pubkey,
    pub winning_image_index: u8,
    pub total_staked: u64,
    pub curator_fee: u64,
    pub platform_fee: u64,
    pub penalty_pool: u64,
    pub winner_count: u64,
}

#[event]
pub struct WinningsWithdrawn {
    pub idea: Pubkey,
    pub reviewer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct VotingCancelled {
    pub idea: Pubkey,
    pub reason: String,
}

#[event]
pub struct RefundWithdrawn {
    pub idea: Pubkey,
    pub reviewer: Pubkey,
    pub amount: u64,
}

// -----------------------------------------------------------------------------
// Account Structures (same as core program)
// -----------------------------------------------------------------------------

#[account]
pub struct Idea {
    pub initiator: Pubkey,
    pub idea_id: u64,
    pub prompt: String,
    pub created_at: i64,
    pub image_uris: Vec<String>,
    pub generation_status: GenerationStatus,
    pub generation_deadline: i64,
    pub depin_provider: Pubkey,
    pub sponsor: Option<Pubkey>,
    pub initial_prize_pool: u64,
    pub total_staked: u64,
    pub min_stake: u64,
    pub curator_fee_bps: u16,
    pub votes: [u64; 4],
    pub reject_all_weight: u64,
    pub total_voters: u64,
    pub winning_image_index: Option<u8>,
    pub curator_fee_collected: u64,
    pub platform_fee_collected: u64,
    pub penalty_pool_amount: u64,
    pub winner_count: u64,
    pub voting_deadline: i64,
    pub status: IdeaStatus,
    pub vault_bump: u8,
    pub idea_bump: u8,
}

#[account]
pub struct Vault {
    pub idea: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Vote {
    pub idea: Pubkey,
    pub voter: Pubkey,
    pub image_choice: u8,
    pub stake_amount: u64,
    pub vote_weight: u64,
    pub ts: i64,
}

#[account]
pub struct ReviewerStake {
    pub idea: Pubkey,
    pub reviewer: Pubkey,
    pub total_staked: u64,
    pub is_winner: bool,
    pub winnings: u64,
    pub bump: u8,
}
