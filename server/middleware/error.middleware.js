const errorHandler = (err, req, res, next) => {
    console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

    // Erros conhecidos de validação / regras de negócio
    const clientErrors = [
        'obrigatório',
        'inválid',
        'não encontrado',
        'já cadastrado',
        'permissão',
        'conter no mínimo',
        'posterior à Previsão',
        'pelo menos'
    ];

    const isClientError = clientErrors.some(keyword => 
        err.message && err.message.toLowerCase().includes(keyword.toLowerCase())
    );

    const statusCode = err.status || (isClientError ? 400 : 500);

    return res.status(statusCode).json({
        success: false,
        error: err.message || 'Erro interno no servidor.',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
};

module.exports = errorHandler;
