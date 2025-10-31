use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use taste_fun_shared::*;

declare_id!("DiyEKJXPDNJ4Phfe3wVYkgi2NbJQuHtifgDgBYbCRuGe");

#[program]
pub mod taste_fun_core {
    use super::*;

    /// 创建新创意，提交 AI 生图 Prompt
    pub fn create_idea(
        ctx: Context<CreateIdea>,
        idea_id: u64,
        prompt: String,
        theme: Pubkey,
        depin_provider: Pubkey,
        voting_duration_hours: u16,
    ) -> Result<()> {
        require!(
            prompt.len() > 0 && prompt.len() <= MAX_PROMPT_LEN,
            ConsensusError::InvalidPrompt
        );
        require!(
            voting_duration_hours >= 24 && voting_duration_hours <= 168,
            ConsensusError::InvalidVotingDuration
        );

        let clock = Clock::get()?;
        let idea = &mut ctx.accounts.idea;

        idea.initiator = ctx.accounts.initiator.key();
        idea.idea_id = idea_id;
        idea.prompt = prompt.clone();
        idea.created_at = clock.unix_timestamp;
        idea.theme = theme;
        idea.theme_token_mint = ctx.accounts.theme_token_mint.key();
        idea.image_uris = Vec::new();
        idea.generation_status = GenerationStatus::Pending;
        idea.generation_deadline = clock.unix_timestamp + IMAGE_GENERATION_TIMEOUT;
        idea.total_staked = 0;
        idea.min_stake = MIN_TOKEN_STAKE; // Now uses token amount
        idea.curator_fee_bps = CURATOR_FEE_BPS;
        idea.votes = [0; 4];
        idea.reject_all_weight = 0;
        idea.total_voters = 0;
        idea.voting_deadline = 0;
        idea.curator_fee_collected = 0;
        idea.platform_fee_collected = 0;
        idea.penalty_pool_amount = 0;
        idea.winner_count = 0;
        idea.status = IdeaStatus::GeneratingImages;
        idea.vault_bump = ctx.bumps.vault;
        idea.idea_bump = ctx.bumps.idea;
        idea.depin_provider = depin_provider;
        idea.sponsor = None;
        idea.initial_prize_pool = 0;

        // 收取发起费用
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.initiator.key(),
            &ctx.accounts.protocol_treasury.key(),
            CREATION_FEE,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.initiator.to_account_info(),
                ctx.accounts.protocol_treasury.to_account_info(),
            ],
        )?;

        emit!(IdeaCreated {
            idea: idea.key(),
            initiator: idea.initiator,
            prompt: prompt.clone(),
            depin_provider,
        });

        Ok(())
    }

    /// 创建赞助竞赛 (赞助商注入初始奖池)
    pub fn create_sponsored_idea(
        ctx: Context<CreateSponsoredIdea>,
        idea_id: u64,
        prompt: String,
        theme: Pubkey,
        depin_provider: Pubkey,
        voting_duration_hours: u16,
        initial_prize_pool: u64,
    ) -> Result<()> {
        require!(
            prompt.len() > 0 && prompt.len() <= MAX_PROMPT_LEN,
            ConsensusError::InvalidPrompt
        );
        require!(
            voting_duration_hours >= 24 && voting_duration_hours <= 168,
            ConsensusError::InvalidVotingDuration
        );
        require!(
            initial_prize_pool >= MIN_TOKEN_STAKE,
            ConsensusError::StakeTooLow
        );

        let clock = Clock::get()?;
        let idea = &mut ctx.accounts.idea;

        idea.initiator = ctx.accounts.initiator.key();
        idea.idea_id = idea_id;
        idea.prompt = prompt.clone();
        idea.created_at = clock.unix_timestamp;
        idea.theme = theme;
        idea.theme_token_mint = ctx.accounts.theme_token_mint.key();
        idea.image_uris = Vec::new();
        idea.generation_status = GenerationStatus::Pending;
        idea.generation_deadline = clock.unix_timestamp + IMAGE_GENERATION_TIMEOUT;
        idea.total_staked = initial_prize_pool;
        idea.min_stake = MIN_TOKEN_STAKE;
        idea.curator_fee_bps = CURATOR_FEE_BPS;
        idea.votes = [0; 4];
        idea.reject_all_weight = 0;
        idea.total_voters = 0;
        idea.voting_deadline = 0;
        idea.curator_fee_collected = 0;
        idea.platform_fee_collected = 0;
        idea.penalty_pool_amount = 0;
        idea.winner_count = 0;
        idea.status = IdeaStatus::GeneratingImages;
        idea.vault_bump = ctx.bumps.vault;
        idea.idea_bump = ctx.bumps.idea;
        idea.depin_provider = depin_provider;
        idea.sponsor = Some(ctx.accounts.sponsor.key());
        idea.initial_prize_pool = initial_prize_pool;

        // 收取发起费用
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.initiator.key(),
            &ctx.accounts.protocol_treasury.key(),
            CREATION_FEE,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.initiator.to_account_info(),
                ctx.accounts.protocol_treasury.to_account_info(),
            ],
        )?;

        // 转移初始奖池代币到 vault（使用 SPL Token）
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sponsor_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.sponsor.to_account_info(),
                },
            ),
            initial_prize_pool,
        )?;

        emit!(SponsoredIdeaCreated {
            idea: idea.key(),
            initiator: idea.initiator,
            sponsor: ctx.accounts.sponsor.key(),
            prompt: prompt.clone(),
            initial_prize_pool,
            depin_provider,
        });

        Ok(())
    }

    /// 确认图片生成完成 (由授权的链下服务调用)
    pub fn confirm_images(
        ctx: Context<ConfirmImages>,
        image_uris: Vec<String>,
    ) -> Result<()> {
        let idea = &mut ctx.accounts.idea;
        require!(
            idea.status == IdeaStatus::GeneratingImages,
            ConsensusError::InvalidState
        );
        require!(image_uris.len() == 4, ConsensusError::InvalidImageCount);

        // 验证调用者是授权的 DePIN 服务
        require!(
            ctx.accounts.depin_authority.key() == AUTHORIZED_DEPIN_PUBKEY,
            ConsensusError::UnauthorizedDePIN
        );

        // 验证 URI 长度
        for uri in &image_uris {
            require!(
                uri.len() > 0 && uri.len() <= MAX_IMAGE_URI_LEN,
                ConsensusError::InvalidImageUri
            );
        }

        idea.image_uris = image_uris.clone();
        idea.generation_status = GenerationStatus::Completed;
        idea.status = IdeaStatus::Voting;

        let clock = Clock::get()?;
        idea.voting_deadline = clock.unix_timestamp + DEFAULT_VOTING_DURATION;

        emit!(ImagesGenerated {
            idea: idea.key(),
            image_uris,
        });

        Ok(())
    }

    /// 质押并投票选择图片 (使用主题代币质押)
    pub fn vote_for_image(
        ctx: Context<VoteForImage>,
        image_index: u8,
        token_amount: u64,
    ) -> Result<()> {
        let idea = &ctx.accounts.idea;
        require!(idea.status == IdeaStatus::Voting, ConsensusError::InvalidState);
        require!(
            image_index < 4 || image_index == 255,
            ConsensusError::InvalidImageIndex
        );
        require!(token_amount >= idea.min_stake, ConsensusError::StakeTooLow);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < idea.voting_deadline,
            ConsensusError::VotingEnded
        );

        // 转移代币质押到 vault（使用 SPL Token）
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.voter_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.voter.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // 计算二次方投票权重: vote_weight = sqrt(token_amount)
        let vote_weight = integer_sqrt(token_amount);

        // 更新 idea 统计
        let idea = &mut ctx.accounts.idea;
        if image_index < 4 {
            idea.votes[image_index as usize] = idea.votes[image_index as usize]
                .checked_add(vote_weight)
                .ok_or(ConsensusError::Overflow)?;
        } else {
            // RejectAll 投票权重
            idea.reject_all_weight = idea.reject_all_weight
                .checked_add(vote_weight)
                .ok_or(ConsensusError::Overflow)?;
        }
        idea.total_staked = idea.total_staked.checked_add(token_amount)
            .ok_or(ConsensusError::Overflow)?;
        idea.total_voters += 1;

        // 创建投票记录（首次投票）
        let vote = &mut ctx.accounts.vote;
        vote.idea = idea.key();
        vote.voter = ctx.accounts.voter.key();
        vote.image_choice = image_index;
        vote.stake_amount = token_amount;
        vote.ts = clock.unix_timestamp;
        vote.vote_weight = vote_weight;

        // 创建质押记录（首次投票）
        let reviewer_stake = &mut ctx.accounts.reviewer_stake;
        reviewer_stake.idea = idea.key();
        reviewer_stake.reviewer = ctx.accounts.voter.key();
        reviewer_stake.total_staked = token_amount; // 首次投票，直接设置
        reviewer_stake.is_winner = false;
        reviewer_stake.winnings = 0;
        reviewer_stake.bump = ctx.bumps.reviewer_stake;

        emit!(VoteCast {
            idea: idea.key(),
            voter: ctx.accounts.voter.key(),
            image_choice: image_index,
            stake_amount: token_amount,
        });

        Ok(())
    }

    /// 取消创意 (参与者不足或超时)
    pub fn cancel_idea(ctx: Context<CancelIdea>) -> Result<()> {
        let idea = &mut ctx.accounts.idea;
        let clock = Clock::get()?;

        // 只能由发起者取消，或者超时后任何人都可以取消
        let can_cancel = ctx.accounts.authority.key() == idea.initiator
            || clock.unix_timestamp > idea.generation_deadline + DEFAULT_VOTING_DURATION;

        require!(can_cancel, ConsensusError::Unauthorized);

        require!(
            idea.status == IdeaStatus::GeneratingImages || idea.status == IdeaStatus::Voting,
            ConsensusError::InvalidState
        );

        idea.status = IdeaStatus::Cancelled;

        emit!(IdeaCancelled {
            idea: idea.key(),
            reason: "Cancelled by initiator or timeout".to_string(),
        });

        Ok(())
    }
}

