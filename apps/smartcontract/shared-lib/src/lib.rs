use anchor_lang::prelude::*;

// This crate only exports constants, enums, and utility functions
// Account structures are defined separately in each program

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

pub const BPS_DENOMINATOR: u16 = 10_000;
pub const MIN_REVIEWERS: u64 = 10; // 最小参与者数量
pub const CURATOR_FEE_BPS: u16 = 100; // 1% 策展费
pub const PENALTY_BPS: u16 = 5_000; // 50% 惩罚比例
pub const PLATFORM_FEE_BPS: u16 = 200; // 2% 平台费

// 序列化限制
pub const MAX_PROMPT_LEN: usize = 512;
pub const MAX_IMAGE_URI_LEN: usize = 128;
pub const MAX_THEME_NAME_LEN: usize = 12;      // 减小到 12 避免栈溢出
pub const MAX_THEME_DESCRIPTION_LEN: usize = 48; // 减小到 48

// 质押参数
pub const MIN_STAKE: u64 = 10_000_000; // 0.01 SOL
pub const CREATION_FEE: u64 = 5_000_000; // 0.005 SOL

// 时间加权参数
pub const EARLY_BIRD_BONUS_BPS: u16 = 2_000; // 早期投票20%奖励
pub const EARLY_BIRD_THRESHOLD: i64 = 24 * 3600; // 第一天算早期

// RejectAll 阈值
pub const REJECT_ALL_THRESHOLD_BPS: u16 = 6_667; // 2/3 = 66.67%

// DePIN 参数
pub const IMAGE_GENERATION_TIMEOUT: i64 = 24 * 3600; // 24小时
pub const DEFAULT_VOTING_DURATION: i64 = 72 * 3600; // 72小时

// 授权的 DePIN 服务公钥 (实际部署时替换)
pub const AUTHORIZED_DEPIN_PUBKEY: Pubkey = Pubkey::new_from_array([0; 32]);

// -----------------------------------------------------------------------------
// 代币发行参数（基于 Pumpfun 标准）
// -----------------------------------------------------------------------------
pub const TOKEN_TOTAL_SUPPLY: u64 = 1_000_000_000_000_000; // 1B * 10^6 decimals
pub const TOKEN_DECIMALS: u8 = 6;
pub const CREATOR_RESERVE_PERCENT: u8 = 20;
pub const CIRCULATING_PERCENT: u8 = 80;

// -----------------------------------------------------------------------------
// 联合曲线参数
// -----------------------------------------------------------------------------
pub const INITIAL_TOKEN_RESERVES: u64 = 800_000_000_000_000; // 80% of total supply
pub const INITIAL_SOL_RESERVES: u64 = 0; // 初始为 0，等待首次交易
pub const MIGRATION_THRESHOLD: u64 = 80_000_000_000; // 80 SOL (in lamports)
pub const TRADE_FEE_BPS: u16 = 100; // 1%
pub const BUYBACK_FEE_SPLIT_BPS: u16 = 5000; // 50% of fees
pub const PLATFORM_FEE_SPLIT_BPS: u16 = 3000; // 30% of fees
pub const CREATOR_FEE_SPLIT_BPS: u16 = 2000; // 20% of fees

// -----------------------------------------------------------------------------
// 回购机制
// -----------------------------------------------------------------------------
pub const BUYBACK_THRESHOLD: u64 = 100_000_000; // 0.1 SOL
pub const SETTLEMENT_BUYBACK_BPS: u16 = 500; // 5% from settlement

// -----------------------------------------------------------------------------
// 交易限制
// -----------------------------------------------------------------------------
pub const MIN_SOL_TRADE: u64 = 1_000_000; // 0.001 SOL
pub const MIN_TOKEN_STAKE: u64 = 1_000_000; // 1 token (6 decimals)
pub const MAX_SLIPPAGE_BPS: u16 = 1000; // 10%

