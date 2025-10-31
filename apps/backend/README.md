# Taste.Fun Backend Service

Backend service for the taste.fun project - handling blockchain event indexing, API services, and DePIN integration.

## Features

- 🔗 **Solana Event Indexer**: Real-time monitoring and indexing of smart contract events
- 🗄️ **PostgreSQL Database**: Structured storage of ideas, votes, and user activities
- 🚀 **REST API**: Comprehensive endpoints for frontend data consumption
- 📡 **WebSocket Server**: Real-time updates pushed to connected clients
- 🎨 **IPFS Integration**: Secure image upload and storage service
- 🤖 **DePIN Integration**: AI image generation via io.net services
- 🔄 **Task Queue**: Reliable background job processing with BullMQ
- 🛡️ **Idempotent Processing**: Prevents duplicate event handling
- 📊 **Historical Sync**: Catches up missed events after downtime

## Architecture

```
taste-fun-backend/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── config/                  # Configuration management
│   ├── database/                # Database schemas and migrations
│   ├── services/
│   │   ├── indexer/            # Blockchain event listener
│   │   ├── api/                # REST API server
│   │   ├── websocket/          # Real-time WebSocket server
│   │   ├── ipfs/               # Image upload service
│   │   ├── depin/              # DePIN integration
│   │   └── queue/              # Task queue management
│   ├── models/                  # Data models
│   ├── handlers/                # Event handlers
│   ├── utils/                   # Utility functions
│   └── types/                   # TypeScript type definitions
├── package.json
├── tsconfig.json
└── .env.example
```

## Quick Start

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- Redis 6+ (for task queue)
- Solana CLI (optional, for testing)

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd taste-fun-backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up database:
```bash
npm run db:migrate
```

5. Start development server:
```bash
npm run dev
```

## Configuration

### Solana Network

- **RPC Endpoint**: QuickNode devnet endpoint (configured in .env)
- **WebSocket**: For real-time event subscription
- **Program ID**: `Cp8t3nkKdscJZozSgxxwGY2hwpnQDzKKkA8Ynceaz8UZ`

### Database Schema

The service uses PostgreSQL with the following main tables:

- `ideas`: Core idea/spark data
- `votes`: User votes and stakes
- `reviewer_stakes`: Aggregated stake information
- `processed_signatures`: Transaction tracking for idempotency

### IPFS Configuration

Two supported providers:
- **Pinata**: Set `IPFS_API_KEY` and `IPFS_SECRET_KEY`
- **Infura**: Set `IPFS_PROJECT_ID` and `IPFS_PROJECT_SECRET`

## API Endpoints

### Ideas

- `GET /api/ideas` - List all ideas with filtering
- `GET /api/ideas/:id` - Get idea details
- `GET /api/ideas/:id/votes` - Get votes for an idea

### Users

- `GET /api/users/:pubkey/activity` - Get user activity history

### Stats

- `GET /api/stats` - Platform-wide statistics

### Upload

- `POST /api/upload/images` - Upload images to IPFS

## Event Handling

The indexer monitors and processes the following contract events:

- `IdeaCreated` - New idea created
- `SponsoredIdeaCreated` - Sponsored idea created
- `ImagesGenerated` - AI images generated
- `VoteCast` - User vote recorded
- `VotingSettled` - Voting concluded
- `WinningsWithdrawn` - Winner claimed rewards
- `IdeaCancelled` - Idea cancelled
- `VotingCancelled` - Voting cancelled
- `RefundWithdrawn` - User claimed refund

## Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment Considerations

### Database

- Use connection pooling for high concurrency
- Set up regular backups
- Create indexes on frequently queried fields

### Scaling

- Run multiple indexer instances with Redis coordination
- Use load balancer for API servers
- Implement caching layer (Redis) for frequently accessed data

### Monitoring

- Log all events and errors
- Set up health check endpoints
- Monitor WebSocket connection count
- Track task queue metrics

## Security

- Never expose IPFS API keys to frontend
- Use secure WebSocket connections (WSS) in production
- Validate all user inputs
- Implement rate limiting on API endpoints
- Store sensitive keys in secure key management service

## License

MIT
