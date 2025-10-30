# Taste.Fun - Decentralized Creative Prediction Market

## Overview

**Taste.Fun** is a revolutionary creative platform that combines AI-powered content generation, community voting, and token economics on Solana. It creates a self-sustaining economic flywheel where creative ideas are tokenized, AI generates content through DePIN (Decentralized Physical Infrastructure) networks, and users participate in prediction markets to earn rewards.

## 🌟 Core Concept

Taste.Fun transforms creative ideas into economic assets. When users create a theme, it automatically issues theme-specific tokens. Community members can then propose ideas under themes, have AI generate content variations, and participate in "taste games" - prediction markets where users stake tokens to vote on winning content.

## 🎯 Key Features

### 1. **Theme Tokenization**
- Create custom themes with auto-issued SPL tokens
- Bonding curve pricing mechanism for theme tokens
- Dynamic token trading with automatic price discovery
- 80 SOL migration threshold to external DEX

### 2. **AI-Powered Content Generation via DePIN**
- Decentralized GPU provider network integration
- AI generates 4 image/video variations per idea
- GPU providers earn theme tokens as rewards
- Broadcasting system for compute order matching
- Support for future io.net and Render Network integration

### 3. **Prediction Market "Taste Gamess"**
- Stake theme tokens to vote on favorite content
- 5 voting options: Image A-D or Reject All
- Time-weighted rewards (20% bonus for early voters)
- Prize pool from losing stakes distributed to winners
- Quadratic voting support for fair participation

### 4. **Economic Flywheel**
- **Winning Voters**: 80% of prize pool
- **Idea Curator**: 5% curation fee
- **DePIN GPU Providers**: 5% + theme token rewards
- **Platform**: 5% platform fee
- **Automatic Buyback**: 5% for token buyback

### 5. **Real-Time Activity Feed**
- Live updates on voting activities
- Token trading notifications
- DePIN order matching results
- Settlement announcements
- WebSocket-powered real-time sync

## 🏗️ Architecture

The project consists of three main components:

### **Smart Contracts** (Solana/Anchor)
```
taste-fun-smartcontract/
├── taste-fun-core          # Idea creation, voting, image submission
├── taste-fun-settlement    # Voting settlement and reward distribution
└── taste-fun-token         # Theme token minting and bonding curve trading
```

**Program IDs (Devnet):**
- `taste_fun_core`: `qupK2NZtQcGSNHQubrbEvXeza1YVj4pdzx3tTf8opeL`
- `taste_fun_settlement`: `8h6AzALcR6R4baMkCdknJev8jyQerFYsgHaKcZV5kA78`
- `taste_fun_token`: `5AJyXAbob3Rzcq4H7JPiWHeh7csVaJRUosPUC1NcWzGS`

### **Backend Service** (Node.js/TypeScript)
```
taste.fun-backend/
├── Event Indexer      # Real-time blockchain event monitoring
├── REST API           # Data endpoints for frontend
├── WebSocket Server   # Real-time push notifications
├── IPFS Integration   # Image storage service
└── DePIN Integration  # AI generation task queue
```

### **Frontend Application** (Next.js 14/React)
```
apps/taste.fun/
├── /                   # Explore themes and ideas
├── /theme/[id]         # Theme details, token trading, price charts
├── /spark              # Create new ideas with AI generation
├── /jury               # Vote on ideas (taste games)
├── /wallet             # User portfolio and earnings
└── /demo               # Full-featured demo mode
```

## 💡 How It Works

### **Complete User Journey**

1. **Create a Theme**
   - User submits theme name and description
   - Smart contract mints 1B SPL tokens
   - 80% goes to bonding curve, 20% reserved for creator
   - Theme appears on marketplace

2. **Spark an Idea**
   - User selects a theme and writes a creative prompt
   - DePIN network broadcasts AI generation order
   - GPU providers compete to accept the order
   - AI model generates 4 content variations
   - Images stored on IPFS, URIs recorded on-chain

3. **Taste Game (Voting)**
   - Users stake theme tokens on their preferred option
   - Voting period: 72 hours (configurable)
   - Early voters receive 20% time-weighted bonus
   - Minimum 10 voters required for settlement

4. **Settlement & Rewards**
   - Smart contract determines winning option
   - Prize pool distributed according to stakes
   - Winners receive 80% of losing stakes
   - Curator, GPU provider, platform receive fees
   - 5% triggers automatic token buyback

