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
const PendingApproval = require('../models/PendingApproval');
const Whitelist = require('../models/Whitelist');
const dispatcherDetector = require('./dispatcher-detector');
const messageFilter = require('./message-filter');
const telegramBot = require('./telegram-bot');
const semySMS = require('./semysms');
const autoReply = require('./autoReply');

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
            // Send auto-reply to blocked user (using session)
            // DON'T AWAIT - run in background to avoid blocking message processing
            autoReply.sendAutoReply(
              this,
              senderId,
              sender?.username || `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim(),
              chatId,
              chat?.title || 'Unknown Group',
              message.id
            ).then(replyResult => {
              if (replyResult.success) {
                console.log(`📨 Auto-reply sent to blocked user ${sender?.username}`);
              } else {
                console.log(`⏭️ Auto-reply skipped for blocked user: ${replyResult.reason}`);
              }
            }).catch(error => {
              console.error(`❌ Auto-reply error for blocked user:`, error.message);
            });

            // TUZATISH: CONTINUE O'CHIRILDI - Bloklangan userlar e'lonlari HAM yuboriladi!
            // Endi auto-reply yuboriladi, lekin e'lon normal process qilinadi
            // continue; // <-- REMOVED
          }

          console.log(`🔍 Processing message from ${sender?.username || sender?.firstName} in ${chat?.title}`);

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

          // Extract phone number from message
          const logisticsData = dispatcherDetector.extractLogisticsData(messageData.message_text);
          const phoneNumber = logisticsData.contact_phone;

          // Check if phone number is blocked
          if (phoneNumber) {
            const isPhoneBlocked = await BlockedUser.isPhoneBlocked(phoneNumber);
            if (isPhoneBlocked) {
              console.log(`📵 Blocked phone detected: ${phoneNumber} - sending auto-reply`);

              // Send auto-reply to blocked phone user (using session)
              // DON'T AWAIT - run in background to avoid blocking message processing
              autoReply.sendAutoReply(
                this,
                senderId,
                sender?.username || `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim(),
                chatId,
                chat?.title || 'Unknown Group',
                message.id
              ).then(replyResult => {
                if (replyResult.success) {
                  console.log(`📨 Auto-reply sent to blocked phone user ${sender?.username}`);
                } else {
                  console.log(`⏭️ Auto-reply skipped for blocked phone: ${replyResult.reason}`);
                }
              }).catch(error => {
                console.error(`❌ Auto-reply error for blocked phone:`, error.message);
              });

              // TUZATISH: CONTINUE O'CHIRILDI - Blocked phone'lar e'lonlari HAM yuboriladi!
              // continue; // <-- REMOVED
            }
          }

          // 🚨 PHONE SPAM DETECTION: 20+ guruhda bir xil raqam = ADMIN TASDIQ KERAK
          if (phoneNumber) {
            // Check if user is whitelisted
            const isWhitelisted = await Whitelist.isWhitelisted(senderId);
            if (!isWhitelisted) {
              const { db } = require("../config/database");
              const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

              const recentWithSamePhone = db.get("messages")
                .filter(msg =>
                  msg.contact_phone === phoneNumber &&
                  new Date(msg.created_at) >= thirtyMinutesAgo
                )
                .value();

              // Count unique groups
              const uniqueGroups = new Set(recentWithSamePhone.map(m => m.group_id));
              const groupCount = uniqueGroups.size;

              if (groupCount >= 20) {
                console.log(`🚨 SPAM DETECTED! Phone ${phoneNumber} in ${groupCount} groups - AVTOMATIK BLOKLASH`);

                // AVTOMATIK BLOKLASH - admin tasdiqsiz
                const existingBlock = await BlockedUser.findByTelegramId(senderId);
                if (!existingBlock) {
                  await BlockedUser.create({
                    telegram_user_id: senderId,
                    username: messageData.sender_username,
                    full_name: messageData.sender_full_name,
                    phone_number: phoneNumber,
                    reason: `AVTO-BLOK: ${groupCount} ta guruhda bir xil raqam (30 daqiqada)`,
                    blocked_by: 0  // 0 = auto-blocked
                  });

                  // DELETE ALL USER'S MESSAGES from group (including old ones)
                  await telegramBot.deleteAllUserMessages(senderId);

                  // Send info notification to admin (tugmalarsiz)
                  await telegramBot.sendBlockNotification({
                    user_id: senderId,
                    username: messageData.sender_username,
                    full_name: messageData.sender_full_name,
                    phone_number: phoneNumber,
                    reason: `${groupCount} ta guruhda bir xil raqam (30 daqiqada)`,
                    message_text: messageData.message_text
                  });

                  console.log(`✅ AVTOMATIK BLOKLANDI: ${messageData.sender_full_name} - Admin'ga xabar yuborildi`);

                  // Send SMS to blocked user
                  semySMS.sendBlockNotificationSMS(
                    phoneNumber,
                    messageData.sender_full_name,
                    `${groupCount} ta guruhda bir xil raqam`,
                    senderId // Check if user in group before sending SMS
                  ).catch(err => {
                    console.error('SMS yuborishda xatolik:', err.message);
                  });
                }
                // Skip this message since user is now blocked
                continue;
              }
            }
          }

          // Filter check
          const filterResult = messageFilter.checkMessage(messageData);

          if (filterResult.shouldBlock) {
            // Skip messages without phone numbers (no notification needed)
            if (filterResult.reason === 'Telefon raqam yo\'q') {
              continue;
            }

            // Check if user is whitelisted
            const isWhitelisted = await Whitelist.isWhitelisted(senderId);

            if (!isWhitelisted) {
              // AVTOMATIK BLOKLASH
              const existingBlock = await BlockedUser.findByTelegramId(senderId);
              if (!existingBlock) {
                await BlockedUser.create({
                  telegram_user_id: senderId,
                  username: messageData.sender_username,
                  full_name: messageData.sender_full_name,
                  phone_number: phoneNumber || null,
                  reason: `AVTO-BLOK: ${filterResult.reason}`,
                  blocked_by: 0  // 0 = auto-blocked
                });

                // DELETE ALL USER'S MESSAGES from group (including old ones)
                await telegramBot.deleteAllUserMessages(senderId);

                // Send info notification to admin (tugmalarsiz)
                await telegramBot.sendBlockNotification({
                  user_id: senderId,
                  username: messageData.sender_username,
                  full_name: messageData.sender_full_name,
                  phone_number: phoneNumber || null,
                  reason: filterResult.reason,
                  message_text: messageData.message_text
                });

                console.log(`✅ AVTOMATIK BLOKLANDI: ${messageData.sender_full_name} - ${filterResult.reason}`);

                // Send SMS to blocked user
                semySMS.sendBlockNotificationSMS(
                  phoneNumber || null,
                  messageData.sender_full_name,
                  filterResult.reason,
                  senderId // Check if user in group before sending SMS
                ).catch(err => {
                  console.error('SMS yuborishda xatolik:', err.message);
                });
              }
              // Skip this message since user is blocked
              continue;
            }
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

          // logistics data already extracted above (line 246) for phone check
          // No need to extract again

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

          // AUTO-REPLY to dispatcher messages
          // Check if:
          // 1. Current message detected as dispatcher OR
          // 2. User was previously marked as dispatcher (in any previous message) OR
          // 3. User is blocked (all blocked users are dispatchers)
          let shouldReply = detection.isDispatcher;

          if (!shouldReply && messageData.sender_user_id) {
            const { db } = require('../config/database');

            // Check if user is blocked (all blocked = dispatcher)
            const isBlocked = db.get('blocked_users')
              .find({ telegram_user_id: senderId })
              .value();

            if (isBlocked) {
              shouldReply = true;
              console.log(`🚫 User ${messageData.sender_username} is blocked = dispatcher`);
            } else {
              // Check if this user has any previous messages marked as dispatcher
              const previousDispatcherMessage = db.get('messages')
                .find({ sender_user_id: senderId, is_dispatcher: true })
                .value();

              if (previousDispatcherMessage) {
                shouldReply = true;
                console.log(`👤 User ${messageData.sender_username} was previously marked as dispatcher`);
              }
            }
          }

          if (shouldReply && messageData.sender_user_id) {
            // Send auto-reply using Telegram Session
            // DON'T AWAIT - run in background to avoid blocking message processing
            autoReply.sendAutoReply(
              this,
              messageData.sender_user_id,
              messageData.sender_username || messageData.sender_full_name,
              chatId,
              chat?.title || 'Unknown Group',
              messageData.telegram_message_id
            ).then(replyResult => {
              if (replyResult.success) {
                console.log(`📨 Auto-reply sent to dispatcher ${messageData.sender_username}`);
              } else {
                console.log(`⏭️ Auto-reply skipped for ${messageData.sender_username}: ${replyResult.reason}`);
              }
            }).catch(error => {
              console.error(`❌ Auto-reply error for ${messageData.sender_username}:`, error.message);
            });
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
   * Send message via session (reply to a message)
   */
  async sendMessage(chatId, messageText, replyToMessageId = null) {
    try {
      if (!this.client || !this.isConnected) {
        throw new Error('Telegram session ulanmagan');
      }

      const options = {};
      if (replyToMessageId) {
        options.replyTo = replyToMessageId;
      }

      const result = await this.client.sendMessage(chatId, {
        message: messageText,
        ...options
      });

      return {
        success: true,
        message_id: result.id
      };
    } catch (error) {
      console.error('❌ Session message yuborishda xatolik:', error.message);
      return {
        success: false,
        error: error.message
      };
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
