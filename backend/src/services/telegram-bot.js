/**
 * Telegram Bot Service - Optional
 * Agar token bo'lmasa ishlamaydi, xato bermaydi
 */

const { Telegraf } = require('telegraf');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
  }

  async start() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken || botToken.startsWith('1234567890')) {
        console.log('⚠️  Telegram bot token topilmadi - bot o\'chirilgan');
        this.isRunning = false;
        return;
      }

      this.bot = new Telegraf(botToken);
      await this.bot.launch();
      this.isRunning = true;
      console.log('✅ Telegram bot ishga tushdi!');
    } catch (error) {
      console.error('❌ Telegram bot xatolik:', error.message);
      this.isRunning = false;
    }
  }

  async sendToChannel(messageId) {
    if (!this.isRunning) {
      console.log('⚠️  Bot ishlamayapti');
      return false;
    }
    return true;
  }

  stop() {
    if (this.bot) {
      this.bot.stop();
      this.isRunning = false;
    }
  }
}

module.exports = new TelegramBotService();
