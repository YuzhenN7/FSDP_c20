-- SCRUM-25 groundwork: two belt ladders with a grading fee per grade, and concession status on students.
-- Safe to run more than once. Adds columns only; no existing data is changed.

-- Which ladder a belt is on. Adults (13 and above) and juniors (under 13) climb separate ladders.
-- Order numbers: adult ladder 0-99, junior ladder from 100, so "next belt = order + 1" never crosses ladders.
ALTER TABLE belt_levels ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT 'adult'
  CHECK (track IN ('adult', 'junior'));

-- Fee charged to grade FOR this belt (empty for Mukyu: nobody grades for "no rank").
ALTER TABLE belt_levels ADD COLUMN IF NOT EXISTS grading_fee NUMERIC(10, 2)
  CHECK (grading_fee IS NULL OR grading_fee >= 0);

-- Same column the grading sessions work adds. Listed here too so this file works on its own.
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Discount status the admin records after seeing proof. Seniors (65+) need no entry: that comes from date_of_birth.
ALTER TABLE students ADD COLUMN IF NOT EXISTS concession TEXT NOT NULL DEFAULT 'none'
  CHECK (concession IN ('none', 'student', 'nsf'));
