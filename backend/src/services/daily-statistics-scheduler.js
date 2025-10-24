const cron = require('node-cron');
const DailyStatistics = require('../models/DailyStatistics');

/**
 * Kunlik statistika scheduler
 * Har kecha 00:00 da kechagi statistikani saqlaydi
 */
function startDailyStatisticsScheduler() {
  // Har kecha 00:00 da ishga tushadi (Toshkent vaqti bo'yicha)
  // Cron format: sekund daqiqa soat kun oy hafta_kuni
  // '0 0 * * *' = har kuni 00:00 da

  const job = cron.schedule('0 0 * * *', async () => {
    console.log('🕐 00:00 - Kunlik statistika saqlanmoqda...');

    try {
      const stat = await DailyStatistics.saveTodayStatistics();
      console.log('✅ Kunlik statistika muvaffaqiyatli saqlandi:', stat.date);
    } catch (error) {
      console.error('❌ Kunlik statistika saqlashda xatolik:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Tashkent" // Toshkent vaqti
  });

  console.log('📅 Kunlik statistika scheduler ishga tushdi (har kecha 00:00 da)');

  return job;
}

module.exports = { startDailyStatisticsScheduler };
