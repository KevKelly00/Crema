-- Run in Supabase → SQL Editor

ALTER TABLE public.coffee_logs
  ADD COLUMN IF NOT EXISTS ai_rating  numeric(2,1) CHECK (ai_rating >= 1.0 AND ai_rating <= 5.0),
  ADD COLUMN IF NOT EXISTS ai_tips    text;
