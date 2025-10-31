use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::Mint;
use taste_fun_shared::*;
use crate::{Theme, ThemeVault, ThemeCreated};

/// Context for initializing a new theme - Step 1: Create theme account
#[derive(Accounts)]
#[instruction(theme_id: u64)]
pub struct InitializeThemeStep1<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Theme::INIT_SPACE,
        seeds = [b"theme", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump
    )]
    pub theme: Account<'info, Theme>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Context for initializing a new theme - Step 2: Create vault and mint
#[derive(Accounts)]
#[instruction(theme_id: u64)]
pub struct InitializeThemeStep2<'info> {
    #[account(
        mut,
        seeds = [b"theme", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump
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
    pub token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// For backward compatibility, keep the original struct but simplified
#[derive(Accounts)]
#[instruction(theme_id: u64)]
pub struct InitializeTheme<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Theme::INIT_SPACE,
        seeds = [b"theme", creator.key().as_ref(), theme_id.to_le_bytes().as_ref()],
        bump
    )]
    pub theme: Account<'info, Theme>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Helper function to convert voting mode enum to u8
#[inline(always)]
fn voting_mode_to_u8(voting_mode: VotingMode) -> u8 {
    match voting_mode {
        VotingMode::Classic => VOTING_MODE_CLASSIC,
        VotingMode::Reverse => VOTING_MODE_REVERSE,
        VotingMode::MiddleWay => VOTING_MODE_MIDDLE_WAY,
    }
}

/// Helper function to initialize theme data
#[inline(never)]
fn init_theme_data(
    theme: &mut Theme,
    creator: Pubkey,
    theme_id: u64,
    token_mint: Pubkey,
    timestamp: i64,
    voting_mode_u8: u8,
    vault_bump: u8,
    theme_bump: u8,
) {
    theme.creator = creator;
    theme.theme_id = theme_id;
    theme.created_at = timestamp;
    theme.token_mint = token_mint;
    theme.total_supply = TOKEN_TOTAL_SUPPLY;
    theme.circulating_supply = (TOKEN_TOTAL_SUPPLY / 100) * (CIRCULATING_PERCENT as u64);
    theme.creator_reserve = (TOKEN_TOTAL_SUPPLY / 100) * (CREATOR_RESERVE_PERCENT as u64);
    theme.token_reserves = theme.circulating_supply;
    theme.sol_reserves = INITIAL_SOL_RESERVES;
    theme.buyback_pool = 0;
    theme.voting_mode = voting_mode_u8;
    theme.status = THEME_STATUS_ACTIVE;
    theme.vault_bump = vault_bump;
    theme.theme_bump = theme_bump;
}

/// Helper function to initialize vault data
#[inline(never)]
fn init_vault_data(vault: &mut ThemeVault, theme_key: Pubkey, vault_bump: u8) {
    vault.theme = theme_key;
    vault.bump = vault_bump;
}

/// Helper function to emit theme created event
#[inline(never)]
fn emit_theme_created_event(
    theme_key: Pubkey,
    creator_key: Pubkey,
    token_mint_key: Pubkey,
    voting_mode: VotingMode,
) {
    emit!(ThemeCreated {
        theme: theme_key,
        creator: creator_key,
        token_mint: token_mint_key,
        voting_mode,
        total_supply: TOKEN_TOTAL_SUPPLY,
    });
}

/// Initializes a new theme - Step 1: Create theme account only
/// This reduces stack usage by splitting the initialization process
#[inline(never)]
pub fn initialize_theme(
    ctx: Context<InitializeTheme>,
    theme_id: u64,
    name: [u8; 12],
    description: [u8; 48],
    voting_mode: VotingMode,
) -> Result<()> {
    msg!("=== InitializeTheme START ===");
    msg!("Theme ID: {}", theme_id);

    // Initialize theme account only
    init_theme_basic_data(&mut ctx.accounts.theme, &ctx.accounts.creator, theme_id, name, description, voting_mode, ctx.bumps.theme)?;

    msg!("Theme account initialized: {}", ctx.accounts.theme.key());
    Ok(())
}

/// Helper function to initialize basic theme data (without vault/mint references)
#[inline(never)]
fn init_theme_basic_data(
    theme: &mut Theme,
    creator: &Signer,
    theme_id: u64,
    name: [u8; 12],
    description: [u8; 48],
    voting_mode: VotingMode,
    theme_bump: u8,
) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;
    let voting_mode_u8 = voting_mode_to_u8(voting_mode);
    
    theme.creator = creator.key();
    theme.theme_id = theme_id;
    theme.name = name;
    theme.description = description;
    theme.created_at = timestamp;
    theme.token_mint = Pubkey::default(); // Will be set in step 2
    theme.total_supply = TOKEN_TOTAL_SUPPLY;
    theme.circulating_supply = (TOKEN_TOTAL_SUPPLY / 100) * (CIRCULATING_PERCENT as u64);
    theme.creator_reserve = (TOKEN_TOTAL_SUPPLY / 100) * (CREATOR_RESERVE_PERCENT as u64);
    theme.token_reserves = theme.circulating_supply;
    theme.sol_reserves = INITIAL_SOL_RESERVES;
    theme.buyback_pool = 0;
    theme.voting_mode = voting_mode_u8;
    theme.status = THEME_STATUS_ACTIVE;
    theme.vault_bump = 0; // Will be set in step 2
    theme.theme_bump = theme_bump;
    
    Ok(())
}