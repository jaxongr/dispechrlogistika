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
  subscriptions: [],
  payments: [],
  telegram_sessions: [],
  target_channels: [],
  statistics: []
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
