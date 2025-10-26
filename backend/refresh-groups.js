/**
 * Guruhlar bazasini yangilash
 * Eski guruhlarni o'chirib, yangi sessiondagi guruhlarni qayta yuklaydi
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { db } = require('./src/config/database');

async function refreshGroups() {
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 GURUHLAR BAZASINI YANGILASH');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    // 1. Backup current groups
    const currentGroups = db.get('telegram_groups').value();
    console.log(`📊 Joriy guruhlar: ${currentGroups.length} ta`);

    const backupPath = path.join(__dirname, '../database/telegram_groups.backup.' + Date.now() + '.json');
    const fs = require('fs');
    fs.writeFileSync(backupPath, JSON.stringify(currentGroups, null, 2));
    console.log(`💾 Backup saqlandi: ${path.basename(backupPath)}`);
    console.log('');

    // 2. Clear telegram_groups
    console.log('🗑️  Eski guruhlarni o\'chirish...');
    db.set('telegram_groups', []).write();
    console.log('✅ Guruhlar bazasi tozalandi');
    console.log('');

    // 3. Connect to Telegram session
    console.log('📱 Telegram sessionga ulanish...');
    const apiId = parseInt(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH;
    const sessionString = process.env.TELEGRAM_SESSION_STRING || '';

    if (!apiId || !apiHash || !sessionString) {
      throw new Error('Telegram credentials topilmadi');
    }

    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const me = await client.getMe();
    console.log('✅ Session ulandi!');
    console.log(`👤 Account: ${me.firstName} ${me.phone}`);
    console.log('');

    // 4. Get all groups from session
    console.log('📥 Guruhlarni olish...');
    const dialogs = await client.getDialogs({ limit: 200 });
    const groups = dialogs.filter(d => d.isGroup || d.isChannel);

    console.log(`📱 ${groups.length} ta guruh topildi`);
    console.log('');

    // 5. Add groups to database
    console.log('💾 Guruhlarni bazaga qo\'shish...');
    let addedCount = 0;

    for (const dialog of groups) {
      const chatId = dialog.id?.toString();
      const title = dialog.title || 'Unknown';
      const username = dialog.entity?.username || '';

      if (chatId) {
        db.get('telegram_groups')
          .push({
            id: Date.now() + addedCount,
            group_id: chatId,
            group_name: title,
            group_username: username,
            added_by: 1,
            is_active: true,
            total_messages: 0,
            added_at: new Date().toISOString(),
            last_message_at: null
          })
          .write();

        addedCount++;

        if (addedCount % 10 === 0) {
          process.stdout.write(`   ${addedCount}/${groups.length} guruh qo'shildi...\r`);
        }
      }
    }

    console.log(`   ${addedCount}/${groups.length} guruh qo'shildi...`);
    console.log('');

    // 6. Disconnect
    await client.disconnect();

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ TAYYOR!');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📋 NATIJA:');
    console.log(`   Eski guruhlar: ${currentGroups.length} ta (backup qilindi)`);
    console.log(`   Yangi guruhlar: ${addedCount} ta (bazaga qo'shildi)`);
    console.log('');
    console.log('📋 KEYINGI QADAM:');
    console.log('   pm2 restart dispatchr-logistics');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ XATO:', error.message);
    console.error('');
    process.exit(1);
  }
}

refreshGroups();
