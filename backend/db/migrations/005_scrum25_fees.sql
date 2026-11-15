-- SCRUM-25: the Fees page (raise grading fees, counter payments, settle / edit / void a charge).
-- Safe to run more than once. Existing fee rows are not changed.

-- A fee can now be voided (cancelled but kept on record). 'unpaid' stays as it is: the online
-- payment code looks for it. The page shows 'unpaid' as Pending, or Overdue once the due date passes.
ALTER TABLE fees DROP CONSTRAINT IF EXISTS fees_status_check;
ALTER TABLE fees ADD CONSTRAINT fees_status_check CHECK (status IN ('unpaid', 'paid', 'void'));

-- Who raised the charge and when (empty for fees that existed before this)
ALTER TABLE fees ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Which grading application a grading fee was raised for (id from grading_applications).
-- The index stops the same application being charged twice; a voided charge does not count.
ALTER TABLE fees ADD COLUMN IF NOT EXISTS grading_application_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS fees_one_per_grading_application
  ON fees (grading_application_id) WHERE grading_application_id IS NOT NULL AND status <> 'void';

-- Void record: the reason, the admin who signed it (password re-entered) and when
ALTER TABLE fees ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE fees ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- One row every time an unpaid charge's amount or due date is changed
CREATE TABLE IF NOT EXISTS fee_edits (
  id           SERIAL PRIMARY KEY,
  fee_id       INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  edited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  edited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_amount   NUMERIC(10, 2) NOT NULL,
  new_amount   NUMERIC(10, 2) NOT NULL,
  old_due_date DATE,
  new_due_date DATE,
  reason       TEXT NOT NULL
);
