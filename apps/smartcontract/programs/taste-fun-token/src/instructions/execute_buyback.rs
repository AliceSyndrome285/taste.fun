use anchor_lang::prelude::*;
use anchor_lang::system_program::System;
use anchor_spl::token::{burn, Mint, Token, TokenAccount, Burn};
use anchor_spl::associated_token::AssociatedToken;
use taste_fun_shared::*;
use crate::{Theme, ThemeVault, TradingConfiguration, BuybackExecuted};

#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    #[account(
        mut,
        seeds = [b"theme", theme.creator.as_ref(), theme.theme_id.to_le_bytes().as_ref()],
        bump = theme.theme_bump
    )]
    pub theme: Account<'info, Theme>,
    
    #[account(
        mut,
        seeds = [b"theme_vault", theme.creator.as_ref(), theme.theme_id.to_le_bytes().as_ref()],
        bump = theme.vault_bump
    )]
    pub vault: Account<'info, ThemeVault>,
    
    /// Theme token mint
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"trading_config"],
        bump
    )]
    pub trading_config: Account<'info, TradingConfiguration>,
    
    /// CHECK: Anyone can trigger buyback
    pub authority: Signer<'info>,
    
    /// CHECK: Vault SOL account（包含回购资金）
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

/// 执行回购销毁机制
/// 基于文档建议：从联合曲线回购代币并销毁
#[inline(never)]
pub fn execute_buyback(ctx: Context<ExecuteBuyback>) -> Result<()> {
    let theme = &mut ctx.accounts.theme;
    
    msg!("=== ExecuteBuyback START ===");
    
    // 验证基本条件
    validate_buyback_conditions(theme, &ctx.accounts.token_mint)?;
    
    let sol_to_spend = theme.buyback_pool;
    msg!("Buyback pool balance: {} lamports", sol_to_spend);
    
    // 计算可回购的代币数量（使用联合曲线公式）
    let tokens_to_buy = calculate_buyback_tokens(
        sol_to_spend,
        theme.token_reserves,
        theme.sol_reserves,
    )?;
    
    msg!("Tokens to buy back and burn: {}", tokens_to_buy);
    
    require!(
        tokens_to_buy <= theme.token_reserves,
        ConsensusError::InsufficientReserves
    );
    require!(
        tokens_to_buy <= ctx.accounts.vault_token_account.amount,
        ConsensusError::InsufficientReserves
    );
    
    // 执行回购交易：SOL已经在vault中，更新储备状态
    update_reserves_after_buyback(theme, sol_to_spend, tokens_to_buy)?;
    
    // 销毁回购的代币
    burn_bought_tokens(
        &ctx.accounts.token_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.vault,
        &ctx.accounts.token_program,
        tokens_to_buy,
        theme.vault_bump,
        &theme.creator,
        theme.theme_id,
    )?;
    
    // 更新总供应量
    theme.circulating_supply = theme.circulating_supply
        .checked_sub(tokens_to_buy)
        .ok_or(ConsensusError::Overflow)?;
    
    // 重置回购池
    theme.buyback_pool = 0;
    
    emit!(BuybackExecuted {
        theme: theme.key(),
        sol_spent: sol_to_spend,
        tokens_burned: tokens_to_buy,
        new_token_reserves: theme.token_reserves,
    });
    
    msg!("Buyback completed: {} SOL spent, {} tokens burned", sol_to_spend, tokens_to_buy);
    msg!("New reserves - SOL: {}, Tokens: {}", theme.sol_reserves, theme.token_reserves);
    msg!("=== ExecuteBuyback COMPLETE ===");
    
    Ok(())
}

/// 验证回购执行条件
#[inline(never)]
fn validate_buyback_conditions(theme: &Theme, token_mint: &Account<Mint>) -> Result<()> {
    require!(
        token_mint.key() == theme.token_mint,
        ConsensusError::InvalidMint
    );
    
    require!(
        theme.status == THEME_STATUS_ACTIVE,
        ConsensusError::InvalidTheme
    );
    
    require!(
        theme.buyback_pool >= BUYBACK_THRESHOLD,
        ConsensusError::InvalidAmount
    );
    
    Ok(())
}

/// 计算回购代币数量（无手续费）
#[inline(always)]
fn calculate_buyback_tokens(
    sol_amount: u64,
    token_reserves: u64,
    sol_reserves: u64,
) -> Result<u64> {
    calculate_buy_tokens(
        sol_amount,
        token_reserves,
        sol_reserves,
        0, // 回购无手续费
    )
}

/// 更新储备状态
#[inline(never)]
fn update_reserves_after_buyback(
    theme: &mut Theme,
    sol_spent: u64,
    tokens_bought: u64,
) -> Result<()> {
    // SOL储备增加（回购SOL加入流动性）
    theme.sol_reserves = theme.sol_reserves
        .checked_add(sol_spent)
        .ok_or(ConsensusError::Overflow)?;
    
    // 代币储备减少（将要被销毁的代币）
    theme.token_reserves = theme.token_reserves
        .checked_sub(tokens_bought)
        .ok_or(ConsensusError::Overflow)?;
    
    Ok(())
}

/// 销毁回购的代币
#[inline(never)]
fn burn_bought_tokens<'info>(
    token_mint: &Account<'info, Mint>,
    vault_token_account: &Account<'info, TokenAccount>,
    vault: &Account<'info, ThemeVault>,
    token_program: &Program<'info, Token>,
    tokens_to_burn: u64,
    vault_bump: u8,
    creator_key: &Pubkey,
    theme_id: u64,
) -> Result<()> {
    let theme_id_bytes = theme_id.to_le_bytes();
    let vault_seeds = &[
        b"theme_vault",
        creator_key.as_ref(),
        theme_id_bytes.as_ref(),
        &[vault_bump],
    ];
    let signer = &[&vault_seeds[..]];
    
    burn(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Burn {
                mint: token_mint.to_account_info(),
                from: vault_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer,
        ),
        tokens_to_burn,
    )?;
    
    Ok(())
}
