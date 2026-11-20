-- SCRUM-21: record grading results from the examiners, update the belt, keep a promotion log.
-- Safe to run more than once. Adds columns and tables only; existing rows are not changed.

-- Examiners are senior instructors. A rank here (e.g. '6th dan') marks an instructor as an examiner.
ALTER TABLE instructors ADD COLUMN IF NOT EXISTS examiner_rank TEXT;

-- More detail on each result. Results recorded before this have no session, application or recorder.
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS session_id     INTEGER REFERENCES grading_sessions(id) ON DELETE SET NULL;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS application_id INTEGER REFERENCES grading_applications(id) ON DELETE SET NULL;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS certificate_no TEXT;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS recorded_by    INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS recorded_at    TIMESTAMPTZ;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS updated_by     INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE gradings ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ;
-- One result per grading application
CREATE UNIQUE INDEX IF NOT EXISTS gradings_one_per_application ON gradings (application_id) WHERE application_id IS NOT NULL;

-- The examiner panel of each grading session (one chief, any number of assistants)
CREATE TABLE IF NOT EXISTS grading_examiners (
  session_id    INTEGER NOT NULL REFERENCES grading_sessions(id) ON DELETE CASCADE,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('chief', 'assistant')),
  PRIMARY KEY (session_id, instructor_id)
);

-- Every belt change made by this page: a pass, or a result corrected later
CREATE TABLE IF NOT EXISTS promotion_log (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_belt_id INTEGER REFERENCES belt_levels(id),
  to_belt_id   INTEGER REFERENCES belt_levels(id),
  grading_id   INTEGER REFERENCES gradings(id) ON DELETE SET NULL,
  session_id   INTEGER REFERENCES grading_sessions(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,                    -- 'Passed grading' or 'Result corrected: ...'
  changed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row every time a saved result is changed
CREATE TABLE IF NOT EXISTS grading_edits (
  id         SERIAL PRIMARY KEY,
  grading_id INTEGER NOT NULL REFERENCES gradings(id) ON DELETE CASCADE,
  edited_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  edited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_result TEXT NOT NULL,
  new_result TEXT NOT NULL,
  old_notes  TEXT,
  new_notes  TEXT,
  old_certificate_no TEXT,
  new_certificate_no TEXT,
  reason     TEXT NOT NULL
);

-- The "fee unpaid" tag reads this column from the fees work (SCRUM-25). Listed here too so this file works on its own.
ALTER TABLE fees ADD COLUMN IF NOT EXISTS grading_application_id INTEGER;
