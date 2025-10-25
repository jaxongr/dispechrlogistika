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

      // SemySMS API returns: { code: 0, count: N, data: [...devices...] }
      if (response.data && response.data.data) {
        // Map SemySMS device format to our format
        return response.data.data.map(d => ({
          device_id: d.id,
          device_name: d.device_name || d.dop_name || 'Unknown',
          device_model: d.manufacturer ? `${d.manufacturer} ${d.android_version}` : 'Unknown',
          online: d.power === 1 && d.is_work === 1 ? 1 : 0,
          battery: d.bat || 0,
          device_status: d.is_arhive === 0 && d.power === 1 ? 'active' : 'inactive',
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

      const response = await axios.post(`${this.baseUrl}/sms.php`, {
        token: this.apiToken,
        device: targetDeviceId,
        phone: cleanPhone,
        msg: message
      }, {
        timeout: 15000
      });

      if (response.data && response.data.response === 1) {
        console.log(`✅ SMS yuborildi: ${cleanPhone} - ID: ${response.data.message_id}`);
        return {
          success: true,
          message_id: response.data.message_id,
          phone: cleanPhone,
          device_id: targetDeviceId
        };
      } else {
        throw new Error(response.data.msg || 'SMS yuborishda xatolik');
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
  async sendBlockNotificationSMS(phoneNumber, userName = '', reason = '') {
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
          message_id: result.message_id,
          device_id: result.device_id,
          sent_at: new Date().toISOString()
        });
      } else {
        this.saveSMSHistory({
          phone: phoneNumber,
          message: message,
          status: 'failed',
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
