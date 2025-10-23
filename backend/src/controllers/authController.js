const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

class AuthController {
  // Login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username va password kerak' });
      }

      const user = await User.findByUsername(username);

      if (!user) {
        return res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });
      }

      const isPasswordValid = await User.verifyPassword(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Username yoki parol noto\'g\'ri' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Sizning hisobingiz bloklangan' });
      }

      const token = generateToken({ userId: user.id, username: user.username });

      res.json({
        message: 'Muvaffaqiyatli kirish',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role_name,
          permissions: user.permissions
        }
      });
    } catch (error) {
      console.error('Login xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Register (faqat admin tomonidan)
  async register(req, res) {
    try {
      const { username, email, password, full_name, role_id } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username va password kerak' });
      }

      // Mavjudligini tekshirish
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: 'Bu username allaqachon mavjud' });
      }

      const user = await User.create({
        username,
        email,
        password,
        full_name,
        role_id: role_id || 3 // Default: viewer
      });

      res.status(201).json({
        message: 'Foydalanuvchi yaratildi',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name
        }
      });
    } catch (error) {
      console.error('Register xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Get current user
  async me(req, res) {
    try {
      res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          full_name: req.user.full_name,
          role: req.user.role_name,
          permissions: req.user.permissions
        }
      });
    } catch (error) {
      console.error('Me xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { old_password, new_password } = req.body;

      if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Eski va yangi parollar kerak' });
      }

      const user = await User.findById(req.user.id);

      const isPasswordValid = await User.verifyPassword(old_password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(400).json({ error: 'Eski parol noto\'g\'ri' });
      }

      await User.update(req.user.id, { password: new_password });

      res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi' });
    } catch (error) {
      console.error('Change password xatolik:', error);
      res.status(500).json({ error: 'Server xatolik' });
    }
  }
}

module.exports = new AuthController();
