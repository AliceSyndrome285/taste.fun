# Taste.Fun Smart Contracts

A decentralized creative voting platform on Solana, featuring AI-powered image generation, community voting, and a bonding curve token mechanism.

## Overview

Taste.Fun consists of three interconnected Solana smart contracts built with the Anchor framework:

1. **taste-fun-core**: Core idea creation, voting, and lifecycle management
2. **taste-fun-settlement**: Voting settlement, reward distribution, and penalty enforcement
3. **taste-fun-token**: Theme token creation, trading via bonding curve, and buyback mechanisms

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Taste.Fun Ecosystem                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │  taste-fun-core  │  │ taste-fun-       │  │ taste-fun-│ │
│  │                  │  │ settlement       │  │ token     │ │
│  │ • Idea Creation  │  │                  │  │           │ │
│  │ • Image Gen      │  │ • Vote Settlement│  │ • Bonding │ │
│  │ • Voting         │  │ • Rewards        │  │   Curve   │ │
│  │ • Cancellation   │  │ • Penalties      │  │ • Token   │ │
│  └──────────────────┘  └──────────────────┘  │   Trading │ │
│                                               │ • Buyback │ │
│                                               └───────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) 1.75.0+
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) 1.18.0+
- [Anchor](https://www.anchor-lang.com/docs/installation) 0.30.0+
- [Node.js](https://nodejs.org/) 18+
- [Yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd taste.fun-smartcontract
```

2. Install dependencies:
```bash
yarn install
```

3. Build all programs:
```bash
anchor build
```

4. Run tests:
```bash
anchor test
```

### Deployment

1. Configure your Solana wallet:
```bash
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json
```

2. Ensure you have sufficient SOL:
```bash
solana airdrop 2
```

3. Deploy all programs:
```bash
anchor deploy
```

## Program IDs

### Devnet
- **taste_fun_core**: `qupK2NZtQcGSNHQubrbEvXeza1YVj4pdzx3tTf8opeL`
- **taste_fun_settlement**: `8h6AzALcR6R4baMkCdknJev8jyQerFYsgHaKcZV5kA78`
- **taste_fun_token**: `5AJyXAbob3Rzcq4H7JPiWHeh7csVaJRUosPUC1NcWzGS`

## Contract Details

### [taste-fun-core](./programs/taste-fun-core/README.md)

The core contract manages the entire idea lifecycle:

**Key Features:**
- Create ideas with AI image generation prompts
- Submit AI-generated images from DePIN providers
- Cast votes with token staking (4 options + RejectAll)
- Cancel ideas when generation fails
- Withdraw winnings or refunds

**Main Instructions:**
- `create_idea` - Submit a new creative idea
- `sponsored_create_idea` - Create sponsored idea
- `submit_images` - DePIN provider submits generated images
- `cast_vote` - Vote for an image option
- `withdraw_winnings` - Claim rewards after voting
- `cancel_idea` - Cancel failed generation
- `withdraw_refund` - Claim refund after cancellation

### [taste-fun-settlement](./programs/taste-fun-settlement/README.md)

Handles voting settlement and reward distribution:

**Key Features:**
- Time-weighted voting rewards (20% bonus for early voters)
- Quadratic voting support for fair influence
- Supermajority RejectAll mechanism (2/3 threshold)
- Platform and curator fee collection
- Automatic buyback triggering

**Main Instructions:**
- `settle_voting` - Settle completed voting round
- `cancel_voting` - Cancel voting with insufficient participation

**Reward Distribution:**
- Winners share the prize pool
- Early voters receive bonus rewards
- Platform fee: 2%
- Curator fee: 1%
- Penalty: 50% for losing voters

### [taste-fun-token](./programs/taste-fun-token/README.md)

Token management and bonding curve trading:

**Key Features:**
- Theme token creation with metadata
- Bonding curve DEX (buy/sell)
- Dynamic pricing based on supply
- Automated buyback mechanism
- Fee distribution (platform, creator, buyback)

**Main Instructions:**
- `initialize_trading_config` - Set global trading parameters
- `initialize_theme` - Create new theme with metadata
- `mint_initial_tokens` - Mint initial token supply
- `swap_sol_for_tokens` - Buy tokens with SOL
- `swap_tokens_for_sol` - Sell tokens for SOL
- `execute_buyback` - Execute token buyback

**Tokenomics:**
- Total Supply: 1B tokens (1,000,000,000)
- Decimals: 6
- Creator Reserve: 20%
- Initial Circulation: 80%
- Trading Fee: 1%
- Migration Threshold: 80 SOL

## Shared Library

The `shared-lib` crate contains common constants, enums, and utilities:

**Key Constants:**
- `MIN_REVIEWERS`: 10 (minimum voters)
- `CURATOR_FEE_BPS`: 100 (1%)
- `PLATFORM_FEE_BPS`: 200 (2%)
- `EARLY_BIRD_BONUS_BPS`: 2000 (20%)
- `REJECT_ALL_THRESHOLD_BPS`: 6667 (66.67%)
- `MIN_STAKE`: 0.01 SOL
- `CREATION_FEE`: 0.005 SOL

**Enums:**
- `IdeaStatus`: GeneratingImages, Voting, Completed, Cancelled
- `GenerationStatus`: Pending, Success, Failed
- `VotingMode`: Linear, Quadratic

## Workflow

```
1. Create Idea → 2. Generate Images → 3. Cast Votes → 4. Settle Voting → 5. Claim Rewards
                         ↓                                    ↓
                    (DePIN Provider)                     (Distribution)
                         ↓                                    ↓
                   Submit Images                        Winners + Early Voters
```

### Complete Flow Example

1. **Theme Setup** (Token Contract)
   - Initialize theme with name and description
   - Mint initial token supply (80% to bonding curve)

2. **Idea Creation** (Core Contract)
   - User submits prompt and stakes tokens
   - System assigns DePIN provider
   - 24-hour deadline for image generation

3. **Image Generation**
   - DePIN provider generates 4 images
   - Submits image URIs on-chain
   - Status changes to Voting

4. **Voting Period** (Core Contract)
   - Users stake tokens to vote
   - Options: Image 1-4 or RejectAll
   - 72-hour voting period (configurable)
   - Time-weighted rewards incentivize early participation

5. **Settlement** (Settlement Contract)
   - After voting deadline
   - Check minimum participation (10 voters)
   - Check RejectAll threshold (66.67%)
   - Calculate time-weighted rewards
   - Distribute prizes to winners
   - Collect platform and curator fees
   - Trigger buyback if threshold met

6. **Claim Phase**
   - Winners withdraw rewards
   - Losers can withdraw refund (50% penalty)
   - Automatic buyback execution

## Testing

Run the complete test suite:
```bash
anchor test
```

Run specific program tests:
```bash
anchor test --skip-local-validator programs/taste-fun-core
```

## Security Considerations

- ✅ All arithmetic operations use checked math
- ✅ Reentrancy protection via account validation
- ✅ PDA verification for all critical accounts
- ✅ Time-based constraints enforced
- ✅ Minimum participation requirements
- ✅ Slippage protection on swaps
- ⚠️ Requires external DePIN authorization
- ⚠️ Admin keys for emergency operations

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Links

- [Documentation](./docs)
- [Backend Service](../taste.fun-backend)
- [Frontend App](../apps/taste.fun)
- [Solana Docs](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)