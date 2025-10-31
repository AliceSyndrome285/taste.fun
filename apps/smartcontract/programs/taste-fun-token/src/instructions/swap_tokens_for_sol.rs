use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use taste_fun_shared::*;
use crate::{Theme, ThemeVault, TradingConfiguration, TokensSwapped};

#[derive(Accounts)]
pub struct SwapTokensForSol<'info> {
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
        mut,
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
    
    /// CHECK: Vault SOL account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn swap_tokens_for_sol(
    ctx: Context<SwapTokensForSol>,
    token_amount: u64,
    min_sol_out: u64,
) -> Result<()> {
    let theme = &mut ctx.accounts.theme;
    let config = &ctx.accounts.trading_config;
    
    // Validate token mint matches theme
    require!(
        ctx.accounts.token_mint.key() == theme.token_mint,
        ConsensusError::InvalidMint
    );
    
    require!(
        theme.status == THEME_STATUS_ACTIVE,
        ConsensusError::InvalidTheme
    );
    require!(
        token_amount >= MIN_TOKEN_STAKE,
        ConsensusError::InvalidAmount
    );
    // Token balance will be checked by the token program during transfer
    
    // Calculate SOL out using bonding curve
    let sol_out = calculate_sell_sol(
        token_amount,
        theme.token_reserves,
        theme.sol_reserves,
        config.trade_fee_bps,
    )?;
    
    require!(
        sol_out >= min_sol_out,
        ConsensusError::SlippageExceeded
    );
    require!(
        sol_out <= theme.sol_reserves,
        ConsensusError::InsufficientReserves
    );
    
    // Calculate fees (already deducted in calculate_sell_sol)
    let sol_before_fee = calculate_sell_sol(
        token_amount,
        theme.token_reserves,
        theme.sol_reserves,
        0, // No fee to get gross amount
    )?;
    
    let total_fee = sol_before_fee
        .checked_sub(sol_out)
        .ok_or(ConsensusError::Overflow)?;
    
    let buyback_fee = (total_fee as u128)
        .checked_mul(config.buyback_fee_split_bps as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)? as u64;
    
    let platform_fee = (total_fee as u128)
        .checked_mul(config.platform_fee_split_bps as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)? as u64;
    
    let creator_fee = (total_fee as u128)
        .checked_mul(config.creator_fee_split_bps as u128)
        .ok_or(ConsensusError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(ConsensusError::DivisionByZero)? as u64;
    
    // Transfer tokens from user to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        token_amount,
    )?;
    
    // Transfer SOL from vault to user
    let creator_key = theme.creator;
    let theme_id_bytes = theme.theme_id.to_le_bytes();
    let vault_seeds = &[
        b"theme_vault",
        creator_key.as_ref(),
        theme_id_bytes.as_ref(),
        &[theme.vault_bump],
    ];
    let _signer = &[&vault_seeds[..]];
    
    **ctx.accounts.vault_sol_account.try_borrow_mut_lamports()? = ctx.accounts.vault_sol_account.lamports()
        .checked_sub(sol_out)
        .ok_or(ConsensusError::Overflow)?;
    **ctx.accounts.user.try_borrow_mut_lamports()? = ctx.accounts.user.lamports()
        .checked_add(sol_out)
        .ok_or(ConsensusError::Overflow)?;
    
    // Update theme state
    theme.sol_reserves = theme.sol_reserves
        .checked_sub(sol_before_fee)
        .ok_or(ConsensusError::Overflow)?;
    theme.token_reserves = theme.token_reserves
        .checked_add(token_amount)
        .ok_or(ConsensusError::Overflow)?;
    theme.buyback_pool = theme.buyback_pool
        .checked_add(buyback_fee)
        .ok_or(ConsensusError::Overflow)?;
    // 移除统计字段更新
    
    emit!(TokensSwapped {
        theme: theme.key(),
        user: ctx.accounts.user.key(),
        sol_amount: sol_out,
        token_amount,
        is_buy: false,
        new_sol_reserves: theme.sol_reserves,
        new_token_reserves: theme.token_reserves,
    });
    
    msg!("Swapped {} tokens for {} SOL", token_amount, sol_out);
    msg!("New reserves - SOL: {}, Tokens: {}", theme.sol_reserves, theme.token_reserves);
    
    Ok(())
}
