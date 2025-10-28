const { Markup } = require('telegraf');
const driverManager = require('./driver-manager');

/**
 * HAYDOVCHI BOT HANDLER
 * Telegram bot uchun haydovchi boshqaruv commandlari
 */

class DriverBotHandler {
  constructor() {
    this.userStates = new Map(); // User holatlarini saqlash
  }

  /**
   * Bot'ga handlerlarni ulash
   */
  setupHandlers(bot) {
    // Asosiy menyu
    bot.command('haydovchilar', (ctx) => this.showMainMenu(ctx));
    bot.action('drivers_menu', (ctx) => this.showMainMenu(ctx));

    // Haydovchi tekshirish
    bot.action('driver_check', (ctx) => this.startDriverCheck(ctx));
    bot.action('driver_add', (ctx) => this.startDriverAdd(ctx));
    bot.action('driver_list', (ctx) => this.showDriverList(ctx));
    bot.action('driver_stats', (ctx) => this.showStatistics(ctx));

    // Qora/Oq ro'yxat tanlash
    bot.action('add_blacklist', (ctx) => this.startAddBlacklist(ctx));
    bot.action('add_whitelist', (ctx) => this.startAddWhitelist(ctx));

    // Text message handler - faqat driver state bor bo'lsa
    bot.on('text', (ctx, next) => {
      const userId = ctx.from.id;
      if (this.userStates.has(userId)) {
        return this.handleTextMessage(ctx);
      }
      // Aks holda keyingi handlerga o'tkazish
      return next();
    });

    console.log('✅ Haydovchi bot handlerlari ulandi');
  }

