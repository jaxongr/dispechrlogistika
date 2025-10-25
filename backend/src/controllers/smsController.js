const semySMS = require('../services/semysms');

class SMSController {
  // Get SMS settings
  async getSettings(req, res) {
    try {
      const settings = semySMS.getSettings();
      res.json({ settings });
    } catch (error) {
      console.error('Get SMS settings xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Update SMS settings
  async updateSettings(req, res) {
    try {
      const { enabled, template, device_id, auto_select_device } = req.body;

      const updated = semySMS.updateSettings({
        enabled,
        template,
        device_id,
        auto_select_device
      });

      res.json({
        message: 'SMS sozlamalari yangilandi',
        settings: updated
      });
    } catch (error) {
      console.error('Update SMS settings xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Get devices from SemySMS
  async getDevices(req, res) {
    try {
      const devices = await semySMS.getDevices();
      res.json({ devices });
    } catch (error) {
      console.error('Get devices xatolik:', error);
      res.status(500).json({
        error: 'Qurilmalarni olishda xatolik',
        message: error.message
      });
    }
  }

  // Get account info
  async getAccountInfo(req, res) {
    try {
      const info = await semySMS.getAccountInfo();
      res.json({ account: info });
    } catch (error) {
      console.error('Get account info xatolik:', error);
      res.status(500).json({
        error: 'Account info olishda xatolik',
        message: error.message
      });
    }
  }

  // Send test SMS
  async sendTestSMS(req, res) {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          error: 'Telefon raqam va xabar matni kerak'
        });
      }

      const result = await semySMS.sendSMS(phone, message);

      if (result.success) {
        res.json({
          message: 'Test SMS yuborildi',
          result
        });
      } else {
        res.status(500).json({
          error: 'SMS yuborishda xatolik',
          message: result.error
        });
      }
    } catch (error) {
      console.error('Send test SMS xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Get SMS history
  async getHistory(req, res) {
    try {
      const { limit = 100 } = req.query;
      const history = semySMS.getSMSHistory(parseInt(limit));
      res.json({
        history,
        total: history.length
      });
    } catch (error) {
      console.error('Get SMS history xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
}

module.exports = new SMSController();
