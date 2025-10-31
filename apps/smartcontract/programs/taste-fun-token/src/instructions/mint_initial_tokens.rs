use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, Token, TokenAccount, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use taste_fun_shared::*;
use crate::{Theme, ThemeVault};

/// 步骤1: 初始化vault和mint（拆分以减少栈使用）
#[derive(Accounts)]
#[instruction(theme_id: u64)]
pub struct InitVaultAndMint<'info> {
    #[account(
        mut,
        seeds = [b"theme", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump = theme.theme_bump
    )]
    pub theme: Account<'info, Theme>,

    #[account(
        init,
        payer = creator,
        space = 8 + ThemeVault::SPACE,
        seeds = [b"theme_vault", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: Account<'info, ThemeVault>,

    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = vault,
        seeds = [b"theme_mint", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// 步骤2: 铸造代币并分配（拆分以减少栈使用）
#[derive(Accounts)]
#[instruction(theme_id: u64)]
pub struct MintInitialTokens<'info> {
    #[account(
        mut,
        seeds = [b"theme", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump = theme.theme_bump
    )]
    pub theme: Account<'info, Theme>,

    #[account(
        mut,
        seeds = [b"theme_vault", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump = theme.vault_bump
    )]
    pub vault: Account<'info, ThemeVault>,

    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// 步骤1: 初始化vault和mint
pub fn init_vault_and_mint(ctx: Context<InitVaultAndMint>, _theme_id: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let theme = &mut ctx.accounts.theme;
    
    // 初始化vault
    vault.theme = theme.key();
    vault.bump = ctx.bumps.vault;
    
    // 更新theme引用
    theme.vault_bump = ctx.bumps.vault;
    theme.token_mint = ctx.accounts.token_mint.key();
    
    Ok(())
}

/// 步骤2: 铸造初始代币供应量并分配
pub fn mint_initial_tokens(ctx: Context<MintInitialTokens>, theme_id: u64) -> Result<()> {
    // 铸造总供应量到vault
    mint_to_vault(&ctx, theme_id)?;
    
    // 计算并转移创建者储备
    let creator_reserve = calculate_creator_reserve()?;
    transfer_to_creator(&ctx, theme_id, creator_reserve)?;
    
    // 更新theme储备
    update_theme_reserves(&mut ctx.accounts.theme, creator_reserve)?;
    
    // 发出事件
    emit_theme_created_event(&ctx)?;
    
    Ok(())
}

/// 计算创建者储备 - 独立函数
#[inline(never)]
fn calculate_creator_reserve() -> Result<u64> {
    TOKEN_TOTAL_SUPPLY
        .checked_mul(CREATOR_RESERVE_PERCENT as u64)
        .and_then(|x| x.checked_div(100))
        .ok_or(ConsensusError::Overflow.into())
}

/// 铸造到vault - 优化版本，直接使用数组而非Vec
#[inline(never)]
fn mint_to_vault(ctx: &Context<MintInitialTokens>, theme_id: u64) -> Result<()> {
    let theme_id_bytes = theme_id.to_le_bytes();
    let bump_bytes = [ctx.accounts.theme.vault_bump];
    let creator_key = ctx.accounts.creator.key();
    
    let seeds: &[&[u8]] = &[
        b"theme_vault",
        creator_key.as_ref(),
        theme_id_bytes.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer = &[seeds];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        ),
        TOKEN_TOTAL_SUPPLY,
    )
}

/// 转移到创建者 - 优化版本，直接使用数组而非Vec
#[inline(never)]
fn transfer_to_creator(ctx: &Context<MintInitialTokens>, theme_id: u64, amount: u64) -> Result<()> {
    let theme_id_bytes = theme_id.to_le_bytes();
    let bump_bytes = [ctx.accounts.theme.vault_bump];
    let creator_key = ctx.accounts.creator.key();
    
    let seeds: &[&[u8]] = &[
        b"theme_vault",
        creator_key.as_ref(),
        theme_id_bytes.as_ref(),
        bump_bytes.as_ref(),
    ];
    let signer = &[seeds];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        ),
        amount,
    )
}

/// 更新theme储备 - 独立函数
#[inline(never)]
fn update_theme_reserves(theme: &mut Account<Theme>, creator_reserve: u64) -> Result<()> {
    theme.token_reserves = TOKEN_TOTAL_SUPPLY
        .checked_sub(creator_reserve)
        .ok_or(ConsensusError::Overflow)?;
    Ok(())
}

/// 发出事件 - 独立函数
#[inline(never)]
fn emit_theme_created_event(ctx: &Context<MintInitialTokens>) -> Result<()> {
    emit!(crate::ThemeCreated {
        theme: ctx.accounts.theme.key(),
        creator: ctx.accounts.creator.key(),
        token_mint: ctx.accounts.token_mint.key(),
        voting_mode: VotingMode::from_u8(ctx.accounts.theme.voting_mode)?,
        total_supply: ctx.accounts.theme.total_supply,
    });
    Ok(())
}

