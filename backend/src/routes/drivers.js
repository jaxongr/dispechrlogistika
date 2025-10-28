const express = require('express');
const router = express.Router();
const driverManager = require('../services/driver-manager');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/drivers/statistics - Haydovchilar statistikasi
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = driverManager.getStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Driver statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Statistika olishda xatolik',
      error: error.message
    });
  }
});

/**
 * GET /api/drivers - Barcha haydovchilar
 */
router.get('/', async (req, res) => {
  try {
    const { list_type, limit = 50 } = req.query;

    let drivers = driverManager.getAllDrivers(list_type);

    // Limit ni qo'llash
    if (limit) {
      drivers = drivers.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      data: drivers,
      count: drivers.length
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Haydovchilarni olishda xatolik',
      error: error.message
    });
  }
});

/**
 * GET /api/drivers/search/:phone - Haydovchini telefon bo'yicha qidirish
 */
router.get('/search/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const history = driverManager.getDriverHistory(phone);

    if (!history) {
      return res.status(404).json({
        success: false,
        message: 'Haydovchi topilmadi'
      });
    }

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Search driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Haydovchini qidirishda xatolik',
      error: error.message
    });
  }
});

/**
 * POST /api/drivers - Yangi haydovchi qo'shish
 */
router.post('/', async (req, res) => {
  try {
    const {
      phone,
      list_type,
      truck_type,
      truck_color,
      truck_plate,
      truck_capacity,
      reason,
      note,
      debt,
      route
    } = req.body;

    // Validation
    if (!phone || !list_type || !truck_type) {
      return res.status(400).json({
        success: false,
        message: 'Telefon, ro\'yxat turi va mashina turi majburiy'
      });
    }

    if (!['black', 'white'].includes(list_type)) {
      return res.status(400).json({
        success: false,
        message: 'Ro\'yxat turi faqat "black" yoki "white" bo\'lishi mumkin'
      });
    }

    const driver = driverManager.addDriver({
      phone,
      list_type,
      truck_type,
      truck_color,
      truck_plate,
      truck_capacity,
      reason,
      note,
      debt,
      route,
      dispatcher_id: req.user.id,
      dispatcher_name: req.user.username
    });

    res.status(201).json({
      success: true,
      message: 'Haydovchi muvaffaqiyatli qo\'shildi',
      data: driver
    });
  } catch (error) {
    console.error('Add driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Haydovchi qo\'shishda xatolik',
      error: error.message
    });
  }
});

/**
 * POST /api/drivers/:phone/note - Haydovchiga qayd qo'shish
 */
router.post('/:phone/note', async (req, res) => {
  try {
    const { phone } = req.params;
    const { route, debt, reason, note } = req.body;

    const updatedHistory = driverManager.addDriverNote(phone, {
      route,
      debt,
      reason,
      note,
      dispatcher_id: req.user.id,
      dispatcher_name: req.user.username
    });

    if (!updatedHistory) {
      return res.status(404).json({
        success: false,
        message: 'Haydovchi topilmadi'
      });
    }

    res.json({
      success: true,
      message: 'Qayd muvaffaqiyatli qo\'shildi',
      data: updatedHistory
    });
  } catch (error) {
    console.error('Add driver note error:', error);
    res.status(500).json({
      success: false,
      message: 'Qayd qo\'shishda xatolik',
      error: error.message
    });
  }
});

module.exports = router;