5. **Token Trading**
   - Users can trade theme tokens on bonding curve
   - Price increases with buy pressure
   - Price decreases with sell pressure
   - Automatic migration to external DEX at 80 SOL threshold

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30+
- PostgreSQL 14+ (for backend)
- Redis 6+ (for task queue)

### **Frontend Setup**
```bash
cd apps/taste.fun
npm install
npm run dev
```

### **Backend Setup**
```bash
cd taste.fun-backend
npm install
cp .env.example .env
# Configure database and Solana RPC
npm run db:migrate
npm run dev
```

### **Smart Contract Deployment**
```bash
cd taste.fun-smartcontract
anchor build
anchor deploy --provider.cluster devnet
```

### **Demo Mode**
Experience the full platform without blockchain:
```bash
cd apps/taste.fun
cp .env.local.example .env.local
# Set NEXT_PUBLIC_DEMO_MODE=true
npm run dev
# Visit http://localhost:3000/demo
```

## 🎮 Demo Mode Features

The `/demo` route provides a complete simulation with:
- ✅ Mock wallet and SOL balance
- ✅ Real-time theme token price updates
- ✅ Simulated DePIN AI generation (5-stage process)
- ✅ Live activity feed with notifications
- ✅ Token trading simulator with bonding curve
- ✅ Voting settlement with earnings breakdown
- ✅ All data updates automatically every 5-8 seconds

## 🌊 Growth Flywheel

```
More Ideas Created
      ↓
More Stakes in Voting
      ↓
Higher Prize Pools
      ↓
Token Buyback Increases
      ↓
Token Price Rises
      ↓
More Trading Activity
      ↓
More GPU Providers Attracted
      ↓
Faster AI Generation
      ↓
More Ideas Created ← (Loop)
```

## 🤝 DePIN Integration Strategy

While DePIN integration is currently simulated in the demo, the production roadmap includes:

- **GPU Order Broadcasting**: Automatic task distribution to decentralized compute networks
- **Provider Bidding**: GPU providers bid based on current theme token price
- **Dual Rewards**: Providers earn both platform tokens and DePIN network tokens
- **Quality Verification**: Smart contract validates generation completion
- **Target Platforms**: io.net, Render Network, Akash Network

This creates a powerful symbiotic relationship - prediction market revenue funds GPU providers, attracting more idle compute power to DePIN networks.

## 📊 Tokenomics

### **Theme Tokens**
- Total Supply: 1,000,000,000 (1B)
- Decimals: 6
- Creator Reserve: 20%
- Initial Bonding Curve: 80%
- Trading Fee: 1%
- Migration Threshold: 80 SOL liquidity

### **Fee Distribution**
- Winners: 80% of prize pool
- Curator: 5%
- GPU Provider: 5% + token rewards
- Platform: 5%
- Buyback: 5%

### **Voting Incentives**
- Early bird bonus: 20% extra rewards
- Minimum stake: 0.01 SOL
- Idea creation fee: 0.005 SOL
- Minimum voters: 10
- Reject All threshold: 66.67%

## 🛠️ Tech Stack

- **Blockchain**: Solana (Devnet)
- **Smart Contracts**: Anchor Framework (Rust)
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **State Management**: Zustand
- **Wallet**: Solana Wallet Adapter
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Queue**: BullMQ + Redis
- **Storage**: IPFS (Pinata)
- **Real-time**: WebSocket
- **Charts**: Recharts
- **Animations**: Framer Motion

## 🎯 Vision & Market Opportunity

Taste.Fun targets:

1. **Content Creators**: Fast funding for creative projects without traditional crowdfunding
2. **DePIN Providers**: High-frequency GPU consumption scenarios with dual token rewards
3. **Prediction Market Users**: Engaging prediction games with real economic incentives
4. **Token Traders**: Early access to theme tokens with bonding curve mechanics

**Market Size**: Multi-billion dollar opportunity in the convergence of:
- Prediction markets
- Creator economy
- Decentralized compute
- Meme token culture

## 📝 License

MIT License - see individual package LICENSE files for details.

## 🔗 Links

- **Frontend Demo**: /demo route
- **Smart Contracts**: taste.fun-smartcontract
- **Backend Service**: taste.fun-backend
- **Solana Devnet**: [Explorer](https://explorer.solana.com/?cluster=devnet)

## 🤖 Contributing

We welcome contributions! Please see individual package READMEs for specific development guidelines.

---

**Built for Solana Hackathon** - Empowering creators, incentivizing taste, and scaling DePIN through the power of prediction markets.