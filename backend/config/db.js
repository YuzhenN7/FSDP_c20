// Database connection.
// In any model file:   const db = require('../config/db');   then   await db.query('SELECT ...', [params]);
// Always pass user input as $1, $2... params (never glue it into the SQL text).
//
// Two modes:
//   1. DATABASE_URL is set in backend/.env  -> real PostgreSQL on Neon (shared by the whole team).
//   2. DATABASE_URL is empty                -> TEMPORARY local database that lives in memory.
//      It is rebuilt from db/sample-data/ every time the server starts, so anything you
//      create while testing disappears on restart. Use this until Neon is set up.
//
// For a Neon database we use @neondatabase/serverless instead of the plain `pg` driver.
// It reaches Neon over HTTPS on port 443 rather than the Postgres port 5432, which many
// school, office and public networks block. Same Pool API as `pg`, so nothing else changes.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isLocal = !process.env.DATABASE_URL;

let pool = null;   // Neon mode
let local = null;  // local mode (promise of the in-memory database)

if (!isLocal) {
  const url = process.env.DATABASE_URL;

  if (/\.neon\.tech(\W|$)/.test(url)) {
    const { Pool, neonConfig, types } = require('@neondatabase/serverless');

    // The driver talks to Neon over a WebSocket (port 443). Node 22+ has WebSocket
    // built in; on older Node it comes from the optional `ws` package.
    if (!neonConfig.webSocketConstructor) {
      if (typeof globalThis.WebSocket === 'function') {
        neonConfig.webSocketConstructor = globalThis.WebSocket;
      } else {
        try {
          neonConfig.webSocketConstructor = require('ws');
        } catch {
          throw new Error('Node 22+ is needed for the Neon driver, or run: npm install ws');
        }
      }
    }

    // Return DATE columns as plain 'YYYY-MM-DD' text so dates never shift by a day across timezones
    types.setTypeParser(1082, (value) => value);
    pool = new Pool({ connectionString: url });
  } else {
    const { Pool, types } = require('pg');
    types.setTypeParser(1082, (value) => value);
    pool = new Pool({ connectionString: url });
  }
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

// Run several queries as one all-or-nothing unit.
// Usage:  await db.transaction(async (q) => {
//           await q('UPDATE ... WHERE id = $1', [id]);
//           await q('INSERT ...', [a, b]);
//         });
// If anything inside throws, every change is rolled back.
async function transaction(callback) {
  if (!isLocal) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback((text, params) => client.query(text, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  const db = await getLocal();
  return db.transaction(async (tx) => callback((text, params) => tx.query(text, params || [])));
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { query, transaction, close, isLocal };