const { getDatabase } = require('../config/database');
const { supabase: defaultSupabase, isSupabaseConfigured } = require('../config/supabase');

const _UNSET = Symbol('unset');

class ProjectRepository {
    constructor(db = null, supabase = _UNSET) {
        this.db = db || getDatabase();
        this.supabase = supabase === _UNSET
            ? (isSupabaseConfigured() ? defaultSupabase : null)
            : supabase;
    }

    // -------------------------------------------------------------------------
    // FIND ALL
    // -------------------------------------------------------------------------
    findAll(userId, filters = {}) {
        if (this.supabase) {
            return this._findAllSupabase(userId, filters);
        }
        return this._findAllSqlite(userId, filters);
    }

    _findAllSupabase(userId, filters = {}) {
        // Supabase JS é assíncrono, mas o service chama de forma síncrona via
        // padrão legado. Usamos a estratégia de retornar uma Promise e o service
        // foi adaptado para await. Aqui retornamos a Promise diretamente.
        let query = this.supabase
            .from('projects')
            .select(`
                id, user_id, name, project_date, classification,
                type, responsible_name, responsible_email, responsible_phone,
                objective, location, start_date, end_date,
                evaluation_analysis, status, created_at, updated_at
            `)
            .eq('user_id', userId)
            .order('end_date', { ascending: true })
            .order('id', { ascending: false });

        if (filters.classification) query = query.eq('classification', filters.classification);
        if (filters.type)           query = query.eq('type', filters.type);
        if (filters.status)         query = query.eq('status', filters.status);
        if (filters.search) {
            const term = `%${filters.search}%`;
            query = query.or(
                `name.ilike.${term},responsible_name.ilike.${term},location.ilike.${term}`
            );
        }

        return query.then(({ data, error }) => {
            if (error) {
                console.error('[Supabase ProjectRepository] findAll error:', error.message);
                return this._findAllSqlite(userId, filters);
            }
            return data || [];
        });
    }

    _findAllSqlite(userId, filters = {}) {
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

        if (filters.classification) { sql += ` AND p.classification = ?`; params.push(filters.classification); }
        if (filters.type)           { sql += ` AND p.type = ?`;           params.push(filters.type); }
        if (filters.status)         { sql += ` AND p.status = ?`;         params.push(filters.status); }
        if (filters.search) {
            sql += ` AND (
                p.name LIKE ? OR p.responsible_name LIKE ? OR p.location LIKE ?
                OR EXISTS (SELECT 1 FROM project_responsibles pr WHERE pr.project_id = p.id AND (pr.name LIKE ? OR pr.email LIKE ? OR pr.phone LIKE ?))
                OR EXISTS (SELECT 1 FROM project_locations pl WHERE pl.project_id = p.id AND pl.name LIKE ?)
            )`;
            const term = `%${filters.search}%`;
            params.push(term, term, term, term, term, term, term);
        }

        sql += ` GROUP BY p.id ORDER BY p.end_date ASC, p.id DESC`;
        return this.db.prepare(sql).all(...params);
    }

    // -------------------------------------------------------------------------
    // FIND BY ID
    // -------------------------------------------------------------------------
    findById(id, userId, client = null) {
        if (this.supabase && !client) {
            return this._findByIdSupabase(id, userId);
        }
        return this._findByIdSqlite(id, userId, client);
    }

