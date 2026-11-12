// REPLACE ALL DATA with the CSV files.   Run with:  npm run db:reload
//
// Deletes every centre, student, class, fee, payment... (the admin account is kept)
// and loads the CSV files again. Use it after editing the CSVs, or when the real data arrives:
//
//   npm run db:reload                  -> loads db/sample-data/
//   npm run db:reload -- real-data     -> loads db/real-data/   (a folder you create, same file names)
//
// WARNING: on Neon this wipes the shared database for the whole team. Tell them first.

const db = require('../config/db');
const loader = require('./data-loader');

async function main() {
  if (db.isLocal) {
    console.log('The temporary local database reloads itself on every restart of `npm run dev`.');
    console.log('Just edit the CSV files and restart the server.');
    return;
  }

  const folder = process.argv[2] || 'sample-data';
  await loader.ensureSchema();
  await loader.ensureAdmin();
  await loader.clearData();
  const counts = await loader.loadCsvData(folder);
  console.log(`Reloaded data from db/${folder}:`, counts);
}

main()
  .catch((err) => {
    console.error('Reload failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
