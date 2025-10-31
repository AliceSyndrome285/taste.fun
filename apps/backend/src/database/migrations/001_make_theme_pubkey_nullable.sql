-- Migration: Make theme_pubkey nullable in ideas table
-- Ideas and Themes are independent systems

-- Remove the NOT NULL constraint from theme_pubkey
ALTER TABLE ideas 
ALTER COLUMN theme_pubkey DROP NOT NULL;

-- Add comment to clarify
COMMENT ON COLUMN ideas.theme_pubkey IS 'Optional reference to theme. NULL for standalone ideas.';
