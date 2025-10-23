const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create({ username, email, password, full_name, role_id = 3 }) {
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now(),
      username,
      email,
      password_hash,
      full_name,
      role_id,
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.get('users')
      .push(newUser)
      .write();

    return newUser;
  }

  static async findByUsername(username) {
    const user = db.get('users')
      .find({ username })
      .value();

    if (!user) return null;

    // Role ma'lumotlarini qo'shish
    const role = db.get('roles')
      .find({ id: user.role_id })
      .value();

    return {
      ...user,
      role_name: role ? role.name : null,
      permissions: role ? JSON.parse(role.permissions || '{}') : {}
    };
  }

  static async findById(id) {
    const user = db.get('users')
      .find({ id: parseInt(id) })
      .value();

    if (!user) return null;

    const role = db.get('roles')
      .find({ id: user.role_id })
      .value();

    return {
      ...user,
      role_name: role ? role.name : null,
      permissions: role ? JSON.parse(role.permissions || '{}') : {}
    };
  }

  static async findAll() {
    const users = db.get('users').value();

    return users.map(user => {
      const role = db.get('roles').find({ id: user.role_id }).value();
      return {
        ...user,
        role_name: role ? role.name : null
      };
    });
  }

  static async update(id, data) {
    const user = db.get('users')
      .find({ id: parseInt(id) })
      .value();

    if (!user) return null;

    const updates = { ...data };

    if (data.password) {
      updates.password_hash = await bcrypt.hash(data.password, 10);
      delete updates.password;
    }

    updates.updated_at = new Date().toISOString();

    db.get('users')
      .find({ id: parseInt(id) })
      .assign(updates)
      .write();

    return db.get('users').find({ id: parseInt(id) }).value();
  }

  static async delete(id) {
    db.get('users')
      .remove({ id: parseInt(id) })
      .write();
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
