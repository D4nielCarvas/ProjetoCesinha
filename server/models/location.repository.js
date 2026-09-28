const { getDatabase } = require('../config/database');

class LocationRepository {
    constructor(db = null) {
        this.db = db || getDatabase();
    }

    findByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            SELECT id, project_id, name, created_at
            FROM project_locations
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
            SELECT id, project_id, name, created_at
            FROM project_locations
            WHERE project_id IN (${placeholders})
            ORDER BY project_id ASC, id ASC
        `);
        return stmt.all(...projectIds);
    }

    createMany(projectId, locations = [], client = null) {
        const db = client || this.db;
        if (!locations || locations.length === 0) return [];

        const stmt = db.prepare(`
            INSERT INTO project_locations (project_id, name)
            VALUES (?, ?)
        `);

        const created = [];
        for (const loc of locations) {
            const name = (typeof loc === 'string' ? loc : loc.name || '').trim();
            if (!name) continue;

            const res = stmt.run(projectId, name);
            created.push({
                id: Number(res.lastInsertRowid),
                project_id: projectId,
                name
            });
        }
        return created;
    }

    deleteByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            DELETE FROM project_locations
            WHERE project_id = ?
        `);
        return stmt.run(projectId);
    }
}

module.exports = LocationRepository;
