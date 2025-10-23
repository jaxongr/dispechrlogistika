/**
 * Telegram Session Creator
 * Bu skript Telegram session yaratadi
 */

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const phoneNumber = process.env.TELEGRAM_PHONE_NUMBER;

console.log('\n🔐 TELEGRAM SESSION YARATISH\n');
console.log('📱 Telefon raqam:', phoneNumber);
console.log('🔑 API ID:', apiId);
console.log('\n⚠️  Telefonga kod yuboriladi!\n');

const stringSession = new StringSession('');

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => await input.text('Parol (agar 2FA yoqilgan bo\'lsa): '),
    phoneCode: async () => await input.text('Telegram\'dan kelgan kodni kiriting: '),
    onError: (err) => console.log('❌ Xatolik:', err),
  });

  console.log('\n✅ Muvaffaqiyatli ulandingiz!');
  console.log('\n📋 SESSION STRING (buni .env faylga qo\'shing):\n');
  console.log(client.session.save());
  console.log('\n✅ Session yaratildi! Bu stringni .env faylga qo\'shing:\n');
  console.log('TELEGRAM_SESSION_STRING=' + client.session.save());
  console.log('\n');

  await client.disconnect();
  process.exit(0);
})();
