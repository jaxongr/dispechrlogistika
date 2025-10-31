const { Telegraf, Markup } = require('telegraf');
const { db } = require('../config/database');
const BlockedUser = require('../models/BlockedUser');
const DispatcherReport = require('../models/DispatcherReport');
const PendingApproval = require('../models/PendingApproval');
const Whitelist = require('../models/Whitelist');
const Message = require('../models/Message');
const semySMS = require('./semysms');
const autoReply = require('./autoReply');
const driverBotHandler = require('./driver-bot-handler');
const cargoSearch = require('./cargo-search');
const botOrder = require('./bot-order');
const advanceBooking = require('./driver-advance-booking');

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    this.targetGroupId = null;
    // Cache for user announcement counts - prevents slow DB queries
    this.userAnnouncementCache = new Map();
    // User state for cargo search (yuk qidirish)
    this.userSearchState = new Map();
    // User state for order creation (buyurtma yaratish)
    this.userOrderState = new Map();
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
                phone: '', // Telefon raqam keyinchalik qo'shiladi
                is_registered: false, // Ro'yxatdan o'tmaganmi
                started_at: new Date().toISOString()
              })
              .write();

            console.log(`✅ New bot user registered: ${ctx.from.username || ctx.from.id}`);

            // Telefon raqam so'rash
            const phoneKeyboard = {
              keyboard: [
                [{ text: '📱 Telefon raqamni yuborish', request_contact: true }]
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            };

            await ctx.reply(
              '👋 Assalomu alaykum!\n\n' +
              '📱 Botdan foydalanish uchun telefon raqamingizni yuboring:',
              { reply_markup: phoneKeyboard }
            );
            return; // /start xabarini ko'rsatmaslik
          } else {
            // Agar telefon raqam yo'q bo'lsa - qaytadan so'rash
            if (!existingUser.phone || !existingUser.is_registered) {
              const phoneKeyboard = {
                keyboard: [
                  [{ text: '📱 Telefon raqamni yuborish', request_contact: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              };

              await ctx.reply(
                '📱 Botdan foydalanish uchun telefon raqamingizni yuboring:',
                { reply_markup: phoneKeyboard }
              );
              return;
            }

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

<b>ℹ️ Qanday ishlaydi:</b>
1. E'lonlar avtomatik filter qilinadi
2. To'g'ri e'lonlar guruhga yuboriladi
3. E'lonni olish uchun "✅ Olindi" tugmasini bosing
4. Telefon raqam botda yuboriladi

<b>🚛 Haydovchilar tizimi:</b>
Pul bermaydigan va yaxshi haydovchilarni qora/oq ro'yxatga olish uchun /haydovchilar buyrug'ini yuboring

<b>📞 Raqamni qayta olish:</b>
Agar raqamni unutsangiz, "📞 Raqamni olish" tugmasini bosing

<b>⚠️ Eslatma:</b>
Noto'g'ri e'lonlarni "Bu dispetcher ekan" deb belgilasangiz, admin tasdiqlashini kutib turing.`;

        // Reply keyboard qo'shish - 2 ustunda chiroyli tartibda
        const keyboard = {
          keyboard: [
            [{ text: '📝 Buyurtma yaratish' }, { text: '🔍 Yuk qidirish' }],
            [{ text: '📅 Oldindan bron qilish' }, { text: '🚛 Haydovchilar' }],
            [{ text: '📊 Statistika' }, { text: 'ℹ️ Yordam' }]
          ],
          resize_keyboard: true
        };

        await ctx.reply(welcomeMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      });

      // Setup /help command
      this.bot.command('help', async (ctx) => {
        const helpMessage = `📚 <b>YORDAM</b>

<b>Bot komandalar:</b>
/start - Bot haqida
/help - Bu yordam
/stats - Mening statistikam
/haydovchilar - Haydovchilarni boshqarish

<b>Qanday ishlaydi:</b>
• Bot guruhlardan e'lonlarni o'qiydi
• AI va qoidalar orqali filter qiladi
• To'g'ri e'lonlar "YO'LDA | Yuk markazi" guruhiga yuboriladi

<b>Agar e'lon dispetcher bo'lsa:</b>
• "🚫 Bu dispetcher ekan" tugmasini bosing
• User avtomatik bloklanadi
• E'lon o'chiriladi

<b>🚛 Haydovchilar tizimi:</b>
• /haydovchilar - Qora/oq ro'yxat boshqaruvi
• Pul bermaydigan haydovchilarni qora ro'yxatga qo'shing
• Yaxshi haydovchilarni oq ro'yxatga qo'shing
• Telefon raqam orqali qidiring

Savol bo'lsa, admin bilan bog'laning.`;

        await ctx.reply(helpMessage, { parse_mode: 'HTML' });
      });

      // Setup /stats command
      this.bot.command('stats', async (ctx) => {
        try {
          const userId = ctx.from.id.toString();

          // E'lonlar statistikasi
          const userMessages = db.get('messages')
            .filter({ sender_user_id: userId })
            .value();

          const approvedCount = userMessages.filter(m => m.is_approved).length;
          const dispatcherCount = userMessages.filter(m => m.is_dispatcher).length;
          const rejectedCount = userMessages.filter(m => m.is_rejected).length;
          const pendingCount = userMessages.filter(m => !m.is_approved && !m.is_dispatcher && !m.is_rejected).length;

          // Haydovchilar statistikasi
          const allDrivers = db.get('drivers').value() || [];
          const userDrivers = allDrivers.filter(d => d.added_by_user_id === userId);

          // Qora ro'yxatdagilar
          const blackListDrivers = userDrivers.filter(d => d.list_type === 'black' && !d.removed);
          const totalDebt = blackListDrivers.reduce((sum, d) => sum + (d.debt_amount || 0), 0);

          // Oq ro'yxatdagilar
          const whiteListDrivers = userDrivers.filter(d => d.list_type === 'white' && !d.removed);

          const statsMessage = `📊 <b>SIZNING STATISTIKANGIZ</b>

👤 User: ${ctx.from.first_name || 'Noma\'lum'}
🆔 ID: <code>${userId}</code>

📨 <b>E'lonlar:</b>
• Jami yuborilgan: ${userMessages.length} ta
• ✅ Tasdiqlangan: ${approvedCount} ta
• 🚫 Dispetcher deb topilgan: ${dispatcherCount} ta
• ❌ Rad etilgan: ${rejectedCount} ta
• ⏳ Kutilmoqda: ${pendingCount} ta

🚛 <b>Haydovchilar:</b>
• Jami qo'shilgan: ${userDrivers.length} ta
• ⚫ Qora ro'yxat: ${blackListDrivers.length} ta
• 💰 Jami qarz: ${totalDebt.toLocaleString()} so'm
• ⚪ Oq ro'yxat: ${whiteListDrivers.length} ta`;

          await ctx.reply(statsMessage, { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Stats command error:', error);
          await ctx.reply('❌ Statistikani yuklashda xatolik yuz berdi.');
        }
      });

      // Setup /users command - Foydalanuvchilar statistikasi (Admin uchun)
      this.bot.command('users', async (ctx) => {
        try {
          // Admin ID larini tekshirish (o'zingizning admin ID ni qo'shing)
          const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
          if (!adminIds.includes(ctx.from.id.toString())) {
            await ctx.reply('❌ Bu komanda faqat admin uchun!');
            return;
          }

          // Barcha foydalanuvchilarni olish
          const allUsers = db.get('bot_users').value();
          const registeredUsers = allUsers.filter(u => u.is_registered);
          const unregisteredUsers = allUsers.filter(u => !u.is_registered);

          // Oxirgi 24 soatda ro'yxatdan o'tganlar
          const last24h = new Date();
          last24h.setHours(last24h.getHours() - 24);
          const recentUsers = registeredUsers.filter(u =>
            u.registered_at && new Date(u.registered_at) > last24h
          );

          // Oxirgi 10 ta ro'yxatdan o'tgan
          const latestUsers = [...registeredUsers]
            .sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at))
            .slice(0, 10);

          let message = `👥 <b>FOYDALANUVCHILAR STATISTIKASI</b>\n\n`;
          message += `📊 <b>Umumiy:</b>\n`;
          message += `• Jami: ${allUsers.length} ta\n`;
          message += `• ✅ Ro'yxatdan o'tgan: ${registeredUsers.length} ta\n`;
          message += `• ⏳ Ro'yxatdan o'tmagan: ${unregisteredUsers.length} ta\n\n`;
          message += `📅 <b>Oxirgi 24 soat:</b> ${recentUsers.length} ta\n\n`;

          if (latestUsers.length > 0) {
            message += `🆕 <b>Oxirgi 10 ta ro'yxatdan o'tgan:</b>\n`;
            latestUsers.forEach((u, i) => {
              const name = u.first_name || u.username || 'Noma\'lum';
              const phone = u.phone || '?';
              const date = u.registered_at ? new Date(u.registered_at).toLocaleDateString('uz-UZ') : '?';
              message += `${i + 1}. ${name} | ${phone} | ${date}\n`;
            });
          }

          await ctx.reply(message, { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Users command error:', error);
          await ctx.reply('❌ Statistikani yuklashda xatolik yuz berdi.');
        }
      });


      // Klavyatura tugmalarini qabul qilish - to'g'ridan-to'g'ri funksiya chaqirish
      this.bot.hears(['📊 Mening statistikam', '📊 Statistika'], async (ctx) => {
        // /stats komandasi bilan bir xil
        try {
          const userId = ctx.from.id;
          const userMessages = db.get('messages')
            .filter({ sender_user_id: userId.toString() })
            .value();

          const approvedCount = userMessages.filter(m => m.is_approved).length;
          const dispatcherCount = userMessages.filter(m => m.is_dispatcher).length;
          const rejectedCount = userMessages.filter(m => m.is_rejected).length;
          const pendingCount = userMessages.filter(m => !m.is_approved && !m.is_dispatcher && !m.is_rejected).length;

          // Haydovchilar statistikasi
          const allDrivers = db.get('drivers').value() || [];
          const userDrivers = allDrivers.filter(d => d.added_by_user_id === userId.toString());

          // Qora ro'yxatdagilar
          const blackListDrivers = userDrivers.filter(d => d.list_type === 'black' && !d.removed);
          const totalDebt = blackListDrivers.reduce((sum, d) => sum + (d.debt_amount || 0), 0);

          // Oq ro'yxatdagilar
          const whiteListDrivers = userDrivers.filter(d => d.list_type === 'white' && !d.removed);

          let message = `📊 <b>Sizning statistikangiz:</b>\n\n`;

          message += `📨 <b>E'lonlar:</b>\n`;
          message += `• Jami yuborilgan: ${userMessages.length} ta\n`;
          message += `• ✅ Tasdiqlangan: ${approvedCount} ta\n`;
          message += `• 🚫 Dispetcher deb topilgan: ${dispatcherCount} ta\n`;
          message += `• ❌ Rad etilgan: ${rejectedCount} ta\n`;
          message += `• ⏳ Kutilmoqda: ${pendingCount} ta\n\n`;

          message += `🚛 <b>Haydovchilar:</b>\n`;
          message += `• Jami qo'shilgan: ${userDrivers.length} ta\n`;
          message += `• ⚫ Qora ro'yxat: ${blackListDrivers.length} ta\n`;
          message += `• 💰 Jami qarz: ${totalDebt.toLocaleString()} so'm\n`;
          message += `• ⚪ Oq ro'yxat: ${whiteListDrivers.length} ta\n`;

          await ctx.reply(message, { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Statistika xatosi:', error);
          await ctx.reply('❌ Statistikani yuklashda xatolik yuz berdi.');
        }
      });


      this.bot.hears('🚛 Haydovchilar', async (ctx) => {
        // /haydovchilar komandasi bilan bir xil - driver handler qo'ng'iroq qilish
        const driverBotHandler = require('./driver-bot-handler');
        await driverBotHandler.showMainMenu(ctx);
      });

      // Yuk qidirish tugmasi
      this.bot.hears('🔍 Yuk qidirish', async (ctx) => {
        await this.handleCargoSearchStart(ctx);
      });

      // Buyurtma yaratish tugmasi
      this.bot.hears('📝 Buyurtma yaratish', async (ctx) => {
        await this.handleOrderCreationStart(ctx);
      });

      // Oldindan bron qilish tugmasi
      this.bot.hears('📅 Oldindan bron qilish', async (ctx) => {
        await this.handleAdvanceBookingStart(ctx);
      });

      this.bot.hears('ℹ️ Yordam', async (ctx) => {
        // /help komandasi bilan bir xil
        const helpMessage = `ℹ️ <b>YORDAM</b>

<b>📨 E'lon yuborish:</b>
• Guruhda e'lon yozing
• Bot avtomatik tekshiradi
• To'g'ri bo'lsa guruhga yuboriladi

<b>✅ E'lonni olish:</b>
• "✅ Olindi" tugmasini bosing
• Telefon raqam botda yuboriladi

<b>🚫 Noto'g'ri e'lon:</b>
• "Bu dispetcher ekan" tugmasini bosing
• Admin tasdiqlashini kutib turing

<b>📞 Raqamni qayta olish:</b>
• Agar raqamni unutsangiz
• "📞 Raqamni olish" tugmasini bosing

<b>🚛 Haydovchilar:</b>
• Pul bermaydigan haydovchilarni qora ro'yxatga olish
• Yaxshi haydovchilarni oq ro'yxatga olish

Qo'shimcha yordam kerakmi? Admin bilan bog'laning.`;

        await ctx.reply(helpMessage, { parse_mode: 'HTML' });
      });

      // Bosh menyu tugmasi - /start ni ko'rsatish
      this.bot.hears('🔙 Bosh menyu', async (ctx) => {
        // Reply keyboard qo'shish - 2 ustunda chiroyli tartibda
        const keyboard = {
          keyboard: [
            [{ text: '📝 Buyurtma yaratish' }, { text: '🔍 Yuk qidirish' }],
            [{ text: '📅 Oldindan bron qilish' }, { text: '🚛 Haydovchilar' }],
            [{ text: '📊 Statistika' }, { text: 'ℹ️ Yordam' }]
          ],
          resize_keyboard: true
        };

        const welcomeMessage = `🤖 <b>YO'LDA | Yuk Markazi Bot</b>

Assalomu alaykum! Bu bot logistika e'lonlarini filter qiladi va guruhga yuboradi.

<b>ℹ️ Qanday ishlaydi:</b>
1. E'lonlar avtomatik filter qilinadi
2. To'g'ri e'lonlar guruhga yuboriladi
3. E'lonni olish uchun "✅ Olindi" tugmasini bosing
4. Telefon raqam botda yuboriladi

<b>🚛 Haydovchilar tizimi:</b>
Pul bermaydigan va yaxshi haydovchilarni qora/oq ro'yxatga olish uchun "🚛 Haydovchilar" tugmasini bosing

Tanlang:`;

        await ctx.reply(welcomeMessage, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      });

      // Verify token first
      const me = await this.bot.telegram.getMe();
      console.log('✅ TELEGRAM BOT ULANDI!');
      console.log('🤖 Bot username: @' + me.username);

      // Setup driver management handlers FIRST (before other callback handlers)
      driverBotHandler.setupHandlers(this.bot);
      console.log('✅ Driver bot handlers yuklandi');

      // Cargo search pagination callback handler
      this.bot.action(/^cargo_page:(.+):(.+):(.+):(\d+)$/, async (ctx) => {
        try {
          await ctx.answerCbQuery();

          const [_, searchType, fromLocation, toLocation, pageStr] = ctx.match;
          const page = parseInt(pageStr, 10);

          // Natijalarni qayta qidirish
          let results;
          if (searchType === 'two-way') {
            results = cargoSearch.searchTwoWayRoute(fromLocation, toLocation || null);
          } else {
            results = cargoSearch.searchFromLocation(fromLocation);
          }

          const formatted = cargoSearch.formatResults(
            results,
            searchType,
            fromLocation,
            toLocation || null,
            page
          );

          // Xabarni yangilash
          await ctx.editMessageText(formatted.message, {
            parse_mode: 'HTML',
            reply_markup: formatted.keyboard
          });
        } catch (error) {
          console.error('Cargo pagination error:', error);
          await ctx.answerCbQuery('❌ Xatolik yuz berdi');
        }
      });

      // Noop callback (sahifa ko'rsatkichi bosilganda)
      this.bot.action('noop', async (ctx) => {
        await ctx.answerCbQuery();
      });

      // Bron yakunlash - savol
      this.bot.action(/^complete_booking:(.+)$/, async (ctx) => {
        const bookingId = ctx.match[1];
        await advanceBooking.askCompleteBooking(ctx, bookingId);
      });

      // Bron yakunlash - yuk topildi
      this.bot.action(/^complete_found:(.+)$/, async (ctx) => {
        const bookingId = ctx.match[1];
        await advanceBooking.completeBookingFound(ctx, bookingId);
      });

      // Bron yakunlash - topilmadi
      this.bot.action(/^complete_not_found:(.+)$/, async (ctx) => {
        const bookingId = ctx.match[1];
        await advanceBooking.completeBookingNotFound(ctx, bookingId);
      });

      // Yakunlashni bekor qilish
      this.bot.action('cancel_complete', async (ctx) => {
        await ctx.answerCbQuery('Bekor qilindi');
        await ctx.deleteMessage();
      });

      // Contact (telefon raqam) yuborilganda
      this.bot.on('contact', async (ctx) => {
        try {
          const phone = ctx.message.contact.phone_number;
          const userId = ctx.from.id.toString();

          // Telefon raqamni saqlash
          db.get('bot_users')
            .find({ telegram_user_id: userId })
            .assign({
              phone: phone,
              is_registered: true,
              registered_at: new Date().toISOString()
            })
            .write();

          console.log(`✅ User registered with phone: ${phone}`);

          // Asosiy menyu klavyaturasi
          const keyboard = {
            keyboard: [
              [{ text: '📝 Buyurtma yaratish' }, { text: '🔍 Yuk qidirish' }],
              [{ text: '📅 Oldindan bron qilish' }, { text: '🚛 Haydovchilar' }],
              [{ text: '📊 Statistika' }, { text: 'ℹ️ Yordam' }]
            ],
            resize_keyboard: true
          };

          await ctx.reply(
            `✅ Tabriklaymiz! Ro'yxatdan o'tdingiz!\n\n` +
            `📱 Telefon: ${phone}\n\n` +
            `Endi botning barcha imkoniyatlaridan foydalanishingiz mumkin!`,
            { reply_markup: keyboard }
          );

          // Welcome xabarini ko'rsatish
          const welcomeMessage = `🤖 <b>YO'LDA | Yuk Markazi Bot</b>

Assalomu alaykum! Bu bot logistika e'lonlarini filter qiladi va guruhga yuboradi.

<b>ℹ️ Qanday ishlaydi:</b>
1. E'lonlar avtomatik filter qilinadi
2. To'g'ri e'lonlar guruhga yuboriladi
3. E'lonni olish uchun "✅ Olindi" tugmasini bosing
4. Telefon raqam botda yuboriladi

<b>🚛 Haydovchilar tizimi:</b>
Pul bermaydigan va yaxshi haydovchilarni qora/oq ro'yxatga olish uchun "🚛 Haydovchilar" tugmasini bosing

Tanlang:`;

          await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });

        } catch (error) {
          console.error('Contact handler error:', error);
          await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
        }
      });

      // Text message handler for cargo search input
      this.bot.on('text', async (ctx) => {
        try {
          const userId = ctx.from.id.toString();
          const text = ctx.message.text;
          const userSearchState = this.userSearchState.get(userId);
          const userOrderState = this.userOrderState.get(userId);

          // Agar user cargo search mode'da bo'lsa
          if (userSearchState) {
            await this.handleCargoSearchInput(ctx, userSearchState);
            return;
          }

          // Agar user order creation mode'da bo'lsa
          if (userOrderState) {
            await this.handleOrderInput(ctx, userOrderState);
            return;
          }

          // Agar user advance booking mode'da bo'lsa
          const advanceBookingHandled = await this.handleAdvanceBookingText(ctx, text);
          if (advanceBookingHandled) {
            return;
          }

          // Boshqa text handler'lar davom etadi (bu yerda)
          // Masalan: driver-bot-handler yoki boshqa funksiyalar

        } catch (error) {
          console.error('Text handler error:', error);
        }
      });

      // Setup callback query handler for "Bu dispetcher ekan" button
      // This runs AFTER driver handlers
      this.bot.on('callback_query', async (ctx) => {
        const callbackData = ctx.callbackQuery.data;

        // Order-related callbacks
        if (callbackData === 'order_confirm') {
          await this.handleOrderConfirmation(ctx);
          return;
        }

        if (callbackData === 'order_cancel') {
          await this.handleOrderCancellation(ctx);
          return;
        }

        if (callbackData && callbackData.startsWith('order_take:')) {
          const orderId = callbackData.split(':')[1];
          await botOrder.handleOrderTaken(this.bot, ctx, orderId);
          return;
        }

        // Dispatcher report callback
        await this.handleDispatcherReport(ctx);
      });

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

      // "Ha bu dispetcher" button handler - YANGI TIZIM (report confirmation)
      if (callbackData.startsWith('admin_confirm_dispatcher_')) {
        await this.handleAdminAction(ctx);
        return;
      }

      // "Yo'q bu yukchi" button handler - YANGI TIZIM (report rejection)
      if (callbackData.startsWith('admin_reject_dispatcher_')) {
        await this.handleAdminAction(ctx);
        return;
      }

      // "Ha bu dispetcher" button handler - ESKI TIZIM (pending approval)
      if (callbackData.startsWith('admin_confirm_')) {
        await this.handleAdminConfirmDispatcher(ctx);
        return;
      }

      // "Yo'q bu yukchi" button handler - ESKI TIZIM (pending approval)
      if (callbackData.startsWith('admin_reject_')) {
        await this.handleAdminRejectDispatcher(ctx);
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

      // Check if reporter is admin - if yes, auto-block immediately
      const adminId = process.env.ADMIN_USER_ID;
      const isAdmin = adminId && ctx.from.id.toString() === adminId.toString();

      if (isAdmin) {
        // Admin bosgan - to'g'ridan-to'g'ri bloklash VA E'LONNI O'CHIRISH
        console.log(`👑 Admin o'zi blokladi - avtomatik tasdiqlandi`);

        // DELETE THE CURRENT MESSAGE IMMEDIATELY (admin bosgan e'lon)
        try {
          await ctx.deleteMessage();
          console.log(`🗑️ Admin blokladi - HOZIRGI e'lon o'chirildi: ${messageId}`);
        } catch (err) {
          console.error('Error deleting current message:', err.message);
        }

        // Block the user
        await BlockedUser.create({
          telegram_user_id: telegramUserId,
          username: message.sender_username || '',
          full_name: message.sender_full_name || '',
          reason: `Admin tomonidan dispetcher deb belgilangan`,
          blocked_by: ctx.from.id
        });

        // DELETE ALL USER'S OLD MESSAGES from group (barcha eski e'lonlar)
        await this.deleteAllUserMessages(telegramUserId);

        // Update database
        db.get('messages')
          .find({ id: messageId })
          .assign({
            is_dispatcher: true,
            confidence_score: 1.0,
            confirmed_by_admin: true,
            confirmed_at: new Date().toISOString()
          })
          .write();

        await ctx.answerCbQuery('✅ Dispetcher bloklandi!');
        console.log(`✅ Admin blocked user ${telegramUserId} immediately`);
        return;
      }

      // Agar admin emas bo'lsa - tasdiqlash uchun admin'ga so'rov yuborish
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

      // Count how many messages THIS USER has sent to OUR bot group (with cache)
      let userAnnouncementCount = this.userAnnouncementCache.get(message.sender_user_id);

      if (userAnnouncementCount === undefined) {
        // First time seeing this user - count from DB and cache
        userAnnouncementCount = db.get('messages')
          .filter({ sender_user_id: message.sender_user_id })
          .size()
          .value();
        this.userAnnouncementCache.set(message.sender_user_id, userAnnouncementCount);
      } else {
        // Already cached - just increment
        userAnnouncementCount++;
        this.userAnnouncementCache.set(message.sender_user_id, userAnnouncementCount);
      }

      // Format: /001, /002, etc. - shows how many announcements from this user
      const announcementNumber = `/${String(userAnnouncementCount).padStart(3, '0')}`;

      messageText += `\n👤 Yuboruvchi: ${senderInfo} ${userIdHashtag} ${announcementNumber}`;

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

      // Send SUCCESS SMS to user (filtrdan o'tdi, guruhga joylashtirildi)
      if (message.contact_phone) {
        semySMS.sendSuccessNotificationSMS(
          message.contact_phone,
          message.sender_full_name || message.sender_username,
          process.env.TARGET_CHANNEL_USERNAME || '@yoldauz',
          message.sender_user_id // Check if user still in group
        ).catch(err => {
          console.error('Success SMS yuborishda xatolik:', err.message);
        });
      }

      // Notify ad scheduler that a message was sent
      try {
        const adScheduler = require('./ad-scheduler');
        await adScheduler.onMessageSent();
      } catch (error) {
        console.error('Ad scheduler notification error:', error.message);
      }

      // Match cargo with advance bookings
      try {
        const advanceBooking = require('./driver-advance-booking');

        const cargoInfo = {
          message_id: messageId,
          route: `${message.route_from || ''} - ${message.route_to || ''}`.trim(),
          cargo: message.message_text || '',
          price: message.price || 'Kelishiladi',
          phone: message.contact_phone || '',
          cargo_type: message.cargo_type || ''
        };

        console.log('🔍 Checking advance bookings for cargo:', cargoInfo.route);

        const matchedBookings = await advanceBooking.matchCargoWithBookings(this.bot, cargoInfo);

        if (matchedBookings.length > 0) {
          console.log(`✅ ${matchedBookings.length} advance booking(s) matched for cargo ${messageId}`);
        } else {
          console.log(`ℹ️ No advance bookings matched for cargo ${messageId}`);
        }
      } catch (error) {
        console.error('Advance booking matching error:', error);
        // Don't fail the whole operation if matching fails
      }

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

      if (report.reported_by_username) {
        notificationText += `<a href="https://t.me/${report.reported_by_username}">${this.escapeHtml(report.reported_by_full_name)}</a>`;
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

        // DELETE ALL USER'S MESSAGES from group (including old ones)
        await this.deleteAllUserMessages(userId);

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
      // +998901234567, 998901234567, 901234567, 90 123 45 67, 33.483.90.86, etc.
      cleanedText = cleanedText.replace(/\+?\d{12}/g, '***');  // +998901234567
      cleanedText = cleanedText.replace(/\b\d{12}\b/g, '***');  // 998901234567
      cleanedText = cleanedText.replace(/\b\d{9}\b/g, '***');   // 901234567
      cleanedText = cleanedText.replace(/\b\d{2}\s?\d{3}\s?\d{2}\s?\d{2}\b/g, '***'); // 90 123 45 67
      cleanedText = cleanedText.replace(/\b\d{3}\s?\d{3}\s?\d{3}\b/g, '***'); // 977 016 763
      cleanedText = cleanedText.replace(/\b\d{2}\.\d{3}\.\d{2}\.\d{2}\b/g, '***'); // 33.483.90.86
      cleanedText = cleanedText.replace(/\b\d{2}\.\d{3}\.\d{3}\b/g, '***'); // 33.483.9086 (variant)

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
   * Send admin notification for flagged user (Admin confirmation required)
   */
  async sendAdminNotification(userData) {
    try {
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId) {
        console.log('⚠️ ADMIN_USER_ID not set - cannot send admin notification');
        return;
      }

      const message = `
🚨 <b>SPAM/DISPETCHER ANIQLANDI</b>

👤 <b>User:</b> ${this.escapeHtml(userData.full_name || 'N/A')}
📱 <b>Username:</b> @${this.escapeHtml(userData.username || 'N/A')}
📞 <b>Tel:</b> ${this.escapeHtml(userData.phone_number || 'N/A')}
🆔 <b>User ID:</b> <code>${userData.user_id}</code>

🔍 <b>Sabab:</b> ${this.escapeHtml(userData.reason)}

📝 <b>Xabar:</b>
${this.escapeHtml((userData.message_text || '').substring(0, 200))}${(userData.message_text || '').length > 200 ? '...' : ''}

<b>Tasdiqlansinmi?</b>
`;

      await this.bot.telegram.sendMessage(
        adminId,
        message,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Ha bu dispetcher', callback_data: `admin_confirm_${userData.user_id}` },
              { text: '❌ Yo\'q bu yukchi', callback_data: `admin_reject_${userData.user_id}` }
            ]]
          }
        }
      );

      console.log(`📨 Admin notification sent for user ${userData.user_id}`);
    } catch (error) {
      console.error('❌ Send admin notification error:', error.message);
    }
  }

  /**
   * Send block notification to admin (info only, no buttons)
   * Admin gets notified about auto-block, but no action needed
   */
  async sendBlockNotification(userData) {
    try {
      const adminId = process.env.ADMIN_USER_ID;
      if (!adminId) {
        console.log('⚠️ ADMIN_USER_ID not set - cannot send block notification');
        return;
      }

      const message = `
🚫 <b>AVTOMATIK BLOKLANDI</b>

👤 <b>User:</b> ${this.escapeHtml(userData.full_name || 'N/A')}
📱 <b>Username:</b> @${this.escapeHtml(userData.username || 'N/A')}
📞 <b>Tel:</b> ${this.escapeHtml(userData.phone_number || 'N/A')}
🆔 <b>User ID:</b> <code>${userData.user_id}</code>

🔍 <b>Sabab:</b> ${this.escapeHtml(userData.reason)}

📝 <b>Xabar:</b>
${this.escapeHtml((userData.message_text || '').substring(0, 200))}${(userData.message_text || '').length > 200 ? '...' : ''}

<i>Bu user avtomatik ravishda bloklandi.</i>
`;

      await this.bot.telegram.sendMessage(
        adminId,
        message,
        {
          parse_mode: 'HTML'
          // No buttons - just info
        }
      );

      console.log(`📨 Block notification sent to admin for user ${userData.user_id}`);
    } catch (error) {
      console.error('❌ Send block notification error:', error.message);
    }
  }

  /**
   * Handle admin confirmation - "Ha bu dispetcher" button
   * Block user and update pending approval
   */
  async handleAdminConfirmDispatcher(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      const userId = callbackData.replace('admin_confirm_', '');

      console.log(`👑 Admin confirmed dispatcher (OLD SYSTEM): ${userId}`);

      // Get pending approval
      const approvals = await PendingApproval.findByUserId(userId);
      if (!approvals || approvals.length === 0) {
        await ctx.answerCbQuery('⚠️ Bu eski xabar - yangi tizim ishlatiladi');
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n⚠️ <b>Bu eski xabar - yangi avtoblok tizimi ishlatiladi</b>\n\nYangi bloklashlar avtomatik bo\'ladi va sizga info yuboriladi.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const approval = approvals[0];

      // Block the user
      const existingBlock = await BlockedUser.findByTelegramId(userId);
      if (!existingBlock) {
        await BlockedUser.create({
          telegram_user_id: userId,
          username: approval.username,
          full_name: approval.full_name,
          phone_number: approval.phone_number,
          reason: `Admin tasdiqladi: ${approval.reason}`,
          blocked_by: ctx.from.id
        });
      }

      // Update pending approval
      await PendingApproval.updateAdminResponse(approval.id, 'approved');

      // DELETE ALL USER'S MESSAGES from group (including old ones)
      await this.deleteAllUserMessages(userId);

      // Edit message to show it's been handled
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + '\n\n✅ <b>BLOKLANDI</b> (Dispetcher deb tasdiqlandi)',
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery('✅ User bloklandi');

      console.log(`✅ Admin blocked user ${userId}`);
    } catch (error) {
      console.error('❌ Handle admin confirm error:', error.message);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi');
    }
  }

  /**
   * Handle admin rejection - "Yo'q bu yukchi" button
   * Add to whitelist and reprocess all user's messages
   */
  async handleAdminRejectDispatcher(ctx) {
    try {
      const callbackData = ctx.callbackQuery.data;
      const userId = callbackData.replace('admin_reject_', '');

      console.log(`👑 Admin rejected (cargo owner) (OLD SYSTEM): ${userId}`);

      // Get pending approval
      const approvals = await PendingApproval.findByUserId(userId);
      if (!approvals || approvals.length === 0) {
        await ctx.answerCbQuery('⚠️ Bu eski xabar - yangi tizim ishlatiladi');
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n⚠️ <b>Bu eski xabar - yangi avtoblok tizimi ishlatiladi</b>\n\nYangi bloklashlar avtomatik bo\'ladi va sizga info yuboriladi.',
          { parse_mode: 'HTML' }
        );
        return;
      }

      const approval = approvals[0];

      // Add to whitelist
      await Whitelist.add({
        telegram_user_id: userId,
        username: approval.username,
        full_name: approval.full_name,
        phone_number: approval.phone_number,
        reason: 'Admin tomonidan yuk egasi deb tasdiqlangan',
        added_by: ctx.from.id
      });

      // Update pending approval
      await PendingApproval.updateAdminResponse(approval.id, 'rejected');

      // Reprocess all user's messages
      const userMessages = db.get('messages')
        .filter({ sender_user_id: userId })
        .value();

      console.log(`🔄 Reprocessing ${userMessages.length} messages from user ${userId}`);

      // Send all messages to target group
      for (const msg of userMessages) {
        try {
          if (!msg.group_message_id) {
            // Message was never sent to target group - send it now
            await this.sendToChannel(msg.id);
          }
        } catch (error) {
          console.error(`❌ Error reprocessing message ${msg.id}:`, error.message);
        }
      }

      // Edit message to show it's been handled
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + `\n\n✅ <b>WHITELIST'GA QO'SHILDI</b> (Yuk egasi - ${userMessages.length} ta xabar qayta ishlandi)`,
        { parse_mode: 'HTML' }
      );

      await ctx.answerCbQuery(`✅ Whitelist'ga qo'shildi - ${userMessages.length} ta xabar qayta ishlandi`);

      console.log(`✅ Admin whitelisted user ${userId} and reprocessed ${userMessages.length} messages`);
    } catch (error) {
      console.error('❌ Handle admin reject error:', error.message);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi');
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

  /**
   * Check if user is member of the target group
   * Used to avoid sending SMS to users who are already in the group
   */
  async isUserInGroup(telegram_user_id) {
    try {
      if (!this.bot || !this.targetGroupId) {
        console.log('⚠️ Bot or target group not configured');
        return false;
      }

      const chatMember = await this.bot.telegram.getChatMember(this.targetGroupId, telegram_user_id);

      // User is in group if status is: member, administrator, or creator
      const isInGroup = ['member', 'administrator', 'creator'].includes(chatMember.status);

      console.log(`👤 User ${telegram_user_id} group status: ${chatMember.status} (in group: ${isInGroup})`);

      return isInGroup;
    } catch (error) {
      // If user not found or other error, assume user is NOT in group
      console.log(`ℹ️ User ${telegram_user_id} not in group or error: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete all messages from a blocked user in target group
   * Called when user is auto-blocked or manually blocked
   */
  async deleteAllUserMessages(telegram_user_id) {
    try {
      if (!this.targetGroupId) {
        console.log('⚠️ Target group ID not set - cannot delete messages');
        return { deleted: 0, errors: 0 };
      }

      // Find all messages from this user that were sent to channel
      const userMessages = db.get('messages')
        .filter({ sender_user_id: telegram_user_id, is_sent_to_channel: true })
        .value();

      console.log(`🗑️ Found ${userMessages.length} messages from user ${telegram_user_id} to delete`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const message of userMessages) {
        if (message.group_message_id) {
          try {
            await this.bot.telegram.deleteMessage(this.targetGroupId, message.group_message_id);
            deletedCount++;
            console.log(`✅ Deleted message ${message.group_message_id} from group`);
          } catch (err) {
            errorCount++;
            console.error(`❌ Error deleting message ${message.group_message_id}:`, err.message);
          }
        }
      }

      console.log(`🗑️ Deleted ${deletedCount} messages from user ${telegram_user_id} (${errorCount} errors)`);
      return { deleted: deletedCount, errors: errorCount };

    } catch (error) {
      console.error('❌ Delete all user messages error:', error);
      return { deleted: 0, errors: 0 };
    }
  }

  /**
   * Send reminder message to unregistered users (who didn't share phone number)
   * Returns: { success, sent, failed, results }
   */
  async sendReminderToUnregistered() {
    try {
      if (!this.bot || !this.isRunning) {
        return { success: false, error: 'Bot ishlamayapti', sent: 0, failed: 0 };
      }

      // Get all unregistered users (who started bot but didn't share phone)
      const botUsers = db.get('bot_users').value() || [];
      const unregisteredUsers = botUsers.filter(u => !u.is_registered);

      console.log(`📤 Sending reminder to ${unregisteredUsers.length} unregistered users`);

      const reminderMessage = `🤖 <b>YO'LDA | Yuk Markazi Bot</b>

Assalomu alaykum!

Siz bizning botga /start bostingiz, lekin hali ro'yxatdan o'tmadingiz.

<b>🔔 Bot yangilandi!</b>

Endi botda quyidagi yangi imkoniyatlar mavjud:
✅ Haydovchilarni qora/oq ro'yxatga olish
✅ Qarz miqdorini kuzatish
✅ Yaxshi haydovchilarni saqlash
✅ Auto-reply tarixi

<b>📱 Ro'yxatdan o'tish juda oson:</b>
1. Quyidagi tugmani bosing
2. Telefon raqamingizni yuboring
3. Tayyor! Barcha imkoniyatlar ochiladi

Tugmani qayta ko'rish uchun /start ni bosing.`;

      let sent = 0;
      let failed = 0;
      const results = [];

      // Send with delay to avoid Telegram rate limits
      for (const user of unregisteredUsers) {
        try {
          // Create reply keyboard with phone share button
          const keyboard = {
            keyboard: [
              [{ text: '📱 Telefon raqamni yuborish', request_contact: true }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
          };

          await this.bot.telegram.sendMessage(
            user.telegram_user_id,
            reminderMessage,
            {
              parse_mode: 'HTML',
              reply_markup: keyboard
            }
          );

          sent++;
          results.push({
            user_id: user.telegram_user_id,
            name: user.first_name || user.username || 'Unknown',
            status: 'sent'
          });

          console.log(`✅ Sent reminder to ${user.telegram_user_id} (${user.first_name})`);

          // Delay to avoid rate limits (30 messages per second max)
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          failed++;
          results.push({
            user_id: user.telegram_user_id,
            name: user.first_name || user.username || 'Unknown',
            status: 'failed',
            error: error.message
          });

          console.error(`❌ Failed to send to ${user.telegram_user_id}:`, error.message);
        }
      }

      console.log(`📊 Reminder sent: ${sent} success, ${failed} failed`);

      return {
        success: true,
        sent,
        failed,
        total: unregisteredUsers.length,
        results
      };

    } catch (error) {
      console.error('❌ Send reminder error:', error);
      return {
        success: false,
        error: error.message,
        sent: 0,
        failed: 0
      };
    }
  }

  /**
   * Send advertisement message to the target group
   * Returns: { success, message_id }
   */
  async sendAdToGroup(adMessage) {
    try {
      if (!this.bot || !this.isRunning) {
        return { success: false, error: 'Bot ishlamayapti' };
      }

      if (!this.targetGroupId) {
        return { success: false, error: 'Target group ID yo\'q' };
      }

      if (!adMessage || adMessage.trim().length === 0) {
        return { success: false, error: 'Reklama xabari bo\'sh' };
      }

      console.log(`📢 Reklamani guruhga yuborish: ${this.targetGroupId}`);

      // Send ad message with special formatting
      const formattedMessage = `@Yukchiborbot\n\n${adMessage}\n\n@Yukchiborbot`;

      const sentMessage = await this.bot.telegram.sendMessage(
        this.targetGroupId,
        formattedMessage,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );

      console.log(`✅ Reklama yuborildi: message_id=${sentMessage.message_id}`);

      return {
        success: true,
        message_id: sentMessage.message_id
      };

    } catch (error) {
      console.error('❌ Send ad to group error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * ========================================
   * CARGO SEARCH HANDLERS (YUK QIDIRISH)
   * ========================================
   */

  /**
   * Yuk qidirish boshlanganida
   */
  async handleCargoSearchStart(ctx) {
    try {
      const userId = ctx.from.id.toString();

      // Qidirish turini tanlash
      const keyboard = {
        keyboard: [
          [{ text: '🔄 A ↔️ B (Ikki yo\'nalish)' }],
          [{ text: '➡️ A → ? (Ixtiyoriy yo\'nalish)' }],
          [{ text: '🔙 Orqaga' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      };

      await ctx.reply(
        '🔍 <b>Yuk Qidirish</b>\n\n' +
        'Qidirish turini tanlang:\n\n' +
        '🔄 <b>A ↔️ B</b> - Ikki yo\'nalishda qidirish\n' +
        '   Masalan: Toshkent ↔️ Samarqand\n' +
        '   (ikkala yo\'nalish ham ko\'rsatiladi)\n\n' +
        '➡️ <b>A → ?</b> - Bir yo\'nalishda qidirish\n' +
        '   Masalan: Toshkent → har qanday\n' +
        '   (faqat Toshkentdan ketayotganlar)',
        { parse_mode: 'HTML', reply_markup: keyboard }
      );

      // User state'ni saqlash
      this.userSearchState.set(userId, {
        step: 'choose_type',
        type: null,
        fromLocation: null,
        toLocation: null
      });

    } catch (error) {
      console.error('Cargo search start error:', error);
      await ctx.reply('❌ Xatolik yuz berdi. /start ni bosing.');
    }
  }

  /**
   * Yuk qidirish input'larini boshqarish
   */
  async handleCargoSearchInput(ctx, userState) {
    try {
      const userId = ctx.from.id.toString();
      const text = ctx.message.text;

      // Orqaga
      if (text === '🔙 Orqaga') {
        this.userSearchState.delete(userId);
        const mainKeyboard = {
          keyboard: [
            [{ text: '📝 Buyurtma yaratish' }, { text: '🔍 Yuk qidirish' }],
            [{ text: '📅 Oldindan bron qilish' }, { text: '🚛 Haydovchilar' }],
            [{ text: '📊 Statistika' }, { text: 'ℹ️ Yordam' }]
          ],
          resize_keyboard: true
        };
        await ctx.reply('Asosiy menyuga qaytdingiz', { reply_markup: mainKeyboard });
        return;
      }

      // Step 1: Qidirish turini tanlash
      if (userState.step === 'choose_type') {
        if (text === '🔄 A ↔️ B (Ikki yo\'nalish)') {
          userState.type = 'two-way';
          userState.step = 'input_from';

          await ctx.reply(
            '📍 <b>A punktini kiriting</b>\n\n' +
            'Qayerdan yo\'nalish?\n\n' +
            '✍️ Viloyat, shahar yoki tuman nomini yozing:\n' +
            'Masalan: <i>Toshkent</i>, <i>Samarqand</i>, <i>Andijon</i>\n\n' +
            '💡 Xato yozsangiz ham tushunaman!',
            { parse_mode: 'HTML' }
          );
        } else if (text === '➡️ A → ? (Ixtiyoriy yo\'nalish)') {
          userState.type = 'from-any';
          userState.step = 'input_from';

          await ctx.reply(
            '📍 <b>A punktini kiriting</b>\n\n' +
            'Qayerdan yo\'nalish?\n\n' +
            '✍️ Viloyat, shahar yoki tuman nomini yozing:\n' +
            'Masalan: <i>Toshkent</i>, <i>Samarqand</i>, <i>Andijon</i>\n\n' +
            '💡 Xato yozsangiz ham tushunaman!',
            { parse_mode: 'HTML' }
          );
        }

        this.userSearchState.set(userId, userState);
        return;
      }

      // Step 2: A punktini kiritish
      if (userState.step === 'input_from') {
        const fromLocation = cargoSearch.findLocation(text);

        if (!fromLocation) {
          await ctx.reply(
            '❌ Kechirasiz, "<b>' + text + '</b>" ni taniy olmadim.\n\n' +
            '💡 Iltimos, viloyat yoki shahar nomini to\'g\'ri yozing:\n' +
            'Masalan: Toshkent, Samarqand, Andijon, Fargona, Namangan va h.k.',
            { parse_mode: 'HTML' }
          );
          return;
        }

        userState.fromLocation = fromLocation;
        const locationName = cargoSearch.getLocationName(fromLocation);

        if (userState.type === 'two-way') {
          // Ikki yo'nalish uchun B punktini so'rash
          userState.step = 'input_to';

          await ctx.reply(
            '✅ A punkt: <b>' + locationName + '</b>\n\n' +
            '📍 <b>B punktini kiriting</b>\n\n' +
            'Qayerga yo\'nalish?\n\n' +
            '✍️ Viloyat, shahar yoki tuman nomini yozing:',
            { parse_mode: 'HTML' }
          );
        } else {
          // Ixtiyoriy yo'nalish uchun darhol qidirish
          await ctx.reply(
            '✅ Qidirish boshlandi...\n\n' +
            '📍 Qayerdan: <b>' + locationName + '</b>\n' +
            '📍 Qayerga: <b>Ixtiyoriy yo\'nalish</b>\n\n' +
            '⏳ Oxirgi 3 soatdagi e\'lonlar qidirilmoqda...',
            { parse_mode: 'HTML' }
          );

          // Qidirish
          const results = cargoSearch.searchFromLocation(fromLocation);
          const formatted = cargoSearch.formatResults(results, 'from-any', fromLocation, null, 0);

          await ctx.reply(formatted.message, {
            parse_mode: 'HTML',
            reply_markup: formatted.keyboard
          });

          // State'ni tozalash
          this.userSearchState.delete(userId);

          // Asosiy menyuga qaytarish
          const mainKeyboard = {
            keyboard: [
              [{ text: '🔍 Yuk qidirish' }],
              [{ text: '📊 Mening statistikam' }],
              [{ text: '🚛 Haydovchilar' }],
              [{ text: 'ℹ️ Yordam' }]
            ],
            resize_keyboard: true
          };
          await ctx.reply('Boshqa yo\'nalish bo\'yicha qidirish uchun "🔍 Yuk qidirish" ni bosing', { reply_markup: mainKeyboard });
        }

        this.userSearchState.set(userId, userState);
        return;
      }

      // Step 3: B punktini kiritish (faqat two-way uchun)
      if (userState.step === 'input_to' && userState.type === 'two-way') {
        const toLocation = cargoSearch.findLocation(text);

        if (!toLocation) {
          await ctx.reply(
            '❌ Kechirasiz, "<b>' + text + '</b>" ni taniy olmadim.\n\n' +
            '💡 Iltimos, viloyat yoki shahar nomini to\'g\'ri yozing:',
            { parse_mode: 'HTML' }
          );
          return;
        }

        userState.toLocation = toLocation;
        const fromName = cargoSearch.getLocationName(userState.fromLocation);
        const toName = cargoSearch.getLocationName(toLocation);

        await ctx.reply(
          '✅ Qidirish boshlandi...\n\n' +
          '📍 Qayerdan: <b>' + fromName + '</b>\n' +
          '📍 Qayerga: <b>' + toName + '</b>\n\n' +
          '⏳ Oxirgi 3 soatdagi e\'lonlar qidirilmoqda...',
          { parse_mode: 'HTML' }
        );

        // Qidirish
        const results = cargoSearch.searchTwoWayRoute(userState.fromLocation, toLocation);
        const formatted = cargoSearch.formatResults(results, 'two-way', userState.fromLocation, toLocation, 0);

        await ctx.reply(formatted.message, {
          parse_mode: 'HTML',
          reply_markup: formatted.keyboard
        });

        // State'ni tozalash
        this.userSearchState.delete(userId);

        // Asosiy menyuga qaytarish
        const mainKeyboard = {
          keyboard: [
            [{ text: '📝 Buyurtma yaratish' }, { text: '🔍 Yuk qidirish' }],
            [{ text: '📅 Oldindan bron qilish' }, { text: '🚛 Haydovchilar' }],
            [{ text: '📊 Statistika' }, { text: 'ℹ️ Yordam' }]
          ],
          resize_keyboard: true
        };
        await ctx.reply('Boshqa yo\'nalish bo\'yicha qidirish uchun "🔍 Yuk qidirish" ni bosing', { reply_markup: mainKeyboard });
      }

    } catch (error) {
      console.error('Cargo search input error:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      this.userSearchState.delete(ctx.from.id.toString());
    }
  }

  /**
   * Buyurtma yaratishni boshlash
   */
  async handleOrderCreationStart(ctx) {
    const userId = ctx.from.id.toString();
    const result = await botOrder.startOrderCreation(ctx);

    if (result.state) {
      this.userOrderState.set(userId, result);
    }
  }

  /**
   * Buyurtma yaratish inputlarini qayta ishlash
   */
  async handleOrderInput(ctx, userState) {
    try {
      const userId = ctx.from.id.toString();
      const text = ctx.message.text;

      let result;

      if (userState.state === 'awaiting_route') {
        result = await botOrder.handleRoute(ctx, userState.data);
      } else if (userState.state === 'awaiting_cargo_info') {
        result = await botOrder.handleCargoInfo(ctx, userState.data);
      } else if (userState.state === 'awaiting_price') {
        result = await botOrder.handlePrice(ctx, userState.data);
      }

      if (result) {
        this.userOrderState.set(userId, result);
      }
    } catch (error) {
      console.error('Order input error:', error);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
      this.userOrderState.delete(ctx.from.id.toString());
    }
  }

  /**
   * Buyurtmani tasdiqlash
   */
  async handleOrderConfirmation(ctx) {
    const userId = ctx.from.id.toString();
    const userState = this.userOrderState.get(userId);

    if (!userState || userState.state !== 'awaiting_confirmation') {
      await ctx.answerCbQuery('❌ Buyurtma topilmadi');
      return;
    }

    // Buyurtmani yaratish va userlarga yuborish
    const result = await botOrder.createAndSendOrder(this.bot, userState.data);

    if (result.success) {
      await ctx.answerCbQuery('✅ Buyurtma yaratildi!');
      await ctx.editMessageText(
        `✅ <b>Buyurtma muvaffaqiyatli yaratildi!</b>\n\n` +
        `📤 ${result.sentCount} ta userga yuborildi\n\n` +
        `⏱ 3 daqiqa ichida kimdir qabul qilmasa, avtomatik guruhga chiqadi.`,
        { parse_mode: 'HTML' }
      );

      // State'ni tozalash
      this.userOrderState.delete(userId);
    } else {
      await ctx.answerCbQuery('❌ Xatolik: ' + result.error);
    }
  }

  /**
   * Buyurtmani bekor qilish
   */
  async handleOrderCancellation(ctx) {
    const userId = ctx.from.id.toString();
    this.userOrderState.delete(userId);
    await botOrder.cancelOrder(ctx);
    await ctx.editMessageText('❌ Buyurtma bekor qilindi');
  }

  /**
   * ADVANCE BOOKING HANDLERS
   */

  /**
   * Oldindan bron qilish jarayonini boshlash
   */
  async handleAdvanceBookingStart(ctx) {
    await advanceBooking.startBookingCreation(ctx);
  }

  /**
   * Bron jarayonida matn qabul qilish
   */
  async handleAdvanceBookingText(ctx, text) {
    const userId = ctx.from.id.toString();
    const state = advanceBooking.userBookingState.get(userId);

    if (!state) {
      return false;
    }

    if (state.step === 'awaiting_next_route') {
      await advanceBooking.handleNextRoute(ctx, text);
      return true;
    }

    if (state.step === 'awaiting_arrival_time') {
      await advanceBooking.handleArrivalTime(ctx, text);
      return true;
    }

    if (state.step === 'awaiting_driver_phone') {
      await advanceBooking.handleDriverPhoneAndSave(this.bot, ctx, text);
      return true;
    }

    return false;
  }

  stop() {
    if (this.bot) {
      this.bot.stop();
      this.isRunning = false;
    }
  }
}

module.exports = new TelegramBotService();
