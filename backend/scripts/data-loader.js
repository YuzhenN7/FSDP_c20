// Loads the CSV files in db/sample-data/ into the database.
// Used by `npm run db:setup`, `npm run db:reload`, and automatically in local (no-Neon) mode.
//
// The CSV files link to each other by NAME / EMAIL (not ids), so they are easy to edit in Excel.
// See db/sample-data/README.md for what each column means.

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const db = require('../config/db');

const DB_DIR = path.join(__dirname, '..', 'db');

// The one admin account (the client has a single admin who sees every centre).
// Development login only - change before anything real goes live.
const ADMIN = { name: 'Dojo Admin', email: 'admin@shinjukai.test', password: 'Admin123!' };
// Every student account created from students.csv gets this password.
const STUDENT_PASSWORD = 'Student123!';

async function ensureSchema() {
  const sql = fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8');
  await db.query(sql);

  // Sprint 1 migrations: apply after the shared schema, without replacing it.
  const migrationsDir = path.join(DB_DIR, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    for (const filename of fs.readdirSync(migrationsDir).filter((x) => /^\d+_scrum.*\.sql$/.test(x)).sort()) {
      await db.query(fs.readFileSync(path.join(migrationsDir, filename), 'utf8'));
    }
  }
}

async function ensureAdmin() {
  const hash = await bcrypt.hash(ADMIN.password, 10);
  await db.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
    [ADMIN.name, ADMIN.email, hash]
  );
}

// Reads one CSV file into an array of { column: value } objects. A missing file means "no rows".
// Empty cells become null.
function readCsv(dir, file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return [];
  const rows = parse(fs.readFileSync(full, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Excel adds an invisible marker at the start of CSV files
  });
  return rows.map((row) => {
    const clean = {};
    for (const [key, value] of Object.entries(row)) clean[key] = value === '' ? null : value;
    return clean;
  });
}

// Looks up an id by name. Stops with a clear message if the CSV refers to something that does not exist.
function lookup(map, name, what, file, rowNumber) {
  if (name === null || name === undefined) return null;
  const id = map.get(name);
  if (id === undefined) {
    throw new Error(`${file} row ${rowNumber}: ${what} "${name}" was not found. Check the spelling matches the other CSV file.`);
  }
  return id;
}

// Deletes all centres, students, classes, fees... (keeps the admin account), ready for a fresh load
async function clearData() {
  await db.query(
    `TRUNCATE public_holidays, term_class_schedule, terms, attendance, payments, fees, gradings, classes, instructors, venues, students, centres, belt_levels, fee_package_items, fee_packages, fee_types
     RESTART IDENTITY CASCADE`
  );
  await db.query(`DELETE FROM users WHERE role = 'student'`);
}
// Yu Wen added fee_package_items, fee_packages, fee_types

