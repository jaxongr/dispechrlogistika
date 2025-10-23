const { db } = require('./database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  try {
    console.log('🚀 Starting database initialization...');

    // Check if roles exist
    const rolesCount = db.get('roles').size().value();

    if (rolesCount === 0) {
      console.log('📝 Creating roles...');

      db.get('roles').push({
        id: 1,
        name: 'admin',
        permissions: JSON.stringify({ all: true }),
        created_at: new Date().toISOString()
      }).write();

      db.get('roles').push({
        id: 2,
        name: 'moderator',
        permissions: JSON.stringify({
          view_messages: true,
          approve_messages: true,
          block_users: true
        }),
        created_at: new Date().toISOString()
      }).write();

      db.get('roles').push({
        id: 3,
        name: 'viewer',
        permissions: JSON.stringify({ view_messages: true }),
        created_at: new Date().toISOString()
      }).write();

      console.log('✅ Roles created');
    }

    // Check if admin user exists
    const adminUser = db.get('users').find({ username: 'admin' }).value();

    if (!adminUser) {
      console.log('👤 Creating admin user...');

      const password_hash = await bcrypt.hash('admin123', 10);

      db.get('users').push({
        id: 1,
        username: 'admin',
        email: 'admin@logistics.uz',
        password_hash,
        full_name: 'Administrator',
        role_id: 1,
        is_active: true,
        created_at: new Date().toISOString()
      }).write();

      console.log('✅ Admin user created');
    } else {
      console.log('⚠️  Admin user already exists');
    }

    console.log('\n✅ Database initialized successfully!');
    console.log('\n📊 Database collections:');
    console.log('   - roles:', db.get('roles').size().value());
    console.log('   - users:', db.get('users').size().value());
    console.log('   - telegram_groups:', db.get('telegram_groups').size().value());
    console.log('   - messages:', db.get('messages').size().value());
    console.log('   - blocked_users:', db.get('blocked_users').size().value());
    console.log('   - subscriptions:', db.get('subscriptions').size().value());

    console.log('\n👤 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
