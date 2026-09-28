const { getDatabase } = require('../config/database');

class ProjectRepository {
    constructor(db = null) {
        this.db = db || getDatabase();
    }

    findAll(userId, filters = {}) {
        let sql = `
            SELECT 
                p.id, p.user_id, p.name, p.project_date, p.classification, 
                p.type, p.responsible_name, p.responsible_email, p.responsible_phone, 
                p.objective, p.location, p.start_date, p.end_date, 
                p.evaluation_analysis, p.status, p.created_at, p.updated_at,
                COUNT(pa.id) as total_activities,
                SUM(CASE WHEN pa.status = 'Concluída' THEN 1 ELSE 0 END) as completed_activities
            FROM projects p
            LEFT JOIN project_activities pa ON p.id = pa.project_id
            WHERE p.user_id = ?
        `;
        const params = [userId];

        if (filters.classification) {
            sql += ` AND p.classification = ?`;
            params.push(filters.classification);
        }

        if (filters.type) {
            sql += ` AND p.type = ?`;
            params.push(filters.type);
        }

        if (filters.status) {
            sql += ` AND p.status = ?`;
            params.push(filters.status);
        }

        if (filters.search) {
            sql += ` AND (
                p.name LIKE ? 
                OR p.responsible_name LIKE ? 
                OR p.location LIKE ?
                OR EXISTS (
                    SELECT 1 FROM project_responsibles pr 
                    WHERE pr.project_id = p.id 
                    AND (pr.name LIKE ? OR pr.email LIKE ? OR pr.phone LIKE ?)
                )
                OR EXISTS (
                    SELECT 1 FROM project_locations pl 
                    WHERE pl.project_id = p.id 
                    AND pl.name LIKE ?
                )
            )`;
            const term = `%${filters.search}%`;
            params.push(term, term, term, term, term, term, term);
        }

        sql += `
            GROUP BY p.id
            ORDER BY p.end_date ASC, p.id DESC
        `;

        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
    }

    findById(id, userId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            SELECT 
                id, user_id, name, project_date, classification, 
                type, responsible_name, responsible_email, responsible_phone, 
                objective, location, start_date, end_date, 
                evaluation_analysis, status, created_at, updated_at
            FROM projects
            WHERE id = ? AND user_id = ?
        `);
        const row = stmt.get(id, userId);
        return row || null;
    }

    create(data, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            INSERT INTO projects (
                user_id, name, project_date, classification, type,
                responsible_name, responsible_email, responsible_phone,
                objective, location, start_date, end_date,
                evaluation_analysis, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.userId,
            data.name,
            data.projectDate,
            data.classification,
            data.type,
            data.responsibleName,
            data.responsibleEmail,
            data.responsiblePhone,
            data.objective,
            data.location,
            data.startDate,
            data.endDate,
            data.evaluationAnalysis || null,
            data.status || 'Em Andamento'
        );

        return Number(result.lastInsertRowid);
    }

    update(id, userId, data, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            UPDATE projects
            SET 
                name = ?, 
                project_date = ?, 
                classification = ?, 
                type = ?,
                responsible_name = ?, 
                responsible_email = ?, 
                responsible_phone = ?,
                objective = ?, 
                location = ?, 
                start_date = ?, 
                end_date = ?,
                evaluation_analysis = ?, 
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `);

        const result = stmt.run(
            data.name,
            data.projectDate,
            data.classification,
            data.type,
            data.responsibleName,
            data.responsibleEmail,
            data.responsiblePhone,
            data.objective,
            data.location,
            data.startDate,
            data.endDate,
            data.evaluationAnalysis || null,
            data.status || 'Em Andamento',
            id,
            userId
        );

        return result.changes > 0;
    }

    delete(id, userId, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            DELETE FROM projects
            WHERE id = ? AND user_id = ?
        `);
        const result = stmt.run(id, userId);
        return result.changes > 0;
    }
}

module.exports = ProjectRepository;
