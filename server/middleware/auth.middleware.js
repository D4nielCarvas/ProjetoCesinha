const AuthService = require('../services/auth.service');

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
