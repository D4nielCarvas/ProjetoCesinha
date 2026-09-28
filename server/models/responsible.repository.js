const { getDatabase } = require('../config/database');

class ResponsibleRepository {
    constructor(db = null) {
        this.db = db || getDatabase();
    }

    findByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            SELECT id, project_id, name, email, phone, created_at
            FROM project_responsibles
            WHERE project_id = ?
            ORDER BY id ASC
        `);
        return stmt.all(projectId);
    }

    findByProjectIds(projectIds, client = null) {
        if (!projectIds || projectIds.length === 0) return [];
        const db = client || this.db;
        const placeholders = projectIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT id, project_id, name, email, phone, created_at
            FROM project_responsibles
            WHERE project_id IN (${placeholders})
            ORDER BY project_id ASC, id ASC
        `);
        return stmt.all(...projectIds);
    }

    createMany(projectId, responsibles = [], client = null) {
        const db = client || this.db;
        if (!responsibles || responsibles.length === 0) return [];

        const stmt = db.prepare(`
            INSERT INTO project_responsibles (project_id, name, email, phone)
            VALUES (?, ?, ?, ?)
        `);

        const created = [];
        for (const resp of responsibles) {
            const name = (resp.name || '').trim();
            const email = (resp.email || '').trim().toLowerCase();
            const phone = (resp.phone || '').trim();

            const res = stmt.run(projectId, name, email, phone);
            created.push({
                id: Number(res.lastInsertRowid),
                project_id: projectId,
                name,
                email,
                phone
            });
        }
        return created;
    }

    deleteByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            DELETE FROM project_responsibles
            WHERE project_id = ?
        `);
        return stmt.run(projectId);
    }
}

module.exports = ResponsibleRepository;
