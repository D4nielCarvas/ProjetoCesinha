const { getDatabase } = require('../config/database');
const { supabase: defaultSupabase, isSupabaseConfigured } = require('../config/supabase');

const _UNSET = Symbol('unset');

class ActivityRepository {
    constructor(db = null, supabase = _UNSET) {
        this.db = db || getDatabase();
        this.supabase = supabase === _UNSET
            ? (isSupabaseConfigured() ? defaultSupabase : null)
            : supabase;
    }

    // -------------------------------------------------------------------------
    // FIND BY PROJECT ID
    // -------------------------------------------------------------------------
    findByProjectId(projectId, client = null) {
        if (this.supabase && !client) {
            return this._findByProjectIdSupabase(projectId);
        }
        return this._findByProjectIdSqlite(projectId, client);
    }

    _findByProjectIdSupabase(projectId) {
        return this.supabase
            .from('project_activities')
            .select('id, project_id, description, target_date, status, created_at')
            .eq('project_id', projectId)
            .order('target_date', { ascending: true })
            .order('id', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase ActivityRepository] findByProjectId error:', error.message);
                    return this._findByProjectIdSqlite(projectId);
                }
                return data || [];
            });
    }

    _findByProjectIdSqlite(projectId, client = null) {
        const db = client || this.db;
        return db.prepare(`
            SELECT id, project_id, description, target_date, status, created_at
            FROM project_activities
            WHERE project_id = ?
            ORDER BY target_date ASC, id ASC
        `).all(projectId);
    }

    // -------------------------------------------------------------------------
    // FIND BY PROJECT IDS (batch)
    // -------------------------------------------------------------------------
    findByProjectIds(projectIds, client = null) {
        if (!projectIds || projectIds.length === 0) return this.supabase && !client ? Promise.resolve([]) : [];
        if (this.supabase && !client) {
            return this._findByProjectIdsSupabase(projectIds);
        }
        return this._findByProjectIdsSqlite(projectIds, client);
    }

    _findByProjectIdsSupabase(projectIds) {
        return this.supabase
            .from('project_activities')
            .select('id, project_id, description, target_date, status, created_at')
            .in('project_id', projectIds)
            .order('project_id', { ascending: true })
            .order('target_date', { ascending: true })
            .order('id', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase ActivityRepository] findByProjectIds error:', error.message);
                    return this._findByProjectIdsSqlite(projectIds);
                }
                return data || [];
            });
    }

    _findByProjectIdsSqlite(projectIds, client = null) {
        const db = client || this.db;
        const placeholders = projectIds.map(() => '?').join(',');
        return db.prepare(`
            SELECT id, project_id, description, target_date, status, created_at
            FROM project_activities
            WHERE project_id IN (${placeholders})
            ORDER BY project_id ASC, target_date ASC, id ASC
        `).all(...projectIds);
    }

    // -------------------------------------------------------------------------
    // CREATE MANY
    // -------------------------------------------------------------------------
    createMany(projectId, activities = [], client = null) {
        if (!activities || activities.length === 0) {
            return this.supabase && !client ? Promise.resolve([]) : [];
        }
        if (this.supabase && !client) {
            return this._createManySupabase(projectId, activities);
        }
        return this._createManySqlite(projectId, activities, client);
    }

    _createManySupabase(projectId, activities) {
        const rows = activities.map(act => ({
            project_id:  projectId,
            description: act.description,
            target_date: act.target_date || act.targetDate,
            status:      act.status || 'Pendente'
        }));

        return this.supabase
            .from('project_activities')
            .insert(rows)
            .select('id, project_id, description, target_date, status')
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase ActivityRepository] createMany error:', error.message);
                    throw new Error(`Falha ao criar etapas no Supabase: ${error.message}`);
                }
                return data || [];
            });
    }

    _createManySqlite(projectId, activities, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`
            INSERT INTO project_activities (project_id, description, target_date, status)
            VALUES (?, ?, ?, ?)
        `);
        const created = [];
        for (const act of activities) {
            const status = act.status || 'Pendente';
            const res = stmt.run(projectId, act.description, act.target_date || act.targetDate, status);
            created.push({
                id: Number(res.lastInsertRowid),
                project_id: projectId,
                description: act.description,
                target_date: act.target_date || act.targetDate,
                status
            });
        }
        return created;
    }

    // -------------------------------------------------------------------------
    // DELETE BY PROJECT ID
    // -------------------------------------------------------------------------
    deleteByProjectId(projectId, client = null) {
        if (this.supabase && !client) {
            return this._deleteByProjectIdSupabase(projectId);
        }
        return this._deleteByProjectIdSqlite(projectId, client);
    }

    _deleteByProjectIdSupabase(projectId) {
        return this.supabase
            .from('project_activities')
            .delete()
            .eq('project_id', projectId)
            .then(({ error }) => {
                if (error) {
                    console.error('[Supabase ActivityRepository] deleteByProjectId error:', error.message);
                    throw new Error(`Falha ao deletar etapas no Supabase: ${error.message}`);
                }
            });
    }

    _deleteByProjectIdSqlite(projectId, client = null) {
        const db = client || this.db;
        return db.prepare(`DELETE FROM project_activities WHERE project_id = ?`).run(projectId);
    }

    // -------------------------------------------------------------------------
    // UPDATE STATUS
    // -------------------------------------------------------------------------
    updateStatus(activityId, projectId, status, client = null) {
        if (this.supabase && !client) {
            return this._updateStatusSupabase(activityId, projectId, status);
        }
        return this._updateStatusSqlite(activityId, projectId, status, client);
    }

    _updateStatusSupabase(activityId, projectId, status) {
        return this.supabase
            .from('project_activities')
            .update({ status })
            .eq('id', activityId)
            .eq('project_id', projectId)
            .then(({ error }) => {
                if (error) {
                    console.error('[Supabase ActivityRepository] updateStatus error:', error.message);
                    throw new Error(`Falha ao atualizar status da etapa no Supabase: ${error.message}`);
                }
                return true;
            });
    }

    _updateStatusSqlite(activityId, projectId, status, client = null) {
        const db = client || this.db;
        const res = db.prepare(`
            UPDATE project_activities SET status = ? WHERE id = ? AND project_id = ?
        `).run(status, activityId, projectId);
        return res.changes > 0;
    }
}

module.exports = ActivityRepository;
