/**
 * Driver Advance Booking Service
 * Haydovchilar oldindan yuk bron qilishi
 *
 * FLOW:
 * 1. Haydovchi hozirgi joyidan (A) keyingi joyga (B) borish vaqtini ko'rsatadi
 * 2. B dan keyingi yo'nalishni (B → C) ko'rsatadi
 * 3. B ga yetib borish vaqtidan ±1 soat oralig'ida C yo'nalishi bo'yicha yuk kerakligini belgilaydi
 * 4. Shu yo'nalish bo'yicha yuk kelganda haydovchiga avtomatik yuboriladi
 * 5. Guruhga ham yuboriladi va haydovchi mention qilinadi
 */

const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DriverAdvanceBookingService {
  constructor() {
    // User state for multi-step booking creation
    this.userBookingState = new Map();
  }

  /**
   * Bron yaratish jarayonini boshlash
   */
  async startBookingCreation(ctx) {
    const userId = ctx.from.id.toString();

    // User ro'yxatdan o'tganmi tekshirish
    const user = db.get('bot_users')
      .find({ telegram_user_id: userId })
      .value();

    if (!user || !user.is_registered) {
      await ctx.reply(
        '❌ Bron qilish uchun avval ro\'yxatdan o\'ting!\n\n' +
        '📱 Telefon raqamingizni yuboring yoki /start ni bosing.',
        { parse_mode: 'HTML' }
      );
      return { state: null };
    }

    // Aktiv bronlar sonini tekshirish (maksimum 10 ta)
    const activeBookingsCount = db.get('driver_advance_bookings')
      .filter({ driver_user_id: userId, status: 'active' })
      .value()
      .length;

    if (activeBookingsCount >= 10) {
      await ctx.reply(
        '⚠️ <b>Limit to\'ldi!</b>\n\n' +
        'Sizda allaqachon <b>10 ta</b> aktiv bron mavjud.\n' +
        'Yangi bron yaratish uchun avval eskisini bekor qiling yoki vaqt o\'tishini kuting.\n\n' +
        '📋 Bronlaringizni ko\'rish uchun: /my_bookings',
        { parse_mode: 'HTML' }
      );
      return { state: null };
    }

    await ctx.reply(
      '📅 <b>Oldindan Yuk Bron Qilish</b>\n\n' +
      'Bu funksiya orqali siz keyingi yo\'nalishingiz bo\'yicha oldindan yuk bron qilishingiz mumkin.\n\n' +
      '<b>Qanday ishlaydi:</b>\n' +
      '1️⃣ Qayerdan qayerga (yo\'nalish)\n' +
      '2️⃣ Qachon kerak (vaqt)\n' +
      '3️⃣ Haydovchi telefon raqami\n' +
      '4️⃣ O\'sha yo\'nalish bo\'yicha yuk tushsa, avtomatik yuboriladi\n\n' +
      '<b>1-qadam:</b> Qayerdan qayerga yuk kerak?\n' +
      'Yo\'nalishni kiriting:\n' +
      'Masalan: <code>Toshkent - Samarqand</code>',
      { parse_mode: 'HTML' }
    );

    this.userBookingState.set(userId, {
      step: 'awaiting_next_route',
      data: {
        user_id: userId,
        username: ctx.from.username || '',
        full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
        phone: user.phone
      }
    });

    return { state: 'awaiting_next_route' };
  }

  /**
   * Haydovchi telefon raqamini qabul qilish va bronni saqlash (oxirgi qadam)
   */
  async handleDriverPhoneAndSave(bot, ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_driver_phone') {
      return { success: false };
    }

    // Telefon raqamni tozalash va formatlash
    let phone = text.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // +998 bilan boshlanmasa, qo'shamiz
    if (!phone.startsWith('+') && !phone.startsWith('998')) {
      phone = '998' + phone;
    }
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    // Telefon raqam uzunligini tekshirish
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 12 || digitsOnly.length > 13) {
      await ctx.reply(
        '❌ Noto\'g\'ri telefon raqam!\n\n' +
        'Iltimos, to\'g\'ri formatda kiriting:\n' +
        'Masalan: <code>998901234567</code> yoki <code>+998 90 123 45 67</code>',
        { parse_mode: 'HTML' }
      );
      return { success: false };
    }

    state.data.driver_phone = phone;

    // Bronni saqlash
    const bookingId = uuidv4();
    const booking = {
      id: bookingId,
      booker_user_id: state.data.user_id, // Bron qilgan user (dispetcher)
      booker_username: state.data.username,
      booker_full_name: state.data.full_name,
      booker_phone: state.data.phone,
      driver_phone: state.data.driver_phone, // Haydovchi telefon raqami
      current_route: state.data.next_route, // Endi bu yo'nalish
      arrival_time: state.data.arrival_time,
      time_window_start: state.data.time_window_start,
      time_window_end: state.data.time_window_end,
      next_route: state.data.next_route, // Yo'nalish
      status: 'active', // active, fulfilled, cancelled, expired
      matched_cargo_count: 0,
      created_at: new Date().toISOString(),
      expires_at: state.data.time_window_end // Vaqt tugagach o'chadi
    };

    db.get('driver_advance_bookings')
      .push(booking)
      .write();

    console.log(`📅 Advance booking created: ${bookingId} by ${state.data.full_name}`);

    // State'ni tozalash
    this.userBookingState.delete(userId);

    const arrivalTimeStr = new Date(booking.arrival_time).toLocaleString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Mavjud yuklar bilan solishtirish
    let matchedCargos = [];
    try {
      matchedCargos = await this.checkExistingCargos(bot, booking);

      if (matchedCargos.length > 0) {
        console.log(`✅ ${matchedCargos.length} mavjud yuk(lar) topildi bronlash paytida`);
      }
    } catch (error) {
      console.error('Mavjud yuklarni tekshirishda xatolik:', error);
    }

    let replyMessage = '✅ <b>Bron muvaffaqiyatli yaratildi!</b>\n\n' +
      `🚛 <b>Yo'nalish:</b> ${booking.next_route}\n` +
      `⏰ <b>Kerak bo'lgan vaqt:</b> ${arrivalTimeStr}\n` +
      `👤 <b>Haydovchi:</b> <code>${booking.driver_phone}</code>\n\n`;

    if (matchedCargos.length > 0) {
      replyMessage += `🎯 <b>Darhol topildi: ${matchedCargos.length} ta mos yuk!</b>\n` +
        `Yuklar sizga yuborildi, pastda ko'ring! ⬇️\n\n`;
    } else {
      replyMessage += `💡 Bu yo'nalish bo'yicha yuk tushsa, sizga avtomatik yuboriladi!\n`;
    }

    replyMessage += `⏱ Vaqt oralig'i: ±1 soat`;

    await ctx.reply(replyMessage, { parse_mode: 'HTML' });

    return { success: true, bookingId, matchedCount: matchedCargos.length };
  }

  /**
   * Vaqtni qabul qilish (2-qadam)
   */
  async handleArrivalTime(ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_arrival_time') {
      return { success: false };
    }

    // Vaqt va sana formatini tekshirish
    // Format 1: "14:30 31.10" yoki "14:30 31/10" yoki "14:30 31-10"
    // Format 2: "14:30" (bugun/ertaga avtomatik)
    const dateTimeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(?:\s+(\d{1,2})[.\/-](\d{1,2}))?$/;
    const match = text.trim().match(dateTimeRegex);

    if (!match) {
      await ctx.reply(
        '❌ Noto\'g\'ri format!\n\n' +
        'Iltimos, vaqtni kiriting:\n' +
        '• Faqat vaqt: <code>14:30</code>\n' +
        '• Vaqt va sana: <code>14:30 31.10</code> yoki <code>14:30 31/10</code>\n\n' +
        'Sana ko\'rsatmasangiz, bugun/ertaga qo\'yiladi.',
        { parse_mode: 'HTML' }
      );
      return { success: false };
    }

    const [, hoursStr, minutesStr, dayStr, monthStr] = match;
    const hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);

    let arrivalTime;
    const now = new Date();

    if (dayStr && monthStr) {
      // Sana berilgan
      const day = parseInt(dayStr);
      const month = parseInt(monthStr) - 1; // JavaScript'da oy 0 dan boshlanadi
      const year = now.getFullYear();

      arrivalTime = new Date(year, month, day, hours, minutes);

      // Agar sana o'tgan bo'lsa, keyingi yilga o'tkazish
      if (arrivalTime < now) {
        arrivalTime.setFullYear(year + 1);
      }
    } else {
      // Sana berilmagan - bugun yoki ertaga
      arrivalTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

      // Agar vaqt o'tmagan bo'lsa, ertaga qo'shish
      if (arrivalTime < now) {
        arrivalTime.setDate(arrivalTime.getDate() + 1);
      }
    }

    state.data.arrival_time = arrivalTime.toISOString();
    state.data.time_window_start = new Date(arrivalTime.getTime() - 60 * 60 * 1000).toISOString(); // -1 soat
    state.data.time_window_end = new Date(arrivalTime.getTime() + 60 * 60 * 1000).toISOString(); // +1 soat
    state.step = 'awaiting_driver_phone';

    this.userBookingState.set(userId, state);

    const arrivalDateStr = arrivalTime.toLocaleString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    await ctx.reply(
      `✅ Vaqt qabul qilindi: <b>${arrivalDateStr}</b>\n` +
      `📍 Vaqt oralig'i: ${new Date(state.data.time_window_start).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} - ${new Date(state.data.time_window_end).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      '<b>3-qadam:</b> Qaysi haydovchi uchun yuk qidiryapsiz?\n' +
      'Haydovchining telefon raqamini kiriting:\n' +
      'Masalan: <code>998901234567</code> yoki <code>+998 90 123 45 67</code>',
      { parse_mode: 'HTML' }
    );

    return { success: true };
  }

  /**
   * Yo'nalishni qabul qilish (1-qadam)
   */
  async handleNextRoute(ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_next_route') {
      return { success: false };
    }

    state.data.next_route = text.trim();
    state.step = 'awaiting_arrival_time';

    this.userBookingState.set(userId, state);

    await ctx.reply(
      `✅ Yo'nalish qabul qilindi: <b>${text}</b>\n\n` +
      '<b>2-qadam:</b> Qachon kerak?\n\n' +
      'Vaqtni kiriting:\n' +
      '• Faqat vaqt: <code>14:30</code>\n' +
      '• Vaqt va sana: <code>14:30 31.10</code>\n\n' +
      '💡 Sana ko\'rsatmasangiz, bugun yoki ertaga avtomatik belgilanadi.',
      { parse_mode: 'HTML' }
    );

    return { success: true };
  }

  /**
   * Yangi yuk kelganda bronlar bilan moslashtirish
   */
  async matchCargoWithBookings(bot, cargoInfo) {
    try {
      const now = new Date();

      // Aktiv bronlarni olish
      const activeBookings = db.get('driver_advance_bookings')
        .filter(b => b.status === 'active')
        .value() || [];

      const matchedBookings = [];

      for (const booking of activeBookings) {
        const windowStart = new Date(booking.time_window_start);
        const windowEnd = new Date(booking.time_window_end);

        // Vaqt oralig'i ichidami?
        if (now >= windowStart && now <= windowEnd) {
          // Yo'nalishni parchalash va to'g'ri solishtirish
          const cargoRoute = (cargoInfo.route || '').toLowerCase().trim();
          const bookingRoute = (booking.next_route || '').toLowerCase().trim();

          // Ikkala yo'nalishni ham parchalash
          const cargoParts = cargoRoute.split('-').map(p => p.trim());
          const bookingParts = bookingRoute.split('-').map(p => p.trim());

          const cargoFrom = cargoParts[0] || '';
          const cargoTo = cargoParts[1] || '';
          const bookingFrom = bookingParts[0] || '';
          const bookingTo = bookingParts[1] || '';

          // Bron bitta joy yoki to'liq yo'nalishmi?
          const hasDash = bookingRoute.includes('-');
          const isSingleLocation = !hasDash || !bookingTo;

          let isMatch = false;

          if (isSingleLocation && cargoFrom && bookingFrom) {
            // Faqat bitta joy - "qayerdan" mos kelishi kerak
            const fromMatch = cargoFrom.includes(bookingFrom) || bookingFrom.includes(cargoFrom);
            if (fromMatch) {
              isMatch = true;
              console.log(`✅ Yuk mos keldi (bitta joy): ${cargoRoute} <-> ${bookingRoute}`);
            }
          } else if (cargoFrom && cargoTo && bookingFrom && bookingTo) {
            // To'liq yo'nalish - ikkalasi ham mos kelishi kerak
            const fromMatch = cargoFrom.includes(bookingFrom) || bookingFrom.includes(cargoFrom);
            const toMatch = cargoTo.includes(bookingTo) || bookingTo.includes(cargoTo);

            if (fromMatch && toMatch) {
              isMatch = true;
              console.log(`✅ Yuk mos keldi (to'liq): ${cargoRoute} <-> ${bookingRoute}`);
            }
          }

          if (isMatch) {
            matchedBookings.push(booking);
          }
        } else if (now > windowEnd) {
          // Vaqt o'tgan bronlarni expired qilish
          db.get('driver_advance_bookings')
            .find({ id: booking.id })
            .assign({ status: 'expired' })
            .write();
        }
      }

      // Mos bronlar bo'lsa, haydovchilarga yuborish
      for (const booking of matchedBookings) {
        await this.notifyDriverAboutMatch(bot, booking, cargoInfo);
      }

      return matchedBookings;

    } catch (error) {
      console.error('Match cargo with bookings error:', error);
      return [];
    }
  }

  /**
   * Bron yaratilganda mavjud yuklar bilan solishtirish
   */
  async checkExistingCargos(bot, booking) {
    try {
      const now = new Date();
      const windowStart = new Date(booking.time_window_start);
      const windowEnd = new Date(booking.time_window_end);

      // Vaqt oralig'i ichidami?
      if (now < windowStart || now > windowEnd) {
        console.log('⏰ Bron vaqt oralig\'i hali boshlanmagan yoki tugagan');
        return [];
      }

      // Database'dan guruhga yuborilgan yuklarni olish
      // HOZIRCHA: route_from/route_to null bo'lgani uchun barcha yuklarni olamiz
      const messages = db.get('messages')
        .filter(m => m.is_sent_to_channel === true && m.message_text)
        .value() || [];

      console.log(`🔍 ${messages.length} ta guruhga yuborilgan yuk tekshirilmoqda...`);

      const matchedCargos = [];
      const bookingRoute = booking.next_route.toLowerCase().trim();

      // Bron yo'nalishini parchalash (masalan: "Toshkent - Samarqand" yoki "Toshkent")
      const hasDash = bookingRoute.includes('-');
      const bookingParts = bookingRoute.split('-').map(p => p.trim());
      const bookingFrom = bookingParts[0] || '';
      const bookingTo = bookingParts[1] || '';

      if (!bookingFrom) {
        console.log('⚠️ Bron yo\'nalishi bo\'sh:', booking.next_route);
        return [];
      }

      // Agar faqat bitta joy ko'rsatilgan bo'lsa (masalan: "Toshkent")
      const isSingleLocation = !hasDash || !bookingTo;

      if (isSingleLocation) {
        console.log(`🔍 Bitta joydan qidirilmoqda: ${bookingFrom} dan istalgan yo'nalishga`);
      }

      for (const message of messages) {
        // HOZIRCHA: route_from/route_to null bo'lgani uchun message_text dan qidiramiz
        const messageText = (message.message_text || '').toLowerCase();

        let isMatch = false;

        if (isSingleLocation) {
          // Faqat bitta joy - matnda bor-yo'qligini tekshiramiz
          if (messageText.includes(bookingFrom)) {
            isMatch = true;
            console.log(`✅ Mos yuk topildi (text): ${message.message_text.substring(0, 50)}...`);
          }
        } else {
          // To'liq yo'nalish - ikkalasi ham bo'lishi kerak
          const fromMatch = messageText.includes(bookingFrom);
          const toMatch = messageText.includes(bookingTo);

          if (fromMatch && toMatch) {
            isMatch = true;
            console.log(`✅ Mos yuk topildi (text): ${message.message_text.substring(0, 50)}...`);
          }
        }

        if (isMatch) {

          const cargoInfo = {
            message_id: message.id,
            route: message.route_from && message.route_to
              ? `${message.route_from} - ${message.route_to}`
              : booking.next_route,
            cargo: message.message_text || '',
            price: message.price || 'Kelishiladi',
            phone: message.contact_phone || '',
            cargo_type: message.cargo_type || ''
          };

          // Dispetcherga yuborish
          await this.notifyDriverAboutMatch(bot, booking, cargoInfo);
          matchedCargos.push(cargoInfo);
        }
      }

      return matchedCargos;

    } catch (error) {
      console.error('Check existing cargos error:', error);
      return [];
    }
  }

  /**
   * Haydovchiga va guruhga yuk haqida xabar yuborish
   */
  async notifyDriverAboutMatch(bot, booking, cargoInfo) {
    try {
      const messageText = `
🎯 <b>SIZNING BRONIZ BO'YICHA YUK TOPILDI!</b>

━━━━━━━━━━━━━━━━━━━━
🚛 <b>Yo'nalish:</b> ${cargoInfo.route}
📦 <b>Yuk:</b> ${cargoInfo.cargo || 'Ma\'lumot yo\'q'}
💰 <b>Narx:</b> ${cargoInfo.price || 'Kelishiladi'}

📱 <b>Telefon:</b> <code>${cargoInfo.phone}</code>
━━━━━━━━━━━━━━━━━━━━

📍 <b>Sizning broniz:</b> ${booking.next_route}
⏰ <b>Vaqt oralig'i:</b> ${new Date(booking.time_window_start).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} - ${new Date(booking.time_window_end).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}

💼 Yukni olish uchun bog'laning!
`.trim();

      // Bron qilgan userga (dispetcherga) yuborish
      await bot.telegram.sendMessage(booking.booker_user_id, messageText, {
        parse_mode: 'HTML'
      });

      console.log(`✅ Matched cargo sent to booker ${booking.booker_full_name}`);

      // Matched count'ni oshirish
      db.get('driver_advance_bookings')
        .find({ id: booking.id })
        .assign({
          matched_cargo_count: (booking.matched_cargo_count || 0) + 1,
          last_matched_at: new Date().toISOString()
        })
        .write();

      // GURUHGA YUBORISH O'CHIRILDI - Faqat haydovchiga private xabar yuboriladi

    } catch (error) {
      console.error('Notify driver about match error:', error);
    }
  }

  /**
   * Userning aktiv bronlarini ko'rsatish
   */
  async showMyBookings(ctx) {
    const userId = ctx.from.id.toString();

    const myBookings = db.get('driver_advance_bookings')
      .filter(b => b.booker_user_id === userId && b.status === 'active')
      .value() || [];

    if (myBookings.length === 0) {
      await ctx.reply(
        '📋 Sizda hozircha aktiv bron yo\'q.\n\n' +
        '📅 Yangi bron qilish uchun "Oldindan bron qilish" tugmasini bosing.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let message = '📋 <b>Sizning aktiv bronlaringiz:</b>\n\n';

    const buttons = [];

    myBookings.forEach((booking, index) => {
      const arrivalTime = new Date(booking.arrival_time).toLocaleString('uz-UZ', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      message += `${index + 1}. 🚛 <b>${booking.next_route}</b>\n`;
      message += `   👤 Haydovchi: <code>${booking.driver_phone}</code>\n`;
      message += `   ⏰ ${arrivalTime}\n`;
      message += `   📊 Topilgan yuklar: ${booking.matched_cargo_count || 0}\n\n`;

      // Har bir bron uchun yakunlash tugmasi
      buttons.push([
        {
          text: `✅ Yakunlash #${index + 1}`,
          callback_data: `complete_booking:${booking.id}`
        }
      ]);
    });

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  }

  /**
   * Bron yakunlash - yuk topildi/topilmadi so'rash
   */
  async askCompleteBooking(ctx, bookingId) {
    const userId = ctx.from.id.toString();

    const booking = db.get('driver_advance_bookings')
      .find({ id: bookingId, booker_user_id: userId })
      .value();

    if (!booking) {
      await ctx.answerCbQuery('❌ Bron topilmadi');
      return;
    }

    const arrivalTime = new Date(booking.arrival_time).toLocaleString('uz-UZ', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    await ctx.answerCbQuery();
    await ctx.reply(
      `🔚 <b>Bronni yakunlash</b>\n\n` +
      `🚛 <b>Yo'nalish:</b> ${booking.next_route}\n` +
      `👤 <b>Haydovchi:</b> <code>${booking.driver_phone}</code>\n` +
      `⏰ <b>Vaqt:</b> ${arrivalTime}\n` +
      `📊 <b>Topilgan yuklar:</b> ${booking.matched_cargo_count || 0}\n\n` +
      `<b>Yuk topildimi?</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yuk topildi', callback_data: `complete_found:${bookingId}` },
              { text: '❌ Topilmadi', callback_data: `complete_not_found:${bookingId}` }
            ],
            [
              { text: '🔙 Bekor qilish', callback_data: 'cancel_complete' }
            ]
          ]
        }
      }
    );
  }

  /**
   * Bronni yakunlash - yuk topildi
   */
  async completeBookingFound(ctx, bookingId) {
    const userId = ctx.from.id.toString();

    const booking = db.get('driver_advance_bookings')
      .find({ id: bookingId, booker_user_id: userId })
      .value();

    if (!booking) {
      await ctx.answerCbQuery('❌ Bron topilmadi');
      return;
    }

    db.get('driver_advance_bookings')
      .find({ id: bookingId })
      .assign({
        status: 'fulfilled',
        completed_at: new Date().toISOString(),
        completion_result: 'found'
      })
      .write();

    await ctx.answerCbQuery('✅ Yuk topildi deb belgilandi');
    await ctx.editMessageText(
      `✅ <b>Bron muvaffaqiyatli yakunlandi!</b>\n\n` +
      `🚛 <b>Yo'nalish:</b> ${booking.next_route}\n` +
      `👤 <b>Haydovchi:</b> <code>${booking.driver_phone}</code>\n` +
      `📊 <b>Topilgan yuklar:</b> ${booking.matched_cargo_count || 0}\n\n` +
      `✅ <b>Natija:</b> Yuk topildi\n` +
      `🎉 Tabriklaymiz!`,
      { parse_mode: 'HTML' }
    );
  }

  /**
   * Bronni yakunlash - yuk topilmadi
   */
  async completeBookingNotFound(ctx, bookingId) {
    const userId = ctx.from.id.toString();

    const booking = db.get('driver_advance_bookings')
      .find({ id: bookingId, booker_user_id: userId })
      .value();

    if (!booking) {
      await ctx.answerCbQuery('❌ Bron topilmadi');
      return;
    }

    db.get('driver_advance_bookings')
      .find({ id: bookingId })
      .assign({
        status: 'not_fulfilled',
        completed_at: new Date().toISOString(),
        completion_result: 'not_found'
      })
      .write();

    await ctx.answerCbQuery('Yuk topilmadi deb belgilandi');
    await ctx.editMessageText(
      `📋 <b>Bron yakunlandi</b>\n\n` +
      `🚛 <b>Yo'nalish:</b> ${booking.next_route}\n` +
      `👤 <b>Haydovchi:</b> <code>${booking.driver_phone}</code>\n` +
      `📊 <b>Topilgan yuklar:</b> ${booking.matched_cargo_count || 0}\n\n` +
      `❌ <b>Natija:</b> Yuk topilmadi\n` +
      `💡 Keyingi safar omadingiz kelsin!`,
      { parse_mode: 'HTML' }
    );
  }

  /**
   * Bronni bekor qilish
   */
  async cancelBooking(ctx, bookingId) {
    const userId = ctx.from.id.toString();

    const booking = db.get('driver_advance_bookings')
      .find({ id: bookingId, booker_user_id: userId })
      .value();

    if (!booking) {
      await ctx.reply('❌ Bron topilmadi yoki sizga tegishli emas.');
      return;
    }

    db.get('driver_advance_bookings')
      .find({ id: bookingId })
      .assign({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .write();

    await ctx.reply('✅ Bron bekor qilindi.');
  }
}

// Export single instance
module.exports = new DriverAdvanceBookingService();
