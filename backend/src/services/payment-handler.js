/**
 * Payment Handler - Click va Payme integratsiyasi
 * Obunalar uchun to'lov tizimi
 */

const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const Referral = require('../models/Referral');
const VIPUser = require('../models/VIPUser');
const { db } = require('../config/database');

// Click.uz integratsiya
const CLICK_SERVICE_ID = process.env.CLICK_SERVICE_ID;
const CLICK_SECRET_KEY = process.env.CLICK_SECRET_KEY;
const CLICK_MERCHANT_USER_ID = process.env.CLICK_MERCHANT_USER_ID;

// Payme integratsiya
const PAYME_MERCHANT_ID = process.env.PAYME_MERCHANT_ID;
const PAYME_SECRET_KEY = process.env.PAYME_SECRET_KEY;

/**
 * Payment plans
 */
const PLANS = {
  weekly: {
    name: 'Haftalik',
    amount: 30000,
    days: 7
  },
  monthly: {
    name: 'Oylik',
    amount: 70000,
    days: 30
  }
};

/**
 * Click.uz - Prepare (Step 1)
 * Har bir to'lovdan oldin chaqiriladi
 */
async function clickPrepare(params) {
  try {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id, // telegram_user_id:plan_type format
      amount,
      action,
      sign_time,
      sign_string
    } = params;

    // Verify signature
    const signString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
    const hash = crypto.createHash('md5').update(signString).digest('hex');

    if (hash !== sign_string) {
      return {
        error: -1,
        error_note: 'SIGN CHECK FAILED'
      };
    }

    // Parse merchant_trans_id
    const [telegram_user_id, plan_type] = merchant_trans_id.split(':');

    if (!telegram_user_id || !plan_type) {
      return {
        error: -5,
        error_note: 'User not found'
      };
    }

    // Check plan
    const plan = PLANS[plan_type];

    if (!plan) {
      return {
        error: -5,
        error_note: 'Invalid plan'
      };
    }

    // Check amount
    if (parseInt(amount) !== plan.amount) {
      return {
        error: -2,
        error_note: 'Incorrect parameter amount'
      };
    }

    // Check if already paid
    const existingPayment = db.get('payments')
      .find({ click_trans_id: click_trans_id.toString() })
      .value();

    if (existingPayment) {
      if (existingPayment.status === 'completed') {
        return {
          error: -4,
          error_note: 'Already paid'
        };
      }
    }

    // Save payment preparation
    if (!db.has('payments').value()) {
      db.set('payments', []).write();
    }

    db.get('payments')
      .push({
        id: Date.now(),
        click_trans_id: click_trans_id.toString(),
        telegram_user_id,
        plan_type,
        amount: parseInt(amount),
        status: 'prepared',
        created_at: new Date().toISOString()
      })
      .write();

    return {
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: Date.now(),
      error: 0,
      error_note: 'Success'
    };
  } catch (error) {
    console.error('Click prepare error:', error);
    return {
      error: -8,
      error_note: 'System error'
    };
  }
}

/**
 * Click.uz - Complete (Step 2)
 * To'lov muvaffaqiyatli bo'lganda chaqiriladi
 */
