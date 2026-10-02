const ProjectRepository = require('../models/project.repository');
const ActivityRepository = require('../models/activity.repository');
const ResponsibleRepository = require('../models/responsible.repository');
const LocationRepository = require('../models/location.repository');
const AlertService = require('./alert.service');
const { getDatabaseHelper } = require('../config/database');
const { isSupabaseConfigured } = require('../config/supabase');

class ProjectService {
    constructor(
        projectRepo = null,
        activityRepo = null,
        responsibleRepo = null,
        locationRepo = null,
        dbHelper = null
    ) {
        this.projectRepo = projectRepo || new ProjectRepository();
        this.activityRepo = activityRepo || new ActivityRepository();
        this.responsibleRepo = responsibleRepo || new ResponsibleRepository();
        this.locationRepo = locationRepo || new LocationRepository();
        this.dbHelper = dbHelper || getDatabaseHelper();
    }

    async getProjects(userId, filters = {}) {
        // Supabase retorna Promises; SQLite retorna arrays síncronos
        const rawProjects = await Promise.resolve(this.projectRepo.findAll(userId, filters));
        const projectIds = rawProjects.map(p => p.id);

        // Carregamento em lote (Batch Loading O(1) queries para evitar o problema N+1)
        const [allActivities, allResponsibles, allLocations] = await Promise.all([
            Promise.resolve(this.activityRepo.findByProjectIds(projectIds)),
            Promise.resolve(this.responsibleRepo.findByProjectIds(projectIds)),
            Promise.resolve(this.locationRepo.findByProjectIds(projectIds))
        ]);

        const activitiesByProject = new Map();
        const responsiblesByProject = new Map();
        const locationsByProject = new Map();

        for (const act of allActivities) {
            if (!activitiesByProject.has(act.project_id)) activitiesByProject.set(act.project_id, []);
            activitiesByProject.get(act.project_id).push(act);
        }

        for (const resp of allResponsibles) {
            if (!responsiblesByProject.has(resp.project_id)) responsiblesByProject.set(resp.project_id, []);
            responsiblesByProject.get(resp.project_id).push(resp);
        }

        for (const loc of allLocations) {
            if (!locationsByProject.has(loc.project_id)) locationsByProject.set(loc.project_id, []);
            locationsByProject.get(loc.project_id).push(loc);
        }

        // Enriquece projetos com alertas, atividades, múltiplos responsáveis e múltiplos locais
        const enrichedProjects = rawProjects.map(project => {
            const activities = activitiesByProject.get(project.id) || [];
            const responsibles = responsiblesByProject.get(project.id) || (
                project.responsible_name ? [{
                    name: project.responsible_name,
                    email: project.responsible_email,
                    phone: project.responsible_phone
                }] : []
            );
            const locations = locationsByProject.get(project.id) || (
                project.location ? [{ name: project.location }] : []
            );

            const enriched = AlertService.enrichProjectWithAlerts(project, activities);
            return {
                ...enriched,
                responsibles,
                locations
            };
        });

        // Filtro adicional opcional por status_prazo
        let filteredProjects = enrichedProjects;
        if (filters.deadline_status) {
            filteredProjects = enrichedProjects.filter(p => p.deadline_info.status === filters.deadline_status);
        }

        // Calcula métricas consolidadas para os cards do dashboard
        const metrics = {
            total: enrichedProjects.length,
            active: enrichedProjects.filter(p => p.status === 'Em Andamento' && p.deadline_info.status !== 'concluido').length,
            completed: enrichedProjects.filter(p => p.status === 'Concluído' || p.deadline_info.status === 'concluido').length,
            criticalAlerts: enrichedProjects.filter(p => p.has_critical_alerts).length,
            overdue: enrichedProjects.filter(p => p.deadline_info.status === 'atrasado').length,
            upcoming: enrichedProjects.filter(p => p.deadline_info.status === 'alerta').length
        };

        const notifications = AlertService.generateUserNotifications(enrichedProjects);

        return {
            metrics,
            notifications,
            projects: filteredProjects
        };
    }

