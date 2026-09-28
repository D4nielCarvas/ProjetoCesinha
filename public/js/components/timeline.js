class TimelineComponent {
    /**
     * Renderiza o HTML da linha do tempo visual do cronograma de etapas
     */
    static render(projectId, activities = [], onStatusChangeCallback = null) {
        if (!activities || activities.length === 0) {
            return `
                <div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-md);">
                    Nenhuma etapa cadastrada no cronograma deste projeto.
                </div>
            `;
        }

        const itemsHtml = activities.map((activity, index) => {
            const statusClass = activity.status ? activity.status.replace(/\s+/g, '-') : 'Pendente';
            const deadline = activity.deadline_info || {};
            
            let deadlineBadgeHtml = '';
            if (activity.status === 'Concluída') {
                deadlineBadgeHtml = `<span class="badge-deadline badge-success">✓ Concluída</span>`;
            } else if (deadline.status === 'atrasada') {
                deadlineBadgeHtml = `<span class="badge-deadline badge-danger">⚠️ Atrasada (${Math.abs(deadline.daysRemaining)}d)</span>`;
            } else if (deadline.status === 'alerta') {
                deadlineBadgeHtml = `<span class="badge-deadline badge-warning">⏳ Vence em ${deadline.daysRemaining}d</span>`;
            } else {
                deadlineBadgeHtml = `<span class="badge-deadline badge-info">📅 Previsto (${deadline.daysRemaining}d)</span>`;
            }

            // Data formatada pt-BR
            const formattedDate = activity.target_date ? activity.target_date.split('-').reverse().join('/') : '-';

            return `
                <div class="timeline-item status-${statusClass}" data-activity-id="${activity.id}">
                    <div class="timeline-node"></div>
                    <div class="timeline-card">
                        <div class="timeline-info">
                            <h5>Etapa ${index + 1}: ${this.escapeHtml(activity.description)}</h5>
                            <div class="timeline-meta">
                                <span><strong>Prazo:</strong> ${formattedDate}</span>
                                ${deadlineBadgeHtml}
                            </div>
                        </div>
                        <div class="timeline-actions">
                            <select class="form-select activity-status-changer" 
                                    style="padding: 0.35rem 0.65rem; font-size: 0.8rem; width: auto;"
                                    data-project-id="${projectId}"
                                    data-activity-id="${activity.id}">
                                <option value="Pendente" ${activity.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                                <option value="Em Andamento" ${activity.status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                                <option value="Concluída" ${activity.status === 'Concluída' ? 'selected' : ''}>Concluída</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="timeline" id="project-timeline-${projectId}">
                ${itemsHtml}
            </div>
        `;
    }

    static bindEvents(container, onStatusChange) {
        if (!container) return;
        const selects = container.querySelectorAll('.activity-status-changer');
        selects.forEach(select => {
            select.addEventListener('change', async (e) => {
                const projectId = Number(e.target.dataset.projectId);
                const activityId = Number(e.target.dataset.activityId);
                const newStatus = e.target.value;

                if (onStatusChange) {
                    await onStatusChange(projectId, activityId, newStatus);
                }
            });
        });
    }

    static escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}
