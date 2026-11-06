// Starts the server.   Run (inside the backend folder) with:  npm run dev

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in backend/.env');
  console.error('Copy backend/.env.example to backend/.env and fill it in (see README.md).');
  process.exit(1);
}

const db = require('./config/db');
const app = require('./app');
const port = process.env.PORT || 3000;

async function start() {
  if (db.isLocal) {
    // No Neon yet: build the temporary in-memory database from the sample CSV files
    const loader = require('./scripts/data-loader');
    await loader.ensureSchema();
    await loader.ensureAdmin();
    const counts = await loader.loadCsvData('sample-data');
    console.log('Using the TEMPORARY local database (DATABASE_URL is empty).');
    console.log('It resets every time the server restarts. Sample data loaded:', counts);
    console.log(`Logins: ${loader.ADMIN.email} / ${loader.ADMIN.password}   |   student@shinjukai.test / ${loader.STUDENT_PASSWORD}`);
  }

  app.listen(port, () => {
    console.log(`Aikido Shinjukai running at http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Could not start:', err.message);
  process.exit(1);
});