    _findByIdSupabase(id, userId) {
        return this.supabase
            .from('projects')
            .select(`
                id, user_id, name, project_date, classification,
                type, responsible_name, responsible_email, responsible_phone,
                objective, location, start_date, end_date,
                evaluation_analysis, status, created_at, updated_at
            `)
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase ProjectRepository] findById error:', error.message);
                    return this._findByIdSqlite(id, userId);
                }
                return data || null;
            });
    }

    _findByIdSqlite(id, userId, client = null) {
        const db = client || this.db;
        const row = db.prepare(`
            SELECT id, user_id, name, project_date, classification,
                type, responsible_name, responsible_email, responsible_phone,
                objective, location, start_date, end_date,
                evaluation_analysis, status, created_at, updated_at
            FROM projects
            WHERE id = ? AND user_id = ?
        `).get(id, userId);
        return row || null;
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------
    create(data, client = null) {
        if (this.supabase && !client) {
            return this._createSupabase(data);
        }
        return this._createSqlite(data, client);
    }

    _createSupabase(data) {
        return this.supabase
            .from('projects')
            .insert({
                user_id:             data.userId,
                name:                data.name,
                project_date:        data.projectDate,
                classification:      data.classification,
                type:                data.type,
                responsible_name:    data.responsibleName,
                responsible_email:   data.responsibleEmail,
                responsible_phone:   data.responsiblePhone,
                objective:           data.objective,
                location:            data.location,
                start_date:          data.startDate,
                end_date:            data.endDate,
                evaluation_analysis: data.evaluationAnalysis || null,
                status:              data.status || 'Em Andamento'
            })
            .select('id')
            .single()
            .then(({ data: row, error }) => {
                if (error) {
                    console.error('[Supabase ProjectRepository] create error:', error.message);
                    throw new Error(`Falha ao criar projeto no Supabase: ${error.message}`);
                }
                return row.id;
            });
    }

    _createSqlite(data, client = null) {
        const db = client || this.db;
        const result = db.prepare(`
            INSERT INTO projects (
                user_id, name, project_date, classification, type,
                responsible_name, responsible_email, responsible_phone,
                objective, location, start_date, end_date,
                evaluation_analysis, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
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

    // -------------------------------------------------------------------------
    // UPDATE
    // -------------------------------------------------------------------------
    update(id, userId, data, client = null) {
        if (this.supabase && !client) {
            return this._updateSupabase(id, userId, data);
        }
        return this._updateSqlite(id, userId, data, client);
    }

    _updateSupabase(id, userId, data) {
        return this.supabase
            .from('projects')
            .update({
                name:                data.name,
                project_date:        data.projectDate,
                classification:      data.classification,
                type:                data.type,
                responsible_name:    data.responsibleName,
                responsible_email:   data.responsibleEmail,
                responsible_phone:   data.responsiblePhone,
                objective:           data.objective,
                location:            data.location,
                start_date:          data.startDate,
                end_date:            data.endDate,
                evaluation_analysis: data.evaluationAnalysis || null,
                status:              data.status || 'Em Andamento',
                updated_at:          new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', userId)
            .then(({ error }) => {
                if (error) {
                    console.error('[Supabase ProjectRepository] update error:', error.message);
                    throw new Error(`Falha ao atualizar projeto no Supabase: ${error.message}`);
                }
                return true;
            });
    }

    _updateSqlite(id, userId, data, client = null) {
        const db = client || this.db;
        const result = db.prepare(`
            UPDATE projects
            SET name = ?, project_date = ?, classification = ?, type = ?,
                responsible_name = ?, responsible_email = ?, responsible_phone = ?,
                objective = ?, location = ?, start_date = ?, end_date = ?,
                evaluation_analysis = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `).run(
            data.name, data.projectDate, data.classification, data.type,
            data.responsibleName, data.responsibleEmail, data.responsiblePhone,
            data.objective, data.location, data.startDate, data.endDate,
            data.evaluationAnalysis || null, data.status || 'Em Andamento',
            id, userId
        );
        return result.changes > 0;
    }

    // -------------------------------------------------------------------------
    // DELETE
    // -------------------------------------------------------------------------
    delete(id, userId, client = null) {
        if (this.supabase && !client) {
            return this._deleteSupabase(id, userId);
        }
        return this._deleteSqlite(id, userId, client);
    }

    _deleteSupabase(id, userId) {
        return this.supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .then(({ error }) => {
                if (error) {
                    console.error('[Supabase ProjectRepository] delete error:', error.message);
                    throw new Error(`Falha ao excluir projeto no Supabase: ${error.message}`);
                }
                return true;
            });
    }

    _deleteSqlite(id, userId, client = null) {
        const db = client || this.db;
        const result = db.prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`).run(id, userId);
        return result.changes > 0;
    }
}

module.exports = ProjectRepository;