async function clickComplete(params) {
  try {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      amount,
      action,
      sign_time,
      sign_string,
      error
    } = params;

    // Verify signature
    const signString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
    const hash = crypto.createHash('md5').update(signString).digest('hex');

    if (hash !== sign_string) {
      return {
        error: -1,
        error_note: 'SIGN CHECK FAILED'
      };
    }

    // Check if payment was successful
    if (parseInt(error) !== 0) {
      return {
        error: -6,
        error_note: 'Transaction cancelled'
      };
    }

    // Find payment
    const payment = db.get('payments')
      .find({ click_trans_id: click_trans_id.toString() })
      .value();

    if (!payment) {
      return {
        error: -5,
        error_note: 'User not found'
      };
    }

    if (payment.status === 'completed') {
      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: payment.id,
        error: 0,
        error_note: 'Success'
      };
    }

    // Parse merchant_trans_id
    const [telegram_user_id, plan_type] = merchant_trans_id.split(':');
    const [referrer_telegram_id, referral_code] = (merchant_trans_id.split('_ref:')[1] || '').split(':');

    // Create subscription
    const plan = PLANS[plan_type];
    const subscription = plan_type === 'weekly'
      ? Subscription.createWeekly(
          {
            user_id: telegram_user_id,
            telegram_user_id,
            username: 'click_user',
            full_name: 'Click User'
          },
          {
            payment_method: 'click',
            transaction_id: click_trans_id.toString(),
            amount_paid: plan.amount
          }
        )
      : Subscription.createMonthly(
          {
            user_id: telegram_user_id,
            telegram_user_id,
            username: 'click_user',
            full_name: 'Click User'
          },
          {
            payment_method: 'click',
            transaction_id: click_trans_id.toString(),
            amount_paid: plan.amount
          }
        );

    // Process referral if exists
    if (referrer_telegram_id) {
      const referrerVIP = VIPUser.findByTelegramId(referrer_telegram_id);

      if (referrerVIP && referrerVIP.can_earn_referral) {
        Referral.create(referrer_telegram_id, telegram_user_id, subscription);
        console.log(`💰 Referral commission processed: ${referrer_telegram_id} -> ${telegram_user_id}`);
      }
    }

    // Update payment status
    db.get('payments')
      .find({ click_trans_id: click_trans_id.toString() })
      .assign({
        status: 'completed',
        subscription_id: subscription.id,
        completed_at: new Date().toISOString()
      })
      .write();

    console.log(`✅ Payment completed: ${click_trans_id} - ${plan_type} subscription`);

    return {
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: 'Success'
    };
  } catch (error) {
    console.error('Click complete error:', error);
    return {
      error: -8,
      error_note: 'System error'
    };
  }
}

/**
 * Payme - CheckPerformTransaction
 */
async function paymeCheckPerformTransaction(params) {
  try {
    const { account, amount } = params;

    // account format: {"telegram_user_id": "123456", "plan_type": "weekly"}
    const { telegram_user_id, plan_type } = account;

    if (!telegram_user_id || !plan_type) {
      return {
        error: {
          code: -31050,
          message: 'User not found'
        }
      };
    }

    const plan = PLANS[plan_type];

    if (!plan) {
      return {
        error: {
          code: -31050,
          message: 'Invalid plan'
        }
      };
    }

    // Check amount (Payme uses tiyin - 1 sum = 100 tiyin)
    if (amount !== plan.amount * 100) {
      return {
        error: {
          code: -31001,
          message: 'Incorrect amount'
        }
      };
    }

    return {
      result: {
        allow: true
      }
    };
  } catch (error) {
    console.error('Payme check error:', error);
    return {
      error: {
        code: -32400,
        message: 'System error'
      }
    };
  }
}

/**
 * Payme - CreateTransaction
 */
async function paymeCreateTransaction(params) {
  try {
    const { id, time, account, amount } = params;

    const { telegram_user_id, plan_type } = account;

    // Initialize payme_transactions if not exists
    if (!db.has('payme_transactions').value()) {
      db.set('payme_transactions', []).write();
    }

    // Check if transaction exists
    const existing = db.get('payme_transactions')
      .find({ payme_id: id })
      .value();

    if (existing) {
      return {
        result: {
          create_time: existing.create_time,
          transaction: existing.id.toString(),
          state: existing.state
        }
      };
    }

    // Create transaction
    const transaction = {
      id: Date.now(),
      payme_id: id,
      telegram_user_id,
      plan_type,
      amount: amount / 100, // Convert from tiyin to sum
      state: 1, // Created
      create_time: time,
      created_at: new Date().toISOString()
    };

    db.get('payme_transactions')
      .push(transaction)
      .write();

    return {
      result: {
        create_time: time,
        transaction: transaction.id.toString(),
        state: 1
      }
    };
  } catch (error) {
    console.error('Payme create transaction error:', error);
    return {
      error: {
        code: -32400,
        message: 'System error'
      }
    };
  }
}

