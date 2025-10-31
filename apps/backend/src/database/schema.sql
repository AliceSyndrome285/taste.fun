-- Database Schema for taste.fun backend
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Themes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    pubkey VARCHAR(44) UNIQUE NOT NULL, -- Theme PDA
    theme_id BIGINT NOT NULL,
    creator_pubkey VARCHAR(44) NOT NULL,
    name VARCHAR(12) NOT NULL,
    description VARCHAR(48) NOT NULL,
    
    -- Token data
    token_mint VARCHAR(44) NOT NULL,
    total_supply BIGINT NOT NULL DEFAULT 1000000000000000, -- 1B tokens with 6 decimals
    circulating_supply BIGINT NOT NULL DEFAULT 800000000000000, -- 80%
    creator_reserve BIGINT NOT NULL DEFAULT 200000000000000, -- 20%
    token_reserves BIGINT NOT NULL DEFAULT 800000000000000,
    sol_reserves BIGINT NOT NULL DEFAULT 0,
    buyback_pool BIGINT NOT NULL DEFAULT 0,
    
    -- Voting mode and status
    voting_mode VARCHAR(20) NOT NULL DEFAULT 'Classic',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_voting_mode CHECK (voting_mode IN ('Classic', 'Reverse', 'MiddleWay')),
    CONSTRAINT valid_status CHECK (status IN ('Active', 'Migrated', 'Paused')),
    CONSTRAINT unique_theme_id UNIQUE(creator_pubkey, theme_id)
);

-- Indexes for themes
CREATE INDEX idx_themes_creator ON themes(creator_pubkey);
CREATE INDEX idx_themes_created_at ON themes(created_at DESC);
CREATE INDEX idx_themes_status ON themes(status);
CREATE INDEX idx_themes_token_mint ON themes(token_mint);

-- ============================================================================
-- Token Swaps Table (for price tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_swaps (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(88) NOT NULL,
    theme_pubkey VARCHAR(44) NOT NULL REFERENCES themes(pubkey) ON DELETE CASCADE,
    user_pubkey VARCHAR(44) NOT NULL,
    is_buy BOOLEAN NOT NULL,
    sol_amount BIGINT NOT NULL,
    token_amount BIGINT NOT NULL,
    sol_reserves_after BIGINT NOT NULL,
    token_reserves_after BIGINT NOT NULL,
    price_after DOUBLE PRECISION NOT NULL, -- SOL per token
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT positive_amounts CHECK (sol_amount > 0 AND token_amount > 0)
);

-- Indexes for token_swaps
CREATE INDEX idx_token_swaps_theme ON token_swaps(theme_pubkey);
CREATE INDEX idx_token_swaps_user ON token_swaps(user_pubkey);
CREATE INDEX idx_token_swaps_created_at ON token_swaps(created_at DESC);
CREATE INDEX idx_token_swaps_signature ON token_swaps(signature);

-- ============================================================================
-- Ideas Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ideas (
    id SERIAL PRIMARY KEY,
    pubkey VARCHAR(44) UNIQUE NOT NULL, -- Solana account public key
    idea_id BIGINT NOT NULL,
    theme_pubkey VARCHAR(44) NOT NULL REFERENCES themes(pubkey) ON DELETE CASCADE,
    initiator_pubkey VARCHAR(44) NOT NULL,
    sponsor_pubkey VARCHAR(44), -- NULL for non-sponsored ideas
    prompt TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'GeneratingImages',
    image_uris TEXT[] DEFAULT '{}', -- Array of image URIs
    generation_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    generation_deadline TIMESTAMPTZ NOT NULL,
    depin_provider VARCHAR(44) NOT NULL,
    
    -- Stake pool data
    total_staked BIGINT NOT NULL DEFAULT 0, -- in lamports
    initial_prize_pool BIGINT NOT NULL DEFAULT 0,
    min_stake BIGINT NOT NULL DEFAULT 10000000, -- 0.01 SOL
    curator_fee_bps SMALLINT NOT NULL DEFAULT 100, -- 1%
    
    -- Voting data (stores vote weights, not counts)
    votes BIGINT[] DEFAULT '{0,0,0,0}', -- 4 images
    reject_all_weight BIGINT NOT NULL DEFAULT 0,
    total_voters INTEGER NOT NULL DEFAULT 0,
    winning_image_index SMALLINT, -- NULL until settled
    
    -- Settlement data
    curator_fee_collected BIGINT NOT NULL DEFAULT 0,
    platform_fee_collected BIGINT NOT NULL DEFAULT 0,
    penalty_pool_amount BIGINT NOT NULL DEFAULT 0,
    winner_count BIGINT NOT NULL DEFAULT 0,
    
    -- Timestamps
    voting_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('GeneratingImages', 'Voting', 'Completed', 'Cancelled')),
    CONSTRAINT valid_generation_status CHECK (generation_status IN ('Pending', 'Completed', 'Failed')),
    CONSTRAINT valid_winning_index CHECK (winning_image_index IS NULL OR (winning_image_index >= 0 AND winning_image_index <= 3))
);