// -----------------------------------------------------------------------------
// Contexts
// -----------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(idea_id: u64, prompt: String, theme: Pubkey)]
pub struct CreateIdea<'info> {
    #[account(
        init,
        payer = initiator,
        space = 8 + Idea::SPACE,
        seeds = [b"idea", initiator.key().as_ref(), &idea_id.to_le_bytes()],
        bump
    )]
    pub idea: Box<Account<'info, Idea>>,

    #[account(
        init,
        payer = initiator,
        space = 8 + Vault::SPACE,
        seeds = [b"vault", idea.key().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: Theme token mint - validated by constraint
    #[account(
        constraint = theme_token_mint.key() != Pubkey::default() @ ConsensusError::InvalidTheme
    )]
    pub theme_token_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    /// CHECK: Protocol treasury account
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(idea_id: u64, prompt: String, theme: Pubkey)]
pub struct CreateSponsoredIdea<'info> {
    #[account(
        init,
        payer = initiator,
        space = 8 + Idea::SPACE,
        seeds = [b"idea", initiator.key().as_ref(), &idea_id.to_le_bytes()],
        bump
    )]
    pub idea: Box<Account<'info, Idea>>,

    #[account(
        init,
        payer = initiator,
        space = 8 + Vault::SPACE,
        seeds = [b"vault", idea.key().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: Theme token mint - validated by constraint
    #[account(
        constraint = theme_token_mint.key() != Pubkey::default() @ ConsensusError::InvalidTheme
    )]
    pub theme_token_mint: UncheckedAccount<'info>,

    /// CHECK: Validated by token program via transfer
    #[account(mut)]
    pub sponsor_token_account: AccountInfo<'info>,

    /// CHECK: Validated by token program via transfer
    #[account(mut)]
    pub vault_token_account: AccountInfo<'info>,

    #[account(mut)]
    pub initiator: Signer<'info>,

    /// CHECK: Sponsor account providing initial prize pool
    #[account(mut)]
    pub sponsor: Signer<'info>,

    /// CHECK: Protocol treasury account
    #[account(mut)]
    pub protocol_treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConfirmImages<'info> {
    #[account(mut)]
    pub idea: Account<'info, Idea>,

    /// CHECK: 授权的 DePIN 服务账户
    pub depin_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(image_index: u8, token_amount: u64)]
