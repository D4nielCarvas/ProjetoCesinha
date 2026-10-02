const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const AlertService = require('../server/services/alert.service');

describe('AlertService - Regras e Estratégia de Prazos', () => {
    const fixedToday = '2026-09-25';

    test('calculateDaysDifference deve calcular corretamente a diferença de dias', () => {
        const diffFuture = AlertService.calculateDaysDifference('2026-09-30', fixedToday);
        assert.equal(diffFuture, 5);

        const diffPast = AlertService.calculateDaysDifference('2026-09-20', fixedToday);
        assert.equal(diffPast, -5);

        const diffToday = AlertService.calculateDaysDifference('2026-09-25', fixedToday);
        assert.equal(diffToday, 0);
    });

    test('evaluateProjectDeadline deve marcar como "concluido" quando status for Concluído', () => {
        const project = { status: 'Concluído', start_date: '2026-09-01', end_date: '2026-09-20' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'concluido');
        assert.equal(result.isCritical, false);
        assert.equal(result.badgeColor, 'success');
    });

    test('evaluateProjectDeadline deve identificar projeto atrasado (< 0 dias desde end_date)', () => {
        // start_date no passado => projeto já iniciou, end_date no passado => atrasado
        const project = { status: 'Em Andamento', start_date: '2026-09-10', end_date: '2026-09-20' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'atrasado');
        assert.equal(result.isCritical, true);
        assert.equal(result.badgeColor, 'danger');
        assert.equal(result.daysRemaining, -5);
    });

    test('evaluateProjectDeadline deve identificar projeto em alerta de proximidade (<= 7 dias)', () => {
        // start_date no passado => projeto já iniciou, end_date em 4 dias => alerta
        const project = { status: 'Em Andamento', start_date: '2026-09-10', end_date: '2026-09-29' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'alerta');
        assert.equal(result.isCritical, true);
        assert.equal(result.badgeColor, 'warning');
        assert.equal(result.daysRemaining, 4);
    });

    test('evaluateProjectDeadline deve identificar projeto no prazo regular (> 7 dias)', () => {
        // start_date no passado => projeto já iniciou, end_date em 20 dias => no_prazo
        const project = { status: 'Em Andamento', start_date: '2026-09-10', end_date: '2026-10-15' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'no_prazo');
        assert.equal(result.isCritical, false);
        assert.equal(result.badgeColor, 'info');
        assert.equal(result.daysRemaining, 20);
    });

    test('evaluateProjectDeadline deve marcar como "agendado" quando start_date ainda não chegou', () => {
        // start_date no futuro => projeto não iniciou, não deve ser "atrasado"
        const project = { status: 'Em Andamento', start_date: '2026-09-30', end_date: '2026-10-15' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'agendado');
        assert.equal(result.isCritical, false);
        assert.equal(result.badgeColor, 'neutral');
        assert.ok(result.label.includes('Inicia em'));
    });

    test('evaluateActivityDeadline deve alertar etapas atrasadas e próximas (<= 5 dias)', () => {
        const actOverdue = { status: 'Pendente', target_date: '2026-09-24' };
        const resOverdue = AlertService.evaluateActivityDeadline(actOverdue, fixedToday);
        assert.equal(resOverdue.status, 'atrasada');
        assert.equal(resOverdue.isCritical, true);

        const actUpcoming = { status: 'Em Andamento', target_date: '2026-09-28' };
        const resUpcoming = AlertService.evaluateActivityDeadline(actUpcoming, fixedToday);
        assert.equal(resUpcoming.status, 'alerta');
        assert.equal(resUpcoming.isCritical, true);

        const actDone = { status: 'Concluída', target_date: '2026-09-20' };
        const resDone = AlertService.evaluateActivityDeadline(actDone, fixedToday);
        assert.equal(resDone.status, 'concluida');
        assert.equal(resDone.isCritical, false);
    });

    test('generateUserNotifications deve ordenar priorizando itens críticos e atrasados', () => {
        const project1 = {
            id: 1,
            name: 'Projeto A',
            end_date: '2026-09-28',
            status: 'Em Andamento',
            deadline_info: { status: 'alerta', isCritical: true, daysRemaining: 3, message: 'Alerta 3 dias' },
            activities: []
        };

        const project2 = {
            id: 2,
            name: 'Projeto B',
            end_date: '2026-09-20',
            status: 'Em Andamento',
            deadline_info: { status: 'atrasado', isCritical: true, daysRemaining: -5, message: 'Atrasado 5 dias' },
            activities: [
                {
                    id: 10,
                    description: 'Etapa urgente',
                    target_date: '2026-09-22',
                    status: 'Pendente',
                    deadline_info: { status: 'atrasada', isCritical: true, daysRemaining: -3, message: 'Etapa atrasada' }
                }
            ]
        };

        const notifications = AlertService.generateUserNotifications([project1, project2]);
        assert.equal(notifications.length, 3);
        // O primeiro deve ser atrasado
        assert.equal(notifications[0].urgency, 'atrasado');
        assert.equal(notifications[0].projectId, 2);
    });

    test('enrichProjectWithAlerts deve marcar como concluído quando 100% das etapas estiverem concluídas, mesmo com end_date no passado', () => {
        // Projeto com datas históricas (como no print do usuário: 24/12/2025 a 03/03/2026)
        const project = {
            id: 101,
            name: '011-BP-2023 Drench Biotrop',
            start_date: '2025-12-24',
            end_date: '2026-03-03',
            status: 'Em Andamento'
        };

        const activities = [
            { id: 1, description: 'Etapa 1', target_date: '2026-01-15', status: 'Concluída' },
            { id: 2, description: 'Etapa 2', target_date: '2026-02-15', status: 'Concluída' },
            { id: 3, description: 'Etapa 3', target_date: '2026-03-03', status: 'Concluída' }
        ];

        const enriched = AlertService.enrichProjectWithAlerts(project, activities, fixedToday);
        assert.equal(enriched.deadline_info.status, 'concluido');
        assert.equal(enriched.deadline_info.label, 'Concluído');
        assert.equal(enriched.deadline_info.badgeColor, 'success');
        assert.equal(enriched.deadline_info.isCritical, false);
        assert.equal(enriched.has_critical_alerts, false);
        assert.equal(enriched.status, 'Concluído');
        assert.equal(enriched.activities_summary.completed, 3);
        assert.equal(enriched.activities_summary.total, 3);
    });
});
