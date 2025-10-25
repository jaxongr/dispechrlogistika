/**
 * SemySMS Service
 *
 * Bloklangan userlarning telefon raqamlariga avtomatik SMS yuborish
 * API: https://semysms.net/api.php
 */

const axios = require('axios');
const { db } = require('../config/database');

class SemySMSService {
  constructor() {
    this.apiToken = process.env.SEMYSMS_API_TOKEN || '';
    this.baseUrl = 'https://semysms.net/api/3';
  }

  /**
   * Get SMS settings from database
   */
  getSettings() {
    const settings = db.get('sms_settings').value();
    if (!settings) {
      // Default settings
      const defaultSettings = {
        enabled: false,
        template: 'Sizning e\'loningiz spam deb topildi va bloklandi. Iltimos, guruhda spam e\'lon tarqatmang!',
        success_enabled: false,
        success_template: 'Tabriklaymiz! Sizning e\'loningiz filtrdan o\'tdi va @yoldauz guruhiga joylashtirildi. Ko\'proq buyurtmalar uchun kanalingizni kuzatib boring!',
        device_id: null,
        auto_select_device: true,
        last_updated: new Date().toISOString()
      };
      db.set('sms_settings', defaultSettings).write();
      return defaultSettings;
    }
    return settings;
  }

