const { Telegraf, Markup } = require('telegraf');
const { db } = require('../config/database');
require('dotenv').config();

class BroadcastBot {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);
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
        `📋 <b>Qadamlar:</b>\n` +
        `1️⃣ /connect - Telegram accountingizni ulash\n` +
        `2️⃣ /groups - Guruhlaringizni ko'rish\n` +
        `3️⃣ /broadcast - Xabar yuborish\n\n` +
        `ℹ️ /help - Yordam`,
        { parse_mode: 'HTML' }
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
        `Ushbu linkka o'ting va ko'rsatmalarga amal qiling:\n` +
        `👉 /create_session\n\n` +
        `⚠️ Bu xavfsiz - biz sizning parolingizni saqlamaymiz!`,
        { parse_mode: 'HTML' }
      );
    });

    // /create_session - Session yaratish yo'riqnomasi
    this.bot.command('create_session', async (ctx) => {
      const userId = ctx.from.id;

      await ctx.reply(
        `🔐 <b>Session yaratish</b>\n\n` +
        `1. Telegram'dan API ID va API Hash oling:\n` +
        `   👉 https://my.telegram.org/apps\n\n` +
        `2. Telefon raqamingizni yuboring:\n` +
        `   Format: +998901234567\n\n` +
        `3. SMS kod keladi - uni yuboring\n` +
        `4. Agar 2FA bo'lsa - parolni yuboring\n\n` +
        `⚠️ Botga FAQAT telefon raqamingizni yuboring!`,
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
        `• Interval: 4 soniya\n` +
        `• Batch: 20 ta → 30s dam\n` +
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
          await ctx.reply('📱 Telefon raqam qabul qilindi!\n\n🔐 Endi SMS kodni yuboring...');

          db.get('users')
            .find({ telegram_id: userId })
            .assign({
              waiting_for_phone: false,
              waiting_for_code: true,
              phone_number: text
            })
            .write();

          // TODO: Start Telegram client and send code
        } else {
          await ctx.reply('❌ Telefon raqam + bilan boshlanishi kerak!\nMasalan: +998901234567');
        }
        return;
      }

      // SMS kod kutilmoqda
      if (user.waiting_for_code) {
        await ctx.reply('✅ Kod qabul qilindi! Tekshirilmoqda...');

        // TODO: Verify code and create session

        db.get('users')
          .find({ telegram_id: userId })
          .assign({
            waiting_for_code: false,
            session_created: true
          })
          .write();

        await ctx.reply('✅ Account muvaffaqiyatli ulandi!\n\n/groups - Guruhlaringizni ko\'rish');
        return;
      }

      // Broadcast xabari kutilmoqda
      if (user.waiting_for_message) {
        await ctx.reply('✅ Xabar qabul qilindi!\n\n📊 Broadcast boshlanmoqda...');

        // TODO: Start broadcast

        db.get('users')
          .find({ telegram_id: userId })
          .assign({ waiting_for_message: false })
          .write();

        await ctx.reply('🎉 Broadcast boshlandi! Statistika tez orada yuboriladi.');
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
