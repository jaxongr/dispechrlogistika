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
      '1️⃣ Hozirgi joyingizdan keyingi manzilga borish vaqtini kiriting\n' +
      '2️⃣ Keyingi yo\'nalishingizni kiriting\n' +
      '3️⃣ O\'sha yo\'nalish bo\'yicha yuk tushsa, sizga avtomatik yuboriladi\n\n' +
      '<b>1-qadam:</b> Qayerdan qayerga ketyapsiz?\n' +
      'Masalan: <code>Toshkent - Samarqand</code>',
      { parse_mode: 'HTML' }
    );

    this.userBookingState.set(userId, {
      step: 'awaiting_current_route',
      data: {
        user_id: userId,
        username: ctx.from.username || '',
        full_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
        phone: user.phone
      }
    });

    return { state: 'awaiting_current_route' };
  }

  /**
   * Hozirgi yo'nalishni qabul qilish
   */
  async handleCurrentRoute(ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_current_route') {
      return { success: false };
    }

    state.data.current_route = text.trim();
    state.step = 'awaiting_arrival_time';

    this.userBookingState.set(userId, state);

    await ctx.reply(
      `✅ Yo'nalish qabul qilindi: <b>${text}</b>\n\n` +
      '<b>2-qadam:</b> Manzilga qachon yetib borasiz?\n' +
      'Vaqtni kiriting (soat:daqiqa formatida):\n' +
      'Masalan: <code>14:30</code> yoki <code>18:00</code>',
      { parse_mode: 'HTML' }
    );

    return { success: true };
  }

  /**
   * Yetib borish vaqtini qabul qilish
   */
  async handleArrivalTime(ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_arrival_time') {
      return { success: false };
    }

    // Vaqt formatini tekshirish (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.match(text.trim())) {
      await ctx.reply(
        '❌ Noto\'g\'ri format!\n\n' +
        'Iltimos, vaqtni <code>soat:daqiqa</code> formatida kiriting.\n' +
        'Masalan: <code>14:30</code>',
        { parse_mode: 'HTML' }
      );
      return { success: false };
    }

    const [hours, minutes] = text.trim().split(':').map(Number);
    const today = new Date();
    const arrivalTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

    // Agar vaqt o'tmagan bo'lsa, ertaga qo'shish
    if (arrivalTime < new Date()) {
      arrivalTime.setDate(arrivalTime.getDate() + 1);
    }

    state.data.arrival_time = arrivalTime.toISOString();
    state.data.time_window_start = new Date(arrivalTime.getTime() - 60 * 60 * 1000).toISOString(); // -1 soat
    state.data.time_window_end = new Date(arrivalTime.getTime() + 60 * 60 * 1000).toISOString(); // +1 soat
    state.step = 'awaiting_next_route';

    this.userBookingState.set(userId, state);

    await ctx.reply(
      `✅ Yetib borish vaqti: <b>${text}</b>\n` +
      `📍 Vaqt oralig'i: ${new Date(state.data.time_window_start).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} - ${new Date(state.data.time_window_end).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      '<b>3-qadam:</b> Keyingi yo\'nalishingiz qayerga?\n' +
      'Masalan: <code>Samarqand - Buxoro</code>',
      { parse_mode: 'HTML' }
    );

    return { success: true };
  }

  /**
   * Keyingi yo'nalishni qabul qilish va bronni saqlash
   */
  async handleNextRouteAndSave(bot, ctx, text) {
    const userId = ctx.from.id.toString();
    const state = this.userBookingState.get(userId);

    if (!state || state.step !== 'awaiting_next_route') {
      return { success: false };
    }

    state.data.next_route = text.trim();

    // Bronni saqlash
    const bookingId = uuidv4();
    const booking = {
      id: bookingId,
      driver_user_id: state.data.user_id,
      driver_username: state.data.username,
      driver_full_name: state.data.full_name,
      driver_phone: state.data.phone,
      current_route: state.data.current_route,
      arrival_time: state.data.arrival_time,
      time_window_start: state.data.time_window_start,
      time_window_end: state.data.time_window_end,
      next_route: state.data.next_route,
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

    await ctx.reply(
      '✅ <b>Bron muvaffaqiyatli yaratildi!</b>\n\n' +
      `📍 <b>Hozirgi yo'nalish:</b> ${booking.current_route}\n` +
      `⏰ <b>Yetib borish:</b> ${arrivalTimeStr}\n` +
      `🚛 <b>Keyingi yo'nalish:</b> ${booking.next_route}\n\n` +
      `💡 Bu yo'nalish bo'yicha yuk tushsa, sizga avtomatik yuboriladi!\n` +
      `⏱ Vaqt oralig'i: ±1 soat`,
      { parse_mode: 'HTML' }
    );

    return { success: true, bookingId };
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
          // Yo'nalish mos keladimi?
          const cargoRoute = cargoInfo.route.toLowerCase();
          const bookingRoute = booking.next_route.toLowerCase();

          if (cargoRoute.includes(bookingRoute) || bookingRoute.includes(cargoRoute)) {
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

      // Haydovchiga yuborish
      await bot.telegram.sendMessage(booking.driver_user_id, messageText, {
        parse_mode: 'HTML'
      });

      console.log(`✅ Matched cargo sent to driver ${booking.driver_full_name}`);

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

👤 <b>Haydovchi:</b> <a href="tg://user?id=${booking.driver_user_id}">${booking.driver_full_name}</a>
📱 <b>Telefon:</b> <code>${booking.driver_phone}</code>

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
      .filter(b => b.driver_user_id === userId && b.status === 'active')
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
      .find({ id: bookingId, driver_user_id: userId })
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
