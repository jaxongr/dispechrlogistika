/**
 * Bot Order Service
 * Buyurtma yaratish - Foydalanuvchilar botda buyurtma yaratishi mumkin
 *
 * FLOW:
 * 1. Foydalanuvchi "📝 Buyurtma yaratish" tugmasini bosadi
 * 2. Bot ma'lumot so'raydi (yo'nalish, yuk haqida, telefon, narx)
 * 3. Buyurtma barcha ro'yxatdan o'tgan userlarga yuboriladi
 * 4. 3 daqiqa ichida kimdir "Olindi" bosadimi kutiladi
 * 5. Agar kimdir "Olindi" bosasa - boshqalardan o'chadi
 * 6. 3 daqiqadan keyin hech kim olmasa - guruhga undov bilan yuboriladi
 */

const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class BotOrderService {
  constructor() {
    // Timer'lar uchun Map (orderId => setTimeout ID)
    this.orderTimers = new Map();
    // Rate limiting - oxirgi buyurtma yaratish vaqti (userId => timestamp)
    this.lastOrderTime = new Map();
  }

  /**
   * Buyurtma yaratish jarayonini boshlash
   */
  async startOrderCreation(ctx) {
    const userId = ctx.from.id.toString();

    // User ro'yxatdan o'tganmi tekshirish
    const user = db.get('bot_users')
      .find({ telegram_user_id: userId })
      .value();

    if (!user || !user.is_registered) {
      await ctx.reply(
        '❌ Buyurtma yaratish uchun avval ro\'yxatdan o\'ting!\n\n' +
        '📱 Telefon raqamingizni yuboring yoki /start ni bosing.',
        { parse_mode: 'HTML' }
      );
      return { state: null };
    }

    // RATE LIMITING: 30 daqiqada 1 marta
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000; // 30 daqiqa millisecondlarda

    if (this.lastOrderTime.has(userId)) {
      const lastTime = this.lastOrderTime.get(userId);
      const timePassed = now - lastTime;

      if (timePassed < THIRTY_MINUTES) {
        const remainingMinutes = Math.ceil((THIRTY_MINUTES - timePassed) / 60000);
        await ctx.reply(
          `⏰ <b>Buyurtma yaratish cheklangan!</b>\n\n` +
          `Siz ${Math.floor(timePassed / 60000)} daqiqa oldin buyurtma yaratgansiz.\n` +
          `Keyingi buyurtmani <b>${remainingMinutes} daqiqadan</b> keyin yaratishingiz mumkin.\n\n` +
          `❗️ Bu cheklov spam oldini olish uchun qo'yilgan.`,
          { parse_mode: 'HTML' }
        );
        return { state: null };
      }
    }

    // Buyurtma yaratishga ruxsat berish va vaqtni yangilash
    this.lastOrderTime.set(userId, now);

    await ctx.reply(
      '📝 <b>Buyurtma yaratish</b>\n\n' +
      'Buyurtmangizni yaratish uchun quyidagi ma\'lumotlarni kiriting:\n\n' +
      '<b>1-qadam:</b> Yo\'nalishni kiriting\n' +
      'Masalan: <code>Toshkent - Samarqand</code> yoki <code>Toshkent ga Buxoro</code>',
      { parse_mode: 'HTML' }
    );

    return {
      state: 'awaiting_route',
      data: {
        user_id: userId,
        username: user.username || '',
        full_name: user.first_name || '',
        phone: user.phone || ''
      }
    };
  }

  /**
   * Yo'nalish ma'lumotini qabul qilish
   */
  async handleRoute(ctx, orderData) {
    const route = ctx.message.text.trim();

    if (route.length < 5) {
      await ctx.reply('❌ Yo\'nalish juda qisqa. Iltimos, to\'g\'ri kiriting.\nMasalan: <code>Toshkent - Samarqand</code>', {
        parse_mode: 'HTML'
      });
      return { state: 'awaiting_route', data: orderData };
    }

    orderData.route = route;

    await ctx.reply(
      '✅ Yo\'nalish: <b>' + route + '</b>\n\n' +
      '<b>2-qadam:</b> Yuk haqida ma\'lumot kiriting\n' +
      'Masalan: <code>Mebel, 5 tonna, 20 kub</code>',
      { parse_mode: 'HTML' }
    );

    return { state: 'awaiting_cargo_info', data: orderData };
  }

  /**
   * Yuk haqida ma'lumot qabul qilish
   */
  async handleCargoInfo(ctx, orderData) {
    const cargoInfo = ctx.message.text.trim();

    if (cargoInfo.length < 10) {
      await ctx.reply('❌ Yuk haqida kamroq ma\'lumot berildi. Iltimos, batafsil yozing.\nMasalan: <code>Mebel, 5 tonna, 20 kub</code>', {
        parse_mode: 'HTML'
      });
      return { state: 'awaiting_cargo_info', data: orderData };
    }

    orderData.cargo_info = cargoInfo;

    await ctx.reply(
      '✅ Yuk ma\'lumoti qabul qilindi\n\n' +
      '<b>3-qadam:</b> Narx kiriting (ixtiyoriy)\n' +
      'Masalan: <code>500 000 so\'m</code> yoki <code>Kelishiladi</code>\n\n' +
      'Agar narx yo\'q bo\'lsa, <code>Yo\'q</code> yoki <code>-</code> kiriting',
      { parse_mode: 'HTML' }
    );

    return { state: 'awaiting_price', data: orderData };
  }

  /**
   * Narx ma'lumotini qabul qilish
   */
  async handlePrice(ctx, orderData) {
    let price = ctx.message.text.trim();

    if (price.toLowerCase() === 'yo\'q' || price === '-' || price.toLowerCase() === 'yoq') {
      price = 'Kelishiladi';
    }

    orderData.price = price;

    // Tasdiqlash xabari
    const confirmMessage = `
📝 <b>Buyurtmangizni tasdiqlang:</b>

🚛 <b>Yo'nalish:</b> ${orderData.route}
📦 <b>Yuk:</b> ${orderData.cargo_info}
💰 <b>Narx:</b> ${orderData.price}
📞 <b>Telefon:</b> ${orderData.phone}

Buyurtmani yaratishni tasdiqlaysizmi?
`.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: 'order_confirm' },
          { text: '❌ Bekor qilish', callback_data: 'order_cancel' }
        ]
      ]
    };

    await ctx.reply(confirmMessage, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    return { state: 'awaiting_confirmation', data: orderData };
  }

  /**
   * Buyurtmani yaratish va userlarga yuborish
   */
  async createAndSendOrder(bot, orderData) {
    try {
      // Buyurtma yaratish
      const orderId = uuidv4();
      const order = {
        id: orderId,
        creator_user_id: orderData.user_id,
        creator_username: orderData.username,
        creator_full_name: orderData.full_name,
        creator_phone: orderData.phone,
        route: orderData.route,
        cargo_info: orderData.cargo_info,
        price: orderData.price,
        status: 'pending', // pending, taken, posted_to_group
        taken_by_user_id: null,
        taken_at: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 daqiqadan keyin
        message_ids: [] // Har bir userga yuborilgan xabar ID'lari
      };

      // Database'ga saqlash
      db.get('bot_orders')
        .push(order)
        .write();

      console.log(`📝 Buyurtma yaratildi: ${orderId}`);

      // Ro'yxatdan o'tgan barcha userlarga yuborish
      const registeredUsers = db.get('bot_users')
        .filter({ is_registered: true })
        .value() || [];

      const messageText = `
🆕 <b>YANGI BUYURTMA</b>

🚛 <b>Yo'nalish:</b> ${order.route}
📦 <b>Yuk:</b> ${order.cargo_info}
💰 <b>Narx:</b> ${order.price}

👤 <b>Buyurtmachi:</b> ${order.creator_full_name}
📞 <b>Telefon:</b> <code>${order.creator_phone}</code>

⏱ <b>3 daqiqa ichida</b> qabul qiling, aks holda guruhga chiqadi!
`.trim();

      const keyboard = {
        inline_keyboard: [
          [{ text: '✅ Olindi', callback_data: `order_take:${orderId}` }]
        ]
      };

      // Barcha userlarga yuborish
      let sentCount = 0;
      for (const user of registeredUsers) {
        // O'ziga yubormaslik
        if (user.telegram_user_id === order.creator_user_id) {
          continue;
        }

        try {
          const sentMsg = await bot.telegram.sendMessage(
            user.telegram_user_id,
            messageText,
            {
              parse_mode: 'HTML',
              reply_markup: keyboard
            }
          );

          // Message ID saqlanadi - keyin o'chirish uchun
          order.message_ids.push({
            user_id: user.telegram_user_id,
            message_id: sentMsg.message_id
          });

          sentCount++;
        } catch (error) {
          console.error(`Failed to send order to user ${user.telegram_user_id}:`, error.message);
        }
      }

      // Database'ni yangilash (message_ids qo'shildi)
      db.get('bot_orders')
        .find({ id: orderId })
        .assign({ message_ids: order.message_ids })
        .write();

      console.log(`✅ Buyurtma ${sentCount} ta userga yuborildi`);

      // Guruhga bildirishnoma yuborish
      await this.sendOrderNotificationToGroup(bot, order);

      // 3 daqiqalik timer o'rnatish
      this.startOrderTimer(bot, orderId);

      return { success: true, orderId, sentCount };

    } catch (error) {
      console.error('Order creation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 3 daqiqalik timer boshlash
   */
  startOrderTimer(bot, orderId) {
    const timerId = setTimeout(async () => {
      await this.handleOrderExpiry(bot, orderId);
    }, 3 * 60 * 1000); // 3 daqiqa

    this.orderTimers.set(orderId, timerId);
    console.log(`⏱ Timer started for order ${orderId}`);
  }

  /**
   * Timer tugaganda - guruhga yuborish
   */
  async handleOrderExpiry(bot, orderId) {
    try {
      const order = db.get('bot_orders')
        .find({ id: orderId })
        .value();

      if (!order) {
        console.log(`Order ${orderId} not found`);
        return;
      }

      // Agar kimdir allaqachon olgan bo'lsa - skip
      if (order.status === 'taken') {
        console.log(`Order ${orderId} already taken, skipping group post`);
        return;
      }

      console.log(`⏱ Order ${orderId} expired - posting to group`);

      // Guruhga yuborish (undov bilan)
      const targetGroupId = process.env.TARGET_GROUP_ID || process.env.TARGET_CHANNEL_ID;

      if (!targetGroupId) {
        console.error('TARGET_GROUP_ID not configured');
        return;
      }

      const messageText = `
‼️ <b>BUYURTMA</b> ‼️

🚛 <b>Yo'nalish:</b> ${order.route}
📦 <b>Yuk:</b> ${order.cargo_info}
💰 <b>Narx:</b> ${order.price}

👤 <b>Buyurtmachi:</b> ${order.creator_full_name}
📞 <b>Telefon:</b> <code>${order.creator_phone}</code>

⚡️ Tez bog'laning!
`.trim();

      await bot.telegram.sendMessage(targetGroupId, messageText, {
        parse_mode: 'HTML'
      });

      // Statusni yangilash
      db.get('bot_orders')
        .find({ id: orderId })
        .assign({
          status: 'posted_to_group',
          posted_to_group_at: new Date().toISOString()
        })
        .write();

      console.log(`✅ Order ${orderId} posted to group`);

    } catch (error) {
      console.error(`Error handling order expiry for ${orderId}:`, error);
    } finally {
      // Timer'ni o'chirish
      this.orderTimers.delete(orderId);
    }
  }

  /**
   * "Olindi" tugmasi bosilganda
   */
  async handleOrderTaken(bot, ctx, orderId) {
    try {
      const userId = ctx.from.id.toString();

      // CRITICAL SECTION: Atomic check and update
      const order = db.get('bot_orders')
        .find({ id: orderId })
        .value();

      if (!order) {
        await ctx.answerCbQuery('❌ Buyurtma topilmadi');
        return;
      }

      // DOUBLE-CHECK: Agar allaqachon olingan bo'lsa
      if (order.status === 'taken') {
        await ctx.answerCbQuery('❌ Bu buyurtma allaqachon boshqa user tomonidan olingan', {
          show_alert: true
        });
        return;
      }

      // ATOMIC UPDATE: Faqat status 'pending' bo'lsagina update qil
      const updateResult = db.get('bot_orders')
        .find({ id: orderId, status: 'pending' }) // Double-check in query
        .assign({
          status: 'taken',
          taken_by_user_id: userId,
          taken_at: new Date().toISOString()
        })
        .write();

      // Verify update was successful
      const updatedOrder = db.get('bot_orders')
        .find({ id: orderId })
        .value();

      // RACE CONDITION CHECK: Agar boshqa user olgan bo'lsa
      if (updatedOrder.taken_by_user_id !== userId) {
        await ctx.answerCbQuery('❌ Bu buyurtma allaqachon boshqa user tomonidan olingan', {
          show_alert: true
        });
        return;
      }

      console.log(`✅ Order ${orderId} taken by user ${userId}`);

      // DARHOL JAVOB BERISH - Foydalanuvchi kutmasin!
      await ctx.answerCbQuery('✅ Buyurtma sizga biriktirildi!');

      // Timer'ni bekor qilish
      const timerId = this.orderTimers.get(orderId);
      if (timerId) {
        clearTimeout(timerId);
        this.orderTimers.delete(orderId);
        console.log(`⏱ Timer cancelled for order ${orderId}`);
      }

      // FONDA ISHLASH: Barcha boshqa userlardagi xabarni o'chirish (await qilmasdan)
      this.deleteOrderMessagesFromOthers(bot, order.message_ids, userId);

      // Xabarni yangilash (faqat olgan user uchun)
      const updatedText = `
✅ <b>SIZ BU BUYURTMANI OLDINGIZ</b>

🚛 <b>Yo'nalish:</b> ${order.route}
📦 <b>Yuk:</b> ${order.cargo_info}
💰 <b>Narx:</b> ${order.price}

👤 <b>Buyurtmachi:</b> ${order.creator_full_name}
📞 <b>Telefon:</b> <code>${order.creator_phone}</code>

💼 Buyurtmachi bilan bog'lanib, ma'lumotlarni aniqlang!
`.trim();

      await ctx.editMessageText(updatedText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] } // Tugmani o'chirish
      });

      // Buyurtma beruvchiga xabar
      try {
        const takerUser = db.get('bot_users')
          .find({ telegram_user_id: userId })
          .value();

        const notificationText = `
✅ <b>Sizning buyurtmangizni olishdi!</b>

🚛 <b>Yo'nalish:</b> ${order.route}

👤 <b>Olgan user:</b> ${takerUser?.first_name || 'Noma\'lum'}
📞 <b>Telefon:</b> <code>${takerUser?.phone || 'Noma\'lum'}</code>

💼 User siz bilan bog'lanadi!
`.trim();

        await bot.telegram.sendMessage(order.creator_user_id, notificationText, {
          parse_mode: 'HTML'
        });
      } catch (error) {
        console.error('Failed to notify order creator:', error);
      }

    } catch (error) {
      console.error('Error handling order taken:', error);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi');
    }
  }

  /**
   * Buyurtmani bekor qilish
   */
  async cancelOrder(ctx, orderId) {
    if (!orderId) {
      await ctx.reply('✅ Buyurtma yaratish bekor qilindi');
      return;
    }

    // Agar order yaratilgan bo'lsa, uni o'chirish kerak
    const order = db.get('bot_orders')
      .find({ id: orderId })
      .value();

    if (order) {
      // Timer'ni bekor qilish
      const timerId = this.orderTimers.get(orderId);
      if (timerId) {
        clearTimeout(timerId);
        this.orderTimers.delete(orderId);
      }

      // Database'dan o'chirish
      db.get('bot_orders')
        .remove({ id: orderId })
        .write();
    }

    await ctx.answerCbQuery('✅ Buyurtma bekor qilindi');
  }

  /**
   * Guruhga yangi buyurtma haqida bildirishnoma yuborish
   */
  async sendOrderNotificationToGroup(bot, order) {
    try {
      const targetGroupId = process.env.TARGET_GROUP_ID || process.env.TARGET_CHANNEL_ID;

      if (!targetGroupId) {
        console.error('❌ TARGET_GROUP_ID not configured');
        return;
      }

      const notificationText = `
🔔 <b>YANGI BUYURTMA!</b>

━━━━━━━━━━━━━━━━━━━━
🚛 <b>Yo'nalish:</b> ${order.route}
📦 <b>Yuk:</b> ${order.cargo_info}
💰 <b>Summa:</b> ${order.price}
━━━━━━━━━━━━━━━━━━━━

📲 <b>Yukni olish uchun botga kiring!</b>
👉 @yukchiborbot
`.trim();

      await bot.telegram.sendMessage(
        targetGroupId,
        notificationText,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );

      console.log(`📢 Guruhga bildirishnoma yuborildi: ${order.id}`);

    } catch (error) {
      console.error('❌ Guruhga bildirishnoma yuborishda xatolik:', error.message);
    }
  }

  /**
   * Boshqa userlardagi xabarlarni o'chirish (fonda)
   */
  async deleteOrderMessagesFromOthers(bot, messageIds, exceptUserId) {
    // Fonda ishlaydi - await qilinmaydi
    for (const msgInfo of messageIds) {
      if (msgInfo.user_id !== exceptUserId) {
        try {
          await bot.telegram.deleteMessage(msgInfo.user_id, msgInfo.message_id);
        } catch (error) {
          // Xatoliklarni ignore qilamiz - muhim emas
          console.error(`Failed to delete message ${msgInfo.message_id} from user ${msgInfo.user_id}:`, error.message);
        }
      }
    }
    console.log(`🗑️ Deleted order messages from other users`);
  }
}

// Export single instance
module.exports = new BotOrderService();
