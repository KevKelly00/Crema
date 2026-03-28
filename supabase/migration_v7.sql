-- Run in Supabase → SQL Editor

ALTER TABLE public.beans
  ADD COLUMN IF NOT EXISTS roast_date date;

ALTER TABLE public.coffee_logs
  ADD COLUMN IF NOT EXISTS bean_id uuid REFERENCES public.beans(id) ON DELETE SET NULL;
