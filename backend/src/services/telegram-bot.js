const { Telegraf } = require('telegraf');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
  }

  async start() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      console.log('🔍 Bot token check:', botToken ? 'EXISTS' : 'MISSING');

      if (!botToken) {
        console.log('❌ Bot token topilmadi!');
        this.isRunning = false;
        return;
      }

      console.log('🚀 Starting Telegram bot...');
      this.bot = new Telegraf(botToken);
      await this.bot.launch();
      this.isRunning = true;

      const me = await this.bot.telegram.getMe();
      console.log('✅ TELEGRAM BOT ISHGA TUSHDI!');
      console.log('🤖 Bot username: @' + me.username);
    } catch (error) {
      console.error('❌ TELEGRAM BOT XATOLIK:', error.message);
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
