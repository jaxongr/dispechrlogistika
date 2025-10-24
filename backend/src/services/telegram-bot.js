const { Telegraf, Markup } = require('telegraf');
const { db } = require('../config/database');
const BlockedUser = require('../models/BlockedUser');
const DispatcherReport = require('../models/DispatcherReport');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    this.targetGroupId = null;
  }

  async start() {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      this.targetGroupId = process.env.TARGET_GROUP_ID || process.env.TARGET_CHANNEL_ID;

      console.log('🔍 Bot token check:', botToken ? 'EXISTS' : 'MISSING');
      console.log('🎯 Target group ID:', this.targetGroupId || 'NOT SET');

      if (!botToken) {
        console.log('❌ Bot token topilmadi!');
        this.isRunning = false;
        return;
      }

      console.log('🚀 Starting Telegram bot...');
      this.bot = new Telegraf(botToken);

      // Setup callback query handler for "Bu dispetcher ekan" button
      this.bot.on('callback_query', async (ctx) => {
        await this.handleDispatcherReport(ctx);
      });

      // Verify token first
      const me = await this.bot.telegram.getMe();
      console.log('✅ TELEGRAM BOT ULANDI!');
      console.log('🤖 Bot username: @' + me.username);

      // Launch bot in background (non-blocking)
      this.bot.launch().catch(err => {
        console.error('❌ Bot launch xatolik:', err.message);
        this.isRunning = false;
      });

      this.isRunning = true;

    } catch (error) {
      console.error('❌ TELEGRAM BOT XATOLIK:', error.message);
      this.isRunning = false;
    }
  }

  /**
   * Handle "Bu dispetcher ekan" button click
   */
  async handleDispatcherReport(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;

      // Admin action handler
      if (callbackData.startsWith('admin_block_')) {
        await this.handleAdminAction(ctx);
        return;
      }

      if (!callbackData.startsWith('report_dispatcher_')) {
        return;
      }

      // Extract message_id and telegram_user_id from callback data
      // Format: report_dispatcher_{message_id}_{telegram_user_id}
      const parts = callbackData.split('_');
      const messageId = parseInt(parts[2]); // Convert to number to match DB type
      const telegramUserId = parts[3];

      console.log(`🚫 Dispetcher report: msg=${messageId}, user=${telegramUserId}, reporter=${ctx.from.id}`);

      // Get message from database
      const message = db.get('messages').find({ id: messageId }).value();

      if (!message) {
        await ctx.answerCbQuery('❌ Xabar topilmadi');
        return;
      }

      // Save report to database
      const report = await DispatcherReport.create({
        message_id: messageId,
        reported_by_user_id: ctx.from.id.toString(),
        reported_by_username: ctx.from.username || '',
        reported_by_full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
        reported_user_id: telegramUserId,
        reported_user_username: message.sender_username || '',
        channel_message_id: message.group_message_id
      });

      console.log(`📝 Report saved: ID=${report.id}, reporter=${ctx.from.id}`);

      // Send notification to admin
      await this.notifyAdminAboutReport(report, message, ctx);

      // Block the user
      const isAlreadyBlocked = await BlockedUser.isBlocked(telegramUserId);

      if (!isAlreadyBlocked) {
        await BlockedUser.create({
          telegram_user_id: telegramUserId,
          username: message.sender_username || '',
          full_name: message.sender_full_name || '',
          reason: `Guruh a'zosi tomonidan dispetcher deb belgilandi (reporter: ${ctx.from.id})`,
          blocked_by: ctx.from.id
        });

        console.log(`✅ User ${telegramUserId} blocked by group member ${ctx.from.id}`);

        // Also block all phone numbers from this user's messages
        await BlockedUser.blockUserPhoneNumbers(
          telegramUserId,
          `Guruh a'zosi tomonidan bloklangan user telefoni (reporter: ${ctx.from.id})`
        );
      }

      // Delete message from group
      if (message.group_message_id) {
        try {
          await ctx.deleteMessage(message.group_message_id);
          console.log(`🗑️ Message ${message.group_message_id} deleted from group`);
        } catch (deleteError) {
          console.error('Delete error:', deleteError.message);
        }
      }

      // Update message in database
      db.get('messages')
        .find({ id: messageId })
        .assign({
          is_dispatcher: true,
          confidence_score: 1.0,
          blocked_by_group: true,
          blocked_at: new Date().toISOString()
        })
        .write();

      await ctx.answerCbQuery('✅ Dispetcher bloklandi va e\'lon o\'chirildi!');

    } catch (error) {
      console.error('❌ Callback handler error:', error);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi').catch(() => {});
    }
  }

  /**
   * Send approved message to target group with "Bu dispetcher ekan" button
   */
  async sendToChannel(messageId) {
    try {
      if (!this.isRunning) {
        console.log('⚠️  Bot ishlamayapti');
        return { success: false, error: 'Bot ishlamayapti' };
      }

      if (!this.targetGroupId) {
        console.log('⚠️  Target group ID o\'rnatilmagan');
        return { success: false, error: 'Target group ID yo\'q' };
      }

      // Get message from database
      const message = db.get('messages').find({ id: messageId }).value();

      if (!message) {
        return { success: false, error: 'Xabar topilmadi' };
      }

      // DUPLICATE CHECK: Skip if same phone number was sent in last 10 minutes
      if (message.contact_phone) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentDuplicate = db.get('messages')
          .filter(msg =>
            msg.contact_phone === message.contact_phone &&
            msg.is_sent_to_channel === true &&
            msg.id !== messageId &&
            new Date(msg.sent_at) > tenMinutesAgo
          )
          .value();

        if (recentDuplicate.length > 0) {
          console.log(`⏭️ SKIP DUPLICATE: Phone ${message.contact_phone} already sent in last 10 min`);
          return { success: false, error: 'Dublikat - oxirgi 10 daqiqada yuborilgan', isDuplicate: true };
        }
      }

      // Format message text with HTML formatting
      let messageText = `📦 ${this.escapeHtml(message.message_text)}\n\n`;

      if (message.contact_phone) {
        messageText += `📞 Telefon: ${message.contact_phone}\n`;
      }

      if (message.route_from || message.route_to) {
        messageText += `🛣️ Yo'nalish: ${this.escapeHtml(message.route_from || '?')} → ${this.escapeHtml(message.route_to || '?')}\n`;
      }

      if (message.cargo_type) {
        messageText += `📦 Yuk turi: ${this.escapeHtml(message.cargo_type)}\n`;
      }

      // Get group info from database
      const groupInfo = db.get('telegram_groups')
        .find({ id: message.group_id })
        .value();

      // Create clickable sender link
      const senderName = this.escapeHtml(message.sender_full_name || 'Noma\'lum');
      let senderInfo;

      if (message.sender_username && message.sender_username.trim()) {
        // If username exists, create clickable link to @username
        senderInfo = `<a href="https://t.me/${message.sender_username}">${senderName}</a>`;
      } else {
        // No username - use text mention format (works in all Telegram clients)
        // Format: <a href="tg://user?id=USER_ID">Name</a>
        senderInfo = `<a href="tg://user?id=${message.sender_user_id}">${senderName}</a>`;
      }

      // Add hashtag for user ID tracking
      const userIdHashtag = `#ID${message.sender_user_id}`;

      messageText += `\n👤 Yuboruvchi: ${senderInfo} ${userIdHashtag}`;

      // Create message source link - universal "Bu yerda" text
      if (groupInfo) {
        let sourceLink;

        if (groupInfo.group_username && groupInfo.group_username.trim()) {
          // Public group - use username
          sourceLink = `https://t.me/${groupInfo.group_username}/${message.telegram_message_id}`;
        } else {
          // Private group - use group ID (remove -100 prefix if exists)
          const cleanGroupId = groupInfo.group_id.toString().replace(/^-100/, '');
          sourceLink = `https://t.me/c/${cleanGroupId}/${message.telegram_message_id}`;
        }

        messageText += `\n📍 Manba: <a href="${sourceLink}">Bu yerda</a>`;
      } else {
        messageText += `\n📍 Manba: Noma'lum`;
      }

      // Create inline keyboard with "Bu dispetcher ekan" button
      const keyboard = Markup.inlineKeyboard([
        Markup.button.callback(
          '🚫 Bu dispetcher ekan',
          `report_dispatcher_${messageId}_${message.sender_user_id}`
        )
      ]);

      // Send message to target group with HTML formatting
      const sentMessage = await this.bot.telegram.sendMessage(
        this.targetGroupId,
        messageText,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: keyboard.reply_markup
        }
      );

      console.log(`✅ Message ${messageId} sent to group ${this.targetGroupId}, msg_id=${sentMessage.message_id}`);

      // Update message in database with group_message_id
      db.get('messages')
        .find({ id: messageId })
        .assign({
          is_sent_to_channel: true,
          sent_at: new Date().toISOString(),
          group_message_id: sentMessage.message_id
        })
        .write();

      return {
        success: true,
        groupMessageId: sentMessage.message_id
      };

    } catch (error) {
      console.error('❌ Send to channel error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete message from group (when blocked from dashboard)
   */
  async deleteFromGroup(messageId) {
    try {
      if (!this.isRunning || !this.targetGroupId) {
        return { success: false, error: 'Bot ishlamayapti' };
      }

      const message = db.get('messages').find({ id: messageId }).value();

      if (!message || !message.group_message_id) {
        return { success: false, error: 'Group message ID topilmadi' };
      }

      await this.bot.telegram.deleteMessage(
        this.targetGroupId,
        message.group_message_id
      );

      console.log(`🗑️ Message ${message.group_message_id} deleted from group`);

      return { success: true };

    } catch (error) {
      console.error('❌ Delete from group error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify admin about dispatcher report
   */
  async notifyAdminAboutReport(report, message, ctx) {
    try {
      const adminId = process.env.ADMIN_USER_ID;

      if (!adminId) {
        console.log('⚠️ ADMIN_USER_ID not set in .env');
        return;
      }

      // Get reporter's stats
      const reporterStats = await DispatcherReport.getReportsByUser(report.reported_by_user_id);

      let notificationText = `🚨 <b>DISPETCHER BLOKLANDI!</b>\n\n`;
      notificationText += `👤 <b>Bloklagan:</b> `;

      if (ctx.from.username) {
        notificationText += `<a href="https://t.me/${ctx.from.username}">${this.escapeHtml(report.reported_by_full_name)}</a>`;
      } else {
        notificationText += `<a href="tg://user?id=${report.reported_by_user_id}">${this.escapeHtml(report.reported_by_full_name)}</a>`;
      }

      notificationText += `\n📊 <b>Jami bloklagan:</b> ${reporterStats.length} ta\n\n`;

      notificationText += `❌ <b>Bloklangan user:</b>\n`;
      if (message.sender_username) {
        notificationText += `   @${message.sender_username}\n`;
      }
      notificationText += `   ID: <code>${message.sender_user_id}</code>\n`;
      notificationText += `   Ism: ${this.escapeHtml(message.sender_full_name || 'N/A')}\n\n`;

      notificationText += `📝 <b>E'lon matni:</b>\n${this.escapeHtml(message.message_text.substring(0, 200))}${message.message_text.length > 200 ? '...' : ''}\n\n`;

      if (message.contact_phone) {
        notificationText += `📞 Telefon: ${message.contact_phone}\n`;
      }

      // Create admin keyboard with actions
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚫 Bloklagan userni blokla',
            `admin_block_reporter_${report.id}_${report.reported_by_user_id}`
          )
        ],
        [
          Markup.button.callback(
            '⛔ Guruhdan chiqar',
            `admin_kick_reporter_${report.id}_${report.reported_by_user_id}`
          )
        ],
        [
          Markup.button.callback(
            '✅ Hech narsa qilma',
            `admin_ignore_${report.id}`
          )
        ]
      ]);

      await this.bot.telegram.sendMessage(
        adminId,
        notificationText,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup
        }
      );

      // Mark as notified
      await DispatcherReport.markAsNotified(report.id);

      console.log(`📨 Admin notified about report ${report.id}`);

    } catch (error) {
      console.error('❌ Error notifying admin:', error.message);
    }
  }

  /**
   * Handle admin actions on reporter
   */
  async handleAdminAction(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      const parts = callbackData.split('_');

      if (callbackData.startsWith('admin_block_reporter_')) {
        // Format: admin_block_reporter_{report_id}_{user_id}
        const reportId = parseInt(parts[3]);
        const userId = parts[4];

        // Block the reporter
        const isAlreadyBlocked = await BlockedUser.isBlocked(userId);

        if (!isAlreadyBlocked) {
          await BlockedUser.create({
            telegram_user_id: userId,
            username: '',
            full_name: '',
            reason: 'Admin tomonidan bloklandi - noto\'g\'ri hisobotlar yuborgan',
            blocked_by: ctx.from.id
          });

          // Update report
          await DispatcherReport.updateAdminAction(reportId, 'blocked');

          await ctx.answerCbQuery('✅ User bloklandi');
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n✅ <b>Admin action:</b> User bloklandi',
            { parse_mode: 'HTML' }
          );

          console.log(`✅ Admin blocked reporter ${userId}`);
        } else {
          await ctx.answerCbQuery('⚠️ User allaqachon bloklangan');
        }

      } else if (callbackData.startsWith('admin_kick_reporter_')) {
        // Format: admin_kick_reporter_{report_id}_{user_id}
        const reportId = parseInt(parts[3]);
        const userId = parts[4];

        try {
          // Kick from target group
          await this.bot.telegram.banChatMember(this.targetGroupId, userId);

          // Unban immediately (just kick, not permanent ban)
          await this.bot.telegram.unbanChatMember(this.targetGroupId, userId);

          // Update report
          await DispatcherReport.updateAdminAction(reportId, 'kicked');

          await ctx.answerCbQuery('✅ User guruhdan chiqarildi');
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n⛔ <b>Admin action:</b> User guruhdan chiqarildi',
            { parse_mode: 'HTML' }
          );

          console.log(`✅ Admin kicked reporter ${userId} from group`);

        } catch (error) {
          console.error('❌ Kick error:', error.message);
          await ctx.answerCbQuery('❌ Xatolik: ' + error.message);
        }

      } else if (callbackData.startsWith('admin_ignore_')) {
        // Format: admin_ignore_{report_id}
        const reportId = parseInt(parts[2]);

        // Update report
        await DispatcherReport.updateAdminAction(reportId, 'ignored');

        await ctx.answerCbQuery('✅ Hech narsa qilinmadi');
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n✅ <b>Admin action:</b> Ignore qilindi',
          { parse_mode: 'HTML' }
        );

        console.log(`✅ Admin ignored report ${reportId}`);
      }

    } catch (error) {
      console.error('❌ Admin action error:', error.message);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi').catch(() => {});
    }
  }

  /**
   * Escape HTML special characters for Telegram HTML parse mode
   */
  escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  stop() {
    if (this.bot) {
      this.bot.stop();
      this.isRunning = false;
    }
  }
}

module.exports = new TelegramBotService();
