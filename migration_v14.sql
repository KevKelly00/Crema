ALTER TABLE coffee_logs DROP CONSTRAINT IF EXISTS coffee_logs_art_rating_check;
ALTER TABLE coffee_logs DROP CONSTRAINT IF EXISTS coffee_logs_flavour_rating_check;

ALTER TABLE coffee_logs
  ADD CONSTRAINT coffee_logs_art_rating_check     CHECK (art_rating     >= 0 AND art_rating     <= 5),
  ADD CONSTRAINT coffee_logs_flavour_rating_check CHECK (flavour_rating >= 0 AND flavour_rating <= 5);
