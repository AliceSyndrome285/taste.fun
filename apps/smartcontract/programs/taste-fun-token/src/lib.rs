use anchor_lang::prelude::*;
use taste_fun_shared::*;

declare_id!("AKLa61NJ7uwrSb13P7dhcuNfBFRJbVA2BVeqTtCXpe7X");

pub mod instructions;
use instructions::*;

#[program]
pub mod taste_fun_token {
    use super::*;

    /// 初始化全局交易配置
    pub fn initialize_trading_config(
        ctx: Context<InitializeTradingConfig>,
        trade_fee_bps: u16,
        buyback_fee_split_bps: u16,
        platform_fee_split_bps: u16,
        creator_fee_split_bps: u16,
    ) -> Result<()> {
        instructions::initialize_trading_config(
            ctx,
            trade_fee_bps,
            buyback_fee_split_bps,
            platform_fee_split_bps,
            creator_fee_split_bps,
        )
    }

    /// 初始化新主题 (第一步) - 包含 name 和 description
    pub fn initialize_theme(
        ctx: Context<InitializeTheme>,
        theme_id: u64,
        name: [u8; 12],
        description: [u8; 48],
        voting_mode: VotingMode,
    ) -> Result<()> {
        instructions::initialize_theme(ctx, theme_id, name, description, voting_mode)
    }

    /// 初始化vault和mint (第二步)
    pub fn init_vault_and_mint(ctx: Context<InitVaultAndMint>, theme_id: u64) -> Result<()> {
        instructions::init_vault_and_mint(ctx, theme_id)
    }

    /// 铸造初始代币 (第三步)
    pub fn mint_initial_tokens(ctx: Context<MintInitialTokens>, theme_id: u64) -> Result<()> {
        instructions::mint_initial_tokens(ctx, theme_id)
    }

    /// 用 SOL 购买主题代币
    pub fn swap_sol_for_tokens(
        ctx: Context<SwapSolForTokens>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        instructions::swap_sol_for_tokens(ctx, sol_amount, min_tokens_out)
    }

    /// 卖出主题代币获得 SOL
    pub fn swap_tokens_for_sol(
        ctx: Context<SwapTokensForSol>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        instructions::swap_tokens_for_sol(ctx, token_amount, min_sol_out)
    }

    /// 执行回购销毁
    pub fn execute_buyback(ctx: Context<ExecuteBuyback>) -> Result<()> {
        instructions::execute_buyback(ctx)
    }
}

// -----------------------------------------------------------------------------
// Events
// -----------------------------------------------------------------------------

#[event]
pub struct ThemeCreated {
    pub theme: Pubkey,
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    // name 移除，存储在链下
    pub voting_mode: VotingMode,
    pub total_supply: u64,
}

#[event]
pub struct TokensSwapped {
    pub theme: Pubkey,
    pub user: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub is_buy: bool,
    pub new_sol_reserves: u64,
    pub new_token_reserves: u64,
}

#[event]
pub struct BuybackExecuted {
    pub theme: Pubkey,
    pub sol_spent: u64,
    pub tokens_burned: u64,
    pub new_token_reserves: u64,
}

// -----------------------------------------------------------------------------
// Account Structures
// -----------------------------------------------------------------------------

#[account]
pub struct Theme {
    pub creator: Pubkey,
    pub theme_id: u64,
    
    // Fixed-length name and description to avoid stack overflow
    pub name: [u8; 12],        // 12 bytes for theme name  
    pub description: [u8; 48], // 48 bytes for description
    
    pub created_at: i64,
    
    // Token info
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub creator_reserve: u64,
    
    // Bonding curve state
    pub token_reserves: u64,
    pub sol_reserves: u64,
    
    // 移除统计字段，存储在链下或事件中
    // total_ideas_count, total_traded_volume 移除
    
    // Essential fee pools only
    pub buyback_pool: u64,
    // platform_fee_collected, creator_fee_collected 移除，可通过事件计算
    
    // Settings - 简化枚举
    pub voting_mode: u8,  // 改为 u8，只保留基本模式
    pub status: u8,       // 改为 u8，只保留 Active/Paused
    
    // Bumps
    pub vault_bump: u8,
    pub theme_bump: u8,
}

impl Theme {
    pub const INIT_SPACE: usize = THEME_SPACE;
}

#[account]
pub struct ThemeVault {
    pub theme: Pubkey,
    pub bump: u8,
}

impl ThemeVault {
    pub const SPACE: usize = THEME_VAULT_SPACE;
}

#[account]
pub struct TradingConfiguration {
    pub trade_fee_bps: u16,
    pub buyback_fee_split_bps: u16,
    pub platform_fee_split_bps: u16,
    pub creator_fee_split_bps: u16,
}

impl TradingConfiguration {
    pub const SPACE: usize = TRADING_CONFIG_SPACE;
}