    async getProjectById(id, userId) {
        const project = await Promise.resolve(this.projectRepo.findById(id, userId));
        if (!project) {
            throw new Error('Projeto não encontrado ou você não tem permissão para acessá-lo.');
        }

        const [activities, responsibles, locations] = await Promise.all([
            Promise.resolve(this.activityRepo.findByProjectId(id)),
            Promise.resolve(this.responsibleRepo.findByProjectId(id)),
            Promise.resolve(this.locationRepo.findByProjectId(id))
        ]);

        const enriched = AlertService.enrichProjectWithAlerts(project, activities);
        return {
            ...enriched,
            responsibles: responsibles.length > 0 ? responsibles : (
                project.responsible_name ? [{
                    name: project.responsible_name,
                    email: project.responsible_email,
                    phone: project.responsible_phone
                }] : []
            ),
            locations: locations.length > 0 ? locations : (
                project.location ? [{ name: project.location }] : []
            )
        };
    }

    async createProject(userId, data) {
        this.validateProjectData(data);

        const primaryResp = data.responsibles[0];
        const primaryLoc = typeof data.locations[0] === 'string' ? data.locations[0] : data.locations[0].name;

        // Se o Supabase estiver configurado, usa operações assíncronas diretas
        if (isSupabaseConfigured()) {
            return this._createProjectSupabase(userId, data, primaryResp, primaryLoc);
        }

        // Fallback: transação SQLite síncrona
        return this.dbHelper.transaction((client) => {
            const projectId = this.projectRepo.create({
                userId,
                name: data.name.trim(),
                projectDate: data.projectDate,
                classification: data.classification,
                type: data.type,
                responsibleName: primaryResp.name.trim(),
                responsibleEmail: primaryResp.email.trim().toLowerCase(),
                responsiblePhone: primaryResp.phone.trim(),
                objective: data.objective.trim(),
                location: primaryLoc.trim(),
                startDate: data.startDate,
                endDate: data.endDate,
                evaluationAnalysis: data.evaluationAnalysis ? data.evaluationAnalysis.trim() : null,
                status: data.status || 'Em Andamento'
            }, client);

            const createdResponsibles = this.responsibleRepo.createMany(projectId, data.responsibles, client);
            const createdLocations = this.locationRepo.createMany(projectId, data.locations, client);

            let createdActivities = [];
            if (Array.isArray(data.activities) && data.activities.length > 0) {
                createdActivities = this.activityRepo.createMany(projectId, data.activities, client);
            }

            const rawProject = this.projectRepo.findById(projectId, userId, client);
            const enriched = AlertService.enrichProjectWithAlerts(rawProject, createdActivities);
            return {
                ...enriched,
                responsibles: createdResponsibles,
                locations: createdLocations
            };
        });
    }

    async _createProjectSupabase(userId, data, primaryResp, primaryLoc) {
        const projectId = await this.projectRepo.create({
            userId,
            name: data.name.trim(),
            projectDate: data.projectDate,
            classification: data.classification,
            type: data.type,
            responsibleName: primaryResp.name.trim(),
            responsibleEmail: primaryResp.email.trim().toLowerCase(),
            responsiblePhone: primaryResp.phone.trim(),
            objective: data.objective.trim(),
            location: primaryLoc.trim(),
            startDate: data.startDate,
            endDate: data.endDate,
            evaluationAnalysis: data.evaluationAnalysis ? data.evaluationAnalysis.trim() : null,
            status: data.status || 'Em Andamento'
        });

        const [createdResponsibles, createdLocations] = await Promise.all([
            this.responsibleRepo.createMany(projectId, data.responsibles),
            this.locationRepo.createMany(projectId, data.locations)
        ]);

        let createdActivities = [];
        if (Array.isArray(data.activities) && data.activities.length > 0) {
            createdActivities = await this.activityRepo.createMany(projectId, data.activities);
        }

        const rawProject = await this.projectRepo.findById(projectId, userId);
        const enriched = AlertService.enrichProjectWithAlerts(rawProject, createdActivities);
        return {
            ...enriched,
            responsibles: createdResponsibles,
            locations: createdLocations
        };
    }

