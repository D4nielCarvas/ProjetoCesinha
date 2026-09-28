const express = require('express');
const cors = require('cors');
const path = require('node:path');
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Middlewares essenciais de segurança e parsing
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servidor de arquivos estáticos do Frontend
app.use(express.static(path.join(__dirname, '../public')));

// Rotas da API RESTful
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Endpoint de Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback SPA: qualquer requisição não atendida pelas APIs entrega a SPA frontend
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'Endpoint não encontrado.' });
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Middleware Central de Erros
app.use(errorHandler);

module.exports = app;
