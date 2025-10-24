/**
 * Semy SMS Integration Service
 * O'zbekistonda SMS yuborish xizmati
 * API: https://api.semy.uz/v1/sms/send
 */

const axios = require('axios');
require('dotenv').config();

class SmsService {
  constructor() {
    this.apiUrl = 'https://api.semy.uz/v1/sms/send';
    this.login = process.env.SEMY_SMS_LOGIN || '';
    this.password = process.env.SEMY_SMS_PASSWORD || '';
    this.adminPhone = process.env.ADMIN_PHONE || ''; // 998901234567 formatda
    this.enabled = process.env.SMS_ALERTS_ENABLED === 'true';

    // Rate limiting - 5 daqiqada max 10 ta SMS
    this.sentMessages = [];
    this.maxMessagesPerWindow = 10;
    this.windowMs = 5 * 60 * 1000; // 5 daqiqa
  }

  /**
   * SMS yuborish mumkinligini tekshirish
   */
  canSendSMS() {
    if (!this.enabled) {
      console.log('⚠️  SMS alerts disabled');
      return false;
    }

    if (!this.login || !this.password) {
      console.log('⚠️  SMS credentials not configured');
      return false;
    }

    if (!this.adminPhone) {
      console.log('⚠️  Admin phone not configured');
      return false;
    }

    // Rate limiting check
    const now = Date.now();
    this.sentMessages = this.sentMessages.filter(time => now - time < this.windowMs);

    if (this.sentMessages.length >= this.maxMessagesPerWindow) {
      console.log('⚠️  SMS rate limit exceeded');
      return false;
    }

    return true;
  }

  /**
   * SMS yuborish (asosiy funksiya)
   * @param {string} phone - Telefon raqam (998901234567 formatda)
   * @param {string} message - SMS matni
   */
  async sendSMS(phone, message) {
    if (!this.canSendSMS()) {
      return { success: false, reason: 'SMS disabled or rate limited' };
    }

    try {
      const response = await axios.post(this.apiUrl, {
        login: this.login,
        password: this.password,
        phone: phone,
        message: message
      }, {
        timeout: 10000, // 10 sekund timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.sentMessages.push(Date.now());

      console.log('📱 SMS yuborildi:', {
        phone,
        message: message.substring(0, 50),
        response: response.data
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ SMS yuborishda xatolik:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Admin'ga muhim xabar yuborish
   */
  async sendToAdmin(message) {
    if (!this.adminPhone) {
      console.log('⚠️  Admin phone not set');
      return;
    }

    return await this.sendSMS(this.adminPhone, message);
  }

  /**
   * Critical alert - tizim muhim xatoliklari
   */
  async sendCriticalAlert(title, details) {
    const timestamp = new Date().toLocaleString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      hour12: false
    });

    const message = `
🚨 MUHIM XATOLIK!

${title}

${details}

⏰ Vaqt: ${timestamp}
🖥️ Server: Logistika Filter
    `.trim();

    return await this.sendToAdmin(message);
  }

  /**
   * Telegram session uzilganda
   */
  async alertSessionDisconnected() {
    return await this.sendCriticalAlert(
      'Telegram Session Uzildi',
      'Telegram session ulanishi uzildi. Xabarlar qabul qilinmayapti. Darhol server.js ni restart qiling!'
    );
  }

  /**
   * Telegram bot ishlamay qolganda
   */
  async alertBotStopped() {
    return await this.sendCriticalAlert(
      'Telegram Bot To\'xtadi',
      'Telegram bot ishlamay qoldi. Bot xabarlarga javob bermayapti. Restart kerak!'
    );
  }

  /**
   * Database xatoligi
   */
  async alertDatabaseError(error) {
    return await this.sendCriticalAlert(
      'Database Xatolik',
      `Database bilan muammo:\n${error.message || error}`
    );
  }

  /**
   * Server qayta ishga tushganda
   */
  async alertServerRestart(reason = 'Unknown') {
    const message = `
🔄 Server Restart

Sabab: ${reason}
Vaqt: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}

Tizim qayta ishga tushmoqda...
    `.trim();

    return await this.sendToAdmin(message);
  }

  /**
   * Ko'p xatolar ketma-ket (5+ xato 10 daqiqada)
   */
  async alertMultipleErrors(errorCount, errors) {
    const errorList = errors.slice(0, 3).map(e => `- ${e}`).join('\n');

    return await this.sendCriticalAlert(
      `${errorCount} ta Xato Aniqlandi`,
      `Oxirgi 10 daqiqada ${errorCount} ta xato:\n\n${errorList}\n\n⚠️ Tizimni tekshiring!`
    );
  }

  /**
   * Test SMS yuborish
   */
  async sendTestMessage() {
    const message = `
✅ Test SMS

Logistika Filter tizimi
SMS xizmati ishlayapti!

Vaqt: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}
    `.trim();

    return await this.sendToAdmin(message);
  }
}

// Singleton instance
const smsService = new SmsService();

module.exports = smsService;
