/**
 * Telegram Session Yaratish Skripti
 * Yangi Telegram account bilan session yaratish uchun
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error('❌ TELEGRAM_API_ID va TELEGRAM_API_HASH .env faylida bo\'lishi kerak!');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log('🔐 TELEGRAM SESSION YARATISH');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log('⚠️  MUHIM:');
console.log('   1. Yangi telefon raqam tayyorlangan bo\'lishi kerak');
console.log('   2. Bu account 100 ta guruhga qo\'shilgan bo\'lishi kerak');
console.log('   3. Eski session.json backup qilinadi');
console.log('');

(async () => {
  try {
    const client = new TelegramClient(
      new StringSession(''),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
      }
    );

    console.log('📱 Telegram\'ga ulanish...');
    console.log('');

    await client.start({
      phoneNumber: async () => {
        const phone = await input.text('Telefon raqam (+998901234567): ');
        console.log('');
        console.log('📲 Telegram\'dan kod keladi...');
        return phone;
      },
      password: async () => {
        console.log('');
        const pass = await input.text('Parol (agar bor bo\'lsa, bo\'sh qoldiring): ');
        return pass || undefined;
      },
      phoneCode: async () => {
        console.log('');
        const code = await input.text('Telegram kod (5 raqam): ');
        console.log('');
        console.log('✅ Kod qabul qilindi, tekshirilmoqda...');
        return code;
      },
      onError: (err) => {
        console.error('❌ Xato:', err.message);
      },
    });

    console.log('');
    console.log('✅ Login muvaffaqiyatli!');
    console.log('');

    // Get account info
    const me = await client.getMe();
    console.log('👤 Account ma\'lumotlari:');
    console.log('   Ism: ' + me.firstName + (me.lastName ? ' ' + me.lastName : ''));
    console.log('   Username: @' + (me.username || 'yo\'q'));
    console.log('   ID: ' + me.id);
    console.log('');

    // Save session
    const sessionString = client.session.save();
    const sessionData = {
      session: sessionString,
      created_at: new Date().toISOString(),
      account_info: {
        id: me.id.toString(),
        username: me.username,
        first_name: me.firstName,
        last_name: me.lastName,
        phone: me.phone
      }
    };

    // Backup old session if exists
    const sessionPath = path.join(__dirname, 'session.json');
    if (fs.existsSync(sessionPath)) {
      const backupPath = path.join(__dirname, 'session.old.' + Date.now() + '.json');
      fs.copyFileSync(sessionPath, backupPath);
      console.log('💾 Eski session backup qilindi: ' + path.basename(backupPath));
    }

    // Save new session
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    console.log('✅ Yangi session saqlandi: session.json');
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 TAYYOR!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📋 KEYINGI QADAMLAR:');
    console.log('   1. pm2 restart dispatchr-logistics');
    console.log('   2. pm2 logs dispatchr-logistics --lines 50');
    console.log('   3. "✅ TELEGRAM SESSION ULANDI!" xabarini kutish');
    console.log('');

    await client.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ XATO:', error.message);
    console.error('');
    console.error('Yana urinib ko\'ring yoki admin bilan bog\'laning.');
    process.exit(1);
  }
})();