-- Indexes for ideas
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_theme ON ideas(theme_pubkey);
CREATE INDEX idx_ideas_initiator ON ideas(initiator_pubkey);
CREATE INDEX idx_ideas_created_at ON ideas(created_at DESC);
CREATE INDEX idx_ideas_voting_deadline ON ideas(voting_deadline DESC) WHERE status = 'Voting';
CREATE INDEX idx_ideas_total_staked ON ideas(total_staked DESC);
CREATE INDEX idx_ideas_total_voters ON ideas(total_voters DESC);

-- ============================================================================
-- Votes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    idea_pubkey VARCHAR(44) NOT NULL REFERENCES ideas(pubkey) ON DELETE CASCADE,
    voter_pubkey VARCHAR(44) NOT NULL,
    image_choice SMALLINT NOT NULL, -- 0-3 for images, 255 for RejectAll
    stake_amount BIGINT NOT NULL, -- in lamports
    vote_weight BIGINT NOT NULL, -- sqrt(stake_amount) for quadratic voting
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_winner BOOLEAN, -- NULL until settled
    winnings_withdrawn BOOLEAN NOT NULL DEFAULT FALSE,
    
    CONSTRAINT unique_vote_per_idea UNIQUE(idea_pubkey, voter_pubkey),
    CONSTRAINT valid_image_choice CHECK (image_choice IN (0, 1, 2, 3, 255)),
    CONSTRAINT positive_stake CHECK (stake_amount > 0)
);

-- Indexes for votes
CREATE INDEX idx_votes_idea ON votes(idea_pubkey);
CREATE INDEX idx_votes_voter ON votes(voter_pubkey);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX idx_votes_is_winner ON votes(is_winner) WHERE is_winner = TRUE;

-- ============================================================================
-- Reviewer Stakes Table (aggregated stake per reviewer per idea)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviewer_stakes (
    id SERIAL PRIMARY KEY,
    idea_pubkey VARCHAR(44) NOT NULL REFERENCES ideas(pubkey) ON DELETE CASCADE,
    reviewer_pubkey VARCHAR(44) NOT NULL,
    total_staked BIGINT NOT NULL DEFAULT 0,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    winnings BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_reviewer_per_idea UNIQUE(idea_pubkey, reviewer_pubkey)
);

-- Indexes for reviewer_stakes
CREATE INDEX idx_reviewer_stakes_idea ON reviewer_stakes(idea_pubkey);
CREATE INDEX idx_reviewer_stakes_reviewer ON reviewer_stakes(reviewer_pubkey);

-- ============================================================================
-- Processed Signatures Table (for idempotency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS processed_signatures (
    id SERIAL PRIMARY KEY,
    signature VARCHAR(88) UNIQUE NOT NULL, -- Base58 encoded signature
    slot BIGINT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for checking processed signatures
CREATE INDEX idx_processed_signatures_signature ON processed_signatures(signature);
CREATE INDEX idx_processed_signatures_slot ON processed_signatures(slot DESC);

-- ============================================================================
-- Sync State Table (track last processed slot for historical sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_state (
    id SERIAL PRIMARY KEY,
    last_processed_slot BIGINT NOT NULL,
    last_processed_signature VARCHAR(88),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial sync state
INSERT INTO sync_state (id, last_processed_slot, last_processed_signature)
VALUES (1, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ideas table
CREATE TRIGGER update_ideas_updated_at
    BEFORE UPDATE ON ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for reviewer_stakes table
CREATE TRIGGER update_reviewer_stakes_updated_at
    BEFORE UPDATE ON reviewer_stakes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View for active voting ideas
CREATE OR REPLACE VIEW active_voting_ideas AS
SELECT 
    i.*,
    COUNT(DISTINCT v.voter_pubkey) as actual_voters,
    SUM(v.stake_amount) as actual_total_staked
FROM ideas i
LEFT JOIN votes v ON i.pubkey = v.idea_pubkey
WHERE i.status = 'Voting'
GROUP BY i.id;

-- View for completed ideas with results
CREATE OR REPLACE VIEW completed_ideas_with_results AS
SELECT 
    i.*,
    COUNT(DISTINCT v.voter_pubkey) FILTER (WHERE v.is_winner = TRUE) as winner_voters,
    COUNT(DISTINCT v.voter_pubkey) FILTER (WHERE v.is_winner = FALSE) as loser_voters
FROM ideas i
LEFT JOIN votes v ON i.pubkey = v.idea_pubkey
WHERE i.status = 'Completed'
GROUP BY i.id;

-- View for user activity summary
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    voter_pubkey as user_pubkey,
    COUNT(*) as total_votes,
    SUM(stake_amount) as total_staked,
    COUNT(*) FILTER (WHERE is_winner = TRUE) as winning_votes,
    SUM(CASE WHEN is_winner = TRUE THEN stake_amount ELSE 0 END) as winning_stakes
FROM votes
GROUP BY voter_pubkey;

-- ============================================================================
-- Grant Permissions (adjust as needed)
-- ============================================================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taste_fun_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taste_fun_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO taste_fun_user;
