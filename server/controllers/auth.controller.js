const AuthService = require('../services/auth.service');

const authService = new AuthService();

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
}

module.exports = AuthController;
