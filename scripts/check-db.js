const Database = require('better-sqlite3');
try {
  const db = new Database('data/ledger-of-alpha.db');
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get();
  console.log('User count:', count.n);
  const settings = db.prepare('SELECT * FROM settings LIMIT 5').all();
  console.log('Sample settings:', settings);
} catch (err) {
  console.error('DB ERROR:', err);
  process.exit(1);
}
