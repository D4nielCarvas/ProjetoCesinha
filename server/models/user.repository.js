const { getDatabase } = require('../config/database');

class UserRepository {
    constructor(db = null) {
        this.db = db || getDatabase();
    }

    create({ name, email, passwordHash, role = 'user' }) {
        const stmt = this.db.prepare(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(name, email, passwordHash, role);
        return {
            id: Number(result.lastInsertRowid),
            name,
            email,
            role
        };
    }

    findByEmail(email) {
        const stmt = this.db.prepare(`
            SELECT id, name, email, password_hash, role, created_at
            FROM users
            WHERE email = ?
        `);
        const row = stmt.get(email);
        return row || null;
    }

    findById(id) {
        const stmt = this.db.prepare(`
            SELECT id, name, email, role, created_at
            FROM users
            WHERE id = ?
        `);
        const row = stmt.get(id);
        return row || null;
    }
}

module.exports = UserRepository;