    async updateProject(id, userId, data) {
        this.validateProjectData(data);

        const existing = await Promise.resolve(this.projectRepo.findById(id, userId));
        if (!existing) {
            throw new Error('Projeto não encontrado ou você não possui permissão para alterá-lo.');
        }

        const primaryResp = data.responsibles[0];
        const primaryLoc = typeof data.locations[0] === 'string' ? data.locations[0] : data.locations[0].name;

        // Se o Supabase estiver configurado, usa operações assíncronas diretas
        if (isSupabaseConfigured()) {
            return this._updateProjectSupabase(id, userId, data, primaryResp, primaryLoc, existing);
        }

        // Fallback: transação SQLite síncrona
        return this.dbHelper.transaction((client) => {
            this.projectRepo.update(id, userId, {
                name: data.name.trim(),
                projectDate: data.projectDate,
                classification: data.classification,
                type: data.type,
                responsibleName: primaryResp.name.trim(),
                responsibleEmail: primaryResp.email.trim().toLowerCase(),
                responsiblePhone: primaryResp.phone.trim(),
                objective: data.objective.trim(),
                location: primaryLoc.trim(),
                startDate: data.startDate,
                endDate: data.endDate,
                evaluationAnalysis: data.evaluationAnalysis ? data.evaluationAnalysis.trim() : null,
                status: data.status || existing.status
            }, client);

            if (Array.isArray(data.responsibles)) {
                this.responsibleRepo.deleteByProjectId(id, client);
                this.responsibleRepo.createMany(id, data.responsibles, client);
            }

            if (Array.isArray(data.locations)) {
                this.locationRepo.deleteByProjectId(id, client);
                this.locationRepo.createMany(id, data.locations, client);
            }

            if (Array.isArray(data.activities)) {
                this.activityRepo.deleteByProjectId(id, client);
                this.activityRepo.createMany(id, data.activities, client);
            }

            const rawProject = this.projectRepo.findById(id, userId, client);
            const activities = this.activityRepo.findByProjectId(id, client);
            const responsibles = this.responsibleRepo.findByProjectId(id, client);
            const locations = this.locationRepo.findByProjectId(id, client);

            const enriched = AlertService.enrichProjectWithAlerts(rawProject, activities);
            return {
                ...enriched,
                responsibles,
                locations
            };
        });
    }

    async _updateProjectSupabase(id, userId, data, primaryResp, primaryLoc, existing) {
        await this.projectRepo.update(id, userId, {
            name: data.name.trim(),
            projectDate: data.projectDate,
            classification: data.classification,
            type: data.type,
            responsibleName: primaryResp.name.trim(),
            responsibleEmail: primaryResp.email.trim().toLowerCase(),
            responsiblePhone: primaryResp.phone.trim(),
            objective: data.objective.trim(),
            location: primaryLoc.trim(),
            startDate: data.startDate,
            endDate: data.endDate,
            evaluationAnalysis: data.evaluationAnalysis ? data.evaluationAnalysis.trim() : null,
            status: data.status || existing.status
        });

        if (Array.isArray(data.responsibles)) {
            await this.responsibleRepo.deleteByProjectId(id);
            await this.responsibleRepo.createMany(id, data.responsibles);
        }

        if (Array.isArray(data.locations)) {
            await this.locationRepo.deleteByProjectId(id);
            await this.locationRepo.createMany(id, data.locations);
        }

        if (Array.isArray(data.activities)) {
            await this.activityRepo.deleteByProjectId(id);
            await this.activityRepo.createMany(id, data.activities);
        }

        const [rawProject, activities, responsibles, locations] = await Promise.all([
            this.projectRepo.findById(id, userId),
            this.activityRepo.findByProjectId(id),
            this.responsibleRepo.findByProjectId(id),
            this.locationRepo.findByProjectId(id)
        ]);

        const enriched = AlertService.enrichProjectWithAlerts(rawProject, activities);
        return {
            ...enriched,
            responsibles,
            locations
        };
    }

    async deleteProject(id, userId) {
        const existing = await Promise.resolve(this.projectRepo.findById(id, userId));
        if (!existing) {
            throw new Error('Projeto não encontrado ou permissão negada.');
        }
        return this.projectRepo.delete(id, userId);
    }