/**
 * Payme - PerformTransaction (Complete payment)
 */
async function paymePerformTransaction(params) {
  try {
    const { id } = params;

    const transaction = db.get('payme_transactions')
      .find({ payme_id: id })
      .value();

    if (!transaction) {
      return {
        error: {
          code: -31003,
          message: 'Transaction not found'
        }
      };
    }

    if (transaction.state !== 1) {
      return {
        result: {
          transaction: transaction.id.toString(),
          perform_time: transaction.perform_time,
          state: transaction.state
        }
      };
    }

    // Create subscription
    const plan = PLANS[transaction.plan_type];
    const subscription = transaction.plan_type === 'weekly'
      ? Subscription.createWeekly(
          {
            user_id: transaction.telegram_user_id,
            telegram_user_id: transaction.telegram_user_id,
            username: 'payme_user',
            full_name: 'Payme User'
          },
          {
            payment_method: 'payme',
            transaction_id: transaction.payme_id,
            amount_paid: transaction.amount
          }
        )
      : Subscription.createMonthly(
          {
            user_id: transaction.telegram_user_id,
            telegram_user_id: transaction.telegram_user_id,
            username: 'payme_user',
            full_name: 'Payme User'
          },
          {
            payment_method: 'payme',
            transaction_id: transaction.payme_id,
            amount_paid: transaction.amount
          }
        );

    // Update transaction
    const performTime = Date.now();
    db.get('payme_transactions')
      .find({ payme_id: id })
      .assign({
        state: 2, // Performed
        perform_time: performTime,
        subscription_id: subscription.id,
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`✅ Payme payment completed: ${id} - ${transaction.plan_type} subscription`);

    return {
      result: {
        transaction: transaction.id.toString(),
        perform_time: performTime,
        state: 2
      }
    };
  } catch (error) {
    console.error('Payme perform transaction error:', error);
    return {
      error: {
        code: -32400,
        message: 'System error'
      }
    };
  }
}

/**
 * Generate Click payment link
 */
function generateClickLink(telegram_user_id, plan_type, referrer_code = null) {
  const plan = PLANS[plan_type];

  if (!plan) {
    throw new Error('Invalid plan type');
  }

  let merchantTransId = `${telegram_user_id}:${plan_type}`;

  if (referrer_code) {
    merchantTransId += `_ref:${referrer_code}`;
  }

  const params = new URLSearchParams({
    service_id: CLICK_SERVICE_ID,
    merchant_id: CLICK_MERCHANT_USER_ID,
    merchant_user_id: telegram_user_id,
    merchant_trans_id: merchantTransId,
    amount: plan.amount,
    return_url: `${process.env.APP_URL}/payment-success`,
    transaction_param: plan.name
  });

  return `https://my.click.uz/services/pay?${params.toString()}`;
}

/**
 * Generate Payme payment link
 */
function generatePaymeLink(telegram_user_id, plan_type, referrer_code = null) {
  const plan = PLANS[plan_type];

  if (!plan) {
    throw new Error('Invalid plan type');
  }

  const account = {
    telegram_user_id,
    plan_type
  };

  if (referrer_code) {
    account.referrer_code = referrer_code;
  }

  const accountBase64 = Buffer.from(JSON.stringify(account)).toString('base64');
  const amountTiyin = plan.amount * 100; // Convert to tiyin

  return `https://checkout.paycom.uz/${PAYME_MERCHANT_ID}?amount=${amountTiyin}&account=${accountBase64}`;
}

module.exports = {
  PLANS,
  clickPrepare,
  clickComplete,
  paymeCheckPerformTransaction,
  paymeCreateTransaction,
  paymePerformTransaction,
  generateClickLink,
  generatePaymeLink
};
