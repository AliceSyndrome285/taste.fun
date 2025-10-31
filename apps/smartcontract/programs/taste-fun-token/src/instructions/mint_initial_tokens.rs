use anchor_lang::prelude::*;
use anchor_spl::token::{mint_to, transfer, Mint, Token, TokenAccount, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use taste_fun_shared::*;
use crate::{Theme, ThemeVault};

/// Context for minting the initial supply of tokens for a theme.
/// This instruction should be called after `initialize_theme`.
/// 基于pumpfun模式：预先铸造总供应量到vault，然后分配给创建者
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

    /// Vault的代币账户，存放流通供应量(80%)
    #[account(
        init,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// 创建者的代币账户，接收创建者储备(20%)
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

/// 铸造初始代币供应量并分配
/// 参考pumpfun：预先铸造总供应量，然后分配
#[inline(never)]
pub fn mint_initial_tokens(ctx: Context<MintInitialTokens>, theme_id: u64) -> Result<()> {
    let theme = &mut ctx.accounts.theme;

    msg!("=== MintInitialTokens START ===");
    msg!("Theme ID: {}", theme_id);

    // 初始化vault数据
    init_vault_data(&mut ctx.accounts.vault, theme.key(), ctx.bumps.vault)?;

    // 更新theme账户中的引用
    theme.vault_bump = ctx.bumps.vault;
    theme.token_mint = ctx.accounts.token_mint.key();

    msg!("Vault initialized: {}", ctx.accounts.vault.key());
    msg!("Token mint created: {}", ctx.accounts.token_mint.key());

    // 步骤1：铸造总供应量到vault的token账户
    let total_supply = TOKEN_TOTAL_SUPPLY;
    mint_total_supply_to_vault(
        &ctx.accounts.token_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.vault,
        &ctx.accounts.token_program,
        total_supply,
        ctx.bumps.vault,
        &ctx.accounts.creator.key(),
        theme_id,
    )?;

    msg!("Total supply {} tokens minted to vault", total_supply);

    // 步骤2：转移20%给创建者作为储备
    let creator_reserve = calculate_creator_reserve(total_supply)?;
    transfer_creator_reserve(
        &ctx.accounts.vault_token_account,
        &ctx.accounts.creator_token_account,
        &ctx.accounts.vault,
        &ctx.accounts.token_program,
        creator_reserve,
        ctx.bumps.vault,
        &ctx.accounts.creator.key(),
        theme_id,
    )?;

    msg!("Creator reserve {} tokens transferred", creator_reserve);

    // 步骤3：更新theme状态
    update_theme_after_minting(theme, total_supply, creator_reserve)?;

    msg!("Theme token reserves: {}", theme.token_reserves);
    msg!("Theme creator reserve: {}", theme.creator_reserve);
    
    // Emit ThemeCreated event now that theme is fully initialized
    emit!(crate::ThemeCreated {
        theme: theme.key(),
        creator: ctx.accounts.creator.key(),
        token_mint: ctx.accounts.token_mint.key(),
        voting_mode: VotingMode::from_u8(theme.voting_mode)?,
        total_supply: theme.total_supply,
    });
    
    msg!("ThemeCreated event emitted");
    msg!("=== MintInitialTokens COMPLETE ===");
    
    Ok(())
}

/// 初始化vault数据
#[inline(never)]
fn init_vault_data(vault: &mut ThemeVault, theme_key: Pubkey, vault_bump: u8) -> Result<()> {
    vault.theme = theme_key;
    vault.bump = vault_bump;
    Ok(())
}

/// 计算创建者储备（20%）
#[inline(always)]
fn calculate_creator_reserve(total_supply: u64) -> Result<u64> {
    total_supply
        .checked_mul(CREATOR_RESERVE_PERCENT as u64)
        .and_then(|x| x.checked_div(100))
        .ok_or(ConsensusError::Overflow.into())
}

/// 铸造总供应量到vault
#[inline(never)]
fn mint_total_supply_to_vault<'info>(
    token_mint: &Account<'info, Mint>,
    vault_token_account: &Account<'info, TokenAccount>,
    vault: &Account<'info, ThemeVault>,
    token_program: &Program<'info, Token>,
    total_supply: u64,
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

    mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            MintTo {
                mint: token_mint.to_account_info(),
                to: vault_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer,
        ),
        total_supply,
    )?;

    Ok(())
}

/// 转移创建者储备
#[inline(never)]
fn transfer_creator_reserve<'info>(
    vault_token_account: &Account<'info, TokenAccount>,
    creator_token_account: &Account<'info, TokenAccount>,
    vault: &Account<'info, ThemeVault>,
    token_program: &Program<'info, Token>,
    creator_reserve: u64,
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

    transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault_token_account.to_account_info(),
                to: creator_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer,
        ),
        creator_reserve,
    )?;

    Ok(())
}

/// 更新theme状态
#[inline(never)]
fn update_theme_after_minting(
    theme: &mut Theme,
    total_supply: u64,
    creator_reserve: u64,
) -> Result<()> {
    // 流通供应量 = 总供应量 - 创建者储备（剩余在vault中）
    theme.token_reserves = total_supply
        .checked_sub(creator_reserve)
        .ok_or(ConsensusError::Overflow)?;
    
    // 其他字段在initialize_theme中已设置
    // theme.total_supply, theme.circulating_supply, theme.creator_reserve 已设置

    Ok(())
}