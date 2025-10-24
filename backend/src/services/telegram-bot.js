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

      // Setup /start command
      this.bot.command('start', async (ctx) => {
        // Save user to database
        try {
          const existingUser = db.get('bot_users')
            .find({ telegram_user_id: ctx.from.id.toString() })
            .value();

          if (!existingUser) {
            db.get('bot_users')
              .push({
                telegram_user_id: ctx.from.id.toString(),
                username: ctx.from.username || '',
                first_name: ctx.from.first_name || '',
                last_name: ctx.from.last_name || '',
                started_at: new Date().toISOString()
              })
              .write();

            console.log(`✅ New bot user registered: ${ctx.from.username || ctx.from.id}`);
          } else {
            // Update last interaction
            db.get('bot_users')
              .find({ telegram_user_id: ctx.from.id.toString() })
              .assign({ last_interaction: new Date().toISOString() })
              .write();
          }
        } catch (err) {
          console.error('Error saving bot user:', err.message);
        }

        const welcomeMessage = `🤖 <b>YO'LDA | Yuk Markazi Bot</b>

Assalomu alaykum! Bu bot logistika e'lonlarini filter qiladi va guruhga yuboradi.

<b>📊 Statistika:</b>
Dashboard: http://5.189.141.151:3001

<b>🔧 Komandalar:</b>
/start - Bot haqida ma'lumot
/help - Yordam
/stats - Mening statistikam

<b>ℹ️ Qanday ishlaydi:</b>
1. E'lonlar avtomatik filter qilinadi
2. To'g'ri e'lonlar guruhga yuboriladi
3. E'lonni olish uchun "✅ Olindi" tugmasini bosing
4. Telefon raqam botda yuboriladi

<b>📞 Raqamni qayta olish:</b>
Agar raqamni unutsangiz, "📞 Raqamni olish" tugmasini bosing

<b>⚠️ Eslatma:</b>
Noto'g'ri e'lonlarni "Bu dispetcher ekan" deb belgilasangiz, admin tasdiqlashini kutib turing.`;

        await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
      });

      // Setup /help command
      this.bot.command('help', async (ctx) => {
        const helpMessage = `📚 <b>YORDAM</b>

<b>Bot komandalar:</b>
/start - Bot haqida
/help - Bu yordam
/stats - Mening statistikam

<b>Qanday ishlaydi:</b>
• Bot guruhlardan e'lonlarni o'qiydi
• AI va qoidalar orqali filter qiladi
• To'g'ri e'lonlar "YO'LDA | Yuk markazi" guruhiga yuboriladi

<b>Agar e'lon dispetcher bo'lsa:</b>
• "🚫 Bu dispetcher ekan" tugmasini bosing
• User avtomatik bloklanadi
• E'lon o'chiriladi

<b>Dashboard:</b>
http://5.189.141.151:3001

Savol bo'lsa, admin bilan bog'laning.`;

        await ctx.reply(helpMessage, { parse_mode: 'HTML' });
      });

      // Setup /stats command
      this.bot.command('stats', async (ctx) => {
        try {
          const userId = ctx.from.id.toString();
          const DispatcherReport = require('../models/DispatcherReport');
          const reports = await DispatcherReport.getReportsByUser(userId);

          const statsMessage = `📊 <b>SIZNING STATISTIKANGIZ</b>

👤 User: ${ctx.from.first_name || 'Noma\'lum'}
🆔 ID: <code>${userId}</code>

📝 <b>Jami bloklagan:</b> ${reports.length} ta e'lon

🔗 <b>To'liq statistika:</b>
http://5.189.141.151:3001/reporter-stats.html`;

          await ctx.reply(statsMessage, { parse_mode: 'HTML' });
        } catch (error) {
          await ctx.reply('❌ Statistikani yuklashda xatolik yuz berdi.');
        }
      });

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

      // "Olindi" button handler
      if (callbackData.startsWith('taken_')) {
        await this.handleTakenButton(ctx);
        return;
      }

      // "Raqamni olish" button handler
      if (callbackData.startsWith('get_phone_')) {
        await this.handleGetPhoneButton(ctx);
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

      // Send notification to admin for confirmation (NOT auto-block)
      await this.notifyAdminAboutReportForConfirmation(report, message, ctx);

      // Mark report as pending in database
      db.get('messages')
        .find({ id: messageId })
        .assign({
          pending_dispatcher_report: true,
          reported_at: new Date().toISOString()
        })
        .write();

      await ctx.answerCbQuery('📨 So\'rov admin\'ga yuborildi. Tasdiqlashni kutib turing...');

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

      // Create inline keyboard with "Bu dispetcher ekan" and "Olindi" buttons
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Olindi',
            `taken_${messageId}_${message.sender_user_id}`
          ),
          Markup.button.callback(
            '🚫 Bu dispetcher ekan',
            `report_dispatcher_${messageId}_${message.sender_user_id}`
          )
        ]
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
   * Notify admin about dispatcher report - FOR CONFIRMATION
   */
  async notifyAdminAboutReportForConfirmation(report, message, reporter) {
    try {
      const adminId = process.env.ADMIN_USER_ID;

      if (!adminId) {
        console.log('⚠️ ADMIN_USER_ID not set in .env');
        return;
      }

      // Get reporter's stats
      const reporterStats = await DispatcherReport.getReportsByUser(report.reported_by_user_id);

      let notificationText = `⚠️ <b>DISPECHR SO'ROV!</b>\n\n`;
      notificationText += `👤 <b>Kim xabar berdi:</b> `;

      if (reporter.from.username) {
        notificationText += `<a href="https://t.me/${reporter.from.username}">${this.escapeHtml(report.reported_by_full_name)}</a>`;
      } else {
        notificationText += `<a href="tg://user?id=${report.reported_by_user_id}">${this.escapeHtml(report.reported_by_full_name)}</a>`;
      }

      notificationText += `\n📊 <b>Jami hisobotlar:</b> ${reporterStats.length} ta\n\n`;

      notificationText += `❓ <b>Dispetcher deb gumon qilingan user:</b>\n`;
      if (message.sender_username) {
        notificationText += `   @${message.sender_username}\n`;
      }
      notificationText += `   ID: <code>${message.sender_user_id}</code>\n`;
      notificationText += `   Ism: ${this.escapeHtml(message.sender_full_name || 'N/A')}\n\n`;

      notificationText += `📝 <b>E'lon matni:</b>\n${this.escapeHtml(message.message_text.substring(0, 200))}${message.message_text.length > 200 ? '...' : ''}\n\n`;

      if (message.contact_phone) {
        notificationText += `📞 Telefon: ${message.contact_phone}\n`;
      }

      notificationText += `\n<b>⚠️ TASDIQLANG:</b> Bu haqiqatan dispetchermi?`;

      // Create admin confirmation keyboard
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Ha, dispetcher - Blokla',
            `admin_confirm_dispatcher_${report.id}_${message.id}_${message.sender_user_id}`
          )
        ],
        [
          Markup.button.callback(
            '❌ Yo\'q, dispetcher emas',
            `admin_reject_dispatcher_${report.id}_${report.reported_by_user_id}`
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

      console.log(`📨 Admin notified about dispatcher confirmation ${report.id}`);

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

      // Admin confirms dispatcher report
      if (callbackData.startsWith('admin_confirm_dispatcher_')) {
        // Format: admin_confirm_dispatcher_{report_id}_{message_id}_{user_id}
        const reportId = parseInt(parts[3]);
        const messageId = parseInt(parts[4]);
        const userId = parts[5];

        // Get message from database
        const message = db.get('messages').find({ id: messageId }).value();

        if (!message) {
          await ctx.answerCbQuery('❌ Xabar topilmadi');
          return;
        }

        // Block the user
        const isAlreadyBlocked = await BlockedUser.isBlocked(userId);

        if (!isAlreadyBlocked) {
          await BlockedUser.create({
            telegram_user_id: userId,
            username: message.sender_username || '',
            full_name: message.sender_full_name || '',
            reason: `Admin tomonidan tasdiqlangan dispetcher`,
            blocked_by: ctx.from.id
          });

          // Block phone numbers
          await BlockedUser.blockUserPhoneNumbers(
            userId,
            `Admin tomonidan tasdiqlangan dispetcher telefoni`
          );

          console.log(`✅ Admin confirmed dispatcher: ${userId}`);
        }

        // Edit message in group - mark as DISPECHR
        await this.markMessageAsDispatcher(message, ctx.from);

        // Update report
        await DispatcherReport.updateAdminAction(reportId, 'confirmed_dispatcher');

        // Update message in database
        db.get('messages')
          .find({ id: messageId })
          .assign({
            is_dispatcher: true,
            confidence_score: 1.0,
            confirmed_by_admin: true,
            confirmed_at: new Date().toISOString(),
            pending_dispatcher_report: false
          })
          .write();

        await ctx.answerCbQuery('✅ Dispetcher tasdiqlandi va bloklandi');
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n✅ <b>Admin action:</b> Dispetcher tasdiqlandi va bloklandi',
          { parse_mode: 'HTML' }
        );

      } else if (callbackData.startsWith('admin_reject_dispatcher_')) {
        // Format: admin_reject_dispatcher_{report_id}_{reporter_user_id}
        const reportId = parseInt(parts[3]);
        const reporterUserId = parts[4];

        // Update report
        await DispatcherReport.updateAdminAction(reportId, 'rejected');

        await ctx.answerCbQuery('❌ Hisobot rad etildi');
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n❌ <b>Admin action:</b> Dispetcher emas, hisobot rad etildi',
          { parse_mode: 'HTML' }
        );

        console.log(`❌ Admin rejected dispatcher report ${reportId}`);

      } else if (callbackData.startsWith('admin_block_reporter_')) {
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
          // Kick from target group - use banChatMember with until_date
          // until_date: current time + 30 seconds (temporary ban, then auto-unban)
          const untilDate = Math.floor(Date.now() / 1000) + 30;

          await this.bot.telegram.banChatMember(this.targetGroupId, userId, {
            until_date: untilDate,
            revoke_messages: false
          });

          // Update report
          await DispatcherReport.updateAdminAction(reportId, 'kicked');

          await ctx.answerCbQuery('✅ User guruhdan chiqarildi');
          await ctx.editMessageText(
            ctx.callbackQuery.message.text + '\n\n⛔ <b>Admin action:</b> User guruhdan chiqarildi (30s temp ban)',
            { parse_mode: 'HTML' }
          );

          console.log(`✅ Admin kicked reporter ${userId} from group (30s temp ban)`);

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
   * Handle "Olindi" button click
   */
  async handleTakenButton(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      // Format: taken_{message_id}_{original_sender_id}
      const parts = callbackData.split('_');
      const messageId = parseInt(parts[1]);

      console.log(`✅ Olindi button: msg=${messageId}, taker=${ctx.from.id}`);

      // Get message from database
      const message = db.get('messages').find({ id: messageId }).value();

      if (!message) {
        await ctx.answerCbQuery('❌ Xabar topilmadi');
        return;
      }

      // Check if already taken
      if (message.is_taken) {
        await ctx.answerCbQuery(`⚠️ Bu e'lon allaqachon ${message.taken_by_username || 'boshqa user'} tomonidan olingan`);
        return;
      }

      // Mark as taken
      db.get('messages')
        .find({ id: messageId })
        .assign({
          is_taken: true,
          taken_by_user_id: ctx.from.id.toString(),
          taken_by_username: ctx.from.username || '',
          taken_by_full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
          taken_at: new Date().toISOString()
        })
        .write();

      console.log(`✅ Message marked as taken by ${ctx.from.username || ctx.from.id}`);

      // Edit the message - hide phone number and add "Olindi" badge
      await this.editMessageAsTaken(messageId, message, ctx.from);

      // Notify admin
      await this.notifyAdminAboutTaken(message, ctx.from);

      await ctx.answerCbQuery('✅ E\'lon sizga berildi!');

    } catch (error) {
      console.error('❌ Olindi handler error:', error.message);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi').catch(() => {});
    }
  }

  /**
   * Handle "Raqamni olish" button click
   */
  async handleGetPhoneButton(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      // Format: get_phone_{message_id}
      const parts = callbackData.split('_');
      const messageId = parseInt(parts[2]);

      console.log(`📞 Get phone button: msg=${messageId}, user=${ctx.from.id}`);

      // Get message from database
      const message = db.get('messages').find({ id: messageId }).value();

      if (!message) {
        await ctx.answerCbQuery('❌ Xabar topilmadi');
        return;
      }

      // Check if message has phone number
      if (!message.contact_phone) {
        await ctx.answerCbQuery('❌ Bu e\'londa telefon raqam yo\'q');
        return;
      }

      // Send phone number privately to the user
      try {
        await this.bot.telegram.sendMessage(
          ctx.from.id,
          `📞 <b>E'lon uchun telefon raqam:</b>\n\n${message.contact_phone}\n\n👤 Yuboruvchi: ${message.sender_full_name || 'Noma\'lum'}\n\n<i>💡 Agar bot ishlamasa, avval /start bosing</i>`,
          { parse_mode: 'HTML' }
        );

        await ctx.answerCbQuery('✅ Telefon raqam botda yuborildi!');
        console.log(`📞 Phone sent to ${ctx.from.username || ctx.from.id} for message ${messageId}`);

      } catch (err) {
        console.log('⚠️ Could not send phone to user (not started bot):', err.message);

        // If failed to send, tell user to start the bot first
        await ctx.answerCbQuery('❌ Botni avval ishga tushiring: @Yukchiborbot ga /start bosing', { show_alert: true });
      }

    } catch (error) {
      console.error('❌ Get phone handler error:', error.message);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi').catch(() => {});
    }
  }

  /**
   * Edit message after "Olindi" - hide phone and add badge
   */
  async editMessageAsTaken(messageId, message, takenBy) {
    try {
      if (!message.group_message_id) {
        return;
      }

      // Recreate message text without phone number
      // Remove phone numbers from message text using regex
      let cleanedText = message.message_text;

      // Remove phone numbers in various formats
      // +998901234567, 998901234567, 901234567, 90 123 45 67, etc.
      cleanedText = cleanedText.replace(/\+?\d{12}/g, '***');  // +998901234567
      cleanedText = cleanedText.replace(/\b\d{12}\b/g, '***');  // 998901234567
      cleanedText = cleanedText.replace(/\b\d{9}\b/g, '***');   // 901234567
      cleanedText = cleanedText.replace(/\b\d{2}\s?\d{3}\s?\d{2}\s?\d{2}\b/g, '***'); // 90 123 45 67
      cleanedText = cleanedText.replace(/\b\d{3}\s?\d{3}\s?\d{3}\b/g, '***'); // 977 016 763

      let messageText = `📦 ${this.escapeHtml(cleanedText)}\n\n`;

      // COMPLETELY HIDE PHONE NUMBER - don't show it at all
      // Phone will be sent only to the taker via private message

      if (message.route_from || message.route_to) {
        messageText += `🛣️ Yo'nalish: ${this.escapeHtml(message.route_from || '?')} → ${this.escapeHtml(message.route_to || '?')}\n`;
      }

      if (message.cargo_type) {
        messageText += `📦 Yuk turi: ${this.escapeHtml(message.cargo_type)}\n`;
      }

      // Get group info
      const groupInfo = db.get('telegram_groups')
        .find({ id: message.group_id })
        .value();

      // Add sender info
      const senderName = this.escapeHtml(message.sender_full_name || 'Noma\'lum');
      let senderInfo;

      if (message.sender_username && message.sender_username.trim()) {
        senderInfo = `<a href="https://t.me/${message.sender_username}">${senderName}</a>`;
      } else {
        senderInfo = `<a href="tg://user?id=${message.sender_user_id}">${senderName}</a>`;
      }

      const userIdHashtag = `#ID${message.sender_user_id}`;
      messageText += `\n👤 Yuboruvchi: ${senderInfo} ${userIdHashtag}`;

      // DON'T add source link when taken - hide manba completely

      // Add "OLINDI" badge with user info
      const takerUsername = takenBy.username ? `@${takenBy.username}` : takenBy.first_name;
      messageText += `\n\n✅ <b>OLINDI!</b> 👤 ${takerUsername}`;

      // Add button to get phone number if forgotten
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📞 Raqamni olish',
            `get_phone_${messageId}`
          )
        ]
      ]);

      // Update message with "Get Phone" button
      await this.bot.telegram.editMessageText(
        this.targetGroupId,
        message.group_message_id,
        null,
        messageText,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...keyboard
        }
      );

      // Send phone number privately to the taker
      if (message.contact_phone) {
        try {
          await this.bot.telegram.sendMessage(
            takenBy.id,
            `📞 <b>E'lon uchun telefon raqam:</b>\n\n${message.contact_phone}\n\n👤 Yuboruvchi: ${message.sender_full_name || 'Noma\'lum'}`,
            { parse_mode: 'HTML' }
          );
        } catch (err) {
          console.log('⚠️ Could not send phone to taker (user has not started bot)');
        }
      }

      console.log(`✅ Message ${messageId} edited as taken`);

    } catch (error) {
      console.error('❌ Edit message error:', error.message);
    }
  }

  /**
   * Notify admin about taken message
   */
  async notifyAdminAboutTaken(message, takenBy) {
    try {
      const adminId = process.env.ADMIN_USER_ID;

      if (!adminId) {
        return;
      }

      const takerUsername = takenBy.username ? `@${takenBy.username}` : takenBy.first_name;
      const takerLink = takenBy.username ?
        `<a href="https://t.me/${takenBy.username}">${this.escapeHtml(takerUsername)}</a>` :
        `<a href="tg://user?id=${takenBy.id}">${this.escapeHtml(takerUsername)}</a>`;

      let notificationText = `✅ <b>E'LON OLINDI!</b>\n\n`;
      notificationText += `👤 <b>Kim oldi:</b> ${takerLink}\n`;
      notificationText += `🆔 ID: <code>${takenBy.id}</code>\n\n`;

      notificationText += `📝 <b>E'lon:</b>\n${this.escapeHtml(message.message_text.substring(0, 200))}${message.message_text.length > 200 ? '...' : ''}\n\n`;

      if (message.contact_phone) {
        notificationText += `📞 Telefon: ${message.contact_phone}\n`;
      }

      if (message.route_from || message.route_to) {
        notificationText += `🛣️ ${message.route_from || '?'} → ${message.route_to || '?'}\n`;
      }

      notificationText += `\n👤 <b>E'lon egasi:</b> ${message.sender_full_name || message.sender_username || 'N/A'}`;

      await this.bot.telegram.sendMessage(
        adminId,
        notificationText,
        { parse_mode: 'HTML' }
      );

      console.log(`📨 Admin notified about taken message ${message.id}`);

    } catch (error) {
      console.error('❌ Error notifying admin about taken:', error.message);
    }
  }

  /**
   * Mark message as dispatcher in group (after admin confirmation)
   */
  async markMessageAsDispatcher(message, admin) {
    try {
      if (!message.group_message_id) {
        return;
      }

      // Recreate message text
      let messageText = `📦 ${this.escapeHtml(message.message_text)}\n\n`;

      // Keep phone number visible (for DISPATCHER posts)
      if (message.contact_phone) {
        messageText += `📞 Telefon: ${message.contact_phone}\n`;
      }

      if (message.route_from || message.route_to) {
        messageText += `🛣️ Yo'nalish: ${this.escapeHtml(message.route_from || '?')} → ${this.escapeHtml(message.route_to || '?')}\n`;
      }

      if (message.cargo_type) {
        messageText += `📦 Yuk turi: ${this.escapeHtml(message.cargo_type)}\n`;
      }

      // Get group info
      const groupInfo = db.get('telegram_groups')
        .find({ id: message.group_id })
        .value();

      // Add sender info
      const senderName = this.escapeHtml(message.sender_full_name || 'Noma\'lum');
      let senderInfo;

      if (message.sender_username && message.sender_username.trim()) {
        senderInfo = `<a href="https://t.me/${message.sender_username}">${senderName}</a>`;
      } else {
        senderInfo = `<a href="tg://user?id=${message.sender_user_id}">${senderName}</a>`;
      }

      const userIdHashtag = `#ID${message.sender_user_id}`;
      messageText += `\n👤 Yuboruvchi: ${senderInfo} ${userIdHashtag}`;

      // Add source link
      if (groupInfo) {
        let sourceLink;
        if (groupInfo.group_username && groupInfo.group_username.trim()) {
          sourceLink = `https://t.me/${groupInfo.group_username}/${message.telegram_message_id}`;
        } else {
          const cleanGroupId = groupInfo.group_id.toString().replace(/^-100/, '');
          sourceLink = `https://t.me/c/${cleanGroupId}/${message.telegram_message_id}`;
        }
        messageText += `\n📍 Manba: <a href="${sourceLink}">Bu yerda</a>`;
      }

      // Add "DISPECHR" badge
      messageText += `\n\n🚫 <b>DISPECHR!</b> (Admin tomonidan tasdiqlangan)`;

      // Update message - remove buttons
      await this.bot.telegram.editMessageText(
        this.targetGroupId,
        message.group_message_id,
        null,
        messageText,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );

      console.log(`✅ Message ${message.id} marked as DISPATCHER`);

    } catch (error) {
      console.error('❌ Mark dispatcher error:', error.message);
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