  /**
   * Update SMS settings
   */
  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...newSettings,
      last_updated: new Date().toISOString()
    };
    db.set('sms_settings', updated).write();
    return updated;
  }

  /**
   * Get list of devices from SemySMS
   */
  async getDevices() {
    try {
      if (!this.apiToken) {
        throw new Error('SemySMS API token topilmadi');
      }

      const response = await axios.get(`${this.baseUrl}/devices.php`, {
        params: {
          token: this.apiToken
        },
        timeout: 10000
      });

      console.log('📱 SemySMS API response:', JSON.stringify(response.data).substring(0, 500));

      // SemySMS API returns: { code: 0, count: N, data: [...devices...] }
      if (response.data && response.data.data) {
        // Filter: only show non-archived (active) devices
        const activeDevices = response.data.data.filter(d => d.is_arhive === 0);

        // Map SemySMS device format to our format
        return activeDevices.map(d => ({
          device_id: d.id,
          device_name: d.dop_name || d.device_name || 'Unknown',
          device_model: d.manufacturer ? `${d.manufacturer} ${d.android_version}` : 'Unknown',
          online: d.power === 1 && d.is_work === 1 ? 1 : 0,
          battery: d.bat || 0,
          device_status: d.power === 1 && d.is_work === 1 ? 'active' : 'inactive',
          mobile_operator: d.mobile_operator || '',
          date_last_active: d.date_last_active
        }));
      } else {
        throw new Error(response.data.msg || 'Qurilmalar topilmadi');
      }
    } catch (error) {
      console.error('❌ SemySMS getDevices xatolik:', error.message);
      throw error;
    }
  }

  /**
   * Get active device (online and ready to send)
   */
  async getActiveDevice() {
    try {
      const devices = await this.getDevices();

      if (!devices || devices.length === 0) {
        throw new Error('Hech qanday qurilma topilmadi');
      }

      // Find online device
      const activeDevice = devices.find(d =>
        d.online === 1 &&
        d.device_status === 'active'
      );

      if (activeDevice) {
        return activeDevice;
      }

      // If no active device, return first online device
      const onlineDevice = devices.find(d => d.online === 1);
      if (onlineDevice) {
        return onlineDevice;
      }

      throw new Error('Faol qurilma topilmadi - barcha qurilmalar offline');
    } catch (error) {
      console.error('❌ Active device topilmadi:', error.message);
      throw error;
    }
  }

  /**
   * Send SMS via SemySMS
   */
  async sendSMS(phoneNumber, message, deviceId = null) {
    try {
      if (!this.apiToken) {
        throw new Error('SemySMS API token topilmadi');
      }

      const settings = this.getSettings();

      // Get device ID
      let targetDeviceId = deviceId || settings.device_id;

      // Auto-select device if enabled
      if (settings.auto_select_device || !targetDeviceId) {
        const activeDevice = await this.getActiveDevice();
        targetDeviceId = activeDevice.device_id;
        console.log(`📱 Auto-selected device: ${activeDevice.device_name} (${targetDeviceId})`);
      }

      // Clean phone number - remove +, spaces, dashes
      const cleanPhone = phoneNumber.replace(/[\+\s\-\(\)]/g, '');

      console.log(`📤 Sending SMS to ${cleanPhone} via device ${targetDeviceId}`);

      // SemySMS requires form-urlencoded, not JSON
      const formData = new URLSearchParams();
      formData.append('token', this.apiToken);
      formData.append('device', targetDeviceId);
      formData.append('phone', cleanPhone);
      formData.append('msg', message);

      const response = await axios.post(`${this.baseUrl}/sms.php`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      });

      console.log(`📱 SMS API response:`, JSON.stringify(response.data));

      // SemySMS SMS API returns: { code: "0", id_device: 353889, id: 132906790 }
      if (response.data && (response.data.code === "0" || response.data.code === 0)) {
        console.log(`✅ SMS yuborildi: ${cleanPhone} - ID: ${response.data.id}`);
        return {
          success: true,
          message_id: response.data.id,
          phone: cleanPhone,
          device_id: targetDeviceId
        };
      } else {
        throw new Error(response.data.msg || response.data.error || 'SMS yuborishda xatolik');
      }

    } catch (error) {
      console.error(`❌ SMS yuborishda xatolik (${phoneNumber}):`, error.message);
      return {
        success: false,
        error: error.message,
        phone: phoneNumber
      };
    }
  }

  /**
   * Send SMS to blocked user
   * Called automatically when user is blocked
   */
  async sendBlockNotificationSMS(phoneNumber, userName = '', reason = '', telegramUserId = null) {
    try {
      const settings = this.getSettings();

      // Check if SMS sending is enabled
      if (!settings.enabled) {
        console.log('⏭️ SMS yuborish o\'chirilgan - skip');
        return { success: false, reason: 'disabled' };
      }

      if (!phoneNumber) {
        console.log('⏭️ Telefon raqam yo\'q - SMS yuborilmaydi');
        return { success: false, reason: 'no_phone' };
      }

      // Check if user is still in group (maybe unblocked or mistake)
      if (telegramUserId) {
        const telegramBot = require('./telegram-bot');
        const isInGroup = await telegramBot.isUserInGroup(telegramUserId);

        if (isInGroup) {
          console.log(`⏭️ User ${telegramUserId} guruhda - SMS yuborilmaydi`);
          return { success: false, reason: 'user_in_group' };
        }
      }

      // Use template from settings
      let message = settings.template;

      // Replace placeholders if any
      message = message
        .replace('{name}', userName)
        .replace('{reason}', reason);

      // Send SMS
      const result = await this.sendSMS(phoneNumber, message);

      // Save to SMS history
      if (result.success) {
        this.saveSMSHistory({
          phone: phoneNumber,
          message: message,
          status: 'sent',
          type: 'block', // Mark as block notification
          message_id: result.message_id,
          device_id: result.device_id,
          sent_at: new Date().toISOString()
        });
      } else {
        this.saveSMSHistory({
          phone: phoneNumber,
          message: message,
          status: 'failed',
          type: 'block',
          error: result.error,
          sent_at: new Date().toISOString()
        });
      }

      return result;

    } catch (error) {
      console.error('❌ sendBlockNotificationSMS xatolik:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS to user when message is approved and sent to channel
   * Called automatically when message is sent to channel
   */
  async sendSuccessNotificationSMS(phoneNumber, userName = '', channelUsername = '@yoldauz', telegramUserId = null) {
    try {
      const settings = this.getSettings();

      // Check if success SMS sending is enabled
      if (!settings.success_enabled) {
        console.log('⏭️ Success SMS o\'chirilgan - skip');
        return { success: false, reason: 'disabled' };
      }

      if (!phoneNumber) {
        console.log('⏭️ Telefon raqam yo\'q - SMS yuborilmaydi');
        return { success: false, reason: 'no_phone' };
      }

      // Check if user is still in group
      if (telegramUserId) {
        const telegramBot = require('./telegram-bot');
        const isInGroup = await telegramBot.isUserInGroup(telegramUserId);

        if (!isInGroup) {
          console.log(`⏭️ User ${telegramUserId} guruhda emas - Success SMS yuborilmaydi (user guruhdan chiqgan)`);
          return { success: false, reason: 'user_not_in_group' };
        }
      }

      // Use success template from settings
      let message = settings.success_template || 'Tabriklaymiz! Sizning e\'loningiz filtrdan o\'tdi va guruhga joylashtirildi.';

      // Replace placeholders if any
      message = message
        .replace('{name}', userName)
        .replace('{channel}', channelUsername);

      // Send SMS
      const result = await this.sendSMS(phoneNumber, message);

      // Save to SMS history
      if (result.success) {
        this.saveSMSHistory({
          phone: phoneNumber,
          message: message,
          status: 'sent',
          type: 'success', // Mark as success notification
          message_id: result.message_id,
          device_id: result.device_id,
          sent_at: new Date().toISOString()
        });
      } else {
        this.saveSMSHistory({
          phone: phoneNumber,
          message: message,
          status: 'failed',
          type: 'success',
          error: result.error,
          sent_at: new Date().toISOString()
        });
      }

      return result;

    } catch (error) {
      console.error('❌ sendSuccessNotificationSMS xatolik:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save SMS to history
   */
  saveSMSHistory(smsData) {
    try {
      const history = db.get('sms_history').value() || [];

      const sms = {
        id: Date.now(),
        ...smsData,
        created_at: new Date().toISOString()
      };

      history.push(sms);

      // Keep only last 1000 SMS
      if (history.length > 1000) {
        history.shift();
      }

      db.set('sms_history', history).write();
    } catch (error) {
      console.error('❌ SMS history saqlashda xatolik:', error.message);
    }
  }

  /**
   * Get SMS history
   */
  getSMSHistory(limit = 100) {
    try {
      const history = db.get('sms_history').value() || [];
      return history
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    } catch (error) {
      console.error('❌ SMS history olishda xatolik:', error.message);
      return [];
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo() {
    try {
      if (!this.apiToken) {
        throw new Error('SemySMS API token topilmadi');
      }

      const response = await axios.get(`${this.baseUrl}/user.php`, {
        params: {
          token: this.apiToken
        },
        timeout: 10000
      });

      if (response.data && response.data.response === 1) {
        return response.data;
      } else {
        throw new Error(response.data.msg || 'Account info olishda xatolik');
      }
    } catch (error) {
      console.error('❌ SemySMS account info xatolik:', error.message);
      throw error;
    }
  }
}

module.exports = new SemySMSService();
