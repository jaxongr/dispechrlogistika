const { Telegraf, Markup } = require('telegraf');
const { db } = require('../config/database');
const telegramClient = require('../services/telegram-client');
require('dotenv').config();

class BroadcastBot {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);
    this.activeBroadcasts = new Map(); // userId -> { stopped: boolean }
    this.setupCommands();
    this.setupHandlers();
  }

  setupCommands() {
    // /start - Botni boshlash
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name;

      // Check if user exists
      let user = db.get('users').find({ telegram_id: userId }).value();

      if (!user) {
        // Create new user
        user = {
          id: Date.now(),
          telegram_id: userId,
          username: username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
          session_created: false,
          is_active: true,
          created_at: new Date().toISOString()
        };
        db.get('users').push(user).write();
        console.log(`✅ Yangi user: ${username} (${userId})`);
      }

      await ctx.reply(
        `🚀 <b>Broadcast Bot'ga xush kelibsiz!</b>\n\n` +
        `📢 Bu bot orqali siz o'z telegram accountingizdan guruhlaringizga xabar yuborishingiz mumkin.\n\n` +
        `👇 Pastdagi tugmalardan birini tanlang:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '🔗 Accountni ulash' }, { text: '📋 Guruhlarim' }],
              [{ text: '📢 Xabar yuborish' }, { text: 'ℹ️ Yordam' }]
            ],
            resize_keyboard: true
          }
        }
      );
    });

    // /connect - Session yaratish
    this.bot.command('connect', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user) {
        await ctx.reply('❌ Avval /start ni bosing!');
        return;
      }

      if (user.session_created) {
        await ctx.reply('✅ Siz allaqachon ulangansiz!\n\n/groups - Guruhlaringizni ko\'rish');
        return;
      }

      await ctx.reply(
        `📱 <b>Telegram accountingizni ulash</b>\n\n` +
        `/create_session - Ulashni boshlash\n\n` +
        `⚠️ <b>Xavfsiz:</b> Sizning parolingiz saqlanmaydi!\n` +
        `✅ Faqat telefon raqam va SMS kod kerak`,
        { parse_mode: 'HTML' }
      );
    });

    // /create_session - Session yaratish yo'riqnomasi
    this.bot.command('create_session', async (ctx) => {
      const userId = ctx.from.id;

      await ctx.reply(
        `🔐 <b>Session yaratish</b>\n\n` +
        `📱 <b>Telefon raqamingizni yuboring:</b>\n` +
        `   Masalan: <code>+998901234567</code>\n\n` +
        `✅ Keyin SMS kod keladi - uni yuboring\n` +
        `✅ Agar 2FA parol bo'lsa - uni yuboring\n\n` +
        `⚠️ <b>Muhim:</b> Faqat telefon raqamingizni yuboring!`,
        { parse_mode: 'HTML' }
      );

      // Set waiting state
      db.get('users')
        .find({ telegram_id: userId })
        .assign({ waiting_for_phone: true })
        .write();
    });

    // /groups - Guruhlarni ko'rish
    this.bot.command('groups', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user || !user.session_created) {
        await ctx.reply('❌ Avval accountingizni ulang: /connect');
        return;
      }

      const userGroups = db.get('user_groups')
        .filter({ user_id: user.id })
        .value();

      if (userGroups.length === 0) {
        await ctx.reply('📭 Sizda guruhlar topilmadi!\n\nGuruhlaringizni botga qo\'shing.');
        return;
      }

      let message = `📋 <b>Sizning guruhlaringiz (${userGroups.length} ta):</b>\n\n`;
      userGroups.forEach((group, index) => {
        message += `${index + 1}. ${group.title}\n`;
      });

      await ctx.reply(message, { parse_mode: 'HTML' });
    });

    // /broadcast - Xabar yuborish
    this.bot.command('broadcast', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user || !user.session_created) {
        await ctx.reply('❌ Avval accountingizni ulang: /connect');
        return;
      }

      const userGroups = db.get('user_groups')
        .filter({ user_id: user.id })
        .value();

      if (userGroups.length === 0) {
        await ctx.reply('❌ Sizda guruhlar yo\'q!');
        return;
      }

      await ctx.reply(
        `📢 <b>Xabar yuborish</b>\n\n` +
        `Yubormoqchi bo'lgan xabaringizni yuboring.\n\n` +
        `📊 <b>Statistika:</b>\n` +
        `• Guruhlar: ${userGroups.length} ta\n` +
        `• Interval: 3.5 soniya\n` +
        `• Batch: 20 ta → 15s dam\n` +
        `• Tsikl: 5 daqiqa dam\n\n` +
        `⚠️ Bekor qilish: /cancel`,
        { parse_mode: 'HTML' }
      );

      db.get('users')
        .find({ telegram_id: userId })
        .assign({ waiting_for_message: true })
        .write();
    });

    // /cancel - Bekor qilish
    this.bot.command('cancel', async (ctx) => {
      const userId = ctx.from.id;

      db.get('users')
        .find({ telegram_id: userId })
        .assign({
          waiting_for_phone: false,
          waiting_for_code: false,
          waiting_for_message: false
        })
        .write();

      await ctx.reply('✅ Jarayon bekor qilindi!');
    });

    // /stop - Broadcast to'xtatish
    this.bot.command('stop', async (ctx) => {
      const userId = ctx.from.id;

      if (this.activeBroadcasts.has(userId)) {
        this.activeBroadcasts.get(userId).stopped = true;
        await ctx.reply(
          '⏸️ Broadcast to\'xtatilmoqda...\n\nKeyingi guruhdan keyin to\'xtaydi.',
          {
            reply_markup: {
              keyboard: [
                [{ text: '🔗 Accountni ulash' }, { text: '📋 Guruhlarim' }],
                [{ text: '📢 Xabar yuborish' }, { text: 'ℹ️ Yordam' }]
              ],
              resize_keyboard: true
            }
          }
        );
      } else {
        await ctx.reply('❌ Hozirda faol broadcast yo\'q!');
      }
    });

    // /help - Yordam
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `📚 <b>Yordam</b>\n\n` +
        `<b>Asosiy buyruqlar:</b>\n` +
        `/start - Botni boshlash\n` +
        `/connect - Account ulash\n` +
        `/groups - Guruhlaringiz\n` +
        `/broadcast - Xabar yuborish\n` +
        `/mystats - Statistika\n` +
        `/cancel - Bekor qilish\n\n` +
        `<b>Rate Limiting:</b>\n` +
        `• Har bir guruh: 4 soniya\n` +
        `• 20 ta guruh → 30 soniya dam\n` +
        `• Tsikl tugadi → 5 daqiqa dam\n\n` +
        `⚠️ Bu xavfsiz tezlik - account freeze bo'lmaydi!`,
        { parse_mode: 'HTML' }
      );
    });
  }

  setupHandlers() {
    // Keyboard button handlers
    this.bot.hears('🔗 Accountni ulash', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user) {
        await ctx.reply('❌ Avval /start ni bosing!');
        return;
      }

      if (user.session_created) {
        await ctx.reply('✅ Siz allaqachon ulangansiz!\n\n/groups - Guruhlaringizni ko\'rish');
        return;
      }

      await ctx.reply(
        `📱 <b>Telegram accountingizni ulash</b>\n\n` +
        `/create_session - Ulashni boshlash\n\n` +
        `⚠️ <b>Xavfsiz:</b> Sizning parolingiz saqlanmaydi!\n` +
        `✅ Faqat telefon raqam va SMS kod kerak`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.hears('📋 Guruhlarim', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user || !user.session_created) {
        await ctx.reply('❌ Avval accountingizni ulang: 🔗 Accountni ulash');
        return;
      }

      const userGroups = db.get('user_groups')
        .filter({ user_id: user.id })
        .value();

      if (userGroups.length === 0) {
        await ctx.reply('📭 Sizda guruhlar topilmadi!\n\nGuruhlaringizni botga qo\'shing.');
        return;
      }

      let message = `📋 <b>Sizning guruhlaringiz (${userGroups.length} ta):</b>\n\n`;
      userGroups.forEach((group, index) => {
        message += `${index + 1}. ${group.title}\n`;
      });

      await ctx.reply(message, { parse_mode: 'HTML' });
    });

    this.bot.hears('📢 Xabar yuborish', async (ctx) => {
      const userId = ctx.from.id;
      const user = db.get('users').find({ telegram_id: userId }).value();

      if (!user || !user.session_created) {
        await ctx.reply('❌ Avval accountingizni ulang: 🔗 Accountni ulash');
        return;
      }

      const userGroups = db.get('user_groups')
        .filter({ user_id: user.id })
        .value();

      if (userGroups.length === 0) {
        await ctx.reply('❌ Sizda guruhlar yo\'q!');
        return;
      }

      await ctx.reply(
        `📢 <b>Xabar yuborish</b>\n\n` +
        `Yubormoqchi bo'lgan xabaringizni yuboring.\n\n` +
        `📊 <b>Statistika:</b>\n` +
        `• Guruhlar: ${userGroups.length} ta\n` +
        `• Interval: 3.5 soniya\n` +
        `• Batch: 20 ta → 15s dam\n` +
        `• Tsikl: 5 daqiqa dam\n\n` +
        `⚠️ Bekor qilish: /cancel`,
        { parse_mode: 'HTML' }
      );

      db.get('users')
        .find({ telegram_id: userId })
        .assign({ waiting_for_message: true })
        .write();
    });

    this.bot.hears('ℹ️ Yordam', async (ctx) => {
      await ctx.reply(
        `📚 <b>Yordam</b>\n\n` +
        `<b>Asosiy buyruqlar:</b>\n` +
        `🔗 Accountni ulash\n` +
        `📋 Guruhlarim\n` +
        `📢 Xabar yuborish\n` +
        `/mystats - Statistika\n` +
        `/cancel - Bekor qilish\n\n` +
        `<b>Rate Limiting:</b>\n` +
        `• Har bir guruh: 4 soniya\n` +
        `• 20 ta guruh → 30 soniya dam\n` +
        `• Tsikl tugadi → 5 daqiqa dam\n\n` +
        `⚠️ Bu xavfsiz tezlik - account freeze bo'lmaydi!`,
        { parse_mode: 'HTML' }
      );
    });

    this.bot.hears('⏹ To\'xtatish', async (ctx) => {
      const userId = ctx.from.id;

      if (this.activeBroadcasts.has(userId)) {
        this.activeBroadcasts.get(userId).stopped = true;
        await ctx.reply(
          '⏸️ Broadcast to\'xtatilmoqda...\n\nKeyingi guruhdan keyin to\'xtaydi.',
          {
            reply_markup: {
              keyboard: [
                [{ text: '🔗 Accountni ulash' }, { text: '📋 Guruhlarim' }],
                [{ text: '📢 Xabar yuborish' }, { text: 'ℹ️ Yordam' }]
              ],
              resize_keyboard: true
            }
          }
        );
      } else {
        await ctx.reply('❌ Hozirda faol broadcast yo\'q!');
      }
    });

    // Text message handler
    this.bot.on('text', async (ctx) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;

      const user = db.get('users').find({ telegram_id: userId }).value();
      if (!user) {
        await ctx.reply('❌ Avval /start ni bosing!');
        return;
      }

      // Telefon raqam kutilmoqda
      if (user.waiting_for_phone) {
        if (text.startsWith('+')) {
          await ctx.reply('📱 Telefon raqam qabul qilindi!\n\n⏳ SMS kod yuborilmoqda...');

          // Start Telegram client and send code
          const result = await telegramClient.startAuth(userId, text);

          if (result.success) {
            db.get('users')
              .find({ telegram_id: userId })
              .assign({
                waiting_for_phone: false,
                waiting_for_code: true,
                phone_number: text
              })
              .write();

            await ctx.reply('✅ SMS kod yuborildi!\n\n🔐 Endi kodni yuboring...');
          } else {
            await ctx.reply(`❌ Xatolik: ${result.error}\n\nQaytadan urinib ko'ring: /connect`);
            db.get('users')
              .find({ telegram_id: userId })
              .assign({ waiting_for_phone: false })
              .write();
          }
        } else {
          await ctx.reply('❌ Telefon raqam + bilan boshlanishi kerak!\nMasalan: +998901234567');
        }
        return;
      }

      // SMS kod kutilmoqda
      if (user.waiting_for_code) {
        await ctx.reply('✅ Kod qabul qilindi! Tekshirilmoqda...');

        // Verify code and create session
        const result = await telegramClient.verifyCode(userId, text);

        if (result.success) {
          db.get('users')
            .find({ telegram_id: userId })
            .assign({
              waiting_for_code: false,
              waiting_for_password: false,
              session_created: true
            })
            .write();

          await ctx.reply(
            '🎉 <b>Account muvaffaqiyatli ulandi!</b>\n\n' +
            '📋 Guruhlaringiz yuklanmoqda...',
            { parse_mode: 'HTML' }
          );

          // Wait a bit for groups to load
          setTimeout(async () => {
            const userGroups = db.get('user_groups')
              .filter({ user_id: user.id })
              .value();

            await ctx.reply(
              `✅ <b>Tayyor!</b>\n\n` +
              `📊 Sizda <b>${userGroups.length} ta</b> guruh topildi.\n\n` +
              `🎯 Endi /broadcast buyrug'i bilan xabar yuborishingiz mumkin!`,
              { parse_mode: 'HTML' }
            );
          }, 3000);

        } else if (result.needPassword) {
          // 2FA password kerak
          db.get('users')
            .find({ telegram_id: userId })
            .assign({
              waiting_for_code: false,
              waiting_for_password: true
            })
            .write();

          await ctx.reply(
            '🔒 <b>2FA parol kerak</b>\n\n' +
            'Telegram accountingiz 2FA bilan himoyalangan.\n' +
            'Iltimos, parolingizni yuboring.',
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(`❌ Xatolik: ${result.error}\n\nQaytadan urinib ko'ring: /connect`);
          db.get('users')
            .find({ telegram_id: userId })
            .assign({ waiting_for_code: false })
            .write();
        }
        return;
      }

      // 2FA parol kutilmoqda
      if (user.waiting_for_password) {
        await ctx.reply('🔐 Parol qabul qilindi! Tekshirilmoqda...');

        const result = await telegramClient.verifyCode(userId, user.temp_code || '', text);

        if (result.success) {
          db.get('users')
            .find({ telegram_id: userId })
            .assign({
              waiting_for_password: false,
              session_created: true,
              temp_code: null
            })
            .write();

          await ctx.reply(
            '🎉 <b>Account muvaffaqiyatli ulandi!</b>\n\n' +
            '📋 Guruhlaringiz yuklanmoqda...',
            { parse_mode: 'HTML' }
          );

          setTimeout(async () => {
            const userGroups = db.get('user_groups')
              .filter({ user_id: user.id })
              .value();

            await ctx.reply(
              `✅ <b>Tayyor!</b>\n\n` +
              `📊 Sizda <b>${userGroups.length} ta</b> guruh topildi.\n\n` +
              `🎯 Endi /broadcast buyrug'i bilan xabar yuborishingiz mumkin!`,
              { parse_mode: 'HTML' }
            );
          }, 3000);
        } else {
          await ctx.reply(`❌ Xatolik: ${result.error}\n\nQaytadan urinib ko'ring: /connect`);
          db.get('users')
            .find({ telegram_id: userId })
            .assign({ waiting_for_password: false })
            .write();
        }
        return;
      }

      // Broadcast xabari kutilmoqda
      if (user.waiting_for_message) {
        const messageText = text;

        await ctx.reply('✅ Xabar qabul qilindi!\n\n📊 Broadcast boshlanmoqda...');

        // Get user groups
        const userGroups = db.get('user_groups')
          .filter({ user_id: user.id })
          .value();

        if (userGroups.length === 0) {
          await ctx.reply('❌ Guruhlar topilmadi!');
          db.get('users')
            .find({ telegram_id: userId })
            .assign({ waiting_for_message: false })
            .write();
          return;
        }

        // Start broadcast
        db.get('users')
          .find({ telegram_id: userId })
          .assign({ waiting_for_message: false })
          .write();

        // Register active broadcast
        this.activeBroadcasts.set(userId, { stopped: false });

        let sentCount = 0;
        let failedCount = 0;
        const startTime = Date.now();

        // Show stop button
        await ctx.reply(
          '⏹ <b>Broadcast to\'xtatish uchun:</b>',
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [[{ text: '⏹ To\'xtatish' }]],
              resize_keyboard: true
            }
          }
        );

        // Progress message
        const progressMsg = await ctx.reply(
          `📊 <b>Broadcast jarayoni:</b>\n\n` +
          `📤 Yuborildi: 0/${userGroups.length}\n` +
          `❌ Xato: 0\n` +
          `⏱ Vaqt: 0s`,
          { parse_mode: 'HTML' }
        );

        // Send to each group with rate limiting
        for (let i = 0; i < userGroups.length; i++) {
          // Check if stopped
          if (this.activeBroadcasts.get(userId)?.stopped) {
            await ctx.reply('⏸️ Broadcast to\'xtatildi!');
            break;
          }

          const group = userGroups[i];

          try {
            const result = await telegramClient.sendMessageToGroup(
              userId,
              group.telegram_group_id,
              messageText
            );

            if (result.success) {
              sentCount++;
            } else {
              failedCount++;
              console.error(`❌ Guruhga yuborib bo'lmadi: ${group.title} - ${result.error}`);
            }
          } catch (error) {
            failedCount++;
            console.error(`❌ Xatolik: ${group.title} - ${error.message}`);
          }

          // Update progress every 5 messages
          if ((i + 1) % 5 === 0 || i === userGroups.length - 1) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              progressMsg.message_id,
              null,
              `📊 <b>Broadcast jarayoni:</b>\n\n` +
              `📤 Yuborildi: ${sentCount}/${userGroups.length}\n` +
              `❌ Xato: ${failedCount}\n` +
              `⏱ Vaqt: ${elapsed}s`,
              { parse_mode: 'HTML' }
            );
          }

          // Rate limiting
          if ((i + 1) % 20 === 0 && i < userGroups.length - 1) {
            // 20 ta guruh → 15 soniya dam
            await ctx.reply('⏸️ 20 ta guruh yuborildi, 15 soniya dam olinmoqda...');
            await new Promise(resolve => setTimeout(resolve, 15000));
          } else if (i < userGroups.length - 1) {
            // Har bir guruh orasida 3.5 soniya
            await new Promise(resolve => setTimeout(resolve, 3500));
          }
        }

        // Cleanup
        this.activeBroadcasts.delete(userId);

        // Final report
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        await ctx.reply(
          `🎉 <b>Broadcast tugadi!</b>\n\n` +
          `✅ Muvaffaqiyatli: ${sentCount}\n` +
          `❌ Xato: ${failedCount}\n` +
          `📊 Jami: ${userGroups.length}\n` +
          `⏱ Jami vaqt: ${totalTime}s`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [
                [{ text: '🔗 Accountni ulash' }, { text: '📋 Guruhlarim' }],
                [{ text: '📢 Xabar yuborish' }, { text: 'ℹ️ Yordam' }]
              ],
              resize_keyboard: true
            }
          }
        );

        return;
      }
    });
  }

  start() {
    this.bot.launch();
    console.log('✅ Broadcast Bot ishga tushdi!');

    // Graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

module.exports = BroadcastBot;
