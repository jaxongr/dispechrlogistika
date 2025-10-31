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

          // Faqat ikkala yo'nalish ham to'liq bo'lsa tekshirish
          if (cargoFrom && cargoTo && bookingFrom && bookingTo) {
            const fromMatch = cargoFrom.includes(bookingFrom) || bookingFrom.includes(cargoFrom);
            const toMatch = cargoTo.includes(bookingTo) || bookingTo.includes(cargoTo);

            if (fromMatch && toMatch) {
              console.log(`✅ Yuk mos keldi: ${cargoRoute} <-> ${bookingRoute}`);
              matchedBookings.push(booking);
            }
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
      const messages = db.get('messages')
        .filter(m =>
          m.is_sent_to_channel === true &&
          m.route_from &&
          m.route_to &&
          m.route_from.trim() !== '' &&
          m.route_to.trim() !== ''
        )
        .value() || [];

      console.log(`🔍 ${messages.length} ta yo'nalishi to'liq yuk tekshirilmoqda...`);

      const matchedCargos = [];
      const bookingRoute = booking.next_route.toLowerCase().trim();

      // Bron yo'nalishini parchalash (masalan: "Toshkent - Samarqand")
      const bookingParts = bookingRoute.split('-').map(p => p.trim());
      const bookingFrom = bookingParts[0] || '';
      const bookingTo = bookingParts[1] || '';

      if (!bookingFrom || !bookingTo) {
        console.log('⚠️ Bron yo\'nalishi noto\'g\'ri formatda:', booking.next_route);
        return [];
      }

      for (const message of messages) {
        // Yo'nalishni tayyorlash
        const cargoFrom = (message.route_from || '').toLowerCase().trim();
        const cargoTo = (message.route_to || '').toLowerCase().trim();

        // Yo'nalish mos keladimi? (Qattiqroq tekshirish)
        const fromMatch = cargoFrom.includes(bookingFrom) || bookingFrom.includes(cargoFrom);
        const toMatch = cargoTo.includes(bookingTo) || bookingTo.includes(cargoTo);

        if (fromMatch && toMatch) {
          console.log(`✅ Mos yuk topildi: ${cargoFrom} - ${cargoTo}`);

          const cargoInfo = {
            message_id: message.id,
            route: `${message.route_from} - ${message.route_to}`,
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

      // Guruhga yuborish (agar kerak bo'lsa)
      const targetGroupId = process.env.TARGET_GROUP_ID || process.env.TARGET_CHANNEL_ID;
      if (targetGroupId) {
        const groupMessage = `
🎯 <b>BRONLANGAN YUK!</b>

🚛 <b>Yo'nalish:</b> ${cargoInfo.route}
📦 <b>Yuk:</b> ${cargoInfo.cargo || 'Ma\'lumot yo\'q'}
💰 <b>Narx:</b> ${cargoInfo.price || 'Kelishiladi'}

👤 <b>Haydovchi:</b> <code>${booking.driver_phone}</code>
📱 <b>Bron qilgan:</b> <a href="tg://user?id=${booking.booker_user_id}">${booking.booker_full_name}</a> (<code>${booking.booker_phone}</code>)

⏰ Bron vaqti ichida topildi!
`.trim();

        await bot.telegram.sendMessage(targetGroupId, groupMessage, {
          parse_mode: 'HTML'
        });
      }

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
      message += `   📊 Topilgan yuklar: ${booking.matched_cargo_count || 0}\n`;
      message += `   🆔 <code>${booking.id}</code>\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'HTML' });
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
