const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserRepository = require('../models/user.repository');

const JWT_SECRET = process.env.JWT_SECRET || 'gestao-projetos-secret-key-prod-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthService {
    constructor(userRepository = null) {
        this.userRepository = userRepository || new UserRepository();
    }

    async register({ name, email, password }) {
        if (!name || name.trim().length < 2) {
            throw new Error('O nome deve conter pelo menos 2 caracteres.');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email.trim().toLowerCase())) {
            throw new Error('Por favor, informe um endereço de e-mail válido.');
        }

        if (!password || password.length < 6) {
            throw new Error('A senha deve conter no mínimo 6 caracteres.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing) {
            throw new Error('Este e-mail já está cadastrado no sistema.');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.userRepository.create({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: 'user'
        });

        const token = this.generateToken(user);
        return { user, token };
    }

    async login({ email, password }) {
        if (!email || !password) {
            throw new Error('E-mail e senha são obrigatórios.');
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) {
            throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
        }

        const token = this.generateToken(user);
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        };
    }

    generateToken(user) {
        return jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    }

    verifyToken(token) {
        return jwt.verify(token, JWT_SECRET);
    }
}

module.exports = AuthService;
