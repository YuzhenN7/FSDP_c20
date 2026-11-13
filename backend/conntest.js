require('dotenv').config();
const { neon, Pool, neonConfig } = require('@neondatabase/serverless');

if (!neonConfig.webSocketConstructor && typeof globalThis.WebSocket === 'function') {
  neonConfig.webSocketConstructor = globalThis.WebSocket;
}

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + ms + 'ms')), ms));

(async () => {
  try {
    const t = Date.now();
    const sql = neon(process.env.DATABASE_URL);
    const r = await Promise.race([sql`select count(*) from users`, timeout(12000)]);
    console.log('HTTP      OK   -', r[0].count, 'users in', Date.now() - t, 'ms');
  } catch (e) {
    console.error('HTTP      FAIL -', e.message);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const t = Date.now();
    const r = await Promise.race([pool.query('select count(*) from users'), timeout(12000)]);
    console.log('WebSocket OK   -', r.rows[0].count, 'users in', Date.now() - t, 'ms');
  } catch (e) {
    console.error('WebSocket FAIL -', e.message);
  }
  pool.end().catch(() => {});
  process.exit(0);
})();