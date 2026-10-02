const AuthService = require('../services/auth.service');
const { getDatabase } = require('../config/database');
const { isSupabaseConfigured } = require('../config/supabase');

const authService = new AuthService();

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Token de autorização não fornecido. Faça login para continuar.'
            });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                error: 'Formato de token inválido. Esperado: Bearer <token>'
            });
        }

        const token = parts[1];
        const decoded = authService.verifyToken(token);

        // Verifica se o usuário do token ainda existe no banco local (SQLite).
        // Isso previne o erro "FOREIGN KEY constraint failed" quando o token é
        // válido mas o user_id referenciado foi deletado (ex: limpeza de testes).
        if (!isSupabaseConfigured()) {
            const db = getDatabase();
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.id);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Sessão expirada. Seu usuário não foi encontrado. Faça login novamente.'
                });
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Sessão expirada ou token inválido. Faça login novamente.'
        });
    }
};

module.exports = authMiddleware;
