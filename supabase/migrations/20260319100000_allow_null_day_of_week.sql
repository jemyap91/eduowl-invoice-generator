-- Allow day_of_week to be NULL for bootcamp series (non-recurring)
-- The existing CHECK constraint rejects NULL, so drop and re-add it
ALTER TABLE class_series DROP CONSTRAINT IF EXISTS class_series_day_of_week_check;
ALTER TABLE class_series ADD CONSTRAINT class_series_day_of_week_check
  CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6);