  /**
   * Asosiy menyu
   */
  async showMainMenu(ctx) {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👤 Haydovchi tekshirish', 'driver_check')],
      [Markup.button.callback('➕ Haydovchi qo\'shish', 'driver_add')],
      [Markup.button.callback('📋 Barcha haydovchilar', 'driver_list')]
    ]);

    const text = `🚛 HAYDOVCHILAR BOSHQARUV TIZIMI\n\nTanlang:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, keyboard);
    } else {
      await ctx.reply(text, keyboard);
    }
  }

  /**
   * Haydovchi tekshirishni boshlash
   */
  async startDriverCheck(ctx) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('📱 Haydovchining telefon raqamini kiriting:\n(Masalan: +998901234567)');

    this.userStates.set(ctx.from.id, { action: 'check_driver' });
  }

  /**
   * Haydovchi qo'shishni boshlash
   */
  async startDriverAdd(ctx) {
    await ctx.answerCbQuery();

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⚫ Qora ro\'yxat (pul bermaydi)', 'add_blacklist')],
      [Markup.button.callback('⚪ Oq ro\'yxat (yaxshi haydovchi)', 'add_whitelist')],
      [Markup.button.callback('🔙 Orqaga', 'drivers_menu')]
    ]);

    await ctx.editMessageText('Qaysi ro\'yxatga qo\'shasiz?', keyboard);
  }

  /**
   * Qora ro'yxatga qo'shish
   */
  async startAddBlacklist(ctx) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⚫ QORA RO\'YXATGA QO\'SHISH\n\nTelefon raqam kiriting:');

    this.userStates.set(ctx.from.id, {
      action: 'add_driver',
      list_type: 'black',
      step: 'phone'
    });
  }

  /**
   * Oq ro'yxatga qo'shish
   */
  async startAddWhitelist(ctx) {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⚪ OQ RO\'YXATGA QO\'SHISH\n\nTelefon raqam kiriting:');

    this.userStates.set(ctx.from.id, {
      action: 'add_driver',
      list_type: 'white',
      step: 'phone'
    });
  }

  /**
   * Text xabarlarni qayta ishlash
   */
  async handleTextMessage(ctx) {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);

    if (!state) return;

    const text = ctx.message.text.trim();

    // Haydovchi tekshirish
    if (state.action === 'check_driver') {
      await this.checkDriver(ctx, text);
      this.userStates.delete(userId);
      return;
    }

    // Haydovchi qo'shish
    if (state.action === 'add_driver') {
      await this.processAddDriver(ctx, text, state);
    }
  }

  /**
   * Haydovchini tekshirish
   */
  async checkDriver(ctx, phone) {
    const history = driverManager.getDriverHistory(phone);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Bosh menyu', 'drivers_menu')]
    ]);

    if (!history) {
      await ctx.reply(`❌ Haydovchi topilmadi: ${phone}\n\nBu haydovchi ro'yxatda yo'q.`, keyboard);
      return;
    }

    let message = `📱 HAYDOVCHI: ${history.phone}\n\n`;

    // Agar ikkalasida ham bo'lsa
    if (history.list_type === 'both') {
      message += `⚫⚪ IKKI RO'YXATDA HAM BOR\n\n`;

      // Qora ro'yxat ma'lumoti
      if (history.black_list_info) {
        message += `⚫ QORA RO'YXAT:\n`;
        message += `🚗 ${history.black_list_info.truck.type || '?'}\n`;
        message += `💰 Qarz: ${history.black_list_info.total_debt.toLocaleString()} so'm\n`;
        message += `👤 Qo'shgan: ${history.black_list_info.added_by}\n\n`;
      }

      // Oq ro'yxat ma'lumoti
      if (history.white_list_info) {
        message += `⚪ OQ RO'YXAT:\n`;
        message += `🚗 ${history.white_list_info.truck.type || '?'}\n`;
        message += `⭐ Reyting: ${history.white_list_info.rating}/5\n`;
        message += `👤 Qo'shgan: ${history.white_list_info.added_by}\n\n`;
      }
    } else {
      // Faqat bitta ro'yxatda
      const icon = history.list_type === 'black' ? '⚫' : '⚪';
      const listName = history.list_type === 'black' ? 'QORA RO\'YXAT' : 'OQ RO\'YXAT';

      message += `${icon} ${listName}\n\n`;

      const info = history.list_type === 'black' ? history.black_list_info : history.white_list_info;
      if (info) {
        message += `🚗 Mashina: ${info.truck.type || '?'}\n`;
        if (history.list_type === 'black' && info.total_debt > 0) {
          message += `💰 Qarz: ${info.total_debt.toLocaleString()} so'm\n`;
        }
        message += `👤 Qo'shgan: ${info.added_by}\n\n`;
      }
    }

    message += `📝 TARIXLAR (${history.total_records} ta):\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;

    history.history.slice(0, 5).forEach((h, i) => {
      const date = new Date(h.date).toLocaleString('uz-UZ');
      const typeIcon = h.list_type === 'black' ? '⚫' : '⚪';

      message += `\n${typeIcon} 📅 ${date}\n`;
      message += `👤 ${h.dispatcher_name}\n`;
      if (h.route) message += `📍 ${h.route}\n`;
      if (h.debt) message += `💰 ${h.debt.toLocaleString()} so'm\n`;
      if (h.reason) message += `⚠️ ${h.reason}\n`;
      if (h.note) message += `📝 ${h.note}\n`;
    });

    if (history.total_records > 5) {
      message += `\n... va yana ${history.total_records - 5} ta qayd`;
    }

    await ctx.reply(message, keyboard);
  }

  /**
   * Haydovchi qo'shish jarayoni - SODDA VERSIYA
   */
  async processAddDriver(ctx, text, state) {
    const userId = ctx.from.id;

    if (state.step === 'phone') {
      state.phone = text;
      state.step = 'truck_type';
      this.userStates.set(userId, state);
      await ctx.reply('Mashina turi:\n(Masalan: Isuzu, Kamaz, Labo)');
      return;
    }

    if (state.step === 'truck_type') {
      state.truck_type = text;
      // To'g'ridan to'g'ri saqlash
      await this.saveDriver(ctx, state);
    }
  }

  /**
   * Haydovchini saqlash
   */
  async saveDriver(ctx, state) {
    try {
      const driver = driverManager.addDriver({
        phone: state.phone,
        list_type: state.list_type,
        truck_type: state.truck_type,
        truck_color: '',
        truck_plate: '',
        reason: '',
        note: '',
        dispatcher_id: ctx.from.id.toString(),
        dispatcher_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '')
      });

      const icon = state.list_type === 'black' ? '⚫' : '⚪';
      const listName = state.list_type === 'black' ? 'QORA RO\'YXATGA' : 'OQ RO\'YXATGA';

      // Raxmat va bosh menyuga qaytish
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Bosh menyu', 'drivers_menu')]
      ]);

      await ctx.reply(
        `✅ ${icon} ${listName} QO\'SHILDI!\n\n📱 ${driver.phone}\n🚗 ${driver.truck.type}\n\n🙏 Raxmat!`,
        keyboard
      );

      this.userStates.delete(ctx.from.id);
    } catch (error) {
      console.error('Haydovchi saqlashda xato:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      this.userStates.delete(ctx.from.id);
    }
  }

  /**
   * Statistika
   */
  async showStatistics(ctx) {
    await ctx.answerCbQuery();

    const stats = driverManager.getStatistics();

    let message = '📊 HAYDOVCHILAR STATISTIKASI\n\n';
    message += `⚫ QORA RO'YXAT: ${stats.black_list.total} ta\n`;
    message += `   💰 Jami qarz: ${stats.black_list.total_debt.toLocaleString()} so'm\n`;
    message += `   📈 Oxirgi 30 kun: ${stats.black_list.recent_30days} ta\n\n`;

    message += `⚪ OQ RO'YXAT: ${stats.white_list.total} ta\n`;
    message += `   📈 Oxirgi 30 kun: ${stats.white_list.recent_30days} ta\n\n`;

    if (stats.top_dispatchers.length > 0) {
      message += `👥 ENG FAOL DISPATCHERLAR:\n`;
      stats.top_dispatchers.forEach((d, i) => {
        message += `   ${i + 1}. ${d.name} - ${d.count} ta\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Bosh menyu', 'drivers_menu')]
    ]);

    await ctx.editMessageText(message, keyboard);
  }

  /**
   * Barcha haydovchilar ro'yxati
   */
  async showDriverList(ctx) {
    await ctx.answerCbQuery();

    const blackList = driverManager.getAllDrivers('black').slice(0, 10);
    const whiteList = driverManager.getAllDrivers('white').slice(0, 10);

    let message = '📋 HAYDOVCHILAR RO\'YXATI\n\n';

    message += `⚫ QORA RO'YXAT (oxirgi 10 ta):\n`;
    blackList.forEach((d, i) => {
      message += `${i + 1}. ${d.phone} | ${d.truck.type || '?'}\n`;
    });

    message += `\n⚪ OQ RO'YXAT (oxirgi 10 ta):\n`;
    whiteList.forEach((d, i) => {
      message += `${i + 1}. ${d.phone} | ${d.truck.type || '?'}\n`;
    });

    message += `\n💡 Haydovchini tekshirish uchun: /haydovchilar`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Bosh menyu', 'drivers_menu')]
    ]);

    await ctx.editMessageText(message, keyboard);
  }
}

module.exports = new DriverBotHandler();
