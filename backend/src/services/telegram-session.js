/**
 * Telegram Session Service
 *
 * Telegram MTProto API orqali guruhlardan xabarlarni real-time o'qiydi
 * GramJS kutubxonasi ishlatiladi
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');

const Message = require('../models/Message');
const TelegramGroup = require('../models/TelegramGroup');
const BlockedUser = require('../models/BlockedUser');
const dispatcherDetector = require('./dispatcher-detector');

class TelegramSessionService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.sessionString = '';
    this.messageHandler = null;
  }

  /**
   * Telegram session'ni boshlash
   */
  async connect() {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;
      const sessionString = process.env.TELEGRAM_SESSION_STRING || '';

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID va TELEGRAM_API_HASH .env faylida bo\'lishi kerak');
      }

      const stringSession = new StringSession(sessionString);

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log('🔄 Telegram ga ulanmoqda...');

      await this.client.start({
        phoneNumber: async () => await input.text('Telefon raqamingizni kiriting (+998...): '),
        password: async () => await input.text('2FA parolni kiriting (agar bo\'lsa): '),
        phoneCode: async () => await input.text('Telegram dan kelgan kodni kiriting: '),
        onError: (err) => console.log('❌ Xatolik:', err),
      });

      console.log('✅ Telegram ga muvaffaqiyatli ulandi!');
      console.log('📝 Session string:', this.client.session.save());
      console.log('⚠️  Bu session string ni .env fayliga TELEGRAM_SESSION_STRING ga qo\'shing!');

      this.sessionString = this.client.session.save();
      this.isConnected = true;

      // Xabar tinglovchisini ishga tushirish
      this.startMessageListener();

      return this.sessionString;
    } catch (error) {
      console.error('❌ Telegram ga ulanishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Xabarlarni tinglash
   */
  startMessageListener() {
    if (!this.client || !this.isConnected) {
      throw new Error('Telegram client ulanmagan');
    }

    console.log('👂 Xabarlarni tinglash boshlandi...');

    this.messageHandler = async (event) => {
      try {
        const message = event.message;

        // Faqat guruh xabarlarini qabul qilish
        if (!message.peerId?.channelId && !message.peerId?.chatId) {
          return;
        }

        const sender = await message.getSender();
        const chat = await message.getChat();

        // Xabar ma'lumotlari
        const messageData = {
          telegram_message_id: message.id,
          sender_user_id: sender?.id?.toString(),
          sender_username: sender?.username || '',
          sender_full_name: `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim(),
          message_text: message.text || '',
          message_date: new Date(message.date * 1000),
          group_id: chat?.id?.toString(),
          group_name: chat?.title || '',
          group_username: chat?.username || ''
        };

        // Bloklangan user bo'lsa, xabarni qabul qilmaymiz
        const isBlocked = await BlockedUser.isBlocked(messageData.sender_user_id);
        if (isBlocked) {
          console.log(`🚫 Bloklangan user: ${messageData.sender_username} (${messageData.sender_user_id})`);
          await BlockedUser.incrementBlockedCount(messageData.sender_user_id);
          return;
        }

        // Dispetcher detection
        const detection = dispatcherDetector.analyze(messageData.message_text, messageData);

        console.log(`\n📨 Yangi xabar:
          Guruh: ${messageData.group_name}
          Yuboruvchi: ${messageData.sender_full_name} (@${messageData.sender_username})
          Dispetcher: ${detection.isDispatcher ? '❌ HA' : '✅ YO\'Q'}
          Ishonch: ${(detection.confidence * 100).toFixed(0)}%
          Ma'lumot: ${messageData.message_text.substring(0, 100)}...
        `);

        // Guruhni database'ga qo'shish
        let dbGroup = await TelegramGroup.findByGroupId(messageData.group_id);
        if (!dbGroup) {
          dbGroup = await TelegramGroup.create({
            group_id: messageData.group_id,
            group_name: messageData.group_name,
            group_username: messageData.group_username,
            added_by: 1 // System user
          });
        } else {
          await TelegramGroup.updateLastMessage(messageData.group_id);
        }

        // Logistika ma'lumotlarini ajratish
        const logisticsData = dispatcherDetector.extractLogisticsData(messageData.message_text);

        // Xabarni database'ga saqlash
        await Message.create({
          telegram_message_id: messageData.telegram_message_id,
          group_id: dbGroup.id,
          sender_user_id: messageData.sender_user_id,
          sender_username: messageData.sender_username,
          sender_full_name: messageData.sender_full_name,
          message_text: messageData.message_text,
          message_date: messageData.message_date,
          is_dispatcher: detection.isDispatcher,
          confidence_score: detection.confidence,
          raw_data: {
            detection: detection,
            chat: {
              id: chat?.id?.toString(),
              title: chat?.title
            }
          },
          ...logisticsData
        });

        // Agar dispetcher bo'lmasa va yetarli confidence bo'lsa, avtomatik approve
        const autoApproveThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || 0.9);
        if (!detection.isDispatcher && detection.confidence >= autoApproveThreshold) {
          console.log('✅ Avtomatik approve qilindi!');
          // Bu yerda telegram bot service orqali kanalga yuborish kerak
          // TO DO: Implement in telegram-bot service
        }

      } catch (error) {
        console.error('❌ Xabarni qayta ishlashda xatolik:', error);
      }
    };

    this.client.addEventHandler(this.messageHandler, new NewMessage({}));
  }

  /**
   * Guruhga qo'shilish
   */
  async joinGroup(inviteLink) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Telegram client ulanmagan');
      }

      const result = await this.client.invoke(
        new require('telegram/tl/functions/messages').ImportChatInvite({
          hash: inviteLink.split('/').pop()
        })
      );

      console.log('✅ Guruhga qo\'shilindi!', result);
      return result;
    } catch (error) {
      console.error('❌ Guruhga qo\'shilishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Guruhdan chiqish
   */
  async leaveGroup(groupId) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Telegram client ulanmagan');
      }

      await this.client.invoke(
        new require('telegram/tl/functions/channels').LeaveChannel({
          channel: groupId
        })
      );

      console.log('✅ Guruhdan chiqildi');
    } catch (error) {
      console.error('❌ Guruhdan chiqishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Barcha guruhlar ro'yxatini olish
   */
  async getDialogs() {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Telegram client ulanmagan');
      }

      const dialogs = await this.client.getDialogs({ limit: 100 });

      return dialogs
        .filter(d => d.isGroup || d.isChannel)
        .map(d => ({
          id: d.id?.toString(),
          title: d.title,
          username: d.entity?.username || '',
          isChannel: d.isChannel,
          isGroup: d.isGroup
        }));
    } catch (error) {
      console.error('❌ Dialoglarni olishda xatolik:', error);
      throw error;
    }
  }

  /**
   * Sessionni to'xtatish
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Telegram session to\'xtatildi');
    }
  }
}

module.exports = new TelegramSessionService();
