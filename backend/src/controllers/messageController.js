const Message = require('../models/Message');
const BlockedUser = require('../models/BlockedUser');
const telegramBot = require('../services/telegram-bot');
const dispatcherDetector = require('../services/dispatcher-detector');

class MessageController {
  // Barcha xabarlarni olish
  async getAll(req, res) {
    try {
      const {
        is_dispatcher,
        is_approved,
        is_sent_to_channel,
        group_id,
        search,
        limit = 50,
        offset = 0
      } = req.query;

      const filters = {};
      if (is_dispatcher !== undefined) filters.is_dispatcher = is_dispatcher === 'true';
      if (is_approved !== undefined) filters.is_approved = is_approved === 'true';
      if (is_sent_to_channel !== undefined) filters.is_sent_to_channel = is_sent_to_channel === 'true';
      if (group_id) filters.group_id = parseInt(group_id);
      if (search) filters.search = search;
      filters.limit = parseInt(limit);
      filters.offset = parseInt(offset);

      const messages = await Message.findAll(filters);
      const total = await Message.countByFilters(filters);

      res.json({
        messages,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get messages xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Bitta xabarni olish
  async getOne(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      res.json({ message });
    } catch (error) {
      console.error('Get message xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Xabarni approve qilish
  async approve(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      if (message.is_dispatcher) {
        return res.status(400).json({ error: 'Dispetcher xabarini approve qilib bo\'lmaydi' });
      }

      await Message.update(id, { is_approved: true });

      res.json({ message: 'Xabar approve qilindi' });
    } catch (error) {
      console.error('Approve message xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Xabarni kanalga yuborish
  async sendToChannel(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      if (!message.is_approved) {
        return res.status(400).json({ error: 'Avval xabarni approve qiling' });
      }

      if (message.is_sent_to_channel) {
        return res.status(400).json({ error: 'Xabar allaqachon yuborilgan' });
      }

      await telegramBot.sendToChannel(id);

      res.json({ message: 'Xabar kanalga yuborildi' });
    } catch (error) {
      console.error('Send to channel xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Ko'p xabarlarni kanalga yuborish
  async sendBulkToChannel(req, res) {
    try {
      const { message_ids } = req.body;

      if (!message_ids || !Array.isArray(message_ids)) {
        return res.status(400).json({ error: 'message_ids array kerak' });
      }

      const results = await telegramBot.sendBulkToChannel(message_ids);

      res.json({
        message: 'Xabarlar yuborildi',
        results
      });
    } catch (error) {
      console.error('Send bulk xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Xabar yuboruvchisini bloklash
  async blockSender(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      // Allaqachon bloklangan bo'lsa
      const isBlocked = await BlockedUser.isBlocked(message.sender_user_id);
      if (isBlocked) {
        return res.status(400).json({ error: 'Bu foydalanuvchi allaqachon bloklangan' });
      }

      await BlockedUser.create({
        telegram_user_id: message.sender_user_id,
        username: message.sender_username,
        full_name: message.sender_full_name,
        reason: reason || 'Dispetcher deb aniqlandi',
        blocked_by: req.user.id
      });

      // Xabarni dispetcher deb belgilash
      await Message.update(id, { is_dispatcher: true });

      res.json({ message: 'Foydalanuvchi bloklandi' });
    } catch (error) {
      console.error('Block sender xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Xabarni qayta tahlil qilish
  async reanalyze(req, res) {
    try {
      const { id } = req.params;
      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      const detection = dispatcherDetector.analyze(message.message_text);
      const logisticsData = dispatcherDetector.extractLogisticsData(message.message_text);

      await Message.update(id, {
        is_dispatcher: detection.isDispatcher,
        confidence_score: detection.confidence,
        ...logisticsData
      });

      res.json({
        message: 'Xabar qayta tahlil qilindi',
        detection,
        logisticsData
      });
    } catch (error) {
      console.error('Reanalyze xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Statistika
  async getStatistics(req, res) {
    try {
      const stats = await Message.getStatistics();
      res.json({ statistics: stats });
    } catch (error) {
      console.error('Get statistics xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Xabarni o'chirish
  async delete(req, res) {
    try {
      const { id } = req.params;
      await Message.delete(id);
      res.json({ message: 'Xabar o\'chirildi' });
    } catch (error) {
      console.error('Delete message xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
  // Get blocked users
  async getBlockedUsers(req, res) {
    try {
      const BlockedUser = require('../models/BlockedUser');
      const blockedUsers = await BlockedUser.findAll(1000, 0);

      res.json({
        blockedUsers: blockedUsers,
        total: blockedUsers.length
      });
    } catch (error) {
      console.error('Get blocked users xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
}

module.exports = new MessageController();
