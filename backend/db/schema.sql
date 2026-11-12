-- Aikido Shinjukai database schema (PostgreSQL / Neon)
-- Safe to run many times: every statement uses IF NOT EXISTS.
-- To change the schema: edit this file, tell the team, then everyone runs `npm run db:setup`.
-- (Everyone shares the same Neon database, so agree on changes before making them.)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS centres (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id        SERIAL PRIMARY KEY,
  centre_id INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  name      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instructors (
  id        SERIAL PRIMARY KEY,
  centre_id INTEGER REFERENCES centres(id) ON DELETE SET NULL,
  name      TEXT NOT NULL,
  email     TEXT
);

CREATE TABLE IF NOT EXISTS belt_levels (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE   -- 1 = lowest belt
);

CREATE TABLE IF NOT EXISTS students (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  centre_id INTEGER REFERENCES centres(id) ON DELETE SET NULL,
  belt_id   INTEGER REFERENCES belt_levels(id),
  joined_on DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS classes (
  id            SERIAL PRIMARY KEY,
  centre_id     INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  venue_id      INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  day_of_week   TEXT,   -- e.g. 'Monday'
  start_time    TIME,
  end_time      TIME
);

CREATE TABLE IF NOT EXISTS gradings (
  id         SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  belt_id    INTEGER NOT NULL REFERENCES belt_levels(id),   -- the belt being graded for
  result     TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  graded_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS grading_sessions (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('mass_adult', 'mass_children', 'private')),
  centre_id    INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  venue        TEXT NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  fee          NUMERIC(10, 2) NOT NULL CHECK (fee >= 0),
  apply_open   TIMESTAMPTZ NOT NULL,
  apply_close  TIMESTAMPTZ NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (apply_open < apply_close),
  CHECK (type <> 'private' OR capacity <= 4)
);

CREATE TABLE IF NOT EXISTS fees (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  description TEXT NOT NULL,                 -- e.g. 'Term 4 membership'
  amount      NUMERIC(10, 2) NOT NULL,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid'))
);

CREATE TABLE IF NOT EXISTS payments (
  id        SERIAL PRIMARY KEY,
  fee_id    INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  amount    NUMERIC(10, 2) NOT NULL,
  method    TEXT NOT NULL DEFAULT 'online',
  reference TEXT,
  paid_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id         SERIAL PRIMARY KEY,
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  UNIQUE (class_id, student_id, class_date)
);