    async updateActivityStatus(activityId, projectId, userId, newStatus) {
        const project = await Promise.resolve(this.projectRepo.findById(projectId, userId));
        if (!project) {
            throw new Error('Projeto não encontrado.');
        }

        const validStatuses = ['Pendente', 'Em Andamento', 'Concluída'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Status inválido. Escolha entre: ${validStatuses.join(', ')}`);
        }

        const updated = await Promise.resolve(this.activityRepo.updateStatus(activityId, projectId, newStatus));
        if (!updated) {
            throw new Error('Etapa de atividade não encontrada neste projeto.');
        }

        return this.getProjectById(projectId, userId);
    }

    validateProjectData(data) {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('O Nome do Projeto é obrigatório.');
        }
        if (!data.projectDate) {
            throw new Error('A Data do Projeto é obrigatória.');
        }
        const validClassifications = ['Experimento', 'Monitoramento', 'Estudo de caso'];
        if (!validClassifications.includes(data.classification)) {
            throw new Error(`Classificação inválida. Deve ser: ${validClassifications.join(', ')}`);
        }
        const validTypes = ['Interno', 'Parceiro'];
        if (!validTypes.includes(data.type)) {
            throw new Error(`Tipo inválido. Deve ser: ${validTypes.join(', ')}`);
        }

        // Validação e normalização de Responsáveis (1 ou mais)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (Array.isArray(data.responsibles) && data.responsibles.length > 0) {
            for (let i = 0; i < data.responsibles.length; i++) {
                const resp = data.responsibles[i];
                if (!resp.name || resp.name.trim().length === 0) {
                    throw new Error(`O Responsável #${i + 1} precisa de um nome válido.`);
                }
                if (!resp.email || !emailRegex.test(resp.email.trim())) {
                    throw new Error(`O Responsável #${i + 1} (${resp.name || 'Sem nome'}) possui um e-mail inválido.`);
                }
                if (!resp.phone || resp.phone.trim().length === 0) {
                    throw new Error(`O Responsável #${i + 1} (${resp.name || 'Sem nome'}) precisa de um telefone/contato válido.`);
                }
            }
        } else if (data.responsibleName && data.responsibleName.trim().length > 0) {
            // Retrocompatibilidade para chamadas com campos diretos
            if (!data.responsibleEmail || !emailRegex.test(data.responsibleEmail.trim())) {
                throw new Error('O E-mail do Responsável é inválido.');
            }
            if (!data.responsiblePhone || data.responsiblePhone.trim().length === 0) {
                throw new Error('O Telefone/Celular do Responsável é obrigatório.');
            }
            data.responsibles = [{
                name: data.responsibleName.trim(),
                email: data.responsibleEmail.trim().toLowerCase(),
                phone: data.responsiblePhone.trim()
            }];
        } else {
            throw new Error('O projeto deve possuir pelo menos um responsável cadastrado.');
        }

        // Validação e normalização de Locais (1 ou mais)
        if (Array.isArray(data.locations) && data.locations.length > 0) {
            const normalizedLocations = [];
            for (let i = 0; i < data.locations.length; i++) {
                const loc = data.locations[i];
                const locName = typeof loc === 'string' ? loc.trim() : (loc.name || '').trim();
                if (!locName || locName.length === 0) {
                    throw new Error(`O Local de Execução #${i + 1} precisa de um nome ou descrição válida.`);
                }
                normalizedLocations.push({ name: locName });
            }
            data.locations = normalizedLocations;
        } else if (data.location && data.location.trim().length > 0) {
            // Retrocompatibilidade para chamadas com location string
            data.locations = [{ name: data.location.trim() }];
        } else {
            throw new Error('O projeto deve possuir pelo menos um local de execução cadastrado.');
        }

        if (!data.objective || data.objective.trim().length === 0) {
            throw new Error('O Objetivo do Projeto é obrigatório.');
        }
        if (!data.startDate || !data.endDate) {
            throw new Error('As datas de início e término são obrigatórias.');
        }
        if (new Date(data.startDate) > new Date(data.endDate)) {
            throw new Error('A Data de Início não pode ser posterior à Previsão de Término.');
        }

        // Valida cada etapa do cronograma se houver
        if (Array.isArray(data.activities)) {
            for (let i = 0; i < data.activities.length; i++) {
                const act = data.activities[i];
                if (!act.description || act.description.trim().length === 0) {
                    throw new Error(`A etapa #${i + 1} do cronograma precisa de uma descrição válida.`);
                }
                if (!act.target_date && !act.targetDate) {
                    throw new Error(`A etapa #${i + 1} do cronograma precisa de uma data prevista de realização.`);
                }
            }
        }
    }
}

module.exports = ProjectService;
