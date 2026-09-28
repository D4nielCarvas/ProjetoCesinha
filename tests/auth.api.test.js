const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server/app');
const { getDatabase } = require('../server/config/database');

describe('Integração API - Autenticação e Recuperação de Senha', () => {
    let server;
    let baseUrl;
    let db;
    const testUser = {
        name: 'Cientista de Dados',
        email: `cientista_${Date.now()}@pesquisa.org`,
        password: 'senhaSegura!2026'
    };
    let userJwtToken;

    before(async () => {
        db = getDatabase();

        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://localhost:${port}/api`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test('1. Registro de usuário: Deve cadastrar com sucesso e retornar 201', async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.token);
        assert.equal(data.data.user.email, testUser.email);
        userJwtToken = data.data.token;
    });

    test('2. Registro de usuário: Deve rejeitar e-mail duplicado com status 400', async () => {
        const res = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.match(data.error, /já está cadastrado/i);
    });

    test('3. Login: Deve autenticar com credenciais corretas e retornar JWT', async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.token);
        assert.equal(data.data.user.name, testUser.name);
    });

    test('4. Login: Deve rejeitar senha incorreta com status 401', async () => {
        const res = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: 'senha_completamente_errada'
            })
        });

        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.match(data.error, /credenciais inválidas/i);
    });

    test('5. Perfil (/me): Deve retornar dados do usuário autenticado via JWT', async () => {
        const res = await fetch(`${baseUrl}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${userJwtToken}`
            }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.data.user.email, testUser.email);
    });

    test('6. Forgot Password: Deve retornar 200 e gerar token no banco', async () => {
        const res = await fetch(`${baseUrl}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUser.email })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        // Verifica existência do token no SQLite local
        const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(testUser.email);
        assert.ok(userRow);

        const tokenRow = db.prepare(
            'SELECT token, used FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1'
        ).get(userRow.id);

        assert.ok(tokenRow);
        assert.equal(tokenRow.used, 0);
        assert.ok(tokenRow.token.length >= 48);
    });

    test('7. Forgot Password: E-mail inexistente deve responder com 200 (anti-enumeração)', async () => {
        const res = await fetch(`${baseUrl}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'inexistente_999999@dominio.com' })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
    });

    test('8. Reset Password: Deve alterar senha com sucesso usando token válido', async () => {
        const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(testUser.email);
        const tokenRow = db.prepare(
            'SELECT token FROM password_reset_tokens WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1'
        ).get(userRow.id);

        const newPassword = 'novaSenhaSegura#2027';

        const res = await fetch(`${baseUrl}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: tokenRow.token,
                password: newPassword
            })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);

        // Testar login com a nova senha
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: newPassword
            })
        });

        assert.equal(loginRes.status, 200);

        // Testar login com a senha antiga (deve falhar)
        const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password
            })
        });

        assert.equal(oldLoginRes.status, 401);
    });

    test('9. Reset Password: Deve rejeitar token já utilizado ou inválido', async () => {
        const resInvalid = await fetch(`${baseUrl}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: 'token_falso_inexistente_1234567890',
                password: 'outraSenhaNova123'
            })
        });

        assert.equal(resInvalid.status, 400);
        const dataInvalid = await resInvalid.json();
        assert.equal(dataInvalid.success, false);
    });
});
