const express = require('express');
const ProjectController = require('../controllers/project.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Todas as rotas de projetos exigem autenticação
router.use(authMiddleware);

router.get('/', ProjectController.list);
router.post('/', ProjectController.create);
router.get('/:id', ProjectController.getById);
router.put('/:id', ProjectController.update);
router.delete('/:id', ProjectController.delete);
router.patch('/:projectId/activities/:activityId', ProjectController.updateActivityStatus);

module.exports = router;
