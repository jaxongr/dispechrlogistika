const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * HAYDOVCHI BOSHQARUV SERVISI
 * Yuk mashinasi haydovchilarini qora/oq ro'yxatga olish
 */

class DriverManager {
  /**
   * Yangi haydovchi qo'shish
   */
  addDriver(driverData) {
    const driver = {
      id: uuidv4(),
      phone: driverData.phone,
      list_type: driverData.list_type, // 'black' yoki 'white'

      truck: {
        type: driverData.truck_type || '',
        color: driverData.truck_color || '',
        plate: driverData.truck_plate || '',
        capacity: driverData.truck_capacity || ''
      },

      blacklist_reason: driverData.blacklist_reason || '',
      total_debt: driverData.debt || 0,
      rating: driverData.rating || 5,

      added_by: {
        user_id: driverData.dispatcher_id,
        name: driverData.dispatcher_name,
        role: 'dispatcher'
      },

      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      history: [{
        date: new Date().toISOString(),
        dispatcher_id: driverData.dispatcher_id,
        dispatcher_name: driverData.dispatcher_name,
        action: driverData.list_type === 'black' ? 'qora_royxatga_qoshildi' : 'oq_royxatga_qoshildi',
        route: driverData.route || '',
        debt: driverData.debt || 0,
        reason: driverData.reason || '',
        note: driverData.note || ''
      }]
    };

    db.get('drivers').push(driver).write();

    console.log(`✅ Haydovchi qo'shildi: ${driver.phone} (${driver.list_type} ro'yxat)`);

    return driver;
  }

  /**
   * Haydovchini telefon raqami bo'yicha topish
   */
  findByPhone(phone) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    return db.get('drivers')
      .filter(d => d.phone.replace(/[^\d+]/g, '') === cleanPhone)
      .value();
  }

  /**
   * Haydovchining to'liq tarixini olish
   */
  getDriverHistory(phone) {
    const drivers = this.findByPhone(phone);

    if (drivers.length === 0) {
      return null;
    }

    // Barcha tarixlarni birlashtirish
    let allHistory = [];
    drivers.forEach(driver => {
      allHistory = allHistory.concat(driver.history || []);
    });

    // Sanaga qarab tartibla (eng yangi birinchi)
    allHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    const latestDriver = drivers[drivers.length - 1];

    return {
      phone: latestDriver.phone,
      list_type: latestDriver.list_type,
      truck: latestDriver.truck,
      total_debt: drivers.reduce((sum, d) => sum + (d.total_debt || 0), 0),
      rating: latestDriver.rating,
      history: allHistory,
      total_records: allHistory.length
    };
  }

  /**
   * Haydovchiga yangi qayd qo'shish
   */
  addDriverNote(phone, noteData) {
    const drivers = this.findByPhone(phone);

    if (drivers.length === 0) {
      return null;
    }

    const latestDriver = drivers[drivers.length - 1];

    const newNote = {
      date: new Date().toISOString(),
      dispatcher_id: noteData.dispatcher_id,
      dispatcher_name: noteData.dispatcher_name,
      action: 'qayd_qoshildi',
      route: noteData.route || '',
      debt: noteData.debt || 0,
      reason: noteData.reason || '',
      note: noteData.note || ''
    };

    // Tarixga qo'shish
    db.get('drivers')
      .find({ id: latestDriver.id })
      .get('history')
      .push(newNote)
      .write();

    // Jami qarzni yangilash
    if (noteData.debt) {
      const newDebt = (latestDriver.total_debt || 0) + noteData.debt;
      db.get('drivers')
        .find({ id: latestDriver.id })
        .assign({
          total_debt: newDebt,
          updated_at: new Date().toISOString()
        })
        .write();
    }

    console.log(`✅ Haydovchiga qayd qo'shildi: ${phone}`);

    return this.getDriverHistory(phone);
  }

  /**
   * Barcha haydovchilar ro'yxati
   */
  getAllDrivers(listType = null) {
    let drivers = db.get('drivers').value();

    if (listType) {
      drivers = drivers.filter(d => d.list_type === listType);
    }

    // Eng yangi birinchi
    drivers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return drivers;
  }

  /**
   * Statistika
   */
  getStatistics() {
    const allDrivers = db.get('drivers').value();

    const blackList = allDrivers.filter(d => d.list_type === 'black');
    const whiteList = allDrivers.filter(d => d.list_type === 'white');

    const totalDebt = blackList.reduce((sum, d) => sum + (d.total_debt || 0), 0);

    // Oxirgi 30 kundagilar
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBlack = blackList.filter(d => new Date(d.created_at) > thirtyDaysAgo);
    const recentWhite = whiteList.filter(d => new Date(d.created_at) > thirtyDaysAgo);

    // Dispatcherlar reytingi
    const dispatcherStats = {};
    allDrivers.forEach(driver => {
      const dispName = driver.added_by.name;
      if (!dispatcherStats[dispName]) {
        dispatcherStats[dispName] = 0;
      }
      dispatcherStats[dispName]++;
    });

    const topDispatchers = Object.entries(dispatcherStats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      black_list: {
        total: blackList.length,
        total_debt: totalDebt,
        avg_debt: blackList.length > 0 ? Math.round(totalDebt / blackList.length) : 0,
        recent_30days: recentBlack.length
      },
      white_list: {
        total: whiteList.length,
        recent_30days: recentWhite.length
      },
      top_dispatchers: topDispatchers
    };
  }
}

module.exports = new DriverManager();
