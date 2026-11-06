// Database connection.
// In any model file:   const db = require('../config/db');   then   await db.query('SELECT ...', [params]);
// Always pass user input as $1, $2... params (never glue it into the SQL text).
//
// Two modes:
//   1. DATABASE_URL is set in backend/.env  -> real PostgreSQL on Neon (shared by the whole team).
//   2. DATABASE_URL is empty                -> TEMPORARY local database that lives in memory.
//      It is rebuilt from db/sample-data/ every time the server starts, so anything you
//      create while testing disappears on restart. Use this until Neon is set up.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isLocal = !process.env.DATABASE_URL;

let pool = null;   // Neon mode
let local = null;  // local mode (promise of the in-memory database)

if (!isLocal) {
  const { Pool, types } = require('pg');
  // Return DATE columns as plain 'YYYY-MM-DD' text so dates never shift by a day across timezones
  types.setTypeParser(1082, (value) => value);
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
}

function getLocal() {
  if (!local) {
    local = import('@electric-sql/pglite').then(({ PGlite }) => new PGlite({ parsers: { 1082: (v) => v } }));
  }
  return local;
}

async function query(text, params) {
  if (!isLocal) return pool.query(text, params);

  const db = await getLocal();
  if (params === undefined) {
    // No params: may contain several statements (e.g. the schema file)
    const results = await db.exec(text);
    return results[results.length - 1] || { rows: [] };
  }
  return db.query(text, params);
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { query, close, isLocal };
