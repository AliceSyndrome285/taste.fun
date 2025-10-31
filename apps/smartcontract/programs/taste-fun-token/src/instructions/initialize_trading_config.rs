use anchor_lang::prelude::*;
use crate::{TradingConfiguration};

#[derive(Accounts)]
pub struct InitializeTradingConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TradingConfiguration::SPACE,
        seeds = [b"trading_config"],
        bump
    )]
    pub trading_config: Account<'info, TradingConfiguration>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn initialize_trading_config(
    ctx: Context<InitializeTradingConfig>,
    trade_fee_bps: u16,
    buyback_fee_split_bps: u16,
    platform_fee_split_bps: u16,
    creator_fee_split_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.trading_config;
    
    // Validate that splits add up to 10000 (100%)
    require!(
        buyback_fee_split_bps + platform_fee_split_bps + creator_fee_split_bps == 10000,
        ErrorCode::InvalidFeeSplits
    );
    
    config.trade_fee_bps = trade_fee_bps;
    config.buyback_fee_split_bps = buyback_fee_split_bps;
    config.platform_fee_split_bps = platform_fee_split_bps;
    config.creator_fee_split_bps = creator_fee_split_bps;
    
    msg!("Trading configuration initialized");
    msg!("Trade fee: {} bps", trade_fee_bps);
    msg!("Buyback split: {} bps", buyback_fee_split_bps);
    msg!("Platform split: {} bps", platform_fee_split_bps);
    msg!("Creator split: {} bps", creator_fee_split_bps);
    
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("Fee splits must add up to 10000 (100%)")]
    InvalidFeeSplits,
}
