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
        const project = { status: 'Concluído', end_date: '2026-09-20' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'concluido');
        assert.equal(result.isCritical, false);
        assert.equal(result.badgeColor, 'success');
    });

    test('evaluateProjectDeadline deve identificar projeto atrasado (< 0 dias)', () => {
        const project = { status: 'Em Andamento', end_date: '2026-09-20' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'atrasado');
        assert.equal(result.isCritical, true);
        assert.equal(result.badgeColor, 'danger');
        assert.equal(result.daysRemaining, -5);
    });

    test('evaluateProjectDeadline deve identificar projeto em alerta de proximidade (<= 7 dias)', () => {
        const project = { status: 'Em Andamento', end_date: '2026-09-29' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'alerta');
        assert.equal(result.isCritical, true);
        assert.equal(result.badgeColor, 'warning');
        assert.equal(result.daysRemaining, 4);
    });

    test('evaluateProjectDeadline deve identificar projeto no prazo regular (> 7 dias)', () => {
        const project = { status: 'Em Andamento', end_date: '2026-10-15' };
        const result = AlertService.evaluateProjectDeadline(project, fixedToday);
        assert.equal(result.status, 'no_prazo');
        assert.equal(result.isCritical, false);
        assert.equal(result.badgeColor, 'info');
        assert.equal(result.daysRemaining, 20);
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
});
