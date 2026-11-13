-- SCRUM-6: admin-managed membership status, in addition to the existing joined_on, centre and belt.
-- Do not apply to the separate legacy Neon schema (different IDs/table structure).
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
  CHECK (membership_status IN ('active', 'suspended', 'inactive'));