async function loadCsvData(dirName = 'sample-data') {
  const dir = path.isAbsolute(dirName) ? dirName : path.join(DB_DIR, dirName);
  if (!fs.existsSync(dir)) throw new Error(`Data folder not found: ${dir}`);

  const belts = new Map();
  const centres = new Map();
  const venues = new Map();       // key: "centre|venue"
  const instructors = new Map();
  const classes = new Map();      // key: "centre|class name"
  const students = new Map();     // key: email
  const fees = new Map();         // key: "email|description"
  // Yu Wen added these two below
  const feeTypes = new Map();    // key: name
  const packages = new Map();     // key: name 

  for (const r of readCsv(dir, 'belts.csv')) {
    const { rows } = await db.query(
      'INSERT INTO belt_levels (name, sort_order) VALUES ($1, $2) RETURNING id',
      [r.name, Number(r.sort_order)]
    );
    belts.set(r.name, rows[0].id);
  }

  for (const r of readCsv(dir, 'centres.csv')) {
    const { rows } = await db.query('INSERT INTO centres (name, address) VALUES ($1, $2) RETURNING id', [r.name, r.address]);
    centres.set(r.name, rows[0].id);
  }

  let n = 1;
  for (const r of readCsv(dir, 'venues.csv')) {
    n++;
    const centreId = lookup(centres, r.centre, 'centre', 'venues.csv', n);
    const { rows } = await db.query('INSERT INTO venues (centre_id, name) VALUES ($1, $2) RETURNING id', [centreId, r.name]);
    venues.set(`${r.centre}|${r.name}`, rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'instructors.csv')) {
    n++;
    const centreId = lookup(centres, r.centre, 'centre', 'instructors.csv', n);
    const { rows } = await db.query(
      'INSERT INTO instructors (centre_id, name, email) VALUES ($1, $2, $3) RETURNING id',
      [centreId, r.name, r.email]
    );
    instructors.set(r.name, rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'classes.csv')) {
    n++;
    const centreId = lookup(centres, r.centre, 'centre', 'classes.csv', n);
    const venueId = r.venue === null ? null : lookup(venues, `${r.centre}|${r.venue}`, 'venue (for that centre)', 'classes.csv', n);
    const instructorId = lookup(instructors, r.instructor, 'instructor', 'classes.csv', n);
    const created = await db.query(
      `INSERT INTO classes (centre_id, venue_id, instructor_id, name, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [centreId, venueId, instructorId, r.name, r.day_of_week, r.start_time, r.end_time]
    );
    classes.set(`${r.centre}|${r.name}`, created.rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'students.csv')) {
    n++;
    const centreId = lookup(centres, r.centre, 'centre', 'students.csv', n);
    const beltId = lookup(belts, r.belt, 'belt', 'students.csv', n);
    const hash = await bcrypt.hash(r.password || STUDENT_PASSWORD, 10);
    const user = await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, LOWER($2), $3, 'student') RETURNING id`,
      [r.name, r.email, hash]
    );
    const student = await db.query(
      `INSERT INTO students (user_id, centre_id, belt_id, joined_on)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE)) RETURNING id`,
      [user.rows[0].id, centreId, beltId, r.joined_on]
    );
    students.set(r.email.toLowerCase(), student.rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'gradings.csv')) {
    n++;
    const studentId = lookup(students, r.student_email.toLowerCase(), 'student email', 'gradings.csv', n);
    const beltId = lookup(belts, r.belt, 'belt', 'gradings.csv', n);
    await db.query(
      `INSERT INTO gradings (student_id, belt_id, result, graded_on, notes)
       VALUES ($1, $2, $3, $4::date, $5)`,
      [studentId, beltId, r.result, r.graded_on, r.notes]
    );
  }

  n = 1;
  for (const r of readCsv(dir, 'fees.csv')) {
    n++;
    const studentId = lookup(students, r.student_email.toLowerCase(), 'student email', 'fees.csv', n);
    const { rows } = await db.query(
      `INSERT INTO fees (student_id, description, amount, due_date, status)
       VALUES ($1, $2, $3, $4::date, $5) RETURNING id`,
      [studentId, r.description, r.amount, r.due_date, r.status || 'unpaid']
    );
    fees.set(`${r.student_email.toLowerCase()}|${r.description}`, rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'payments.csv')) {
    n++;
    const feeId = lookup(fees, `${r.student_email.toLowerCase()}|${r.fee_description}`, 'fee (student email + description)', 'payments.csv', n);
    await db.query(
      `INSERT INTO payments (fee_id, amount, method, reference, paid_at)
       VALUES ($1, $2, COALESCE($3, 'online'), $4, $5::timestamptz)`,
      [feeId, r.amount, r.method, r.reference, r.paid_at]
    );
  }

  /* YuWen Added these below */
    for (const r of readCsv(dir, 'fee_types.csv')) {
    const { rows } = await db.query(
      `INSERT INTO fee_types (name, category, student_group, base_amount, discount_percent, can_be_in_package, description)
       VALUES ($1, COALESCE($2, 'other'), COALESCE($3, 'All'), $4::numeric, COALESCE($5::numeric, 0), COALESCE($6::boolean, TRUE), $7)
       RETURNING id`,
      [r.name, r.category, r.student_group, r.base_amount, r.discount_percent, r.can_be_in_package, r.description]
    );
    feeTypes.set(r.name, rows[0].id);
  }

  for (const r of readCsv(dir, 'fee_packages.csv')) {
    const { rows } = await db.query(
      `INSERT INTO fee_packages (name, student_group, discount_percent, validity, description)
       VALUES ($1, COALESCE($2, 'All'), COALESCE($3::numeric, 0), $4, $5) RETURNING id`,
      [r.name, r.student_group, r.discount_percent, r.validity, r.description]
    );
    packages.set(r.name, rows[0].id);
  }

  n = 1;
  for (const r of readCsv(dir, 'fee_package_items.csv')) {
    n++;
    const packageId = lookup(packages, r.package_name, 'package', 'fee_package_items.csv', n);
    const feeTypeId = lookup(feeTypes, r.fee_type_name, 'fee type', 'fee_package_items.csv', n);
    await db.query('INSERT INTO fee_package_items (package_id, fee_type_id) VALUES ($1, $2)', [packageId, feeTypeId]);
  } 
  /* YuWen added until here */

  n = 1;
  for (const r of readCsv(dir, 'attendance.csv')) {
    n++;
    const classId = lookup(classes, `${r.centre}|${r.class_name}`, 'class (centre + class name)', 'attendance.csv', n);
    const studentId = lookup(students, r.student_email.toLowerCase(), 'student email', 'attendance.csv', n);
    await db.query(
      `INSERT INTO attendance (class_id, student_id, class_date, status) VALUES ($1, $2, $3::date, $4)`,
      [classId, studentId, r.class_date, r.status]
    );
  }

  return {
    centres: centres.size, students: students.size, fees: fees.size, belts: belts.size,
  };
}

async function hasData() {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM centres');
  return rows[0].n > 0;
}

module.exports = { ensureSchema, ensureAdmin, clearData, loadCsvData, hasData, ADMIN, STUDENT_PASSWORD };
