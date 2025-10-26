/**
 * Auto-Reply Session Service
 *
 * ALOHIDA SESSIONDA ISHLAYDI - asosiy monitoring sessionga zarar bermaydi
 *
 * Ishlash prinsipi:
 * 1. Asosiy session (Abduxoliq) xabarlarni tinglab, dispatcherlarni aniqlaydi
 * 2. Dispatcher topilsa, ID va guruh ma'lumotlarini queuega qo'shadi
 * 3. Bu service ALOHIDA SESSION orqali javob yuboradi
 * 4. Agar bu session ban bo'lsa, asosiy sessionga ta'sir qilmaydi
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

class AutoReplySessionService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.replyQueue = [];
    this.processing = false;
    this.sessionString = '';

    // Process queue every 5 seconds
    setInterval(() => this.processQueue(), 5000);
  }

  /**
   * Alohida sessionni boshlash
   */
  async connect() {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      // ALOHIDA SESSION STRING - .env da AUTOREPLY_SESSION_STRING
      const sessionString = process.env.AUTOREPLY_SESSION_STRING || '';

      if (!apiId || !apiHash) {
        console.log('❌ Auto-reply: API credentials topilmadi');
        this.isConnected = false;
        return false;
      }

      if (!sessionString) {
        console.log('⚠️  Auto-reply session topilmadi (AUTOREPLY_SESSION_STRING)');
        console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
        this.isConnected = false;
        return false;
      }

      const stringSession = new StringSession(sessionString);

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log('🔄 Auto-reply session ulanyapti...');
      await this.client.connect();

      if (!this.client.connected) {
        throw new Error('Auto-reply session ulanmadi');
      }

      const me = await this.client.getMe();
      console.log('✅ AUTO-REPLY SESSION ULANDI!');
      console.log(`   👤 Account: ${me.firstName} ${me.phone}`);
      console.log('   ⚠️  Bu alohida session - asosiy sessionga ta\'sir qilmaydi');

      this.isConnected = true;
      return true;

    } catch (error) {
      console.error('❌ Auto-reply session xatolik:', error.message);
      console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Auto-reply queuega qo'shish
   * Asosiy sessiondan chaqiriladi
   */
  addToQueue(replyData) {
    if (!this.isConnected) {
      // Session yo'q - skip
      return false;
    }

    this.replyQueue.push({
      ...replyData,
      addedAt: Date.now()
    });

    // Queue size limit
    if (this.replyQueue.length > 100) {
      this.replyQueue.shift(); // Remove oldest
    }

    return true;
  }

  /**
   * Queue ni process qilish
   */
  async processQueue() {
    if (!this.isConnected || this.processing || this.replyQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const batch = this.replyQueue.splice(0, 10); // Process 10 at a time

      for (const reply of batch) {
        try {
          await this.sendReply(reply);
          await this.sleep(2000); // 2 second delay between replies
        } catch (error) {
          console.error(`❌ Auto-reply error for ${reply.username}:`, error.message);

          // If USER_BANNED, this session is banned, but main session is safe
          if (error.message.includes('USER_BANNED')) {
            console.log(`⚠️  Auto-reply session banned in ${reply.groupName}`);
            console.log('   Asosiy session xavfsiz - monitoring davom etmoqda');
          }
        }
      }

    } catch (error) {
      console.error('❌ Auto-reply queue processing error:', error.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Javob yuborish
   */
  async sendReply(replyData) {
    if (!this.client || !this.isConnected) {
      return;
    }

    const { userId, username, chatId, groupName, messageId } = replyData;

    // Build reply message
    const targetChannel = process.env.TARGET_CHANNEL_ID || '-1002496159921';
    const message = `Assalomu alaykum!\n\n` +
      `Siz yozgan xabaringiz dispecherlar uchun guruhimizga ko'chirildi:\n` +
      `https://t.me/c/${targetChannel.replace('-100', '')}/\n\n` +
      `✅ Tez orada sizga javob berishadi!`;

    try {
      // Send reply via auto-reply session
      await this.client.sendMessage(chatId, {
        message: message,
        replyTo: messageId
      });

      console.log(`✅ Auto-reply sent to ${username} in ${groupName}`);
      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Auto-reply session to\'xtatildi');
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      queueLength: this.replyQueue.length,
      processing: this.processing
    };
  }
}

// Singleton instance
const autoReplySession = new AutoReplySessionService();

module.exports = autoReplySession;
