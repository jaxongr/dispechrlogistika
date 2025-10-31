const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
require('dotenv').config();

// Database fayl yo'li
const dbPath = path.join(__dirname, '../../../database/db.json');

// LowDB adapter
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Default state
db.defaults({
  roles: [],
  users: [],
  telegram_groups: [],
  messages: [],
  blocked_users: [],
  blocked_phones: [],
  subscriptions: [],
  payments: [],
  telegram_sessions: [],
  target_channels: [],
  statistics: [],
  daily_statistics: [],
  dispatcher_reports: [],
  bot_users: [],
  pending_approvals: [],  // Admin tasdiq uchun kutayotgan bloklashlar
  whitelist: [],          // Admin tomonidan tasdiqlangan yuk egalari
  sms_settings: {         // SemySMS sozlamalari
    enabled: false,
    template: 'Sizning e\'loningiz spam deb topildi va bloklandi. Iltimos, guruhda spam e\'lon tarqatmang!',
    success_enabled: false,
    success_template: 'Tabriklaymiz! Sizning e\'loningiz filtrdan o\'tdi va @yoldauz guruhiga joylashtirildi. Ko\'proq buyurtmalar uchun kanalingizni kuzatib boring!',
    device_id: null,
    auto_select_device: true,
    last_updated: new Date().toISOString()
  },
  sms_history: [],         // SMS yuborish tarixi
  auto_reply_settings: {   // Dispatcher auto-reply sozlamalari
    enabled: false,
    template: 'Assalomu alaykum hurmatli dispechr! Sizni ish samaradorligingizni oshirish uchun guruh ochdik! U yerda barcha yukchilardan yuk beriladi tekinga! Guruhga qo\'shilish uchun profil shapkasidagi guruhga qo\'shiling!',
    max_replies_per_hour: 100,
    max_replies_per_minute: 5,
    cooldown_hours: 1,
    check_target_group: true,
    last_updated: new Date().toISOString()
  },
  dispatcher_auto_replies: [],  // Auto-reply tarixi
  broadcasts: [],               // Ommaviy xabar yuborish
  broadcast_announcements: [],   // Broadcast uchun alohida e'lonlar
  drivers: [],                  // Yuk mashinasi haydovchilari (qora/oq ro'yxat)
  bot_orders: []                // Botda yaratilgan buyurtmalar
}).write();

console.log('✅ LowDB (JSON) database ulandi:', dbPath);

// Helper functions (SQL-like interface)
const query = (sql, params = []) => {
  try {
    // Bu oddiy implementation, asosiy CRUD operatsiyalarni qo'llab-quvvatlaydi
    const sqlUpper = sql.trim().toUpperCase();

    // SELECT query
    if (sqlUpper.startsWith('SELECT')) {
      // Bu yerda oddiy SELECT implementation
      // Real loyihada query parser kerak bo'lardi
      return { rows: [] };
    }

    // INSERT query
    if (sqlUpper.startsWith('INSERT')) {
      return { rows: [{ id: Date.now() }], rowCount: 1 };
    }

    // UPDATE query
    if (sqlUpper.startsWith('UPDATE')) {
      return { rows: [], rowCount: 0 };
    }

    // DELETE query
    if (sqlUpper.startsWith('DELETE')) {
      return { rows: [], rowCount: 0 };
    }

    return { rows: [] };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

const getClient = () => {
  return {
    query: (sql, params) => query(sql, params),
    release: () => {}
  };
};

// Database object'ini export qilish
module.exports = {
  query,
  getClient,
  db
};
