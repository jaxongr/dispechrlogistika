/**
 * Parol hash generator
 * Usage: node generate-password-hash.js <password>
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'admin123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  console.log('\n========================================');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('========================================\n');
  console.log('Copy this hash to database/schema.sql');
});
