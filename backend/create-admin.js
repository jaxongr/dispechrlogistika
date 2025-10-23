/**
 * Admin user yaratish
 * Bu script to'g'ri password hash bilan admin yaratadi
 */

const bcrypt = require('bcryptjs');
const { db } = require('./src/config/database');

async function createAdmin() {
  try {
    console.log('🔐 Admin user yaratilmoqda...');

    const username = 'admin';
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    console.log('Password hash:', passwordHash);

    // Eski admin'ni o'chirish
    db.prepare('DELETE FROM users WHERE username = ?').run(username);

    // Yangi admin yaratish
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      username,
      'admin@logistics.uz',
      passwordHash,
      'Administrator',
      1, // admin role
      1  // active
    );

    console.log('✅ Admin user yaratildi!');
    console.log('📝 Login ma\'lumotlari:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('\n⚠️  Login qilgandan keyin parolni o\'zgartiring!');

    // Tekshirish
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    console.log('\n✓ Database\'da:', user);

    process.exit(0);
  } catch (error) {
    console.error('❌ Xatolik:', error);
    process.exit(1);
  }
}

createAdmin();
