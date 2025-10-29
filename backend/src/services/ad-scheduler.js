/**
 * Advertisement Scheduler Service
 * Sends promotional messages to the group after X announcements
 */

const { db } = require('../config/database');
const telegramBot = require('./telegram-bot');

class AdSchedulerService {
  constructor() {
    this.enabled = false;
    this.messageCount = 0;
    this.interval = 10; // Default: har 10 ta e'londan keyin
    this.adMessage = '';
    this.lastAdSentAt = null;
    this.totalAdsSent = 0;

    // Load settings from database
    this.loadSettings();
  }

  /**
   * Load ad scheduler settings from database
   */
  loadSettings() {
    try {
      const settings = db.get('ad_scheduler_settings').value();

      if (settings) {
        this.enabled = settings.enabled || false;
        this.interval = settings.interval || 10;
        this.adMessage = settings.message || '';
        this.messageCount = settings.message_count || 0;
        this.lastAdSentAt = settings.last_ad_sent_at || null;
        this.totalAdsSent = settings.total_ads_sent || 0;

        console.log(`📢 Reklama scheduler yuklandi: ${this.enabled ? 'YOQILGAN' : 'O\'CHIRILGAN'}`);
        if (this.enabled) {
          console.log(`   Interval: Har ${this.interval} ta e'londan keyin`);
          console.log(`   Message count: ${this.messageCount}`);
        }
      } else {
        // Initialize default settings
        this.saveSettings();
      }
    } catch (error) {
      console.error('❌ Ad scheduler settings yuklashda xatolik:', error);
      this.saveSettings();
    }
  }

  /**
   * Save ad scheduler settings to database
   */
  saveSettings() {
    try {
      db.set('ad_scheduler_settings', {
        enabled: this.enabled,
        interval: this.interval,
        message: this.adMessage,
        message_count: this.messageCount,
        last_ad_sent_at: this.lastAdSentAt,
        total_ads_sent: this.totalAdsSent,
        updated_at: new Date().toISOString()
      }).write();
    } catch (error) {
      console.error('❌ Ad scheduler settings saqlashda xatolik:', error);
    }
  }

  /**
   * Update ad scheduler settings
   */
  updateSettings({ enabled, interval, message }) {
    try {
      if (typeof enabled === 'boolean') {
        this.enabled = enabled;
      }

      if (typeof interval === 'number' && interval > 0) {
        this.interval = interval;
      }

      if (typeof message === 'string') {
        this.adMessage = message;
      }

      this.saveSettings();

      console.log(`📢 Reklama scheduler yangilandi: ${this.enabled ? 'YOQILGAN' : 'O\'CHIRILGAN'}`);
      if (this.enabled) {
        console.log(`   Interval: Har ${this.interval} ta e'londan keyin`);
      }

      return {
        success: true,
        settings: this.getSettings()
      };
    } catch (error) {
      console.error('❌ Ad scheduler update error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current ad scheduler settings
   */
  getSettings() {
    return {
      enabled: this.enabled,
      interval: this.interval,
      message: this.adMessage,
      message_count: this.messageCount,
      last_ad_sent_at: this.lastAdSentAt,
      total_ads_sent: this.totalAdsSent,
      next_ad_in: this.enabled ? (this.interval - (this.messageCount % this.interval)) : null
    };
  }

  /**
   * Increment message count (called when a message is sent to group)
   */
  async onMessageSent() {
    if (!this.enabled || !this.adMessage || this.adMessage.trim().length === 0) {
      return;
    }

    this.messageCount++;
    this.saveSettings();

    // Check if we should send ad
    if (this.messageCount % this.interval === 0) {
      await this.sendAd();
    }
  }

  /**
   * Send advertisement message to the group
   */
  async sendAd() {
    try {
      if (!this.enabled || !this.adMessage || this.adMessage.trim().length === 0) {
        console.log('⚠️  Reklama yubora olmaymiz - sozlamalar to\'liq emas');
        return {
          success: false,
          error: 'Reklama sozlamalari to\'liq emas'
        };
      }

      console.log(`📢 Reklama yuborilmoqda... (${this.messageCount} ta e'londan keyin)`);

      // Send ad message through telegram bot
      const result = await telegramBot.sendAdToGroup(this.adMessage);

      if (result.success) {
        this.lastAdSentAt = new Date().toISOString();
        this.totalAdsSent++;
        this.saveSettings();

        console.log(`✅ Reklama yuborildi! Jami: ${this.totalAdsSent}`);

        return {
          success: true,
          total_ads_sent: this.totalAdsSent,
          message_count: this.messageCount
        };
      } else {
        console.error('❌ Reklama yuborishda xatolik:', result.error);
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('❌ Ad send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually send ad (for testing)
   */
  async sendAdManually() {
    try {
      console.log('📢 Reklama qo\'lda yuborilmoqda...');
      return await this.sendAd();
    } catch (error) {
      console.error('❌ Manual ad send error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset message counter
   */
  resetCounter() {
    this.messageCount = 0;
    this.saveSettings();
    console.log('🔄 Reklama counter reset qilindi');
    return {
      success: true,
      message_count: this.messageCount
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      interval: this.interval,
      message_count: this.messageCount,
      total_ads_sent: this.totalAdsSent,
      last_ad_sent_at: this.lastAdSentAt,
      next_ad_in: this.enabled ? (this.interval - (this.messageCount % this.interval)) : null,
      average_per_day: this.calculateAveragePerDay()
    };
  }

  /**
   * Calculate average ads sent per day
   */
  calculateAveragePerDay() {
    if (!this.lastAdSentAt || this.totalAdsSent === 0) {
      return 0;
    }

    // Calculate days since first ad (we don't have first ad date, so use last ad as reference)
    // This is approximate - in real app you'd want to track first_ad_sent_at
    return this.totalAdsSent; // For now, just return total
  }
}

// Export singleton instance
module.exports = new AdSchedulerService();
