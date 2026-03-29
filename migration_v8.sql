-- Track when AI rating was applied (used for per-day rate limiting)
ALTER TABLE coffee_logs ADD COLUMN IF NOT EXISTS ai_rated_at timestamptz;
