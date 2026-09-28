const app = require('./app');
const { getDatabase } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Inicializa banco de dados
try {
    getDatabase();
    console.log('[Database] Conexão com SQLite inicializada com sucesso.');
} catch (err) {
    console.error('[Database Error] Falha ao inicializar banco de dados:', err);
    process.exit(1);
}

const server = app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Sistema de Gestão de Projetos rodando na porta ${PORT}`);
    console.log(`👉 Acesse a aplicação em: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});

// Encerramento gracioso
const shutdown = () => {
    console.log('\n[Server] Encerrando servidor graciosamente...');
    server.close(() => {
        console.log('[Server] Conexões encerradas.');
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
