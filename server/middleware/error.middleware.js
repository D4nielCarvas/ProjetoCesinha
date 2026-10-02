const errorHandler = (err, req, res, next) => {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

    if (err.status) {
        return res.status(err.status).json({
            success: false,
            error: err.message || 'Erro no servidor.',
            ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
        });
    }

    const msg = (err.message || '').toLowerCase();

    // 401 Unauthorized: Falhas diretas de credenciais e sessão
    if (msg.includes('credenciais') || msg.includes('não autorizado') || msg.includes('sessão expirada')) {
        return res.status(401).json({
            success: false,
            error: err.message
        });
    }

    // 400 Bad Request: Violação de integridade referencial (FK) — usuário/projeto não encontrado
    if (msg.includes('foreign key constraint failed')) {
        return res.status(400).json({
            success: false,
            error: 'Operação inválida: o registro referenciado não existe. Tente fazer logout e login novamente.'
        });
    }

    // 400 Bad Request: Validações de entrada, regras de negócio e recursos não autorizados/não encontrados
    const clientKeywords = [
        'obrigatório',
        'inválid',
        'cadastrado',
        'não encontrado',
        'permissão',
        'conter no mínimo',
        'posterior à previsão',
        'pelo menos',
        'expirou',
        'já utilizado'
    ];

    if (clientKeywords.some(kw => msg.includes(kw))) {
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    return res.status(500).json({
        success: false,
        error: err.message || 'Erro interno no servidor.',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
};

module.exports = errorHandler;

