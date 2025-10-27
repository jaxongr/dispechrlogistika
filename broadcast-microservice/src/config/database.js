const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

// ALOHIDA database - asosiy loyihaga tegmaydi!
const dbPath = path.join(__dirname, '../../data/broadcast_db.json');

const adapter = new FileSync(dbPath);
const db = low(adapter);

// Default state
db.defaults({
  users: [],              // Bot foydalanuvchilari
  sessions: [],           // User telegram sessionlari
  announcements: [],      // E'lonlar
  broadcasts: [],         // Broadcast kampaniyalari
  broadcast_logs: [],     // Broadcast tarixi
  user_groups: []         // Har bir userning guruhlari
}).write();

console.log('✅ Broadcast DB ulandi:', dbPath);

module.exports = { db };
