
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env')
});

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET in backend/.env');
  process.exit(1);
}

const db = require('./config/db');
const app = require('./app');
const loader = require('./scripts/data-loader');

const port = process.env.PORT || 3000;

async function start() {
  if (db.isLocal) {
    console.log('Preparing temporary local database...');

    await loader.ensureSchema();
    await loader.ensureAdmin();

    if (!(await loader.hasData())) {
      const counts = await loader.loadCsvData('sample-data');
      console.log('Loaded sample data:', counts);
    }

    console.log('Temporary local database is ready.');
  } else {
    console.log('Using the configured PostgreSQL database.');
  }

  app.listen(port, () => {
    console.log(
      `Aikido Shinjukai running at http://localhost:${port}`
    );
  });
}

start().catch((err) => {
  console.error('Could not start:', err);
  process.exitCode = 1;
});
