/**
 * Broadcast Microservice
 * Multi-user Telegram Broadcast System
 *
 * XAVFSIZ - Asosiy loyihaga HECH QANDAY ta'sir qilmaydi!
 */

require('dotenv').config();
const BroadcastBot = require('./bot');

console.log('🚀 Broadcast Microservice ishga tushmoqda...');
console.log('📦 Port:', process.env.PORT || 3001);
console.log('🤖 Bot Token:', process.env.BOT_TOKEN ? '✅ Mavjud' : '❌ Yo\'q');

// Check environment
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN topilmadi! .env faylni tekshiring');
  process.exit(1);
}

// Create data directory
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data papka yaratildi');
}

// Create sessions directory
const sessionsDir = path.join(__dirname, '../sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
  console.log('✅ Sessions papka yaratildi');
}

// Start bot
const bot = new BroadcastBot();
bot.start();

console.log('✅ Broadcast Microservice tayyor!');
console.log('📱 Botingiz: @YourBotUsername');
console.log('\n💡 Userlar /start buyrug\'i bilan boshlashlari mumkin');
