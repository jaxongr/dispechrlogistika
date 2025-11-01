/**
 * Bot Subscription Handler
 * Obuna va VIP referral funksiyalari
 */

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const VIPUser = require('../models/VIPUser');
const Referral = require('../models/Referral');
const { Markup } = require('telegraf');

/**
 * /start komandasi - referral code bilan
 */
async function handleStart(ctx) {
  try {
    const telegram_id = ctx.from.id;
    const startPayload = ctx.startPayload; // VIP47 kabi

    // Create or update user
    const user = User.createOrUpdateTelegramUser(ctx.from);

    // Check if user is grandfathered
    const isGrandfathered = User.isGrandfathered(telegram_id);

    if (isGrandfathered) {
      // Grandfather user - create subscription if not exists
      let subscription = Subscription.findActiveByTelegramId(telegram_id);

      if (!subscription) {
        subscription = Subscription.createGrandfather({
          user_id: telegram_id,
          telegram_user_id: telegram_id,
          username: ctx.from.username,
          full_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
        });
      }

      // Check if VIP (first 100 subscribers)
      let vipInfo = VIPUser.findByTelegramId(telegram_id);

      if (!vipInfo) {
        const remainingSlots = VIPUser.getRemainingVIPSlots();
        if (remainingSlots > 0) {
          vipInfo = VIPUser.create({
            telegram_user_id: telegram_id,
            username: ctx.from.username,
            full_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
          });

          if (vipInfo) {
            await ctx.reply(
              `🌟 Tabriklaymiz! Siz VIP a'zo bo'ldingiz!\n\n` +
              `🎫 VIP raqamingiz: #${vipInfo.registration_number}\n` +
              `🔗 Referral kodingiz: ${vipInfo.referral_code}\n\n` +
              `💰 Endi siz referral orqali pul ishlashingiz mumkin!\n` +
              `Har bir taklif qilgan odamdan 50% komissiya olasiz.\n\n` +
              `/referral - Referral menyusi`
            );
          }
        }
      }

      await ctx.reply(
        `👋 Xush kelibsiz, ${ctx.from.first_name}!\n\n` +
        `✅ Sizning obunangiz: Cheksiz (Grandfather)\n` +
        (vipInfo ? `🌟 VIP status: ${vipInfo.referral_code}\n` : '') +
        `\nAsosiy menyu:`,
        getMainKeyboard()
      );

      return;
    }

    // New user (after deadline) - check if came via referral
    let referrerVIP = null;

    if (startPayload) {
      referrerVIP = VIPUser.findByReferralCode(startPayload);

      if (referrerVIP) {
        // Save referral code for later (when user subscribes)
        ctx.session = ctx.session || {};
        ctx.session.referredBy = referrerVIP.telegram_user_id;

        await ctx.reply(
          `👋 Xush kelibsiz!\n\n` +
          `🎁 Siz ${referrerVIP.full_name} tavsiyasi bilan keldingiz!\n\n` +
          `Botdan foydalanish uchun obuna kerak.`
        );
      }
    }

    // Check subscription
    const subscription = Subscription.findActiveByTelegramId(telegram_id);

    if (subscription) {
      // Has active subscription
      await ctx.reply(
        `👋 Xush kelibsiz, ${ctx.from.first_name}!\n\n` +
        `✅ Aktiv obuna: ${subscription.plan_type}\n` +
        `📅 Tugash sanasi: ${new Date(subscription.end_date).toLocaleDateString('uz-UZ')}\n\n` +
        `Asosiy menyu:`,
        getMainKeyboard()
      );
    } else {
      // No subscription - offer trial
      await offerSubscription(ctx);
    }
  } catch (error) {
    console.error('handleStart error:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
  }
}

/**
 * Obuna taklif qilish
 */
async function offerSubscription(ctx) {
  const telegram_id = ctx.from.id;

  // Check if trial already used
  const allSubscriptions = Subscription.findAll({});
  const hasUsedTrial = allSubscriptions.some(
    sub => sub.telegram_user_id === telegram_id && sub.plan_type === 'trial'
  );

  if (!hasUsedTrial) {
    // Offer trial
    await ctx.reply(
      '👋 Botdan foydalanish uchun obuna kerak.\n\n' +
      '🎁 Sizga 1 kunlik bepul sinov muddati taklif qilamiz!\n\n' +
      '📋 Obuna narxlari:\n' +
      '📅 Haftalik: 30,000 so\'m (7 kun)\n' +
      '📆 Oylik: 70,000 so\'m (30 kun)\n\n' +
      '💡 Bepul sinov muddati tugagach, xohlagan obunani tanlashingiz mumkin.',
      Markup.keyboard([
        [Markup.button.callback('🎁 Bepul sinov (1 kun)', 'start_trial')],
        [Markup.button.callback('💳 Obuna bo\'lish', 'view_plans')],
      ]).resize()
    );
  } else {
    // Trial already used
    await ctx.reply(
      '⚠️ Obunangiz tugagan yoki siz bepul sinovdan foydalangansiz.\n\n' +
      '📋 Obuna narxlari:\n' +
      '📅 Haftalik: 30,000 so\'m (7 kun)\n' +
      '📆 Oylik: 70,000 so\'m (30 kun)\n\n' +
      'Obuna bo\'lish uchun quyidagi tugmani bosing:',
      Markup.keyboard([
        [Markup.button.callback('💳 Obuna bo\'lish', 'view_plans')]
      ]).resize()
    );
  }
}

/**
 * /trial - Bepul sinov boshlash
 */
async function handleTrial(ctx) {
  try {
    const telegram_id = ctx.from.id;

    // Check if already has subscription
    const existingSub = Subscription.findActiveByTelegramId(telegram_id);

    if (existingSub) {
      await ctx.reply(
        `✅ Sizda aktiv obuna mavjud: ${existingSub.plan_type}\n` +
        `📅 Tugash sanasi: ${new Date(existingSub.end_date).toLocaleDateString('uz-UZ')}`
      );
      return;
    }

    // Check if trial already used
    const allSubscriptions = Subscription.findAll({});
    const hasUsedTrial = allSubscriptions.some(
      sub => sub.telegram_user_id === telegram_id && sub.plan_type === 'trial'
    );

    if (hasUsedTrial) {
      await ctx.reply(
        '⚠️ Siz bepul sinovdan allaqachon foydalangansiz.\n\n' +
        '💳 Obuna bo\'lish uchun: /subscribe'
      );
      return;
    }

    // Create trial subscription
    const subscription = Subscription.createTrial({
      user_id: telegram_id,
      telegram_user_id: telegram_id,
      username: ctx.from.username,
      full_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
    });

    await ctx.reply(
      `🎁 Bepul sinov faollashtirildi!\n\n` +
      `✅ Obuna turi: Bepul sinov\n` +
      `⏳ Muddat: 1 kun\n` +
      `📅 Tugash sanasi: ${new Date(subscription.end_date).toLocaleDateString('uz-UZ')}\n\n` +
      `Botning barcha funksiyalaridan foydalanishingiz mumkin!`,
      getMainKeyboard()
    );

    console.log(`🎁 Trial started: ${telegram_id}`);
  } catch (error) {
    console.error('handleTrial error:', error);
    await ctx.reply('Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
  }
}

/**
 * /subscribe - Obuna bo'lish menyu
 */
async function handleSubscribe(ctx) {
  await ctx.reply(
    '💳 Obuna bo\'lish\n\n' +
    '📋 Narxlar:\n' +
    '📅 Haftalik: 30,000 so\'m (7 kun)\n' +
    '📆 Oylik: 70,000 so\'m (30 kun)\n\n' +
    '💡 To\'lov usullari:\n' +
    '• Click\n' +
    '• Payme\n' +
    '• Balans (referral tushumlari)\n\n' +
    'Qaysi obunani tanlaysiz?',
    Markup.keyboard([
      [Markup.button.callback('📅 Haftalik (30,000)', 'sub_weekly')],
      [Markup.button.callback('📆 Oylik (70,000)', 'sub_monthly')],
      [Markup.button.callback('🔙 Orqaga', 'main_menu')]
    ]).resize()
  );
}

/**
 * /referral - Referral menyu (VIP uchun)
 */
async function handleReferral(ctx) {
  try {
    const telegram_id = ctx.from.id;
    const vipInfo = VIPUser.findByTelegramId(telegram_id);

    if (!vipInfo) {
      await ctx.reply(
        '🚫 Bu funksiya faqat VIP a\'zolar uchun.\n\n' +
        'VIP a\'zolik birinchi 100 ta obunachiga beriladi va referral orqali pul ishlash imkoniyatini beradi.\n\n' +
        `📊 Hozirgi VIP a\'zolar: ${VIPUser.getVIPCount()}/100\n` +
        `💼 Qolgan joylar: ${VIPUser.getRemainingVIPSlots()}`
      );
      return;
    }

    // Get VIP details
    const vipDetails = VIPUser.getVIPDetails(telegram_id);
    const botUsername = ctx.botInfo.username;
    const referralLink = `https://t.me/${botUsername}?start=${vipInfo.referral_code}`;

    await ctx.reply(
      `🌟 VIP Referral Panel\n\n` +
      `🎫 Sizning VIP raqamingiz: #${vipInfo.registration_number}\n` +
      `🔗 Referral kodingiz: ${vipInfo.referral_code}\n\n` +
      `📊 Statistika:\n` +
      `👥 Taklif qilganlar: ${vipDetails.total_referrals} ta\n` +
      `💰 Jami ishlab topgan: ${vipDetails.total_earnings.toLocaleString()} so'm\n` +
      `💳 Joriy balans: ${vipDetails.current_balance.toLocaleString()} so'm\n\n` +
      `🔗 Sizning referral havolangiz:\n` +
      `${referralLink}\n\n` +
      `💡 Bu havolani do'stlaringizga yuboring. Ular obuna bo'lganda siz 50% komissiya olasiz!`,
      Markup.keyboard([
        [Markup.button.callback('📊 Batafsil', 'ref_details')],
        [Markup.button.callback('💸 Balansni yechish', 'ref_withdraw')],
        [Markup.button.callback('🔙 Orqaga', 'main_menu')]
      ]).resize()
    );
  } catch (error) {
    console.error('handleReferral error:', error);
    await ctx.reply('Xatolik yuz berdi.');
  }
}

/**
 * /mysubscription - Obuna ma'lumotlari
 */
async function handleMySubscription(ctx) {
  try {
    const telegram_id = ctx.from.id;
    const subscription = Subscription.findActiveByTelegramId(telegram_id);

    if (!subscription) {
      await ctx.reply(
        '⚠️ Aktiv obunangiz yo\'q.\n\n' +
        '/subscribe - Obuna bo\'lish'
      );
      return;
    }

    const isGrandfathered = User.isGrandfathered(telegram_id);
    const vipInfo = VIPUser.findByTelegramId(telegram_id);

    let message = `📋 Obuna ma'lumotlari\n\n`;
    message += `✅ Turi: ${subscription.plan_type}\n`;
    message += `📅 Boshlangan: ${new Date(subscription.start_date).toLocaleDateString('uz-UZ')}\n`;
    message += `📅 Tugaydi: ${new Date(subscription.end_date).toLocaleDateString('uz-UZ')}\n`;
    message += `💰 To'langan: ${subscription.amount_paid.toLocaleString()} so'm\n`;

    if (isGrandfathered) {
      message += `\n🎁 Grandfather status: Cheksiz obuna!`;
    }

    if (vipInfo) {
      message += `\n\n🌟 VIP Status: ${vipInfo.referral_code} (#${vipInfo.registration_number}/100)`;
      message += `\n💰 Referral orqali pul ishlash imkoni mavjud!`;
      message += `\n\n/referral - Referral menyusi`;
    }

    await ctx.reply(message);
  } catch (error) {
    console.error('handleMySubscription error:', error);
    await ctx.reply('Xatolik yuz berdi.');
  }
}

/**
 * Main keyboard
 */
function getMainKeyboard() {
  return Markup.keyboard([
    ['📝 Buyurtma yaratish', '🔍 Yuk qidirish'],
    ['📢 E\'lon tarqatish', '📊 Statistika'],
    ['💳 Obuna', '🌟 Referral'],
    ['ℹ️ Yordam']
  ]).resize();
}

/**
 * Check subscription for all bot actions
 */
async function requireSubscription(ctx, next) {
  const telegram_id = ctx.from?.id;

  if (!telegram_id) {
    return next();
  }

  // Check if grandfathered
  const isGrandfathered = User.isGrandfathered(telegram_id);

  if (isGrandfathered) {
    return next();
  }

  // Check subscription
  const subscription = Subscription.findActiveByTelegramId(telegram_id);

  if (!subscription) {
    await offerSubscription(ctx);
    return;
  }

  return next();
}

module.exports = {
  handleStart,
  handleTrial,
  handleSubscribe,
  handleReferral,
  handleMySubscription,
  requireSubscription,
  getMainKeyboard
};
