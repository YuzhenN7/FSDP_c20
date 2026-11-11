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
    // ...your existing local-mode code, unchanged...
  } else {
    console.log('Using the NEON database (DATABASE_URL is set).');
  }

  app.listen(port, () => {
    console.log(`Aikido Shinjukai running at http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Could not start:', err.message);
  process.exit(1);
});