/// 整数平方根 (用于二次方投票)
pub fn integer_sqrt(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

// -----------------------------------------------------------------------------
// Shared Enums
// -----------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum IdeaStatus {
    GeneratingImages, // DePIN 正在生成图片
    Voting,           // 评审投票中
    Completed,        // 已结算
    Cancelled,        // 取消（参与者不足/生成失败）
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GenerationStatus {
    Pending,
    Completed,
    Failed,
}

// 简化的枚举常量
pub const VOTING_MODE_CLASSIC: u8 = 0;
pub const VOTING_MODE_REVERSE: u8 = 1;
pub const VOTING_MODE_MIDDLE_WAY: u8 = 2;

pub const THEME_STATUS_ACTIVE: u8 = 0;
pub const THEME_STATUS_PAUSED: u8 = 1;

// 保留原枚举以兼容其他地方的使用
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum VotingMode {
    Classic,    // 最多票获胜
    Reverse,    // 最少票获胜
    MiddleWay,  // 最多和最少都胜，瓜分中间两项
}

impl VotingMode {
    pub fn from_u8(value: u8) -> Result<Self, ProgramError> {
        match value {
            VOTING_MODE_CLASSIC => Ok(VotingMode::Classic),
            VOTING_MODE_REVERSE => Ok(VotingMode::Reverse),
            VOTING_MODE_MIDDLE_WAY => Ok(VotingMode::MiddleWay),
            _ => Err(ProgramError::InvalidArgument),
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ThemeStatus {
    Active,     // 主题活跃中
    Migrated,   // 已迁移到 Raydium
    Paused,     // 暂停
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
#[repr(C)]
pub struct Vault {
    pub idea: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Vote {
    pub idea: Pubkey,
    pub voter: Pubkey,
    pub image_choice: u8, // 0-3 对应图 A-D, 255 = RejectAll
    pub stake_amount: u64,
    pub vote_weight: u64, // 二次方投票权重
    pub ts: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
#[repr(C)]
pub struct ReviewerStake {
    pub idea: Pubkey,
    pub reviewer: Pubkey,
    pub total_staked: u64,
    pub is_winner: bool,
    pub winnings: u64,
    pub bump: u8,
}

// -----------------------------------------------------------------------------
// Account Size Constants
// -----------------------------------------------------------------------------

pub const IDEA_SPACE: usize = 32     // initiator
    + 8                         // idea_id
    + (4 + MAX_PROMPT_LEN)      // prompt
    + 8                         // created_at
    + (4 + 4 * (4 + MAX_IMAGE_URI_LEN)) // image_uris (Vec<String>)
    + 1                         // generation_status
    + 8                         // generation_deadline
    + 32                        // depin_provider
    + (1 + 32)                  // sponsor (Option<Pubkey>)
    + 8                         // initial_prize_pool
    + 8                         // total_staked
    + 8                         // min_stake
    + 2                         // curator_fee_bps
    + 32                        // votes [u64; 4]
    + 8                         // reject_all_weight
    + 8                         // total_voters
    + (1 + 1)                   // winning_image_index (Option<u8>)
    + 8                         // curator_fee_collected
    + 8                         // platform_fee_collected
    + 8                         // penalty_pool_amount
    + 8                         // winner_count
    + 8                         // voting_deadline
    + 1                         // status
    + 1                         // vault_bump
    + 1                         // idea_bump
    + 32                        // theme
    + 32                        // theme_token_mint
    + 16;                       // minimal buffer

pub const VAULT_SPACE: usize = 32 + 1; // idea + bump

pub const VOTE_SPACE: usize = 32 + 32 + 1 + 8 + 8 + 8; // idea + voter + image_choice + stake_amount + vote_weight + ts

pub const REVIEWER_STAKE_SPACE: usize = 32 + 32 + 8 + 1 + 8 + 1; // idea + reviewer + total_staked + is_winner + winnings + bump

// -----------------------------------------------------------------------------
// Theme Token Account Sizes
// -----------------------------------------------------------------------------

// 大幅简化的Theme账户结构
pub const THEME_SPACE: usize = 32      // creator
    + 8                          // theme_id
    + 12                         // name [u8; 12]
    + 48                         // description [u8; 48]
    + 8                          // created_at
    + 32                         // token_mint
    + 8                          // total_supply
    + 8                          // circulating_supply
    + 8                          // creator_reserve
    + 8                          // token_reserves
    + 8                          // sol_reserves
    // 移除统计字段 total_ideas_count, total_traded_volume
    + 8                          // buyback_pool
    // 移除 platform_fee_collected, creator_fee_collected
    + 1                          // voting_mode (u8)
    + 1                          // status (u8)
    + 1                          // vault_bump
    + 1                          // theme_bump
    + 16;                        // 减少buffer，仅保留16字节

pub const THEME_VAULT_SPACE: usize = 32 + 1; // theme + bump

pub const TRADING_CONFIG_SPACE: usize = 2 + 2 + 2 + 2 + 64; // trade_fee_bps + buyback_fee_split_bps + platform_fee_split_bps + creator_fee_split_bps + buffer

// -----------------------------------------------------------------------------
// Bonding Curve Utilities
// -----------------------------------------------------------------------------

/// 计算买入代币数量（使用整数避免浮点精度问题）
/// 基于恒定乘积公式：x * y = k
/// tokens_out = token_reserves * sol_in / (sol_reserves + sol_in)
pub fn calculate_buy_tokens(
    sol_amount: u64,
    token_reserves: u64,
    sol_reserves: u64,
    fee_bps: u16,
) -> Result<u64> {
    if sol_amount == 0 || token_reserves == 0 {
        return err!(ConsensusError::InvalidAmount);
    }
    
    // 扣除手续费（使用 u128 避免溢出）
    let sol_after_fee = (sol_amount as u128)
        .checked_mul((BPS_DENOMINATOR - fee_bps) as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)?;
    
    // 计算新的 SOL 储备
    let new_sol_reserves = (sol_reserves as u128)
        .checked_add(sol_after_fee)
        .ok_or(ConsensusError::Overflow)?;
    
    // tokens_out = token_reserves * sol_after_fee / new_sol_reserves
    let tokens_out = (token_reserves as u128)
        .checked_mul(sol_after_fee)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(new_sol_reserves)
        .ok_or(ConsensusError::DivisionByZero)?;
    
    Ok(tokens_out as u64)
}

/// 计算卖出代币获得的 SOL
/// sol_out = sol_reserves * token_in / (token_reserves + token_in)
pub fn calculate_sell_sol(
    token_amount: u64,
    token_reserves: u64,
    sol_reserves: u64,
    fee_bps: u16,
) -> Result<u64> {
    if token_amount == 0 || sol_reserves == 0 {
        return err!(ConsensusError::InvalidAmount);
    }
    
    // 计算新的代币储备
    let new_token_reserves = (token_reserves as u128)
        .checked_add(token_amount as u128)
        .ok_or(ConsensusError::Overflow)?;
    
    // sol_out = sol_reserves * token_amount / new_token_reserves
    let sol_out = (sol_reserves as u128)
        .checked_mul(token_amount as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(new_token_reserves)
        .ok_or(ConsensusError::DivisionByZero)?;
    
    // 扣除手续费
    let sol_out_net = (sol_out as u128)
        .checked_mul((BPS_DENOMINATOR - fee_bps) as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)?;
    
    Ok(sol_out_net as u64)
}

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

#[error_code]
pub enum ConsensusError {
    #[msg("Invalid prompt length")]
    InvalidPrompt,
    #[msg("Invalid voting duration")]
    InvalidVotingDuration,
    #[msg("Invalid state for this operation")]
    InvalidState,
    #[msg("Invalid image count (expected 4)")]
    InvalidImageCount,
    #[msg("Unauthorized DePIN service")]
    UnauthorizedDePIN,
    #[msg("Invalid image URI")]
    InvalidImageUri,
    #[msg("Invalid image index")]
    InvalidImageIndex,
    #[msg("Stake amount too low")]
    StakeTooLow,
    #[msg("Voting period has ended")]
    VotingEnded,
    #[msg("Voting not ended yet")]
    VotingNotEnded,
    #[msg("Already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Not a winner")]
    NotWinner,
    #[msg("No winner determined")]
    NoWinner,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Overflow")]
    Overflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Theme not found or inactive")]
    InvalidTheme,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient token reserves")]
    InsufficientReserves,
    #[msg("Invalid theme name or description")]
    InvalidThemeMetadata,
    #[msg("Invalid token mint")]
    InvalidMint,
}