pub struct VoteForImage<'info> {
    #[account(mut)]
    pub idea: Box<Account<'info, Idea>>,

    #[account(
        init,
        payer = voter,
        space = 8 + Vote::SPACE,
        seeds = [b"vote", idea.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote: Box<Account<'info, Vote>>,

    #[account(
        init,
        payer = voter,
        space = 8 + ReviewerStake::SPACE,
        seeds = [b"reviewer_stake", idea.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub reviewer_stake: Box<Account<'info, ReviewerStake>>,

    #[account(mut, seeds = [b"vault", idea.key().as_ref()], bump = idea.vault_bump)]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: Validated by token program via transfer
    #[account(mut)]
    pub voter_token_account: AccountInfo<'info>,

    /// CHECK: Validated by token program via transfer
    #[account(mut)]
    pub vault_token_account: AccountInfo<'info>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelIdea<'info> {
    #[account(mut)]
    pub idea: Account<'info, Idea>,

    pub authority: Signer<'info>,
}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

#[event]
pub struct IdeaCreated {
    pub idea: Pubkey,
    pub initiator: Pubkey,
    pub prompt: String,
    pub depin_provider: Pubkey,
}

#[event]
pub struct SponsoredIdeaCreated {
    pub idea: Pubkey,
    pub initiator: Pubkey,
    pub sponsor: Pubkey,
    pub prompt: String,
    pub initial_prize_pool: u64,
    pub depin_provider: Pubkey,
}

#[event]
pub struct ImagesGenerated {
    pub idea: Pubkey,
    pub image_uris: Vec<String>,
}

#[event]
pub struct VoteCast {
    pub idea: Pubkey,
    pub voter: Pubkey,
    pub image_choice: u8,
    pub stake_amount: u64,
}

#[event]
pub struct IdeaCancelled {
    pub idea: Pubkey,
    pub reason: String,
}

// -----------------------------------------------------------------------------
// Account Structures
// -----------------------------------------------------------------------------

#[account]
pub struct Idea {
    // 核心字段
    pub initiator: Pubkey,
    pub idea_id: u64,
    pub prompt: String,
    pub created_at: i64,

    // 主题关联（新增）
    pub theme: Pubkey,
    pub theme_token_mint: Pubkey,

    // DePIN 相关
    pub image_uris: Vec<String>,
    pub generation_status: GenerationStatus,
    pub generation_deadline: i64,
    pub depin_provider: Pubkey,

    // 赞助竞赛相关
    pub sponsor: Option<Pubkey>,
    pub initial_prize_pool: u64,

    // 质押池参数
    pub total_staked: u64,
    pub min_stake: u64,
    pub curator_fee_bps: u16,

    // 投票统计 (存储投票权重，非票数)
    pub votes: [u64; 4],
    pub reject_all_weight: u64,
    pub total_voters: u64,
    pub winning_image_index: Option<u8>,

    // 结算数据
    pub curator_fee_collected: u64,
    pub platform_fee_collected: u64,
    pub penalty_pool_amount: u64,
    pub winner_count: u64,

    // 时间控制
    pub voting_deadline: i64,

    // 状态与 bumps
    pub status: IdeaStatus,
    pub vault_bump: u8,
    pub idea_bump: u8,
}

impl Idea {
    pub const SPACE: usize = IDEA_SPACE + 64; // Added theme + theme_token_mint
}

#[account]
pub struct Vault {
    pub idea: Pubkey,
    pub bump: u8,
}

impl Vault {
    pub const SPACE: usize = VAULT_SPACE;
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

impl Vote {
    pub const SPACE: usize = VOTE_SPACE;
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

impl ReviewerStake {
    pub const SPACE: usize = REVIEWER_STAKE_SPACE;
}
