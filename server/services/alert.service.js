class AlertService {
    static parseDateToUtcMidnight(dateInput) {
        if (!dateInput) return null;
        if (typeof dateInput === 'string') {
            const cleanStr = dateInput.trim().substring(0, 10);
            const parts = cleanStr.split('-');
            if (parts.length === 3) {
                return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
        }
        const d = new Date(dateInput);
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /**
     * Calcula a diferença em dias entre duas datas (YYYY-MM-DD).
     * Retorna número inteiro de dias (positivo = futuro, negativo = passado).
     */
    static calculateDaysDifference(targetDateStr, baseDateStr = null) {
        const targetUtc = this.parseDateToUtcMidnight(targetDateStr);
        if (targetUtc === null) return null;

        const baseUtc = baseDateStr 
            ? this.parseDateToUtcMidnight(baseDateStr)
            : (() => {
                const now = new Date();
                return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
            })();

        const diffMs = targetUtc - baseUtc;
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Avalia o status de prazo de um projeto (Estratégia de Prazos)
     * Regras:
     * - Status Concluído                  -> 'concluido'
     * - hoje < start_date                 -> 'agendado'  (projeto ainda não iniciou)
     * - hoje > end_date                   -> 'atrasado'  (Alerta Crítico)
     * - daysToEnd <= 7 (projeto iniciado) -> 'alerta'    (Proximidade Crítica: 0 a 7 dias)
     * - daysToEnd > 7                     -> 'no_prazo'
     */
    static evaluateProjectDeadline(project, baseDateStr = null) {
        if (project.status === 'Concluído') {
            return {
                status: 'concluido',
                label: 'Concluído',
                badgeColor: 'success',
                daysRemaining: null,
                isCritical: false,
                message: 'Projeto concluído com sucesso.'
            };
        }

        const daysToEnd = this.calculateDaysDifference(project.end_date || project.endDate, baseDateStr);
        if (daysToEnd === null) {
            return {
                status: 'indefinido',
                label: 'Sem Prazo',
                badgeColor: 'neutral',
                daysRemaining: null,
                isCritical: false,
                message: 'Data final não informada.'
            };
        }

        // Verifica se o projeto ainda não iniciou (compara start_date com hoje)
        const daysToStart = this.calculateDaysDifference(project.start_date || project.startDate, baseDateStr);
        if (daysToStart !== null && daysToStart > 0) {
            return {
                status: 'agendado',
                label: `Inicia em ${daysToStart}d`,
                badgeColor: 'neutral',
                daysRemaining: daysToEnd,
                isCritical: false,
                message: `Projeto ainda não iniciado. Início previsto em ${daysToStart} dia(s).`
            };
        }

        // A partir daqui, o projeto já iniciou — avalia atraso com base em end_date
        if (daysToEnd < 0) {
            const overdueDays = Math.abs(daysToEnd);
            return {
                status: 'atrasado',
                label: `Atrasado (${overdueDays}d)`,
                badgeColor: 'danger',
                daysRemaining: daysToEnd,
                isCritical: true,
                message: `Projeto atrasado há ${overdueDays} dia(s). Prazo era ${project.end_date || project.endDate}.`
            };
        }

        if (daysToEnd <= 7) {
            return {
                status: 'alerta',
                label: daysToEnd === 0 ? 'Vence Hoje' : `Vence em ${daysToEnd}d`,
                badgeColor: 'warning',
                daysRemaining: daysToEnd,
                isCritical: true,
                message: daysToEnd === 0
                    ? 'Atenção: o prazo deste projeto expira hoje!'
                    : `Atenção: restam apenas ${daysToEnd} dia(s) para a conclusão do projeto.`
            };
        }

        return {
            status: 'no_prazo',
            label: `No Prazo (${daysToEnd}d)`,
            badgeColor: 'info',
            daysRemaining: daysToEnd,
            isCritical: false,
            message: `Cronograma regular. Restam ${daysToEnd} dias para o encerramento previsto.`
        };
    }

    /**
     * Avalia o status de uma etapa individual do cronograma
     * Regras:
     * - Status Concluída -> 'concluida'
     * - daysRemaining < 0 -> 'atrasada'
     * - daysRemaining <= 5 -> 'alerta' (Proximidade de etapa: até 5 dias)
     * - daysRemaining > 5 -> 'no_prazo'
     */
    static evaluateActivityDeadline(activity, baseDateStr = null) {
        if (activity.status === 'Concluída') {
            return {
                status: 'concluida',
                label: 'Concluída',
                badgeColor: 'success',
                daysRemaining: null,
                isCritical: false
            };
        }

        const days = this.calculateDaysDifference(activity.target_date || activity.targetDate, baseDateStr);
        if (days === null) {
            return {
                status: 'indefinido',
                label: 'Indefinido',
                badgeColor: 'neutral',
                daysRemaining: null,
                isCritical: false
            };
        }

        if (days < 0) {
            return {
                status: 'atrasada',
                label: `Atrasada (${Math.abs(days)}d)`,
                badgeColor: 'danger',
                daysRemaining: days,
                isCritical: true,
                message: `Etapa atrasada há ${Math.abs(days)} dia(s).`
            };
        }

        if (days <= 5) {
            return {
                status: 'alerta',
                label: days === 0 ? 'Vence Hoje' : `Vence em ${days}d`,
                badgeColor: 'warning',
                daysRemaining: days,
                isCritical: true,
                message: days === 0 ? 'Etapa vence hoje!' : `Etapa prevista para daqui a ${days} dia(s).`
            };
        }

        return {
            status: 'no_prazo',
            label: `Previsto (${days}d)`,
            badgeColor: 'info',
            daysRemaining: days,
            isCritical: false,
            message: `No prazo regular.`
        };
    }

    /**
     * Enriquecimento de lista de projetos com cálculo de alertas agregados
     */
    static enrichProjectWithAlerts(project, activities = [], baseDateStr = null) {
        const projectDeadline = this.evaluateProjectDeadline(project, baseDateStr);
        
        let overdueActivities = 0;
        let upcomingActivities = 0;
        const enrichedActivities = activities.map(act => {
            const actDeadline = this.evaluateActivityDeadline(act, baseDateStr);
            if (actDeadline.status === 'atrasada') overdueActivities++;
            if (actDeadline.status === 'alerta') upcomingActivities++;
            return {
                ...act,
                deadline_info: actDeadline
            };
        });

        // O projeto ganha flag crítica se o próprio prazo venceu/está próximo OU se possui etapas críticas atrasadas
        const hasCriticalIssues = projectDeadline.isCritical || overdueActivities > 0;

        return {
            ...project,
            deadline_info: projectDeadline,
            activities_summary: {
                total: activities.length,
                completed: activities.filter(a => a.status === 'Concluída').length,
                overdue: overdueActivities,
                upcoming: upcomingActivities
            },
            has_critical_alerts: hasCriticalIssues,
            activities: enrichedActivities
        };
    }

    /**
     * Gera lista global de notificações ativas para o usuário (usada no sino/dropdown)
     */
    static generateUserNotifications(projectsWithActivities = []) {
        const notifications = [];

        for (const p of projectsWithActivities) {
            // 1. Notificação do Projeto em si
            if (p.deadline_info && p.deadline_info.isCritical) {
                notifications.push({
                    id: `proj-${p.id}`,
                    type: 'project',
                    projectId: p.id,
                    projectName: p.name,
                    title: p.deadline_info.status === 'atrasado' ? 'Projeto Atrasado' : 'Prazo Final Próximo',
                    message: p.deadline_info.message,
                    urgency: p.deadline_info.status, // 'atrasado' ou 'alerta'
                    date: p.end_date,
                    daysRemaining: p.deadline_info.daysRemaining
                });
            }

            // 2. Notificações das etapas do cronograma
            if (Array.isArray(p.activities)) {
                for (const act of p.activities) {
                    if (act.deadline_info && act.deadline_info.isCritical) {
                        notifications.push({
                            id: `act-${act.id}`,
                            type: 'activity',
                            projectId: p.id,
                            projectName: p.name,
                            title: act.deadline_info.status === 'atrasada' ? 'Etapa Atrasada' : 'Etapa Próxima do Vencimento',
                            message: `[${act.description}] no projeto "${p.name}": ${act.deadline_info.message}`,
                            urgency: act.deadline_info.status,
                            date: act.target_date,
                            daysRemaining: act.deadline_info.daysRemaining
                        });
                    }
                }
            }
        }

        // Ordena por severidade: atrasados primeiro (menor daysRemaining), depois alertas próximos
        notifications.sort((a, b) => {
            if (a.urgency === 'atrasado' && b.urgency !== 'atrasado') return -1;
            if (b.urgency === 'atrasado' && a.urgency !== 'atrasado') return 1;
            return (a.daysRemaining || 0) - (b.daysRemaining || 0);
        });

        return notifications;
    }
}

module.exports = AlertService;
