BEGIN;

-- FOUNDATION: organisation, user roles, belt levels and student records
CREATE TABLE dojos (
    dojo_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    location_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE venues (
    venue_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dojo_id BIGINT NOT NULL REFERENCES dojos(dojo_id),
    name VARCHAR(120) NOT NULL,
    capacity INTEGER CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (dojo_id, name)
);

CREATE TABLE belt_levels (
    belt_level_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE CHECK (sort_order > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student', 'instructor')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_users_email_case_insensitive ON users (LOWER(email));

CREATE TABLE students (
    student_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(user_id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    principal_dojo_id BIGINT NOT NULL REFERENCES dojos(dojo_id),
    current_belt_id BIGINT NOT NULL REFERENCES belt_levels(belt_level_id),
    membership_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'inactive', 'suspended')),
    last_promotion_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_students_email_case_insensitive ON students (LOWER(email));
CREATE INDEX idx_students_principal_dojo ON students(principal_dojo_id);

CREATE TABLE instructors (
    instructor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(user_id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX uq_instructors_email_case_insensitive ON instructors (LOWER(email));

CREATE TABLE instructor_availability (
    availability_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_id BIGINT NOT NULL REFERENCES instructors(instructor_id),
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- ISO: Mon=1, Sun=7
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CHECK (end_time > start_time)
);

-- TERMS, PUBLIC HOLIDAYS AND RECURRING CLASS SCHEDULES
CREATE TABLE terms (
    term_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CHECK (end_date >= start_date)
);

CREATE TABLE term_holidays (
    holiday_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term_id BIGINT NOT NULL REFERENCES terms(term_id),
    holiday_date DATE NOT NULL,
    description VARCHAR(200) NOT NULL,
    UNIQUE (term_id, holiday_date)
);

CREATE TABLE class_schedules (
    class_schedule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term_id BIGINT NOT NULL REFERENCES terms(term_id),
    dojo_id BIGINT NOT NULL REFERENCES dojos(dojo_id),
    class_type VARCHAR(50) NOT NULL, -- e.g. kids, adults, beginners
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_time > start_time)
);
CREATE INDEX idx_class_schedules_term_weekday ON class_schedules(term_id, weekday);

CREATE TABLE class_assignments (
    class_assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_schedule_id BIGINT NOT NULL REFERENCES class_schedules(class_schedule_id),
    instructor_id BIGINT NOT NULL REFERENCES instructors(instructor_id),
    venue_id BIGINT NOT NULL REFERENCES venues(venue_id),
    UNIQUE(class_schedule_id, instructor_id)
);

-- GRADING: fields type/dojo/venue deliberately match teammate's gradingModel.js INSERT
-- Values for dojo and venue are numeric IDs, not text names.
CREATE TABLE grading_sessions (
    session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mass', 'private')),
    dojo BIGINT NOT NULL REFERENCES dojos(dojo_id),
    venue BIGINT REFERENCES venues(venue_id),
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
    apply_open DATE,
    apply_close DATE,
    capacity INTEGER CHECK (capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    CHECK (apply_open IS NULL OR apply_close IS NULL OR apply_close >= apply_open)
);

CREATE TABLE grading_session_instructors (
    session_id BIGINT NOT NULL REFERENCES grading_sessions(session_id),
    instructor_id BIGINT NOT NULL REFERENCES instructors(instructor_id),
    PRIMARY KEY (session_id, instructor_id)
);

CREATE TABLE grading_applications (
    application_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES grading_sessions(session_id),
    student_id BIGINT NOT NULL REFERENCES students(student_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by_user_id BIGINT REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(session_id, student_id)
);

CREATE TABLE grading_results (
    result_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL UNIQUE REFERENCES grading_applications(application_id),
    result VARCHAR(20) NOT NULL CHECK (result IN ('pass', 'fail')),
    previous_belt_id BIGINT REFERENCES belt_levels(belt_level_id),
    new_belt_id BIGINT REFERENCES belt_levels(belt_level_id),
    recorded_by_user_id BIGINT REFERENCES users(user_id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- FEES, PACKAGES, STUDENT CHARGES AND PAYMENT ATTEMPTS
CREATE TABLE fee_types (
    fee_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    default_amount NUMERIC(10,2) NOT NULL CHECK (default_amount >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE fee_packages (
    fee_package_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE fee_package_items (
    fee_package_id BIGINT NOT NULL REFERENCES fee_packages(fee_package_id),
    fee_type_id BIGINT NOT NULL REFERENCES fee_types(fee_type_id),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (fee_package_id, fee_type_id)
);

CREATE TABLE student_fees (
    student_fee_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(student_id),
    fee_type_id BIGINT REFERENCES fee_types(fee_type_id),
    fee_package_id BIGINT REFERENCES fee_packages(fee_package_id),
    description VARCHAR(200),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    due_date DATE NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK ((fee_type_id IS NOT NULL) <> (fee_package_id IS NOT NULL))
);
CREATE INDEX idx_student_fees_student ON student_fees(student_id);

CREATE TABLE payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_fee_id BIGINT NOT NULL REFERENCES student_fees(student_fee_id),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method VARCHAR(30) NOT NULL CHECK (method IN ('stripe', 'cash', 'bank_transfer', 'other')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'voided')),
    stripe_payment_intent_id VARCHAR(200) UNIQUE,
    stripe_checkout_session_id VARCHAR(200) UNIQUE,
    received_at TIMESTAMPTZ,
    recorded_by_user_id BIGINT REFERENCES users(user_id),
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status <> 'succeeded' OR received_at IS NOT NULL)
);
CREATE INDEX idx_payments_student_fee ON payments(student_fee_id);

-- Stripe webhook event IDs should be unique to support idempotent handling.
CREATE TABLE payment_events (
    event_id VARCHAR(200) PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reminder_rules (
    rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    days_relative_to_due_date INTEGER NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id BIGINT REFERENCES students(student_id),
    student_fee_id BIGINT REFERENCES student_fees(student_fee_id),
    grading_result_id BIGINT REFERENCES grading_results(result_id),
    notification_type VARCHAR(30) NOT NULL
        CHECK (notification_type IN ('payment_reminder', 'promotion', 'other')),
    destination_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    document_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id BIGINT REFERENCES students(student_id),
    title VARCHAR(200) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL, -- reference to file in secure object storage; not file bytes
    uploaded_by_user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Views simplify commonly needed admin/student screens.
-- This view excludes configured term holiday dates from actual recurring class dates.
CREATE VIEW v_class_occurrences AS
SELECT
    cs.class_schedule_id,
    cs.term_id,
    cs.dojo_id,
    cs.class_type,
    days.class_date::DATE AS class_date,
    cs.start_time,
    cs.end_time
FROM class_schedules cs
JOIN terms t ON t.term_id = cs.term_id
CROSS JOIN LATERAL generate_series(
    t.start_date::TIMESTAMP,
    t.end_date::TIMESTAMP,
    INTERVAL '1 day'
) AS days(class_date)
WHERE cs.is_active = TRUE
  AND EXTRACT(ISODOW FROM days.class_date) = cs.weekday
  AND NOT EXISTS (
      SELECT 1 FROM term_holidays h
      WHERE h.term_id = cs.term_id
        AND h.holiday_date = days.class_date::DATE
  );

-- Outstanding fee balances count only confirmed, non-voided payments.
CREATE VIEW v_student_fee_balances AS
SELECT
    sf.student_fee_id,
    sf.student_id,
    sf.description,
    sf.amount AS fee_amount,
    sf.due_date,
    COALESCE(SUM(p.amount), 0)::NUMERIC(10,2) AS amount_paid,
    GREATEST(sf.amount - COALESCE(SUM(p.amount), 0), 0)::NUMERIC(10,2) AS outstanding_amount
FROM student_fees sf
LEFT JOIN payments p
    ON p.student_fee_id = sf.student_fee_id AND p.status = 'succeeded'
WHERE sf.is_voided = FALSE
GROUP BY sf.student_fee_id, sf.student_id, sf.description, sf.amount, sf.due_date;

COMMIT;


-- ======================================================================
-- ORIGINAL FICTIONAL DATA
-- ======================================================================

BEGIN;

INSERT INTO dojos (name, location_description) VALUES
    ('Demo Central Dojo', 'Fictional development location'),
    ('Demo North Dojo', 'Fictional development location');

INSERT INTO venues (dojo_id, name, capacity)
SELECT dojo_id, 'Main Hall', 30 FROM dojos WHERE name = 'Demo Central Dojo';
INSERT INTO venues (dojo_id, name, capacity)
SELECT dojo_id, 'Training Room', 16 FROM dojos WHERE name = 'Demo North Dojo';

-- Placeholder progression names; replace with stakeholder-approved belt levels.
INSERT INTO belt_levels (name, sort_order) VALUES
    ('Demo Beginner A', 1),
    ('Demo Beginner B', 2),
    ('Demo Intermediate', 3);

INSERT INTO students (full_name, email, date_of_birth, principal_dojo_id, current_belt_id, membership_status)
SELECT 'Demo Student One', 'student.one@example.com', DATE '2005-05-10',
       d.dojo_id, b.belt_level_id, 'active'
FROM dojos d CROSS JOIN belt_levels b
WHERE d.name = 'Demo Central Dojo' AND b.name = 'Demo Beginner A';

INSERT INTO students (full_name, email, date_of_birth, principal_dojo_id, current_belt_id, membership_status)
SELECT 'Demo Student Two', 'student.two@example.com', DATE '2008-11-18',
       d.dojo_id, b.belt_level_id, 'active'
FROM dojos d CROSS JOIN belt_levels b
WHERE d.name = 'Demo North Dojo' AND b.name = 'Demo Beginner B';

INSERT INTO students (full_name, email, date_of_birth, principal_dojo_id, current_belt_id, membership_status)
SELECT 'Demo Student Three', 'student.three@example.com', DATE '2002-02-09',
       d.dojo_id, b.belt_level_id, 'inactive'
FROM dojos d CROSS JOIN belt_levels b
WHERE d.name = 'Demo Central Dojo' AND b.name = 'Demo Intermediate';

INSERT INTO terms (name, start_date, end_date)
VALUES ('Demo Term 1 (2027)', DATE '2027-01-04', DATE '2027-03-26');

-- Not an official Singapore public holiday. This fictional date tests the exclusion rule.
INSERT INTO term_holidays (term_id, holiday_date, description)
SELECT term_id, DATE '2027-02-15', 'Fictional holiday / no-class test date'
FROM terms WHERE name = 'Demo Term 1 (2027)';

INSERT INTO class_schedules (term_id, dojo_id, class_type, weekday, start_time, end_time)
SELECT t.term_id, d.dojo_id, 'beginners', 1, TIME '18:00', TIME '19:00'
FROM terms t CROSS JOIN dojos d
WHERE t.name = 'Demo Term 1 (2027)' AND d.name = 'Demo Central Dojo';

INSERT INTO class_schedules (term_id, dojo_id, class_type, weekday, start_time, end_time)
SELECT t.term_id, d.dojo_id, 'kids', 3, TIME '16:00', TIME '17:00'
FROM terms t CROSS JOIN dojos d
WHERE t.name = 'Demo Term 1 (2027)' AND d.name = 'Demo North Dojo';

INSERT INTO instructors (full_name, email)
VALUES ('Demo Instructor One', 'instructor.one@example.com');

INSERT INTO instructor_availability (instructor_id, weekday, start_time, end_time)
SELECT instructor_id, 1, TIME '17:00', TIME '20:00'
FROM instructors WHERE email = 'instructor.one@example.com';

INSERT INTO class_assignments (class_schedule_id, instructor_id, venue_id)
SELECT c.class_schedule_id, i.instructor_id, v.venue_id
FROM class_schedules c
JOIN dojos d ON d.dojo_id = c.dojo_id
JOIN venues v ON v.dojo_id = d.dojo_id AND v.name = 'Main Hall'
CROSS JOIN instructors i
WHERE c.class_type = 'beginners' AND d.name = 'Demo Central Dojo'
  AND i.email = 'instructor.one@example.com';

INSERT INTO grading_sessions
    (type, dojo, venue, session_date, session_time, fee, apply_open, apply_close, capacity)
SELECT 'mass', d.dojo_id, v.venue_id, DATE '2027-03-13', TIME '10:00',
       100.00, DATE '2027-02-01', DATE '2027-03-01', 20
FROM dojos d JOIN venues v ON v.dojo_id = d.dojo_id
WHERE d.name = 'Demo Central Dojo' AND v.name = 'Main Hall';

INSERT INTO grading_applications (session_id, student_id, status)
SELECT gs.session_id, s.student_id, 'approved'
FROM grading_sessions gs CROSS JOIN students s
WHERE gs.type = 'mass' AND s.email = 'student.one@example.com';

INSERT INTO fee_types (name, default_amount) VALUES
    ('Demo Membership Fee', 120.00),
    ('Demo Grading Fee', 100.00);

INSERT INTO fee_packages (name) VALUES ('Demo Standard Package');
INSERT INTO fee_package_items (fee_package_id, fee_type_id, amount)
SELECT fp.fee_package_id, ft.fee_type_id, 120.00
FROM fee_packages fp CROSS JOIN fee_types ft
WHERE fp.name = 'Demo Standard Package' AND ft.name = 'Demo Membership Fee';

INSERT INTO student_fees (student_id, fee_type_id, description, amount, due_date)
SELECT s.student_id, ft.fee_type_id, 'Demo Term Membership', 120.00, DATE '2027-01-31'
FROM students s CROSS JOIN fee_types ft
WHERE s.email = 'student.one@example.com' AND ft.name = 'Demo Membership Fee';

INSERT INTO student_fees (student_id, fee_type_id, description, amount, due_date)
SELECT s.student_id, ft.fee_type_id, 'Demo Term Membership', 120.00, DATE '2027-01-31'
FROM students s CROSS JOIN fee_types ft
WHERE s.email = 'student.two@example.com' AND ft.name = 'Demo Membership Fee';

INSERT INTO payments (student_fee_id, amount, method, status, received_at)
SELECT sf.student_fee_id, 120.00, 'cash', 'succeeded', NOW()
FROM student_fees sf JOIN students s ON s.student_id = sf.student_id
WHERE s.email = 'student.one@example.com';

-- Second student has paid part of a 120.00 fee, leaving a 70.00 outstanding balance.
INSERT INTO payments (student_fee_id, amount, method, status, received_at)
SELECT sf.student_fee_id, 50.00, 'bank_transfer', 'succeeded', NOW()
FROM student_fees sf JOIN students s ON s.student_id = sf.student_id
WHERE s.email = 'student.two@example.com';

INSERT INTO payments (student_fee_id, amount, method, status)
SELECT sf.student_fee_id, 70.00, 'stripe', 'failed'
FROM student_fees sf JOIN students s ON s.student_id = sf.student_id
WHERE s.email = 'student.two@example.com';

INSERT INTO reminder_rules (name, days_relative_to_due_date)
VALUES ('Demo: three days before due date', -3);

COMMIT;


-- ======================================================================
-- SOP UPDATE MIGRATION
-- ======================================================================

BEGIN;

-- Members must have joined at least three months before applying (SOP page 1).
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS membership_start_date DATE,
    ADD COLUMN IF NOT EXISTS membership_number VARCHAR(60);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_membership_number
    ON students (membership_number) WHERE membership_number IS NOT NULL;

-- Mark the business purpose of an assigned fee, without changing original amounts.
ALTER TABLE fee_types ADD COLUMN IF NOT EXISTS fee_category VARCHAR(20)
    NOT NULL DEFAULT 'other'
    CHECK (fee_category IN ('membership','grading','late_submission','other'));

-- The existing payments.method category is retained for backward compatibility.
-- payment_channel records the SOP's actual external channel (PayNow/Glofox),
-- while verification must be recorded before staff mark a manual payment succeeded.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(25)
        CHECK (payment_channel IN ('stripe','paynow','glofox','cash','bank_transfer','other')),
    ADD COLUMN IF NOT EXISTS external_transaction_reference VARCHAR(160),
    ADD COLUMN IF NOT EXISTS payment_evidence_document_id BIGINT REFERENCES documents(document_id),
    ADD COLUMN IF NOT EXISTS verified_by_user_id BIGINT REFERENCES users(user_id),
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Reference to uploaded evidence, not physical documents stored in PostgreSQL.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(30)
    NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('training_proof','membership_book','payment_proof',
                            'yudansha_form','certificate','other'));

-- One rule per belt grade/audience/source revision.  The published SOP distinguishes
-- children and adults, and variants such as Kyu 6 Blue versus Blue Silver.
-- Numeric requirements are advisory metadata: do not auto-approve solely on these.
CREATE TABLE IF NOT EXISTS grading_grade_rules (
    grade_rule_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    belt_level_id BIGINT NOT NULL REFERENCES belt_levels(belt_level_id),
    audience VARCHAR(12) NOT NULL CHECK (audience IN ('children','adults')),
    grade_label VARCHAR(80) NOT NULL,
    fee_amount NUMERIC(10,2) NOT NULL CHECK (fee_amount >= 0),
    training_requirement_text TEXT,
    min_months INTEGER CHECK (min_months >= 0),
    max_months INTEGER CHECK (max_months >= min_months),
    min_sessions INTEGER CHECK (min_sessions >= 0),
    min_age_years INTEGER CHECK (min_age_years >= 0),
    max_age_years INTEGER CHECK (max_age_years >= min_age_years),
    requires_weapon_assessment BOOLEAN NOT NULL DEFAULT FALSE,
    source_revision VARCHAR(20) NOT NULL DEFAULT '2025-09',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (belt_level_id, source_revision)
);

-- Application target is recorded as an SOP fee/requirement rule; historical fee
-- amounts, once charged, remain snapshotted in student_fees.amount.
ALTER TABLE grading_applications ADD COLUMN IF NOT EXISTS grade_rule_id BIGINT
    REFERENCES grading_grade_rules(grade_rule_id);

-- Applications require proof of training and membership book/fee verification.
-- False = not yet verified, NOT proof that the student has failed eligibility.
CREATE TABLE IF NOT EXISTS grading_application_checks (
    application_id BIGINT PRIMARY KEY REFERENCES grading_applications(application_id),
    training_proof_verified BOOLEAN NOT NULL DEFAULT FALSE,
    training_period_verified BOOLEAN NOT NULL DEFAULT FALSE,
    membership_book_verified BOOLEAN NOT NULL DEFAULT FALSE,
    membership_fee_verified BOOLEAN NOT NULL DEFAULT FALSE,
    grading_fee_verified BOOLEAN NOT NULL DEFAULT FALSE,
    weapon_assessment_verified BOOLEAN,
    yudansha_points_verified BOOLEAN,
    training_proof_document_id BIGINT REFERENCES documents(document_id),
    membership_book_document_id BIGINT REFERENCES documents(document_id),
    reviewed_by_user_id BIGINT REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT
);

-- A single grading application may be associated with a regular grading charge
-- and, if administratively accepted late, the additional SGD 22 charge.
CREATE TABLE IF NOT EXISTS grading_application_charges (
    application_id BIGINT NOT NULL REFERENCES grading_applications(application_id),
    student_fee_id BIGINT NOT NULL UNIQUE REFERENCES student_fees(student_fee_id),
    charge_type VARCHAR(20) NOT NULL CHECK (charge_type IN ('grading','late_submission')),
    PRIMARY KEY (application_id, charge_type)
);

-- SOP page 4: Yudansha 1st-4th Dan point thresholds, stored as reference rules.
-- Does not create a detailed student progress-tracking module (out of project scope).
CREATE TABLE IF NOT EXISTS yudansha_point_requirements (
    dan_number SMALLINT PRIMARY KEY CHECK (dan_number BETWEEN 1 AND 4),
    required_points NUMERIC(5,2) NOT NULL CHECK (required_points >= 0),
    source_revision VARCHAR(20) NOT NULL DEFAULT '2025-09'
);
CREATE TABLE IF NOT EXISTS yudansha_event_point_types (
    event_type VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    points NUMERIC(5,2) NOT NULL CHECK (points >= 0),
    source_revision VARCHAR(20) NOT NULL DEFAULT '2025-09'
);

-- Read-only admin review aid. NULL denotes UNKNOWN, not approved/cleared.
-- Applications normally close >=14 days before grading, but the SOP also lists
-- a late fee; therefore this is a FLAG for admin review, not an absolute rejection.
CREATE OR REPLACE VIEW v_grading_application_sop_review AS
SELECT
    a.application_id,
    a.session_id,
    a.student_id,
    s.full_name AS student_name,
    a.status AS application_status,
    r.grade_label AS target_grade,
    r.fee_amount AS published_grading_fee,
    gs.session_date,
    (gs.session_date - 14) AS standard_application_deadline,
    (a.applied_at::DATE <= (gs.session_date - 14)) AS applied_by_standard_deadline,
    s.membership_status,
    s.membership_start_date,
    CASE WHEN s.membership_start_date IS NULL THEN NULL
         ELSE a.applied_at::DATE >= (s.membership_start_date + INTERVAL '3 months')::DATE
    END AS member_for_at_least_three_months,
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM student_fees sf
        JOIN fee_types ft ON ft.fee_type_id = sf.fee_type_id
        WHERE sf.student_id = s.student_id
          AND sf.is_voided = FALSE AND ft.fee_category = 'membership'
    ) THEN NULL
    ELSE NOT EXISTS (
        SELECT 1 FROM student_fees sf
        JOIN fee_types ft ON ft.fee_type_id = sf.fee_type_id
        JOIN v_student_fee_balances vb ON vb.student_fee_id = sf.student_fee_id
        WHERE sf.student_id = s.student_id
          AND ft.fee_category = 'membership'
          AND vb.outstanding_amount > 0
    ) END AS membership_fees_cleared,
    COALESCE(ch.training_proof_verified, FALSE) AS training_proof_verified,
    COALESCE(ch.training_period_verified, FALSE) AS training_period_verified,
    COALESCE(ch.membership_book_verified, FALSE) AS membership_book_verified,
    COALESCE(ch.grading_fee_verified, FALSE) AS grading_fee_verified,
    r.requires_weapon_assessment,
    ch.weapon_assessment_verified,
    ch.yudansha_points_verified
FROM grading_applications a
JOIN students s ON s.student_id = a.student_id
JOIN grading_sessions gs ON gs.session_id = a.session_id
LEFT JOIN grading_grade_rules r ON r.grade_rule_id = a.grade_rule_id
LEFT JOIN grading_application_checks ch ON ch.application_id = a.application_id;

-- SOP page 3: a PASS should update the member's grade automatically.
-- This trigger does not send email, alter payment data or approve applicants.
-- The backend must manage eligibility, approval and correction/audit procedures.
CREATE OR REPLACE FUNCTION sop_update_member_grade_after_pass()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_student_id BIGINT;
    v_session_date DATE;
    v_target_belt_id BIGINT;
    v_application_status VARCHAR(20);
BEGIN
    IF NEW.result <> 'pass' THEN
        RETURN NEW;
    END IF;

    SELECT a.student_id, gs.session_date, r.belt_level_id, a.status
      INTO v_student_id, v_session_date, v_target_belt_id, v_application_status
    FROM grading_applications a
    JOIN grading_sessions gs ON gs.session_id = a.session_id
    LEFT JOIN grading_grade_rules r ON r.grade_rule_id = a.grade_rule_id
    WHERE a.application_id = NEW.application_id;

    IF v_application_status IS DISTINCT FROM 'approved' THEN
        RAISE EXCEPTION 'Cannot record a passing result for an unapproved grading application';
    END IF;
    IF v_target_belt_id IS NULL THEN
        RAISE EXCEPTION 'Select an SOP target grade before recording a passing result';
    END IF;
    IF NEW.new_belt_id IS NULL OR NEW.new_belt_id <> v_target_belt_id THEN
        RAISE EXCEPTION 'Passing result new_belt_id must match application target grade';
    END IF;

    UPDATE students
       SET current_belt_id = NEW.new_belt_id,
           last_promotion_date = v_session_date,
           updated_at = NOW()
     WHERE student_id = v_student_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sop_update_member_grade_after_pass ON grading_results;
CREATE TRIGGER tr_sop_update_member_grade_after_pass
    AFTER INSERT OR UPDATE OF result, new_belt_id
    ON grading_results
    FOR EACH ROW EXECUTE FUNCTION sop_update_member_grade_after_pass();

COMMIT;


-- ======================================================================
-- SOP GRADE AND DEMO DATA
-- ======================================================================

BEGIN;

-- Belt level identifiers used by grading_grade_rules and student current_belt_id.
-- sort_order values are UI ordering placeholders, not automatic grade progression.
INSERT INTO belt_levels (name, sort_order) VALUES
    ('Children: Kyu 12 (Red)', 1000),
    ('Children: Kyu 11 (Red Gold)', 1001),
    ('Children: Kyu 10 (Yellow)', 1002),
    ('Children: Kyu 9 (Orange)', 1003),
    ('Children: Kyu 8 (Green)', 1004),
    ('Children: Kyu 7 (Purple)', 1005),
    ('Children: Kyu 6 (Blue)', 1006),
    ('Children: Kyu 6 (Blue Silver)', 1007),
    ('Children: Kyu 5 (Blue Gold)', 1008),
    ('Children: Kyu 4 (Brown)', 1009),
    ('Children: Kyu 4 (Brown Silver)', 1010),
    ('Children: Kyu 3 (Brown Gold)', 1011),
    ('Children: Kyu 2 (Black)', 1012),
    ('Children: Kyu 2 (Black Silver)', 1013),
    ('Children: Kyu 1 (Black Gold)', 1014),
    ('Children: Junior Dan', 1015),
    ('Children: ShoDan', 1016),
    ('Children: NiDan', 1017),
    ('Children: SanDan', 1018),
    ('Children: YonDan', 1019),
    ('Adults: Kyu 6 (Blue)', 2000),
    ('Adults: Kyu 5 (Blue Gold)', 2001),
    ('Adults: Kyu 4 (Brown)', 2002),
    ('Adults: Kyu 3 (Brown Gold)', 2003),
    ('Adults: Kyu 2 (Black)', 2004),
    ('Adults: Kyu 1 (Black Gold)', 2005),
    ('Adults: Junior Dan', 2006),
    ('Adults: ShoDan', 2007),
    ('Adults: NiDan', 2008),
    ('Adults: SanDan', 2009),
    ('Adults: YonDan', 2010)
ON CONFLICT (name) DO NOTHING;

-- Grading fees/requirements: children's and adult's schedules are separate.
-- Min/max month/session fields are parsed from the chart; description retains wording.
-- Rules are advisory until the stakeholder confirms interpretation and updates.
INSERT INTO grading_grade_rules
 (belt_level_id, audience, grade_label, fee_amount, training_requirement_text,
  min_months, max_months, min_sessions, min_age_years, max_age_years,
  requires_weapon_assessment, source_revision)
SELECT b.belt_level_id, rules.audience, rules.grade_label, rules.fee_amount,
       rules.training_requirement_text, rules.min_months, rules.max_months,
       rules.min_sessions, rules.min_age_years, rules.max_age_years,
       rules.requires_weapon_assessment, '2025-09'
FROM (VALUES
    ('Children: Kyu 12 (Red)', 'children', 'Kyu 12 (Red)', 45, '5 yrs old, 3 months', 3, NULL, NULL, 5, NULL, FALSE),
    ('Children: Kyu 11 (Red Gold)', 'children', 'Kyu 11 (Red Gold)', 45, '4 months', 4, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 10 (Yellow)', 'children', 'Kyu 10 (Yellow)', 45, '4 months', 4, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 9 (Orange)', 'children', 'Kyu 9 (Orange)', 45, '4 months', 4, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 8 (Green)', 'children', 'Kyu 8 (Green)', 45, '4 to 6 months', 4, 6, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 7 (Purple)', 'children', 'Kyu 7 (Purple)', 45, '6 months', 6, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 6 (Blue)', 'children', 'Kyu 6 (Blue)', 50, '6 months', 6, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 6 (Blue Silver)', 'children', 'Kyu 6 (Blue Silver)', 50, '6 months', 6, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 5 (Blue Gold)', 'children', 'Kyu 5 (Blue Gold)', 55, '6 months', 6, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 4 (Brown)', 'children', 'Kyu 4 (Brown)', 60, '10 months', 10, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 4 (Brown Silver)', 'children', 'Kyu 4 (Brown Silver)', 60, '10 months', 10, NULL, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 3 (Brown Gold)', 'children', 'Kyu 3 (Brown Gold)', 65, '8 to 10 months', 8, 10, NULL, NULL, NULL, FALSE),
    ('Children: Kyu 2 (Black)', 'children', 'Kyu 2 (Black)', 90, '12 yrs & above, 10 months', 10, NULL, NULL, 12, NULL, TRUE),
    ('Children: Kyu 2 (Black Silver)', 'children', 'Kyu 2 (Black Silver)', 90, '10 months', 10, NULL, NULL, NULL, NULL, TRUE),
    ('Children: Kyu 1 (Black Gold)', 'children', 'Kyu 1 (Black Gold)', 95, '9 months & 62 Sessions', 9, NULL, 62, NULL, NULL, TRUE),
    ('Children: Junior Dan', 'children', 'Junior Dan', 215, 'Below 14 yrs old; 9 months & 62 Sessions', 9, NULL, 62, NULL, 13, TRUE),
    ('Children: ShoDan', 'children', 'ShoDan', 535, '15 yrs old & above; 9 months & 70 Sessions', 9, NULL, 70, 15, NULL, TRUE),
    ('Children: NiDan', 'children', 'NiDan', 590, '18 months & 150 Sessions', 18, NULL, 150, NULL, NULL, TRUE),
    ('Children: SanDan', 'children', 'SanDan', 695, '30 months & 240 Sessions', 30, NULL, 240, NULL, NULL, TRUE),
    ('Children: YonDan', 'children', 'YonDan', 910, '42 months & 400 Sessions', 42, NULL, 400, NULL, NULL, TRUE),
    ('Adults: Kyu 6 (Blue)', 'adults', 'Kyu 6 (Blue)', 50, '3 months & 20 Sessions', 3, NULL, 20, NULL, NULL, FALSE),
    ('Adults: Kyu 5 (Blue Gold)', 'adults', 'Kyu 5 (Blue Gold)', 55, '24 Sessions', NULL, NULL, 24, NULL, NULL, FALSE),
    ('Adults: Kyu 4 (Brown)', 'adults', 'Kyu 4 (Brown)', 60, '32 Sessions', NULL, NULL, 32, NULL, NULL, FALSE),
    ('Adults: Kyu 3 (Brown Gold)', 'adults', 'Kyu 3 (Brown Gold)', 65, '6 months & 36 Sessions', 6, NULL, 36, NULL, NULL, FALSE),
    ('Adults: Kyu 2 (Black)', 'adults', 'Kyu 2 (Black)', 90, '6 months & 56 Sessions', 6, NULL, 56, NULL, NULL, TRUE),
    ('Adults: Kyu 1 (Black Gold)', 'adults', 'Kyu 1 (Black Gold)', 95, '9 months & 62 Sessions', 9, NULL, 62, NULL, NULL, TRUE),
    ('Adults: Junior Dan', 'adults', 'Junior Dan', 215, 'Below 14 yrs old; 9 months & 62 Sessions', 9, NULL, 62, NULL, 13, TRUE),
    ('Adults: ShoDan', 'adults', 'ShoDan', 535, '15 yrs old & above; 9 months & 70 Sessions', 9, NULL, 70, 15, NULL, TRUE),
    ('Adults: NiDan', 'adults', 'NiDan', 590, '18 months & 150 Sessions', 18, NULL, 150, NULL, NULL, TRUE),
    ('Adults: SanDan', 'adults', 'SanDan', 695, '30 months & 240 Sessions', 30, NULL, 240, NULL, NULL, TRUE),
    ('Adults: YonDan', 'adults', 'YonDan', 910, '42 months & 400 Sessions', 42, NULL, 400, NULL, NULL, TRUE)
) AS rules(belt_name, audience, grade_label, fee_amount, training_requirement_text,
           min_months, max_months, min_sessions, min_age_years, max_age_years,
           requires_weapon_assessment)
JOIN belt_levels b ON b.name = rules.belt_name
WHERE TRUE -- disambiguates INSERT .. SELECT .. ON CONFLICT in PostgreSQL
ON CONFLICT (belt_level_id, source_revision) DO NOTHING;

-- Yudansha thresholds from SOP page 4. These are reference thresholds only.
INSERT INTO yudansha_point_requirements (dan_number, required_points) VALUES
    (1, 3.00), (2, 6.00), (3, 9.00), (4, 12.00)
ON CONFLICT (dan_number) DO NOTHING;

INSERT INTO yudansha_event_point_types (event_type, description, points) VALUES
    ('hq_seminar_event', 'ASK Headquarters organised seminar or event', 1.00),
    ('sanctioned_international', 'ASK sanctioned international seminars, events or trips', 2.50),
    ('hq_workshop_course', 'ASK Headquarters workshop, course or self-improvement programme', 0.50)
ON CONFLICT (event_type) DO NOTHING;

-- Categorise the earlier fictional membership fee rows so the view can distinguish
-- membership arrears from grading fees. This does NOT change received payments.
UPDATE fee_types SET fee_category = 'membership'
WHERE name = 'Demo Membership Fee' AND fee_category = 'other';
UPDATE fee_types SET fee_category = 'grading'
WHERE name = 'Demo Grading Fee' AND fee_category = 'other';

INSERT INTO fee_types (name, default_amount, fee_category) VALUES
    ('SOP grading charge (grade-specific)', 0.00, 'grading'),
    ('SOP late submission admin charge', 22.00, 'late_submission')
ON CONFLICT (name) DO NOTHING;

-- Update ONLY the three known fictional students. No real student rows affected.
UPDATE students s SET
    membership_start_date = DATE '2025-01-15',
    current_belt_id = b.belt_level_id,
    updated_at = NOW()
FROM belt_levels b
WHERE s.email = 'student.one@example.com' AND s.full_name = 'Demo Student One'
  AND b.name = 'Adults: Kyu 6 (Blue)';

UPDATE students s SET
    membership_start_date = DATE '2027-01-15',
    current_belt_id = b.belt_level_id,
    updated_at = NOW()
FROM belt_levels b
WHERE s.email = 'student.two@example.com' AND s.full_name = 'Demo Student Two'
  AND b.name = 'Adults: Kyu 5 (Blue Gold)';

UPDATE students s SET
    membership_start_date = DATE '2025-06-01',
    current_belt_id = b.belt_level_id,
    updated_at = NOW()
FROM belt_levels b
WHERE s.email = 'student.three@example.com' AND s.full_name = 'Demo Student Three'
  AND b.name = 'Adults: Kyu 4 (Brown)';

-- The previous seed set a fictional application to approved without verification.
-- Put it into PENDING and assign a specific SOP grade for administrative review.
UPDATE grading_applications ga
SET status = 'pending',
    applied_at = TIMESTAMPTZ '2027-02-10 10:00:00+08',
    grade_rule_id = (
        SELECT r.grade_rule_id FROM grading_grade_rules r
        JOIN belt_levels b ON b.belt_level_id = r.belt_level_id
        WHERE b.name = 'Adults: Kyu 5 (Blue Gold)' AND r.source_revision = '2025-09'
    )
WHERE ga.student_id = (SELECT student_id FROM students
                       WHERE email = 'student.one@example.com')
  AND ga.session_id IN (SELECT session_id FROM grading_sessions
                        WHERE session_date = DATE '2027-03-13');

-- A second, fictional application demonstrates an applicant who is both late
-- and has less than 3 months membership, plus an unpaid membership balance.
INSERT INTO grading_applications
    (session_id, student_id, status, applied_at, grade_rule_id)
SELECT gs.session_id, st.student_id, 'pending',
       TIMESTAMPTZ '2027-03-04 10:00:00+08', r.grade_rule_id
FROM grading_sessions gs
JOIN students st ON st.email = 'student.two@example.com'
JOIN grading_grade_rules r ON r.grade_label = 'Kyu 4 (Brown)'
                            AND r.audience = 'adults' AND r.source_revision = '2025-09'
WHERE gs.session_date = DATE '2027-03-13' AND gs.type = 'mass'
ON CONFLICT (session_id, student_id) DO NOTHING;

-- Optional unverified review checklists. Their default FALSE means not checked.
INSERT INTO grading_application_checks (application_id)
SELECT a.application_id FROM grading_applications a
JOIN students s ON s.student_id = a.student_id
WHERE s.email IN ('student.one@example.com','student.two@example.com')
ON CONFLICT (application_id) DO NOTHING;

-- Fee charges are snapshots of each candidate's target grade, not a common
-- grading_sessions.fee value. Each charge remains unpaid until a payment is verified.
INSERT INTO student_fees (student_id, fee_type_id, description, amount, due_date)
SELECT a.student_id, ft.fee_type_id,
       'SOP demo grading: ' || r.grade_label, r.fee_amount,
       DATE '2027-03-01'
FROM grading_applications a
JOIN students s ON s.student_id = a.student_id
JOIN grading_grade_rules r ON r.grade_rule_id = a.grade_rule_id
JOIN fee_types ft ON ft.name = 'SOP grading charge (grade-specific)'
WHERE s.email IN ('student.one@example.com','student.two@example.com')
  AND NOT EXISTS (
      SELECT 1 FROM student_fees sf
      WHERE sf.student_id = a.student_id
        AND sf.description = 'SOP demo grading: ' || r.grade_label
  );

INSERT INTO grading_application_charges (application_id, student_fee_id, charge_type)
SELECT a.application_id, sf.student_fee_id, 'grading'
FROM grading_applications a
JOIN grading_grade_rules r ON r.grade_rule_id = a.grade_rule_id
JOIN student_fees sf ON sf.student_id = a.student_id
    AND sf.description = 'SOP demo grading: ' || r.grade_label
JOIN students s ON s.student_id = a.student_id
WHERE s.email IN ('student.one@example.com','student.two@example.com')
ON CONFLICT (application_id, charge_type) DO NOTHING;

-- SOP additional administrative charge: $22 on late applications (page 2).
-- This is a DEMO scenario; late applications still require manual acceptance.
INSERT INTO student_fees (student_id, fee_type_id, description, amount, due_date)
SELECT s.student_id, ft.fee_type_id,
       'SOP demo late submission charge', 22.00, DATE '2027-03-04'
FROM students s
JOIN fee_types ft ON ft.name = 'SOP late submission admin charge'
WHERE s.email = 'student.two@example.com'
  AND NOT EXISTS (
      SELECT 1 FROM student_fees sf
      WHERE sf.student_id = s.student_id
        AND sf.description = 'SOP demo late submission charge'
  );

INSERT INTO grading_application_charges (application_id, student_fee_id, charge_type)
SELECT a.application_id, sf.student_fee_id, 'late_submission'
FROM grading_applications a
JOIN students s ON s.student_id = a.student_id
JOIN student_fees sf ON sf.student_id = s.student_id
    AND sf.description = 'SOP demo late submission charge'
WHERE s.email = 'student.two@example.com'
ON CONFLICT (application_id, charge_type) DO NOTHING;

COMMIT;

