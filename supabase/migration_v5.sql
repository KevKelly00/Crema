-- Run in Supabase → SQL Editor

ALTER TABLE public.coffee_logs
  ADD COLUMN IF NOT EXISTS log_type      text DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS cafe_name     text,
  ADD COLUMN IF NOT EXISTS cafe_location text;
