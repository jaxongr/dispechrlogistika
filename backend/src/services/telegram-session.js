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
const messageFilter = require('./message-filter');
const telegramBot = require('./telegram-bot');

class TelegramSessionService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.sessionString = '';
    this.messageHandler = null;
    this.messageQueue = [];
    this.processingQueue = false;

    // Process queue every 2 seconds in batch
    setInterval(() => this.processMessageQueue(), 2000);
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
        console.log('❌ TELEGRAM_API_ID va TELEGRAM_API_HASH topilmadi');
        this.isConnected = false;
        return;
      }

      if (!sessionString) {
        console.log('❌ TELEGRAM_SESSION_STRING topilmadi');
        console.log('💡 Session yaratish uchun: npm run create-session');
        this.isConnected = false;
        return;
      }

      const stringSession = new StringSession(sessionString);

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log('🔄 Telegram session ulanyapti...');

      // Session string bor bo'lsa, interactive input kerak emas
      await this.client.connect();

      // Check if we're connected
      if (!this.client.connected) {
        throw new Error('Telegram ulanish amalga oshmadi');
      }

      const me = await this.client.getMe();
      console.log('✅ TELEGRAM SESSION ULANDI!');
      console.log('👤 Account:', me.firstName, me.phone);

      this.isConnected = true;

      // Get dialogs
      const dialogs = await this.client.getDialogs({ limit: 100 });
      const groups = dialogs.filter(d => d.isGroup || d.isChannel);
      console.log(`📱 ${groups.length} ta guruh topildi`);

      // Xabar tinglovchisini ishga tushirish
      this.startMessageListener();

      return true;
    } catch (error) {
      console.error('❌ Telegram session xatolik:', error.message);
      this.isConnected = false;
      return false;
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
      // Add to queue instead of processing immediately
      try {
        const message = event.message;

        // Faqat text xabarlar va guruh xabarlarini qabul qilish
        if (!message?.text || (!message.peerId?.channelId && !message.peerId?.chatId)) {
          return;
        }

        // Add to queue for batch processing
        this.messageQueue.push({
          message,
          timestamp: Date.now()
        });

        // Limit queue size
        if (this.messageQueue.length > 100) {
          this.messageQueue.shift(); // Remove oldest
        }

      } catch (error) {
        console.error('❌ Message handler error:', error.message);
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
   * Process message queue in batches
   */
  async processMessageQueue() {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      const batch = this.messageQueue.splice(0, 20); // Process max 20 at a time
      console.log(`📦 Processing ${batch.length} messages from queue...`);

      for (const item of batch) {
        try {
          const { message } = item;

          const sender = await message.getSender();
          const chat = await message.getChat();

          const senderId = sender?.id?.toString();
          const chatId = chat?.id?.toString();

          // Bloklangan user check
          const isBlocked = await BlockedUser.isBlocked(senderId);
          if (isBlocked) {
            continue;
          }

          const messageData = {
            telegram_message_id: message.id,
            sender_user_id: senderId,
            sender_username: sender?.username || '',
            sender_full_name: `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim(),
            message_text: message.text,
            message_date: new Date(message.date * 1000),
            group_id: chatId,
            group_name: chat?.title || '',
            group_username: chat?.username || ''
          };

          // Filter check
          const filterResult = messageFilter.checkMessage(messageData);

          if (filterResult.shouldBlock) {
            // Auto-block if needed
            if (filterResult.autoBlock) {
              const existingBlock = await BlockedUser.findByTelegramId(senderId);
              if (!existingBlock) {
                await BlockedUser.create({
                  telegram_user_id: senderId,
                  username: messageData.sender_username,
                  full_name: messageData.sender_full_name,
                  reason: filterResult.reason,
                  blocked_by: 0
                });
              }
            }
            continue;
          }

          // Dispatcher detection
          const detection = dispatcherDetector.analyze(messageData.message_text, messageData);

          // Get or create group
          let dbGroup = await TelegramGroup.findByGroupId(messageData.group_id);
          if (!dbGroup) {
            dbGroup = await TelegramGroup.create({
              group_id: messageData.group_id,
              group_name: messageData.group_name,
              group_username: messageData.group_username,
              added_by: 1
            });
          }

          // Extract logistics data
          const logisticsData = dispatcherDetector.extractLogisticsData(messageData.message_text);

          // Save to database
          const savedMessage = await Message.create({
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
              chat: { id: chatId, title: chat?.title }
            },
            ...logisticsData
          });

          console.log(`✅ Saved: ${messageData.group_name}`);

          // AUTO-SEND to target group with "Bu dispetcher ekan" button
          if (savedMessage && savedMessage.id) {
            const sendResult = await telegramBot.sendToChannel(savedMessage.id);
            if (sendResult.success) {
              console.log(`📤 Auto-sent to group: ${savedMessage.id}`);
            } else if (sendResult.isDuplicate) {
              console.log(`⏭️ Skipped duplicate: ${savedMessage.id} - ${sendResult.error}`);
            } else {
              console.error(`❌ Auto-send error for ${savedMessage.id}:`, sendResult.error);
            }
          }

        } catch (error) {
          console.error('❌ Process error:', error.message);
        }
      }

    } catch (error) {
      console.error('❌ Queue processing error:', error.message);
    } finally {
      this.processingQueue = false;
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
