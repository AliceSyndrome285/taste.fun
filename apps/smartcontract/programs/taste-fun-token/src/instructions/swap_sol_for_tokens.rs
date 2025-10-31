use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use taste_fun_shared::*;
use crate::{Theme, ThemeVault, TradingConfiguration, TokensSwapped};

#[derive(Accounts)]
pub struct SwapSolForTokens<'info> {
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
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"trading_config"],
        bump
    )]
    pub trading_config: Account<'info, TradingConfiguration>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: Vault SOL account（存储净SOL和回购费）
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,
    
    /// CHECK: Platform treasury account（接收平台费）
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,
    
    /// CHECK: Theme creator account（接收创建者费）
    #[account(mut)]
    pub theme_creator: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn swap_sol_for_tokens(
    ctx: Context<SwapSolForTokens>,
    sol_amount: u64,
    min_tokens_out: u64,
) -> Result<()> {
    let theme = &mut ctx.accounts.theme;
    let config = &ctx.accounts.trading_config;
    
    // Validate token mint matches theme
    require!(
        ctx.accounts.token_mint.key() == theme.token_mint,
        ConsensusError::InvalidMint
    );
    
    require!(
        ctx.accounts.theme_creator.key() == theme.creator,
        ConsensusError::Unauthorized
    );
    require!(
        theme.status == THEME_STATUS_ACTIVE,
        ConsensusError::InvalidTheme
    );
    require!(
        sol_amount >= MIN_SOL_TRADE,
        ConsensusError::InvalidAmount
    );
    
    // Calculate tokens out using bonding curve
    // 注意参数顺序：sol_amount, token_reserves, sol_reserves, fee_bps
    // 这与pumpfun的恒定乘积公式一致
    let tokens_out = calculate_buy_tokens(
        sol_amount,
        theme.token_reserves,  // y: 代币储备 
        theme.sol_reserves,    // x: SOL储备
        config.trade_fee_bps,
    )?;
    
    require!(
        tokens_out >= min_tokens_out,
        ConsensusError::SlippageExceeded
    );
    require!(
        tokens_out <= theme.token_reserves,
        ConsensusError::InsufficientReserves
    );
    
    // Calculate fees according to configuration
    let total_fee = calculate_total_fee(sol_amount, config.trade_fee_bps)?;
    
    let buyback_fee = calculate_fee_portion(
        total_fee,
        config.buyback_fee_split_bps,
    )?;
    
    let platform_fee = calculate_fee_portion(
        total_fee,
        config.platform_fee_split_bps,
    )?;
    
    let creator_fee = calculate_fee_portion(
        total_fee,
        config.creator_fee_split_bps,
    )?;
    
    // Verify fee distribution adds up correctly
    let calculated_total = buyback_fee
        .checked_add(platform_fee)
        .and_then(|x| x.checked_add(creator_fee))
        .ok_or(ConsensusError::Overflow)?;
    
    require!(
        calculated_total <= total_fee,
        ConsensusError::InvalidAmount
    );
    
    let sol_to_reserves = sol_amount
        .checked_sub(total_fee)
        .ok_or(ConsensusError::Overflow)?;
    
    // 执行多重转账：净SOL到vault，费用分别转账
    // 1. 净SOL + 回购费 转给 vault（用于流动性和回购）
    let vault_amount = sol_to_reserves
        .checked_add(buyback_fee)
        .ok_or(ConsensusError::Overflow)?;
    
    if vault_amount > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault_sol_account.to_account_info(),
                },
            ),
            vault_amount,
        )?;
    }
    
    // 2. 平台费转给平台财库
    if platform_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.platform_treasury.to_account_info(),
                },
            ),
            platform_fee,
        )?;
    }
    
    // 3. 创建者费转给主题创建者
    if creator_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.theme_creator.to_account_info(),
                },
            ),
            creator_fee,
        )?;
    }
    
    // Transfer tokens from vault to user
    let creator_key = theme.creator;
    let theme_id_bytes = theme.theme_id.to_le_bytes();
    let vault_seeds = &[
        b"theme_vault",
        creator_key.as_ref(),
        theme_id_bytes.as_ref(),
        &[theme.vault_bump],
    ];
    let signer = &[&vault_seeds[..]];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        ),
        tokens_out,
    )?;
    
    // Update theme state
    // 只有净SOL进入储备，回购费单独累积
    theme.sol_reserves = theme.sol_reserves
        .checked_add(sol_to_reserves)
        .ok_or(ConsensusError::Overflow)?;
    theme.token_reserves = theme.token_reserves
        .checked_sub(tokens_out)
        .ok_or(ConsensusError::Overflow)?;
    theme.buyback_pool = theme.buyback_pool
        .checked_add(buyback_fee)
        .ok_or(ConsensusError::Overflow)?;
    // platform_fee_collected, creator_fee_collected, total_traded_volume 移除
    
    emit!(TokensSwapped {
        theme: theme.key(),
        user: ctx.accounts.user.key(),
        sol_amount,
        token_amount: tokens_out,
        is_buy: true,
        new_sol_reserves: theme.sol_reserves,
        new_token_reserves: theme.token_reserves,
    });
    
    msg!("Swapped {} SOL for {} tokens", sol_amount, tokens_out);
    msg!("New reserves - SOL: {}, Tokens: {}", theme.sol_reserves, theme.token_reserves);
    
    Ok(())
}

/// 计算总交易费用
#[inline(always)]
fn calculate_total_fee(sol_amount: u64, fee_bps: u16) -> Result<u64> {
    Ok((sol_amount as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)?
        as u64)
}

/// 计算费用分配部分
#[inline(always)]
fn calculate_fee_portion(total_fee: u64, split_bps: u16) -> Result<u64> {
    Ok((total_fee as u128)
        .checked_mul(split_bps as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)?
        as u64)
}
