const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram');
const path = require('path');
const { db } = require('../config/database');
require('dotenv').config();

/**
 * Telegram Client Service
 * Har bir user uchun alohida Telegram session yaratadi
 */
class TelegramClientService {
  constructor() {
    this.apiId = parseInt(process.env.TELEGRAM_API_ID);
    this.apiHash = process.env.TELEGRAM_API_HASH;
    this.clients = new Map(); // userId -> TelegramClient
  }

  /**
   * Telefon raqam orqali session yaratishni boshlash
   */
  async startAuth(userId, phoneNumber) {
    try {
      console.log(`📱 Session yaratish boshlandi: User ${userId}, Phone ${phoneNumber}`);

      const stringSession = new StringSession('');
      const client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 5,
      });

      // Connect
      await client.connect();

      // Send code
      const result = await client.sendCode(
        {
          apiId: this.apiId,
          apiHash: this.apiHash,
        },
        phoneNumber
      );

      // Clientni vaqtinchalik saqlash
      this.clients.set(userId, {
        client,
        phoneNumber,
        phoneCodeHash: result.phoneCodeHash,
        stringSession
      });

      console.log(`✅ SMS kod yuborildi: ${phoneNumber}`);
      return { success: true, phoneCodeHash: result.phoneCodeHash };
    } catch (error) {
      console.error(`❌ SMS kod yuborishda xatolik: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * SMS kodni tasdiqlash va sessionni saqlash
   */
  async verifyCode(userId, code, password = null) {
    try {
      const userData = this.clients.get(userId);
      if (!userData) {
        throw new Error('Session topilmadi! Avval telefon raqam yuboring.');
      }

      const { client, phoneNumber, phoneCodeHash } = userData;

      console.log(`🔐 SMS kod tekshirilmoqda: User ${userId}`);

      // Sign in with code
      let result;
      try {
        result = await client.invoke(
          new Api.auth.SignIn({
            phoneNumber,
            phoneCodeHash,
            phoneCode: code,
          })
        );
      } catch (error) {
        // Agar 2FA (two-factor authentication) kerak bo'lsa
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
          if (!password) {
            console.log(`🔒 2FA password kerak: User ${userId}`);
            return {
              success: false,
              needPassword: true,
              message: '2FA parol kerak'
            };
          }

          // Get password info
          const passwordInfo = await client.invoke(new Api.account.GetPassword());

          // Sign in with password
          result = await client.invoke(
            new Api.auth.CheckPassword({
              password: await client.computeCheck(passwordInfo, password),
            })
          );
        } else {
          throw error;
        }
      }

      // Session stringni olish
      const sessionString = client.session.save();

      // Database'ga saqlash
      const user = db.get('users').find({ telegram_id: userId }).value();

      db.get('sessions').push({
        id: Date.now(),
        user_id: user.id,
        phone_number: phoneNumber,
        session_string: sessionString,
        created_at: new Date().toISOString()
      }).write();

      // User statusini yangilash
      db.get('users')
        .find({ telegram_id: userId })
        .assign({
          session_created: true,
          phone_number: phoneNumber
        })
        .write();

      console.log(`✅ Session yaratildi va saqlandi: User ${userId}`);

      // Guruhlarni olish
      await this.fetchUserGroups(userId, client);

      // Cleanup
      this.clients.delete(userId);

      return { success: true, user: result.user };
    } catch (error) {
      console.error(`❌ Kod tasdiqlashda xatolik: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Userning guruhlarini olish
   */
  async fetchUserGroups(userId, client = null) {
    try {
      console.log(`📋 Guruhlar yuklanmoqda: User ${userId}`);

      // Agar client berilmagan bo'lsa, sessiondan yaratamiz
      if (!client) {
        client = await this.getClientFromSession(userId);
      }

      // Get all dialogs
      const dialogs = await client.getDialogs({ limit: 500 });

      const user = db.get('users').find({ telegram_id: userId }).value();
      const groups = [];

      for (const dialog of dialogs) {
        const entity = dialog.entity;

        // Faqat guruh va supergroup'larni olamiz
        if (entity.className === 'Channel' || entity.className === 'Chat') {
          const group = {
            id: Date.now() + Math.random(), // Unique ID
            user_id: user.id,
            telegram_group_id: entity.id.toString(),
            title: entity.title,
            username: entity.username || null,
            members_count: entity.participantsCount || 0,
            type: entity.className === 'Channel' ? 'supergroup' : 'group',
            created_at: new Date().toISOString()
          };

          groups.push(group);
        }
      }

      // Eski guruhlarni o'chirish
      db.get('user_groups')
        .remove({ user_id: user.id })
        .write();

      // Yangi guruhlarni saqlash
      groups.forEach(group => {
        db.get('user_groups').push(group).write();
      });

      console.log(`✅ ${groups.length} ta guruh saqlandi: User ${userId}`);

      return groups;
    } catch (error) {
      console.error(`❌ Guruhlarni olishda xatolik: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sessiondan clientni tiklash
   */
  async getClientFromSession(userId) {
    try {
      const user = db.get('users').find({ telegram_id: userId }).value();
      if (!user) throw new Error('User topilmadi');

      const session = db.get('sessions').find({ user_id: user.id }).value();
      if (!session) throw new Error('Session topilmadi');

      const stringSession = new StringSession(session.session_string);
      const client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 5,
      });

      await client.connect();
      return client;
    } catch (error) {
      console.error(`❌ Session tiklashda xatolik: ${error.message}`);
      throw error;
    }
  }

  /**
   * Guruhga xabar yuborish
   */
  async sendMessageToGroup(userId, groupTelegramId, message) {
    try {
      const client = await this.getClientFromSession(userId);

      await client.sendMessage(groupTelegramId, { message });

      return { success: true };
    } catch (error) {
      console.error(`❌ Xabar yuborishda xatolik: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TelegramClientService();
