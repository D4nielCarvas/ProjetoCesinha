const { getDatabase } = require('../config/database');

class ActivityRepository {
    constructor(db = null) {
        this.db = db || getDatabase();
    }

    findByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            SELECT id, project_id, description, target_date, status, created_at
            FROM project_activities
            WHERE project_id = ?
            ORDER BY target_date ASC, id ASC
        `);
        return stmt.all(projectId);
    }

    findByProjectIds(projectIds, client = null) {
        if (!projectIds || projectIds.length === 0) return [];
        const db = client || this.db;
        const placeholders = projectIds.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT id, project_id, description, target_date, status, created_at
            FROM project_activities
            WHERE project_id IN (${placeholders})
            ORDER BY project_id ASC, target_date ASC, id ASC
        `);
        return stmt.all(...projectIds);
    }

    createMany(projectId, activities = [], client = null) {
        const db = client || this.db;
        if (!activities || activities.length === 0) return [];

        const stmt = db.prepare(`
            INSERT INTO project_activities (project_id, description, target_date, status)
            VALUES (?, ?, ?, ?)
        `);

        const created = [];
        for (const act of activities) {
            const status = act.status || 'Pendente';
            const res = stmt.run(projectId, act.description, act.target_date, status);
            created.push({
                id: Number(res.lastInsertRowid),
                project_id: projectId,
                description: act.description,
                target_date: act.target_date,
                status
            });
        }
        return created;
    }

    deleteByProjectId(projectId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            DELETE FROM project_activities
            WHERE project_id = ?
        `);
        return stmt.run(projectId);
    }

    updateStatus(activityId, projectId, status, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            UPDATE project_activities
            SET status = ?
            WHERE id = ? AND project_id = ?
        `);
        const res = stmt.run(status, activityId, projectId);
        return res.changes > 0;
    }
}

module.exports = ActivityRepository;
