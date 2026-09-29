const { getDatabase } = require('../config/database');
const { supabase: defaultSupabase, isSupabaseConfigured } = require('../config/supabase');

const _UNSET = Symbol('unset');

class LocationRepository {
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
            .from('project_locations')
            .select('id, project_id, name, created_at')
            .eq('project_id', projectId)
            .order('id', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase LocationRepository] findByProjectId error:', error.message);
                    return this._findByProjectIdSqlite(projectId);
                }
                return data || [];
            });
    }

    _findByProjectIdSqlite(projectId, client = null) {
        const db = client || this.db;
        return db.prepare(`
            SELECT id, project_id, name, created_at
            FROM project_locations
            WHERE project_id = ?
            ORDER BY id ASC
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
            .from('project_locations')
            .select('id, project_id, name, created_at')
            .in('project_id', projectIds)
            .order('project_id', { ascending: true })
            .order('id', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase LocationRepository] findByProjectIds error:', error.message);
                    return this._findByProjectIdsSqlite(projectIds);
                }
                return data || [];
            });
    }

    _findByProjectIdsSqlite(projectIds, client = null) {
        const db = client || this.db;
        const placeholders = projectIds.map(() => '?').join(',');
        return db.prepare(`
            SELECT id, project_id, name, created_at
            FROM project_locations
            WHERE project_id IN (${placeholders})
            ORDER BY project_id ASC, id ASC
        `).all(...projectIds);
    }

    // -------------------------------------------------------------------------
    // CREATE MANY
    // -------------------------------------------------------------------------
    createMany(projectId, locations = [], client = null) {
        if (!locations || locations.length === 0) {
            return this.supabase && !client ? Promise.resolve([]) : [];
        }
        if (this.supabase && !client) {
            return this._createManySupabase(projectId, locations);
        }
        return this._createManySqlite(projectId, locations, client);
    }

    _createManySupabase(projectId, locations) {
        const rows = locations
            .map(loc => ({ project_id: projectId, name: (typeof loc === 'string' ? loc : loc.name || '').trim() }))
            .filter(r => r.name);

        return this.supabase
            .from('project_locations')
            .insert(rows)
            .select('id, project_id, name')
            .then(({ data, error }) => {
                if (error) {
                    console.error('[Supabase LocationRepository] createMany error:', error.message);
                    throw new Error(`Falha ao criar locais no Supabase: ${error.message}`);
                }
                return data || [];
            });
    }

    _createManySqlite(projectId, locations, client = null) {
        const db = client || this.db;
        const stmt = db.prepare(`INSERT INTO project_locations (project_id, name) VALUES (?, ?)`);
        const created = [];
        for (const loc of locations) {
            const name = (typeof loc === 'string' ? loc : loc.name || '').trim();
            if (!name) continue;
            const res = stmt.run(projectId, name);
            created.push({ id: Number(res.lastInsertRowid), project_id: projectId, name });
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
            .from('project_locations')
            .delete()
            .eq('project_id', projectId)
            .then(({ error }) => {
                if (error) {
                    console.error('[Supabase LocationRepository] deleteByProjectId error:', error.message);
                    throw new Error(`Falha ao deletar locais no Supabase: ${error.message}`);
                }
            });
    }

    _deleteByProjectIdSqlite(projectId, client = null) {
        const db = client || this.db;
        return db.prepare(`DELETE FROM project_locations WHERE project_id = ?`).run(projectId);
    }
}

module.exports = LocationRepository;
