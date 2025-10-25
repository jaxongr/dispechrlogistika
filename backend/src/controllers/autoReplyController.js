const autoReply = require('../services/autoReply');

class AutoReplyController {
  // Get auto-reply settings
  async getSettings(req, res) {
    try {
      const settings = autoReply.getSettings();
      res.json({ settings });
    } catch (error) {
      console.error('Get auto-reply settings error:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Update auto-reply settings
  async updateSettings(req, res) {
    try {
      const { enabled, template, max_replies_per_hour, cooldown_hours, check_target_group } = req.body;

      const updated = autoReply.updateSettings({
        enabled,
        template,
        max_replies_per_hour,
        cooldown_hours,
        check_target_group
      });

      console.log('✅ Auto-reply settings updated:', updated);

      res.json({
        message: 'Auto-reply sozlamalari yangilandi',
        settings: updated
      });
    } catch (error) {
      console.error('Update auto-reply settings error:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Get auto-reply history
  async getHistory(req, res) {
    try {
      const { limit = 100 } = req.query;
      const history = autoReply.getReplyHistory(parseInt(limit));
      res.json({
        history,
        total: history.length
      });
    } catch (error) {
      console.error('Get auto-reply history error:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Get statistics
  async getStatistics(req, res) {
    try {
      const stats = autoReply.getStatistics();
      res.json({ statistics: stats });
    } catch (error) {
      console.error('Get auto-reply statistics error:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
}

module.exports = new AutoReplyController();
