-- SCRUM-17: terms / weekly-class links / staff-recorded holidays.
-- Apply to the main-branch schema only; classes(id) must already exist.
CREATE TABLE IF NOT EXISTS terms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_term_range CHECK (end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS term_class_schedule (
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, class_id)
);
CREATE TABLE IF NOT EXISTS public_holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT NOT NULL
);
