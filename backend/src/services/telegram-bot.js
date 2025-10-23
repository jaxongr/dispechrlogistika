/**
 * Telegram Bot Service
 *
 * Bu service ikkita vazifani bajaradi:
 * 1. Approve qilingan e'lonlarni pulli kanal/guruhga yuborish
 * 2. To'lov va obuna botini boshqarish
 */

const { Telegraf, Markup } = require('telegraf');
const Subscription = require('../models/Subscription');
const Message = require('../models/Message');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
  }

  /**
   * Botni ishga tushirish
   */
  async start() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN .env faylida bo\'lishi kerak');
      }

      this.bot = new Telegraf(botToken);

      // Komandalar
      this.setupCommands();

      // To'lov handlerlari
      this.setupPaymentHandlers();

      // Botni ishga tushirish
      await this.bot.launch();
      this.isRunning = true;

      console.log('✅ Telegram bot ishga tushdi!');
      console.log('🤖 Bot username:', (await this.bot.telegram.getMe()).username);

    } catch (error) {
      console.error('❌ Botni ishga tushirishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Bot komandalarini sozlash
   */
  setupCommands() {
    // /start komandasi
    this.bot.command('start', async (ctx) => {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📊 Obuna holati', 'check_subscription')],
        [Markup.button.callback('💳 Obuna sotib olish', 'buy_subscription')],
        [Markup.button.callback('ℹ️ Ma\'lumot', 'info')]
      ]);

      await ctx.reply(
        `🚛 *Logistika E'lonlar Filtri*\n\n` +
        `Assalomu alaykum! Bu bot orqali siz filtrlangan, sifatli logistika e'lonlarini olishingiz mumkin.\n\n` +
        `✅ Dispetcherlar filtrlangan\n` +
        `✅ Faqat asl yuk egalari\n` +
        `✅ Real vaqtda yangilanadi\n\n` +
        `Obuna turlarini ko'rish uchun /subscribe ni bosing`,
        {
          parse_mode: 'Markdown',
          ...keyboard
        }
      );
    });

    // /subscribe komandasi
    this.bot.command('subscribe', async (ctx) => {
      await this.showSubscriptionPlans(ctx);
    });

    // Obuna holati
    this.bot.action('check_subscription', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from.id;

      const subscription = await Subscription.findActiveByTelegramId(userId);

      if (!subscription) {
        await ctx.reply('❌ Sizda faol obuna yo\'q.\n\nObuna sotib olish uchun /subscribe ni bosing.');
        return;
      }

      const endDate = new Date(subscription.end_date);
      const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

      await ctx.reply(
        `✅ *Faol obuna*\n\n` +
        `Tur: ${subscription.subscription_type}\n` +
        `Tugash sanasi: ${endDate.toLocaleDateString('uz-UZ')}\n` +
        `Qolgan kunlar: ${daysLeft} kun`,
        { parse_mode: 'Markdown' }
      );
    });

    // Obuna sotib olish
    this.bot.action('buy_subscription', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showSubscriptionPlans(ctx);
    });

    // Ma'lumot
    this.bot.action('info', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `ℹ️ *Loyiha haqida*\n\n` +
        `Bu bot 100+ logistika guruhlaridan e'lonlarni to'playdi va dispetcherlarni filtrlab, ` +
        `faqat asl yuk egalarining e'lonlarini sizga yetkazadi.\n\n` +
        `📈 Har kuni minglab e'lonlar\n` +
        `🎯 90%+ aniqlik darajasi\n` +
        `⚡ Real vaqtda yangilanadi\n\n` +
        `Savol va takliflar uchun: @support`,
        { parse_mode: 'Markdown' }
      );
    });

    // Obuna turini tanlash
    this.bot.action(/^sub_(.+)$/, async (ctx) => {
      const subscriptionType = ctx.match[1];
      await ctx.answerCbQuery();

      let amount, amountStars;
      const prices = {
        daily: { uzs: 50000, stars: 50 },
        weekly: { uzs: 300000, stars: 300 },
        monthly: { uzs: 1000000, stars: 1000 }
      };

      amount = prices[subscriptionType].uzs;
      amountStars = prices[subscriptionType].stars;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(`💰 To'lash (${amountStars} ⭐)`, `pay_${subscriptionType}`)],
        [Markup.button.callback('◀️ Orqaga', 'buy_subscription')]
      ]);

      let typeName = subscriptionType === 'daily' ? 'Kunlik' :
                     subscriptionType === 'weekly' ? 'Haftalik' : 'Oylik';

      await ctx.editMessageText(
        `📦 *${typeName} obuna*\n\n` +
        `Narx: ${amount.toLocaleString('uz-UZ')} so'm\n` +
        `Telegram Stars: ${amountStars} ⭐\n\n` +
        `To'lash uchun pastdagi tugmani bosing.`,
        {
          parse_mode: 'Markdown',
          ...keyboard
        }
      );
    });

    // To'lov tugmasi
    this.bot.action(/^pay_(.+)$/, async (ctx) => {
      const subscriptionType = ctx.match[1];
      await ctx.answerCbQuery();

      const prices = {
        daily: 50,
        weekly: 300,
        monthly: 1000
      };

      const amountStars = prices[subscriptionType];
      let typeName = subscriptionType === 'daily' ? 'Kunlik' :
                     subscriptionType === 'weekly' ? 'Haftalik' : 'Oylik';

      try {
        // Telegram Stars to'lovi
        await ctx.replyWithInvoice({
          title: `${typeName} Obuna`,
          description: `Logistika e'lonlar filtriga ${typeName.toLowerCase()} obuna`,
          payload: JSON.stringify({
            subscription_type: subscriptionType,
            user_id: ctx.from.id
          }),
          provider_token: '', // Telegram Stars uchun bo'sh
          currency: 'XTR', // Telegram Stars currency
          prices: [{ label: `${typeName} obuna`, amount: amountStars }]
        });
      } catch (error) {
        console.error('To\'lov yaratishda xatolik:', error);
        await ctx.reply('❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.');
      }
    });
  }

  /**
   * To'lov handlerlarini sozlash
   */
  setupPaymentHandlers() {
    // Pre-checkout query
    this.bot.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
      } catch (error) {
        console.error('Pre-checkout xatolik:', error);
        await ctx.answerPreCheckoutQuery(false, 'Xatolik yuz berdi');
      }
    });

    // Muvaffaqiyatli to'lov
    this.bot.on('successful_payment', async (ctx) => {
      try {
        const payment = ctx.message.successful_payment;
        const payload = JSON.parse(payment.invoice_payload);

        console.log('✅ To\'lov muvaffaqiyatli:', payment);

        // Obunani yaratish
        const subscription = await Subscription.create({
          telegram_user_id: ctx.from.id,
          username: ctx.from.username || '',
          full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
          subscription_type: payload.subscription_type,
          amount: payment.total_amount,
          currency: payment.currency
        });

        // Foydalanuvchini kanalga qo'shish
        const channelId = process.env.TARGET_CHANNEL_ID;
        if (channelId) {
          try {
            // Kanal invite link yaratish
            const inviteLink = await this.bot.telegram.createChatInviteLink(channelId, {
              member_limit: 1,
              expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 soat
            });

            let typeName = payload.subscription_type === 'daily' ? 'kunlik' :
                          payload.subscription_type === 'weekly' ? 'haftalik' : 'oylik';

            await ctx.reply(
              `✅ *To'lov muvaffaqiyatli!*\n\n` +
              `Sizning ${typeName} obunangiz faollashtirildi.\n\n` +
              `Kanalga qo'shilish: ${inviteLink.invite_link}\n\n` +
              `Endi siz filtrlangan e'lonlarni olasiz!`,
              { parse_mode: 'Markdown' }
            );
          } catch (error) {
            console.error('Kanal invite link yaratishda xatolik:', error);
            await ctx.reply('✅ To\'lov muvaffaqiyatli! Tez orada kanal linkini yuboramiz.');
          }
        }

      } catch (error) {
        console.error('To\'lovni qayta ishlashda xatolik:', error);
        await ctx.reply('❌ Xatolik yuz berdi. Iltimos admin bilan bog\'laning.');
      }
    });
  }

  /**
   * Obuna tarif rejalarini ko'rsatish
   */
  async showSubscriptionPlans(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Kunlik (50,000 so\'m)', 'sub_daily')],
      [Markup.button.callback('📅 Haftalik (300,000 so\'m)', 'sub_weekly')],
      [Markup.button.callback('📅 Oylik (1,000,000 so\'m)', 'sub_monthly')]
    ]);

    const message = `💳 *Obuna turlari*\n\n` +
      `📅 *Kunlik* - 50,000 so'm (50 ⭐)\n` +
      `• 24 soat kirish\n` +
      `• Barcha e'lonlar\n\n` +
      `📅 *Haftalik* - 300,000 so'm (300 ⭐)\n` +
      `• 7 kun kirish\n` +
      `• Barcha e'lonlar\n` +
      `• 15% tejash\n\n` +
      `📅 *Oylik* - 1,000,000 so'm (1000 ⭐)\n` +
      `• 30 kun kirish\n` +
      `• Barcha e'lonlar\n` +
      `• 33% tejash\n\n` +
      `Obunani tanlang:`;

    if (ctx.updateType === 'callback_query') {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    }
  }

  /**
   * E'lonni kanalga yuborish
   */
  async sendToChannel(messageId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Xabar topilmadi');
      }

      if (message.is_sent_to_channel) {
        console.log('⚠️  Xabar allaqachon yuborilgan');
        return;
      }

      const channelId = process.env.TARGET_CHANNEL_ID;
      if (!channelId) {
        throw new Error('TARGET_CHANNEL_ID sozlanmagan');
      }

      // Xabarni formatlash
      let formattedMessage = message.message_text;

      // Yubor ish
      await this.bot.telegram.sendMessage(channelId, formattedMessage);

      // Statusni yangilash
      await Message.update(messageId, { is_sent_to_channel: true });

      console.log(`✅ Xabar kanalga yuborildi: ${messageId}`);

      return true;
    } catch (error) {
      console.error('❌ Xabarni yuborishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Ko'p xabarlarni kanalga yuborish
   */
  async sendBulkToChannel(messageIds) {
    const results = [];

    for (const messageId of messageIds) {
      try {
        await this.sendToChannel(messageId);
        results.push({ messageId, success: true });

        // Rate limiting uchun kutish
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({ messageId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Botni to'xtatish
   */
  stop() {
    if (this.bot) {
      this.bot.stop();
      this.isRunning = false;
      console.log('🛑 Telegram bot to\'xtatildi');
    }
  }
}

module.exports = new TelegramBotService();
