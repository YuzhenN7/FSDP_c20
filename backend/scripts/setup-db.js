// FIRST-TIME SETUP for the Neon database.   Run with:  npm run db:setup
// Creates the tables, creates the admin account, and loads db/sample-data/ if the database is still empty.
// Safe to run again - it will not add the sample data twice. (To replace the data, use `npm run db:reload`.)

const db = require('../config/db');
const loader = require('./data-loader');

async function main() {
  if (db.isLocal) {
    console.log('DATABASE_URL is empty, so the app is using its temporary local database.');
    console.log('That one sets itself up every time you run `npm run dev` - nothing to do here.');
    console.log('Once Neon is ready, put its connection string in .env as DATABASE_URL and run this again.');
    return;
  }

  await loader.ensureSchema();
  console.log('Tables are ready.');
  await loader.ensureAdmin();

  if (await loader.hasData()) {
    console.log('Data already exists, so the sample data was NOT loaded again.');
  } else {
    const counts = await loader.loadCsvData('sample-data');
    console.log('Loaded sample data:', counts);
  }

  console.log('\nDevelopment logins:');
  console.log(`  Admin:   ${loader.ADMIN.email}  /  ${loader.ADMIN.password}`);
  console.log(`  Student: student@shinjukai.test  /  ${loader.STUDENT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
