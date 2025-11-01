/**
 * Subscription Check Middleware
 * Bot xabarlarni handle qilishdan oldin obunani tekshiradi
 */

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const VIPUser = require('../models/VIPUser');

/**
 * Telegram bot uchun subscription middleware
 */
async function checkSubscription(ctx, next) {
  try {
    const telegram_id = ctx.from?.id;

    if (!telegram_id) {
      return next();
    }

    // Create or update user
    User.createOrUpdateTelegramUser(ctx.from);

    // Check if user is grandfathered (registered before 02.11.2025 18:00)
    const isGrandfathered = User.isGrandfathered(telegram_id);

    if (isGrandfathered) {
      // Grandfather users - check if they have grandfather subscription
      let subscription = Subscription.findActiveByTelegramId(telegram_id);

      if (!subscription) {
        // Create grandfather subscription automatically
        subscription = Subscription.createGrandfather({
          user_id: telegram_id,
          telegram_user_id: telegram_id,
          username: ctx.from.username,
          full_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ')
        });

        console.log(`🎁 Grandfather subscription created for: ${telegram_id}`);
      }

      // Grandfathered users always have access
      ctx.userSubscription = subscription;
      ctx.isGrandfathered = true;
      return next();
    }

    // New users (after 02.11.2025 18:00) - check subscription
    const subscription = Subscription.findActiveByTelegramId(telegram_id);

    if (!subscription) {
      // No active subscription - offer trial or paid plan
      ctx.hasSubscription = false;
      ctx.userSubscription = null;

      // Check if trial already used
      const allSubscriptions = Subscription.findAll({});
      const hasUsedTrial = allSubscriptions.some(
        sub => sub.telegram_user_id === telegram_id && sub.plan_type === 'trial'
      );

      if (!hasUsedTrial) {
        // Offer trial
        await ctx.reply(
          '👋 Salom! Botdan foydalanish uchun obuna kerak.\n\n' +
          '🎁 Sizga 1 kunlik bepul sinov muddati taklif qilamiz!\n\n' +
          'Obuna narxlari:\n' +
          '📅 Haftalik: 30,000 so\'m\n' +
          '📆 Oylik: 70,000 so\'m\n\n' +
          'Buyruqlar:\n' +
          '/subscribe - Obuna bo\'lish\n' +
          '/trial - Bepul sinov boshlash',
          {
            reply_markup: {
              keyboard: [
                [{ text: '🎁 Bepul sinov' }],
                [{ text: '💳 Obuna bo\'lish' }]
              ],
              resize_keyboard: true
            }
          }
        );
      } else {
        // Trial already used
        await ctx.reply(
          '⚠️ Obunangiz tugagan.\n\n' +
          'Botdan foydalanishni davom ettirish uchun obuna bo\'ling:\n\n' +
          '📅 Haftalik: 30,000 so\'m\n' +
          '📆 Oylik: 70,000 so\'m\n\n' +
          '/subscribe - Obuna bo\'lish',
          {
            reply_markup: {
              keyboard: [
                [{ text: '💳 Obuna bo\'lish' }]
              ],
              resize_keyboard: true
            }
          }
        );
      }

      // Block access to main features
      return;
    }

    // Has active subscription
    ctx.hasSubscription = true;
    ctx.userSubscription = subscription;
    ctx.isGrandfathered = false;

    // Check if VIP
    const vipInfo = VIPUser.findByTelegramId(telegram_id);
    ctx.isVIP = !!vipInfo;
    ctx.vipInfo = vipInfo;

    return next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return next(); // Allow in case of error
  }
}

/**
 * Faqat VIP userlar uchun (referral funksiyalar)
 */
async function requireVIP(ctx, next) {
  const telegram_id = ctx.from?.id;

  if (!telegram_id) {
    return;
  }

  const isVIP = VIPUser.isVIP(telegram_id);

  if (!isVIP) {
    await ctx.reply(
      '🚫 Bu funksiya faqat VIP a\'zolar uchun mavjud.\n\n' +
      'VIP a\'zolik birinchi 100 ta obunachiga beriladi va referral orqali pul ishlash imkoniyatini beradi.\n\n' +
      'Afsuski, VIP joylar tugagan. Lekin siz botdan foydalanishingiz mumkin!'
    );
    return;
  }

  ctx.vipInfo = VIPUser.findByTelegramId(telegram_id);
  return next();
}

/**
 * Aktiv obuna talab qiladi
 */
async function requireActiveSubscription(ctx, next) {
  if (!ctx.hasSubscription && !ctx.isGrandfathered) {
    await ctx.reply(
      '⚠️ Bu funksiyadan foydalanish uchun aktiv obuna kerak.\n\n' +
      '/subscribe - Obuna bo\'lish'
    );
    return;
  }

  return next();
}

module.exports = {
  checkSubscription,
  requireVIP,
  requireActiveSubscription
};
