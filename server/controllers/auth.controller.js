const AuthService = require('../services/auth.service');
const PasswordResetService = require('../services/password-reset.service');

const authService = new AuthService();
const resetService = new PasswordResetService();

class AuthController {
    static async register(req, res, next) {
        try {
            const { name, email, password } = req.body;
            const result = await authService.register({ name, email, password });
            return res.status(201).json({
                success: true,
                message: 'Usuário cadastrado com sucesso!',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await authService.login({ email, password });
            return res.status(200).json({
                success: true,
                message: 'Autenticado com sucesso!',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    static async me(req, res, next) {
        try {
            return res.status(200).json({
                success: true,
                data: {
                    user: req.user
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/forgot-password
     * Body: { email }
     * Sempre retorna 200 para não revelar existência de contas (anti-enumeração).
     */
    static async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Por favor, informe um e-mail válido.'
                });
            }
            await resetService.requestReset(email);
            return res.status(200).json({
                success: true,
                message: 'Se este e-mail estiver cadastrado, você receberá as instruções em breve.'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/auth/reset-password
     * Body: { token, password }
     */
    static async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            await resetService.resetPassword(token, password);
            return res.status(200).json({
                success: true,
                message: 'Senha redefinida com sucesso! Faça login com sua nova senha.'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;

