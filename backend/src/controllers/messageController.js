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
      const id = parseInt(req.params.id); // Convert to number
      const { reason } = req.body;

      const message = await Message.findById(id);

      if (!message) {
        return res.status(404).json({ error: 'Xabar topilmadi' });
      }

      // Allaqachon bloklangan bo'lsa - faqat e'lonlarini o'chiramiz, xatolik bermaymiz
      const isBlocked = await BlockedUser.isBlocked(message.sender_user_id);

      if (!isBlocked) {
        // User hali bloklanmagan - bloklash
        await BlockedUser.create({
          telegram_user_id: message.sender_user_id,
          username: message.sender_username,
          full_name: message.sender_full_name,
          reason: reason || 'Dispetcher deb aniqlandi',
          blocked_by: req.user.id
        });
        console.log(`✅ User ${message.sender_user_id} bloklandi - dashboard orqali`);
      } else {
        console.log(`⚠️ User ${message.sender_user_id} allaqachon bloklangan - faqat e'lonlarini o'chiramiz`);
      }

      // DELETE ALL USER'S MESSAGES from group (har doim - bloklangan yoki yo'q)
      const telegramBot = require('../services/telegram-bot');
      await telegramBot.deleteAllUserMessages(message.sender_user_id);

      // Block all phone numbers from this user's messages
      await BlockedUser.blockUserPhoneNumbers(
        message.sender_user_id,
        'Dashboard orqali bloklangan user telefoni'
      );

      // Xabarni dispetcher deb belgilash
      await Message.update(id, { is_dispatcher: true });

      // Delete message from target group if it was sent there
      if (message.is_sent_to_channel && message.group_message_id) {
        try {
          await telegramBot.deleteFromGroup(id);
          console.log(`🗑️ Message ${id} deleted from target group via dashboard`);
        } catch (deleteError) {
          console.error('Delete from group error:', deleteError.message);
          // Don't fail the whole operation if delete fails
        }
      }

      res.json({ message: 'Foydalanuvchi bloklandi va e\'lon guruhdan o\'chirildi' });
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

  // Get phone numbers from messages
  async getPhoneNumbers(req, res) {
    try {
      const { is_dispatcher, is_approved } = req.query;
      const { db } = require('../config/database');

      // Direct DB query - much faster than using findAll
      let messages = db.get('messages').value();

      // Filter only messages with phone numbers FIRST
      messages = messages.filter(m => m.contact_phone);

      // Apply filters
      if (is_dispatcher !== undefined) {
        const isDispatcherBool = is_dispatcher === 'true';
        messages = messages.filter(m => m.is_dispatcher === isDispatcherBool);
      }

      if (is_approved !== undefined) {
        const isApprovedBool = is_approved === 'true';
        messages = messages.filter(m => m.is_approved === isApprovedBool);
      }

      // Sort by date DESC
      messages.sort((a, b) => new Date(b.message_date) - new Date(a.message_date));

      // Get groups for mapping
      const groups = db.get('telegram_groups').value();
      const groupsMap = new Map(groups.map(g => [g.id, g]));

      // Extract phone numbers with minimal data
      const phoneData = messages.map(m => {
        const group = groupsMap.get(m.group_id);
        return {
          phone: m.contact_phone,
          sender: m.sender_full_name || m.sender_username || 'N/A',
          group: group ? group.group_name : 'N/A',
          date: m.message_date,
          route_from: m.route_from,
          route_to: m.route_to,
          cargo_type: m.cargo_type,
          is_dispatcher: m.is_dispatcher,
          is_approved: m.is_approved
        };
      });

      res.json({
        phones: phoneData,
        total: phoneData.length
      });
    } catch (error) {
      console.error('Get phone numbers xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
}

module.exports = new MessageController();
