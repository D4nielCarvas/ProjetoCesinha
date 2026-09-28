const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

class DatabaseConnection {
    constructor(dbPath = null) {
        if (!DatabaseConnection.instance) {
            const resolvedPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../data/gestao_projetos.db');
            
            // Garante que o diretório data/ existe se não for em memória
            if (resolvedPath !== ':memory:') {
                const dataDir = path.dirname(resolvedPath);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
            }

            this.db = new DatabaseSync(resolvedPath);
            this.init();
            DatabaseConnection.instance = this;
        }
        return DatabaseConnection.instance;
    }

    init() {
        // Ativa integridade referencial de chaves estrangeiras
        this.db.exec('PRAGMA foreign_keys = ON;');
        this.db.exec('PRAGMA journal_mode = WAL;');

        // Executa o script de inicialização do schema DDL
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            // Isola as instruções DDL do SQLite (tudo antes da seção Postgres/Supabase)
            const sqliteDdl = schemaSql.split(/--\s*ESQUEMA 2:/i)[0];
            this.db.exec(sqliteDdl);

            // Backfill de migração retrocompatível para responsáveis e locais
            try {
                this.db.exec(`
                    INSERT INTO project_responsibles (project_id, name, email, phone)
                    SELECT p.id, p.responsible_name, p.responsible_email, p.responsible_phone
                    FROM projects p
                    WHERE NOT EXISTS (SELECT 1 FROM project_responsibles pr WHERE pr.project_id = p.id)
                      AND p.responsible_name IS NOT NULL AND TRIM(p.responsible_name) != '';

                    INSERT INTO project_locations (project_id, name)
                    SELECT p.id, p.location
                    FROM projects p
                    WHERE NOT EXISTS (SELECT 1 FROM project_locations pl WHERE pl.project_id = p.id)
                      AND p.location IS NOT NULL AND TRIM(p.location) != '';
                `);
            } catch (migrationErr) {
                console.warn('[Database Migration Warning] Falha na migração automática:', migrationErr.message);
            }
        }
    }

    getDb() {
        return this.db;
    }

    // Helper para executar comandos em transações atômicas ACID
    transaction(callback) {
        this.db.exec('BEGIN TRANSACTION');
        try {
            const result = callback(this.db);
            this.db.exec('COMMIT');
            return result;
        } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
        }
    }
}

// Factory para exportar instância singleton
const getDatabase = (customPath = null) => {
    if (customPath) {
        return new DatabaseConnection(customPath).getDb();
    }
    return new DatabaseConnection().getDb();
};

const getDatabaseHelper = () => new DatabaseConnection();

module.exports = {
    DatabaseConnection,
    getDatabase,
    getDatabaseHelper
};
