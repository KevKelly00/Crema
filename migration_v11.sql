-- Likes
CREATE TABLE public.likes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  log_id     uuid REFERENCES public.coffee_logs ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, log_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can view likes"   ON likes FOR SELECT USING (is_approved());
CREATE POLICY "Approved users can like"         ON likes FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved());
CREATE POLICY "Users can unlike"                ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE TABLE public.comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  log_id     uuid REFERENCES public.coffee_logs ON DELETE CASCADE NOT NULL,
  body       text NOT NULL CHECK (length(body) > 0 AND length(body) <= 500),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved users can view comments"  ON comments FOR SELECT USING (is_approved());
CREATE POLICY "Approved users can comment"        ON comments FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved());
CREATE POLICY "Users can delete own comments"     ON comments FOR DELETE USING (auth.uid() = user_id);
