/**
 * NEXUS PROJETOS - Core Application Controller
 */

// Estado global da aplicação cliente
const state = {
    currentUser: null,
    projects: [],
    metrics: { total: 0, active: 0, completed: 0, criticalAlerts: 0 },
    notifications: [],
    filters: {
        classification: '',
        type: '',
        deadline_status: '',
        search: ''
    },
    editingProjectId: null,
    currentDetailProject: null,
    currentActivitiesProjectId: null
};

// ==========================================================================
// GERENCIADOR DE TEMA (CLARO / ESCURO)
// ==========================================================================
const ThemeManager = {
    STORAGE_KEY: 'nexus_theme',
    DARK: 'dark',
    LIGHT: 'light',

    getCurrent() {
        return localStorage.getItem(this.STORAGE_KEY) || this.DARK;
    },

    apply(theme) {
        if (theme === this.LIGHT) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        localStorage.setItem(this.STORAGE_KEY, theme);
        this.updateIcon(theme);
    },

    toggle() {
        const next = this.getCurrent() === this.DARK ? this.LIGHT : this.DARK;
        this.apply(next);
    },

    updateIcon(theme) {
        const isLight = theme === this.LIGHT;
        document.querySelectorAll('.theme-icon-dark').forEach(icon => {
            icon.style.display = isLight ? 'block' : 'none';
        });
        document.querySelectorAll('.theme-icon-light').forEach(icon => {
            icon.style.display = isLight ? 'none' : 'block';
        });
        const iconDark = document.getElementById('theme-icon-dark');
        const iconLight = document.getElementById('theme-icon-light');
        if (iconDark) iconDark.style.display = isLight ? 'block' : 'none';
        if (iconLight) iconLight.style.display = isLight ? 'none' : 'block';
    },

    init() {
        this.apply(this.getCurrent());
    }
};

// ==========================================================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    initApp();
});

async function initApp() {
    bindGlobalEvents();
    checkAuthSession();

    // Redireciona para login automaticamente quando o token JWT expira
    window.addEventListener('auth:expired', () => {
        renderAuthView();
        Toast.show('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
    });
}

function checkAuthSession() {
    if (api.isAuthenticated()) {
        state.currentUser = api.getUser();
        renderAuthenticatedUI();
        loadDashboard();
    } else {
        renderAuthView();
    }
}

// ==========================================================================
// RENDERIZAÇÃO DE TELAS & AUTENTICAÇÃO
// ==========================================================================
function renderAuthView() {
    document.getElementById('app-navbar').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('auth-view').style.display = 'flex';
}

function renderAuthenticatedUI() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-navbar').style.display = 'flex';
    document.getElementById('dashboard-view').style.display = 'block';

    if (state.currentUser) {
        document.getElementById('user-display-name').textContent = state.currentUser.name;
        document.getElementById('user-display-email').textContent = state.currentUser.email;
        const initials = state.currentUser.name.trim().charAt(0).toUpperCase();
        document.getElementById('user-avatar-initials').textContent = initials || 'U';
        document.getElementById('greeting-title').textContent = `Olá, ${state.currentUser.name.split(' ')[0]}!`;
    }
}

// ==========================================================================
// CARREGAMENTO DO DASHBOARD E DADOS
// ==========================================================================
async function loadDashboard() {
    try {
        const data = await api.getProjects(state.filters);
        state.projects = data.projects || [];
        state.metrics = data.metrics || { total: 0, active: 0, completed: 0, criticalAlerts: 0 };
        state.notifications = data.notifications || [];

        renderMetrics();
        renderNotificationsDropdown();
        renderProjectsGrid();
    } catch (error) {
        Toast.show(error.message, 'error');
    }
}

function renderMetrics() {
    document.getElementById('kpi-total').textContent = state.metrics.total;
    document.getElementById('kpi-active').textContent = state.metrics.active;
    document.getElementById('kpi-completed').textContent = state.metrics.completed;
    document.getElementById('kpi-critical').textContent = state.metrics.criticalAlerts;
}

function renderNotificationsDropdown() {
    const counter = document.getElementById('notification-counter');
    const headerCount = document.getElementById('notification-header-count');
    const listContainer = document.getElementById('notification-items-list');

    const totalAlerts = state.notifications.length;
    if (totalAlerts > 0) {
        counter.textContent = totalAlerts;
        counter.style.display = 'flex';
        headerCount.textContent = `${totalAlerts} ${totalAlerts === 1 ? 'alerta' : 'alertas'}`;
    } else {
        counter.style.display = 'none';
        headerCount.textContent = 'Nenhum alerta pendente';
    }

    if (totalAlerts === 0) {
        listContainer.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
                ✓ Todos os projetos e etapas estão no prazo!
            </div>
        `;
        return;
    }

    listContainer.innerHTML = state.notifications.map(notif => `
        <div class="notification-item urgency-${notif.urgency}" data-project-id="${notif.projectId}">
            <div class="notification-content">
                <h5>${escapeHtml(notif.title)}</h5>
                <p>${escapeHtml(notif.message)}</p>
            </div>
        </div>
    `).join('');

    // Adiciona clique para abrir detalhes do projeto direto da notificação
    listContainer.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const projectId = Number(item.dataset.projectId);
            document.getElementById('notification-dropdown').classList.remove('active');
            openProjectDetailsModal(projectId);
        });
    });
}

function renderProjectsGrid() {
    const grid = document.getElementById('projects-grid');

    if (state.projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                </div>
                <h3>Nenhum projeto encontrado</h3>
                <p>Nenhum projeto atende aos filtros atuais ou você ainda não cadastrou seu primeiro projeto no sistema.</p>
                <button class="btn btn-primary" onclick="openCreateProjectModal()">
                    Cadastrar Primeiro Projeto
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.projects.map(project => {
        const deadline = project.deadline_info || {};
        const activities = project.activities_summary || { total: 0, completed: 0 };
        const percentCompleted = activities.total > 0 
            ? Math.round((activities.completed / activities.total) * 100) 
            : (project.status === 'Concluído' ? 100 : 0);

        const startDateFmt = project.start_date ? project.start_date.split('-').reverse().join('/') : '-';
        const endDateFmt = project.end_date ? project.end_date.split('-').reverse().join('/') : '-';

        return `
            <article class="project-card status-${deadline.status}">
                <div class="card-top">
                    <div class="card-tags">
                        <span class="tag tag-classification">${escapeHtml(project.classification)}</span>
                        <span class="tag tag-type">${escapeHtml(project.type)}</span>
                        <span class="badge-deadline badge-${deadline.badgeColor}">${escapeHtml(deadline.label)}</span>
                    </div>

                    <h3 class="card-title">${escapeHtml(project.name)}</h3>
                    <p class="card-objective">${escapeHtmlMultiline(project.objective)}</p>

                    <div class="card-meta-list">
                        <div class="card-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <span>${escapeHtml(project.responsible_name)}</span>
                        </div>
                        <div class="card-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${escapeHtml(project.location)}</span>
                        </div>
                        <div class="card-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>${startDateFmt} até ${endDateFmt}</span>
                        </div>
                    </div>

                    <div class="progress-container">
                        <div class="progress-header">
                            <span>Progresso do Cronograma</span>
                            <span>${activities.completed}/${activities.total} etapas (${percentCompleted}%)</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${percentCompleted}%;"></div>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="openProjectDetailsModal(${project.id})" title="Ver Detalhes do Projeto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            <span>Detalhes</span>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="openProjectActivitiesModal(${project.id})" title="Visualizar e Editar Etapas">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            <span>Etapas</span>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="exportProjectToPdf(${project.id})" title="Exportar Projeto em PDF">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            <span>PDF</span>
                        </button>
                    </div>
                    <div style="display: flex; gap: 0.35rem; margin-left: auto;">
                        <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal(${project.id})" title="Editar Projeto Completo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            <span>Editar</span>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="confirmDeleteProject(${project.id}, '${escapeHtml(project.name)}')" title="Excluir Projeto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// ==========================================================================
// MODAL DE CADASTRO / EDIÇÃO DE PROJETO
// ==========================================================================
function openCreateProjectModal() {
    state.editingProjectId = null;
    document.getElementById('project-modal-title').textContent = 'Novo Projeto';
    document.getElementById('project-form').reset();
    document.getElementById('project-id-input').value = '';

    // Data padrão de hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('proj-date').value = today;
    document.getElementById('proj-start-date').value = today;

    // Inicializa containers dinâmicos
    document.getElementById('responsibles-container').innerHTML = '';
    addResponsibleRow();

    document.getElementById('locations-container').innerHTML = '';
    addLocationRow();

    const scheduleContainer = document.getElementById('schedule-rows-container');
    scheduleContainer.innerHTML = '';
    addScheduleRow();

    document.getElementById('project-modal-overlay').classList.add('active');
}

async function openEditProjectModal(projectId) {
    try {
        state.editingProjectId = projectId;
        document.getElementById('project-modal-title').textContent = 'Editar Projeto';
        const project = await api.getProjectById(projectId);

        document.getElementById('project-id-input').value = project.id;
        document.getElementById('proj-name').value = project.name;
        document.getElementById('proj-date').value = project.project_date;
        document.getElementById('proj-classification').value = project.classification;
        document.getElementById('proj-type').value = project.type;
        document.getElementById('proj-objective').value = project.objective;
        document.getElementById('proj-start-date').value = project.start_date;
        document.getElementById('proj-end-date').value = project.end_date;
        document.getElementById('proj-evaluation').value = project.evaluation_analysis || '';

        // Preenche responsáveis
        const respsContainer = document.getElementById('responsibles-container');
        respsContainer.innerHTML = '';
        const responsibles = project.responsibles && project.responsibles.length > 0
            ? project.responsibles
            : [{ name: project.responsible_name, email: project.responsible_email, phone: project.responsible_phone }];
        responsibles.forEach(resp => addResponsibleRow(resp));

        // Preenche locais
        const locsContainer = document.getElementById('locations-container');
        locsContainer.innerHTML = '';
        const locations = project.locations && project.locations.length > 0
            ? project.locations
            : [{ name: project.location }];
        locations.forEach(loc => addLocationRow(loc));

        // Preenche etapas do cronograma
        const scheduleContainer = document.getElementById('schedule-rows-container');
        scheduleContainer.innerHTML = '';
        if (Array.isArray(project.activities) && project.activities.length > 0) {
            project.activities.forEach(act => addScheduleRow(act));
        } else {
            addScheduleRow();
        }

        document.getElementById('project-modal-overlay').classList.add('active');
    } catch (error) {
        Toast.show(error.message, 'error');
    }
}

function closeProjectModal() {
    document.getElementById('project-modal-overlay').classList.remove('active');
    state.editingProjectId = null;
}

// Adiciona linha de responsável dinâmico
function addResponsibleRow(data = null) {
    const container = document.getElementById('responsibles-container');
    const rowId = `resp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const name = data ? (data.name || '') : '';
    const email = data ? (data.email || '') : '';
    const phone = data ? (data.phone || '') : '';

    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.id = rowId;
    row.style.gridTemplateColumns = '1fr 1fr 1fr 42px';
    row.innerHTML = `
        <div>
            <input type="text" class="form-input resp-name" placeholder="Nome do Responsável *" value="${escapeHtml(name)}">
        </div>
        <div>
            <input type="email" class="form-input resp-email" placeholder="email@instituicao.com *" value="${escapeHtml(email)}">
        </div>
        <div>
            <input type="tel" class="form-input resp-phone" placeholder="(11) 99999-0000 *" value="${escapeHtml(phone)}">
        </div>
        <div>
            <button type="button" class="btn-remove-step" title="Remover Responsável">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `;

    row.querySelector('.btn-remove-step').addEventListener('click', () => {
        if (container.querySelectorAll('.schedule-row').length > 1) {
            container.removeChild(row);
        } else {
            Toast.show('O projeto deve ter ao menos um responsável.', 'warning');
        }
    });

    // Máscara dinâmica para o telefone
    row.querySelector('.resp-phone').addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.substring(0, 11);
        if (val.length > 10) val = val.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        else if (val.length > 6) val = val.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        else if (val.length > 2) val = val.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        e.target.value = val;
    });

    container.appendChild(row);
}

// Adiciona linha de local de execução dinâmico
function addLocationRow(data = null) {
    const container = document.getElementById('locations-container');
    const rowId = `loc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const name = data ? (typeof data === 'string' ? data : (data.name || '')) : '';

    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.id = rowId;
    row.style.gridTemplateColumns = '1fr 42px';
    row.innerHTML = `
        <div>
            <input type="text" class="form-input loc-name" placeholder="Ex: Laboratório Central - Bloco 3" value="${escapeHtml(name)}">
        </div>
        <div>
            <button type="button" class="btn-remove-step" title="Remover Local">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `;

    row.querySelector('.btn-remove-step').addEventListener('click', () => {
        if (container.querySelectorAll('.schedule-row').length > 1) {
            container.removeChild(row);
        } else {
            Toast.show('O projeto deve ter ao menos um local de execução.', 'warning');
        }
    });

    container.appendChild(row);
}

function addScheduleRow(data = null) {
    const container = document.getElementById('schedule-rows-container');
    const rowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const description = data ? data.description : '';
    const targetDate = data ? data.target_date : '';
    const status = data ? data.status : 'Pendente';

    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.id = rowId;
    row.innerHTML = `
        <div>
            <input type="text" class="form-input activity-desc" placeholder="Descrição da Etapa..." value="${escapeHtml(description)}" required>
        </div>
        <div>
            <input type="date" class="form-input activity-date" value="${targetDate}" required>
        </div>
        <div>
            <select class="form-select activity-status">
                <option value="Pendente" ${status === 'Pendente' ? 'selected' : ''}>Pendente</option>
                <option value="Em Andamento" ${status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
                <option value="Concluída" ${status === 'Concluída' ? 'selected' : ''}>Concluída</option>
            </select>
        </div>
        <div>
            <button type="button" class="btn-remove-step" title="Remover Etapa">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `;

    row.querySelector('.btn-remove-step').addEventListener('click', () => {
        container.removeChild(row);
    });

    container.appendChild(row);
}

// ==========================================================================
// MODAL DE DETALHES DO PROJETO & TIMELINE VISUAL
// ==========================================================================
async function openProjectDetailsModal(projectId) {
    try {
        const project = await api.getProjectById(projectId);
        state.currentDetailProject = project;

        document.getElementById('details-modal-name').textContent = project.name;
        
        // Tags
        const deadline = project.deadline_info || {};
        document.getElementById('details-modal-tags').innerHTML = `
            <span class="tag tag-classification">${escapeHtml(project.classification)}</span>
            <span class="tag tag-type">${escapeHtml(project.type)}</span>
            <span class="badge-deadline badge-${deadline.badgeColor}">${escapeHtml(deadline.label)}</span>
        `;

        // Banner de Alerta Crítico
        const banner = document.getElementById('details-alert-banner');
        banner.className = `details-alert-banner urgency-${deadline.status}`;
        banner.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div>
                <strong>${deadline.status === 'atrasado' ? 'Atenção Crítica: ' : 'Situação do Prazo: '}</strong>
                ${escapeHtml(deadline.message)}
            </div>
        `;

        // Informações de responsáveis com cards dedicados e dados de contato organizados
        const respList = document.getElementById('details-resp-list');
        const responsibles = project.responsibles && project.responsibles.length > 0
            ? project.responsibles
            : [{ name: project.responsible_name, email: project.responsible_email, phone: project.responsible_phone }];

        respList.innerHTML = responsibles.map(r => {
            const initials = r.name ? r.name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'R';
            return `
                <div class="resp-detail-card">
                    <div class="resp-avatar-badge">${initials}</div>
                    <div class="resp-info-block">
                        <div class="resp-name-title">${escapeHtml(r.name || 'Responsável não informado')}</div>
                        <div class="resp-contact-items">
                            ${r.email ? `
                                <div class="resp-contact-pill">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    <a href="mailto:${escapeHtml(r.email)}" title="Enviar e-mail">${escapeHtml(r.email)}</a>
                                </div>
                            ` : ''}
                            ${r.phone ? `
                                <div class="resp-contact-pill">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>${escapeHtml(r.phone)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Informações de locais com badges
        const locList = document.getElementById('details-location-list');
        const locations = project.locations && project.locations.length > 0
            ? project.locations
            : [{ name: project.location }];
        locList.innerHTML = locations.map(l => `
            <div class="location-badge-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${escapeHtml(l.name)}</span>
            </div>
        `).join('');

        // Período
        const startFmt = project.start_date ? project.start_date.split('-').reverse().join('/') : '-';
        const endFmt = project.end_date ? project.end_date.split('-').reverse().join('/') : '-';
        document.getElementById('details-period').textContent = `${startFmt} até ${endFmt}`;
        document.getElementById('details-objective').innerHTML = escapeHtmlMultiline(project.objective);

        const evalContainer = document.getElementById('details-eval-container');
        if (project.evaluation_analysis) {
            evalContainer.style.display = 'block';
            document.getElementById('details-evaluation').innerHTML = escapeHtmlMultiline(project.evaluation_analysis);
        } else {
            evalContainer.style.display = 'none';
        }

        // Renderiza Linha do Tempo Visual
        renderDetailsTimeline(project);

        document.getElementById('details-modal-overlay').classList.add('active');
    } catch (error) {
        Toast.show(error.message, 'error');
    }
}

function renderDetailsTimeline(project) {
    const timelineContainer = document.getElementById('details-timeline-container');
    timelineContainer.innerHTML = TimelineComponent.render(project.id, project.activities);

    TimelineComponent.bindEvents(timelineContainer, async (projectId, activityId, newStatus) => {
        try {
            const updated = await api.updateActivityStatus(projectId, activityId, newStatus);
            Toast.show('Status da etapa atualizado com sucesso!', 'success');
            // Atualiza a visualização da modal
            state.currentDetailProject = updated;
            renderDetailsTimeline(updated);
            // Recarrega o dashboard em segundo plano
            loadDashboard();
        } catch (error) {
            Toast.show(error.message, 'error');
        }
    });
}

function closeDetailsModal() {
    document.getElementById('details-modal-overlay').classList.remove('active');
    state.currentDetailProject = null;
}

// ==========================================================================
// MODAL DE VISUALIZAR E EDITAR ETAPAS (CRONOGRAMA)
// ==========================================================================
async function openProjectActivitiesModal(projectId) {
    try {
        const project = await api.getProjectById(projectId);
        if (!project) throw new Error('Projeto não encontrado.');

        state.currentActivitiesProjectId = projectId;
        document.getElementById('activities-modal-project-name').textContent = project.name;

        const activities = project.activities || [];
        const completedCount = activities.filter(a => a.status === 'Concluída').length;
        const totalCount = activities.length;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (project.status === 'Concluído' ? 100 : 0);

        document.getElementById('activities-progress-label').textContent = `${completedCount} de ${totalCount} etapas concluídas`;
        document.getElementById('activities-progress-percent').textContent = `${percent}%`;
        document.getElementById('activities-progress-fill').style.width = `${percent}%`;

        const container = document.getElementById('activities-modal-rows');
        container.innerHTML = '';

        if (activities.length === 0) {
            addActivityModalRow();
        } else {
            activities.forEach((act) => {
                addActivityModalRow(act.description, act.target_date, act.status);
            });
        }

        document.getElementById('activities-modal-overlay').classList.add('active');
    } catch (error) {
        Toast.show(error.message, 'error');
    }
}

function closeProjectActivitiesModal() {
    document.getElementById('activities-modal-overlay').classList.remove('active');
    state.currentActivitiesProjectId = null;
}

function addActivityModalRow(desc = '', date = '', status = 'Pendente') {
    const container = document.getElementById('activities-modal-rows');
    const index = container.children.length + 1;
    const row = document.createElement('div');
    row.className = 'activity-edit-row';
    row.innerHTML = `
        <div class="activity-index-badge">${index}</div>
        <input type="text" class="form-input activity-modal-desc" placeholder="Descrição da etapa..." value="${escapeHtml(desc)}" required>
        <input type="date" class="form-input activity-modal-date" value="${date}" required>
        <select class="form-select activity-modal-status">
            <option value="Pendente" ${status === 'Pendente' ? 'selected' : ''}>Pendente</option>
            <option value="Em Andamento" ${status === 'Em Andamento' ? 'selected' : ''}>Em Andamento</option>
            <option value="Concluída" ${status === 'Concluída' ? 'selected' : ''}>Concluída</option>
        </select>
        <button type="button" class="btn-remove-step" title="Remover Etapa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    `;

    row.querySelector('.btn-remove-step').addEventListener('click', () => {
        container.removeChild(row);
        Array.from(container.children).forEach((r, i) => {
            const badge = r.querySelector('.activity-index-badge');
            if (badge) badge.textContent = i + 1;
        });
    });

    container.appendChild(row);
}

async function saveProjectActivitiesModal() {
    if (!state.currentActivitiesProjectId) return;
    const projectId = state.currentActivitiesProjectId;
    const rows = document.querySelectorAll('#activities-modal-rows .activity-edit-row');
    const activities = [];

    rows.forEach(row => {
        const desc = row.querySelector('.activity-modal-desc').value.trim();
        const date = row.querySelector('.activity-modal-date').value;
        const status = row.querySelector('.activity-modal-status').value;
        if (desc && date) {
            activities.push({ description: desc, target_date: date, status });
        }
    });

    if (activities.length === 0) {
        Toast.show('O cronograma deve possuir pelo menos uma etapa com descrição e data.', 'warning');
        return;
    }

    try {
        const project = await api.getProjectById(projectId);
        const payload = {
            name: project.name,
            classification: project.classification,
            type: project.type,
            projectDate: project.project_date,
            startDate: project.start_date,
            endDate: project.end_date,
            objective: project.objective,
            evaluationAnalysis: project.evaluation_analysis,
            responsibles: project.responsibles || [{ name: project.responsible_name, email: project.responsible_email, phone: project.responsible_phone }],
            locations: project.locations ? project.locations.map(l => l.name) : [project.location],
            activities: activities
        };

        await api.updateProject(projectId, payload);
        Toast.show('Etapas do cronograma atualizadas com sucesso!', 'success');
        closeProjectActivitiesModal();

        // Se o modal de detalhes estiver aberto, atualiza-o
        if (state.currentDetailProject && state.currentDetailProject.id === projectId) {
            openProjectDetailsModal(projectId);
        }
        loadDashboard();
    } catch (error) {
        Toast.show(error.message, 'error');
    }
}

// ==========================================================================
// EXPORTAÇÃO DO PROJETO EM PDF
// ==========================================================================
async function exportProjectToPdf(projectId) {
    try {
        const project = await api.getProjectById(projectId);
        if (!project) throw new Error('Projeto não encontrado para exportação.');

        const deadline = project.deadline_info || {};
        const activities = project.activities || [];
        const responsibles = project.responsibles && project.responsibles.length > 0
            ? project.responsibles
            : [{ name: project.responsible_name, email: project.responsible_email, phone: project.responsible_phone }];
        const locations = project.locations && project.locations.length > 0
            ? project.locations
            : [{ name: project.location }];

        const completedCount = activities.filter(a => a.status === 'Concluída').length;
        const totalCount = activities.length;
        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (project.status === 'Concluído' ? 100 : 0);

        const startDateFmt = project.start_date ? project.start_date.split('-').reverse().join('/') : '-';
        const endDateFmt = project.end_date ? project.end_date.split('-').reverse().join('/') : '-';
        const emissionDate = new Date().toLocaleString('pt-BR');

        // Cria iframe temporário para gerar impressão sem afetar o layout
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Relatório do Projeto - ${escapeHtml(project.name)}</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                    body { color: #1e293b; background: #ffffff; font-size: 11pt; line-height: 1.45; }
                    
                    .header { border-bottom: 2px solid #0b4628; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; }
                    .header-brand-block { display: flex; align-items: center; gap: 14px; }
                    .header-logo { height: 48px; width: auto; display: block; object-fit: contain; }
                    .brand { font-size: 15pt; font-weight: 800; color: #0b4628; line-height: 1.2; }
                    .brand-sub { font-size: 8.5pt; color: #64748b; font-weight: 500; margin-top: 2px; }
                    .emission-meta { font-size: 8.5pt; color: #64748b; text-align: right; }

                    .title-section { margin-bottom: 16px; }
                    .project-title { font-size: 16pt; font-weight: 700; color: #0b4628; margin-bottom: 6px; }
                    .tag-row { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; }
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 8pt; font-weight: 700; text-transform: uppercase; }
                    .badge-indigo { background: #dcfce7; color: #0b4628; }
                    .badge-sky { background: #ffedd5; color: #c25e0a; }
                    .badge-danger { background: #fee2e2; color: #991b1b; }
                    .badge-warning { background: #fef3c7; color: #92400e; }
                    .badge-success { background: #d1fae5; color: #065f46; }
                    .badge-info { background: #e0f2fe; color: #075985; }

                    .deadline-box { background: #f8fafc; border-left: 4px solid #0b4628; padding: 8px 12px; border-radius: 4px; font-size: 9.5pt; margin-bottom: 16px; }
                    .deadline-box.atrasado { border-left-color: #ef4444; background: #fef2f2; color: #991b1b; }
                    .deadline-box.alerta { border-left-color: #f59e0b; background: #fffbeb; color: #92400e; }
                    .deadline-box.concluido { border-left-color: #10b981; background: #ecfdf5; color: #065f46; }

                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
                    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
                    .info-card h4 { font-size: 8.5pt; text-transform: uppercase; color: #64748b; margin-bottom: 6px; font-weight: 700; letter-spacing: 0.03em; }
                    .info-card p { font-size: 9.5pt; color: #1e293b; }

                    .resp-item, .loc-item { margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #cbd5e1; }
                    .resp-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
                    .resp-item strong { font-size: 9.5pt; color: #0f172a; }
                    .resp-sub { font-size: 8.5pt; color: #475569; }
                    .loc-item { font-size: 9.5pt; color: #1e293b; line-height: 1.35; }
                    .period-item { margin-top: 6px; font-size: 9.5pt; color: #1e293b; }

                    .progress-box { margin-bottom: 16px; }
                    .progress-header { display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; }
                    .progress-bar-bg { width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
                    .progress-bar-fill { height: 100%; background: #0b4628; border-radius: 4px; width: ${percent}%; }

                    .section-heading { font-size: 11pt; font-weight: 700; color: #0b4628; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 9pt; }
                    th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; }
                    td { padding: 6px 8px; border: 1px solid #e2e8f0; color: #1e293b; }
                    tr:nth-child(even) { background: #f8fafc; }

                    .signature-section { margin-top: 35px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; page-break-inside: avoid; }
                    .sig-line { border-top: 1px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 8.5pt; color: #475569; }

                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-brand-block">
                        <img src="${window.location.origin}/img/logo-branco-peres-print.png" alt="Branco Peres Agribusiness" class="header-logo">
                        <div>
                            <div class="brand">Branco Peres Agribusiness</div>
                            <div class="brand-sub">Poma &bull; Inteligência Agrícola</div>
                        </div>
                    </div>
                    <div class="emission-meta">
                        <div>Relatório Técnico de Projeto</div>
                        <div>Emitido em: ${emissionDate}</div>
                    </div>
                </div>

                <div class="title-section">
                    <h1 class="project-title">${escapeHtml(project.name)}</h1>
                    <div class="tag-row">
                        <span class="badge badge-indigo">${escapeHtml(project.classification)}</span>
                        <span class="badge badge-sky">${escapeHtml(project.type)}</span>
                        <span class="badge badge-${deadline.badgeColor}">${escapeHtml(deadline.label)}</span>
                    </div>
                    <div class="deadline-box ${deadline.status}">
                        <strong>Situação do Prazo:</strong> ${escapeHtml(deadline.message)}
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-card">
                        <h4>Responsável(eis) pelo Projeto</h4>
                        ${responsibles.map(r => `
                            <div class="resp-item">
                                <div><strong>${escapeHtml(r.name || 'Não informado')}</strong></div>
                                <div class="resp-sub">${escapeHtml(r.email || '-')}${r.phone ? ' &bull; ' + escapeHtml(r.phone) : ''}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="info-card">
                        <h4>Local(ais) e Período de Execução</h4>
                        ${locations.map(l => `
                            <div class="loc-item">
                                <div>${escapeHtml(l.name || 'Não informado')}</div>
                            </div>
                        `).join('')}
                        <div class="period-item">
                            <strong>Período:</strong> ${startDateFmt} até ${endDateFmt}
                        </div>
                    </div>
                </div>

                <div class="info-card" style="margin-bottom: 16px;">
                    <h4>Objetivo do Projeto</h4>
                    <p style="white-space: pre-wrap;">${escapeHtmlMultiline(project.objective)}</p>
                </div>

                ${project.evaluation_analysis ? `
                <div class="info-card" style="margin-bottom: 16px;">
                    <h4>Critérios de Avaliação e Análise</h4>
                    <p style="white-space: pre-wrap;">${escapeHtmlMultiline(project.evaluation_analysis)}</p>
                </div>
                ` : ''}

                <div class="progress-box">
                    <div class="progress-header">
                        <span>Progresso do Cronograma</span>
                        <span>${completedCount} de ${totalCount} etapas concluídas (${percent}%)</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill"></div>
                    </div>
                </div>

                <div class="section-heading">Cronograma Detalhado de Etapas</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px; text-align: center;">#</th>
                            <th>Descrição da Etapa</th>
                            <th style="width: 100px; text-align: center;">Previsão</th>
                            <th style="width: 110px; text-align: center;">Status</th>
                            <th style="width: 120px; text-align: center;">Situação Prazo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activities.length > 0 ? activities.map((act, idx) => {
                            const actDate = act.target_date ? act.target_date.split('-').reverse().join('/') : '-';
                            const actDeadline = act.deadline_info || {};
                            return `
                                <tr>
                                    <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                                    <td>${escapeHtml(act.description)}</td>
                                    <td style="text-align: center;">${actDate}</td>
                                    <td style="text-align: center;"><strong>${escapeHtml(act.status)}</strong></td>
                                    <td style="text-align: center;">${escapeHtml(actDeadline.label || '-')}</td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="5" style="text-align: center; color: #64748b; padding: 12px;">Nenhuma etapa cadastrada neste cronograma.</td>
                            </tr>
                        `}
                    </tbody>
                </table>

                <div class="signature-section">
                    <div class="sig-line">
                        <strong>${escapeHtml(responsibles[0]?.name || 'Responsável Técnico')}</strong>
                        <div>Assinatura do Responsável</div>
                    </div>
                    <div class="sig-line">
                        <strong>Branco Peres Agribusiness</strong>
                        <div>Validação e Controle Operacional • Metodologia PAAM</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        doc.close();

        const triggerPrint = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        };

        const logoImg = doc.querySelector('.header-logo');
        if (logoImg && !logoImg.complete) {
            logoImg.onload = () => setTimeout(triggerPrint, 150);
            logoImg.onerror = () => setTimeout(triggerPrint, 150);
        } else {
            setTimeout(triggerPrint, 300);
        }

    } catch (error) {
        Toast.show('Erro ao exportar PDF: ' + error.message, 'error');
    }
}

async function confirmDeleteProject(projectId, projectName) {
    if (confirm(`Tem certeza que deseja excluir o projeto "${projectName}"?\nTodas as atividades do cronograma serão removidas definitivamente.`)) {
        try {
            await api.deleteProject(projectId);
            Toast.show('Projeto excluído com sucesso.', 'success');
            loadDashboard();
        } catch (error) {
            Toast.show(error.message, 'error');
        }
    }
}

// ==========================================================================
// EVENT BINDINGS
// ==========================================================================
function bindGlobalEvents() {
    // 1. Auth Tabs
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const fieldName = document.getElementById('field-name-container');
    const authBtn = document.getElementById('btn-auth-submit');
    const authSubtitle = document.getElementById('auth-subtitle');

    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        fieldName.style.display = 'none';
        authBtn.textContent = 'Entrar no Sistema';
        authSubtitle.textContent = 'Acesse seu painel integrado de projetos';
    });

    tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        fieldName.style.display = 'block';
        authBtn.textContent = 'Criar Nova Conta';
        authSubtitle.textContent = 'Cadastre-se para gerenciar seus projetos';
    });

    // 2. Demo Fill
    document.getElementById('btn-fill-demo').addEventListener('click', () => {
        document.getElementById('auth-email').value = 'demo@cesinha.com';
        document.getElementById('auth-password').value = 'demo123';
        Toast.show('Dados de demonstração preenchidos!', 'info');
    });

    // 3. Auth Submit
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const isRegister = tabRegister.classList.contains('active');
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        try {
            if (isRegister) {
                await api.register(name, email, password);
                Toast.show('Conta criada com sucesso! Bem-vindo.', 'success');
            } else {
                await api.login(email, password);
                Toast.show('Login efetuado com sucesso!', 'success');
            }
            state.currentUser = api.getUser();
            renderAuthenticatedUI();
            loadDashboard();
        } catch (error) {
            Toast.show(error.message, 'error');
        }
    });

    // 4. Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        api.logout();
        renderAuthView();
        Toast.show('Sessão encerrada.', 'info');
    });

    // 5. Notifications Bell Dropdown
    const notifBtn = document.getElementById('btn-notifications');
    const notifDropdown = document.getElementById('notification-dropdown');
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.remove('active');
        }
    });

    // 6. Project Modal Controls
    document.getElementById('btn-open-create-modal').addEventListener('click', openCreateProjectModal);
    document.getElementById('btn-close-project-modal').addEventListener('click', closeProjectModal);
    document.getElementById('btn-cancel-project-modal').addEventListener('click', closeProjectModal);
    document.getElementById('btn-add-activity-row').addEventListener('click', () => addScheduleRow());
    document.getElementById('btn-add-responsible-row').addEventListener('click', () => addResponsibleRow());
    document.getElementById('btn-add-location-row').addEventListener('click', () => addLocationRow());

    // 6b. Theme Toggle (sincroniza todos os botões de alternância)
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => ThemeManager.toggle());
    });

    // Máscara dinâmica para o telefone (legado — mantida por compatibilidade com futuras versões)
    // A máscara agora é aplicada individualmente em cada linha de responsável via addResponsibleRow()

    // 7. Salvar Projeto (Submit do formulário)
    document.getElementById('project-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Extrai responsáveis
        const responsibleRows = document.querySelectorAll('#responsibles-container .schedule-row');
        const responsibles = [];
        responsibleRows.forEach(row => {
            const name = row.querySelector('.resp-name').value.trim();
            const email = row.querySelector('.resp-email').value.trim();
            const phone = row.querySelector('.resp-phone').value.trim();
            if (name || email) {
                responsibles.push({ name, email, phone });
            }
        });

        // Extrai locais
        const locationRows = document.querySelectorAll('#locations-container .schedule-row');
        const locations = [];
        locationRows.forEach(row => {
            const name = row.querySelector('.loc-name').value.trim();
            if (name) locations.push(name);
        });

        // Extrai atividades do cronograma dinâmico
        const scheduleRows = document.querySelectorAll('#schedule-rows-container .schedule-row');
        const activities = [];
        scheduleRows.forEach(row => {
            const desc = row.querySelector('.activity-desc').value.trim();
            const date = row.querySelector('.activity-date').value;
            const status = row.querySelector('.activity-status').value;
            if (desc && date) {
                activities.push({
                    description: desc,
                    target_date: date,
                    status: status
                });
            }
        });

        const projectPayload = {
            name: document.getElementById('proj-name').value,
            projectDate: document.getElementById('proj-date').value,
            classification: document.getElementById('proj-classification').value,
            type: document.getElementById('proj-type').value,
            responsibles: responsibles,
            locations: locations,
            objective: document.getElementById('proj-objective').value,
            startDate: document.getElementById('proj-start-date').value,
            endDate: document.getElementById('proj-end-date').value,
            evaluationAnalysis: document.getElementById('proj-evaluation').value,
            activities: activities
        };

        // Validações client-side antes de chamar a API
        if (responsibles.length === 0) {
            Toast.show('Adicione pelo menos um responsável ao projeto.', 'error');
            return;
        }
        if (locations.length === 0) {
            Toast.show('Adicione pelo menos um local de execução ao projeto.', 'error');
            return;
        }
        if (projectPayload.startDate && projectPayload.endDate && new Date(projectPayload.startDate) > new Date(projectPayload.endDate)) {
            Toast.show('A Data de Início não pode ser posterior à Previsão de Término.', 'error');
            return;
        }

        try {
            if (state.editingProjectId) {
                await api.updateProject(state.editingProjectId, projectPayload);
                Toast.show('Projeto atualizado com sucesso!', 'success');
            } else {
                await api.createProject(projectPayload);
                Toast.show('Projeto cadastrado com sucesso!', 'success');
            }
            closeProjectModal();
            loadDashboard();
        } catch (error) {
            Toast.show(error.message, 'error');
        }
    });

    // 8. Details Modal Controls
    document.getElementById('btn-close-details-modal').addEventListener('click', closeDetailsModal);
    document.getElementById('btn-close-details-action').addEventListener('click', closeDetailsModal);
    document.getElementById('btn-edit-from-details').addEventListener('click', () => {
        if (state.currentDetailProject) {
            const id = state.currentDetailProject.id;
            closeDetailsModal();
            openEditProjectModal(id);
        }
    });

    // 8b. Botões de PDF e Gestão de Etapas no Modal de Detalhes
    document.getElementById('btn-export-pdf-details').addEventListener('click', () => {
        if (state.currentDetailProject) {
            exportProjectToPdf(state.currentDetailProject.id);
        }
    });

    document.getElementById('btn-quick-manage-activities').addEventListener('click', () => {
        if (state.currentDetailProject) {
            openProjectActivitiesModal(state.currentDetailProject.id);
        }
    });

    // 8c. Controles do Modal de Etapas
    document.getElementById('btn-close-activities-modal').addEventListener('click', closeProjectActivitiesModal);
    document.getElementById('btn-cancel-activities-modal').addEventListener('click', closeProjectActivitiesModal);
    document.getElementById('btn-save-activities-modal').addEventListener('click', saveProjectActivitiesModal);
    document.getElementById('btn-add-activity-modal-row').addEventListener('click', () => addActivityModalRow());

    // 9. Filters & Debounced Search
    const searchInput = document.getElementById('filter-search');
    let searchDebounceTimeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            state.filters.search = e.target.value.trim();
            loadDashboard();
        }, 300);
    });

    document.getElementById('filter-classification').addEventListener('change', (e) => {
        state.filters.classification = e.target.value;
        loadDashboard();
    });

    document.getElementById('filter-type').addEventListener('change', (e) => {
        state.filters.type = e.target.value;
        loadDashboard();
    });

    document.getElementById('filter-deadline').addEventListener('change', (e) => {
        state.filters.deadline_status = e.target.value;
        loadDashboard();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        state.filters = { classification: '', type: '', deadline_status: '', search: '' };
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-classification').value = '';
        document.getElementById('filter-type').value = '';
        document.getElementById('filter-deadline').value = '';
        loadDashboard();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escapa HTML (anti-XSS) e converte quebras de linha (\n) em <br>
 * para exibição correta de campos textarea em contextos innerHTML.
 */
function escapeHtmlMultiline(str) {
    if (!str) return '';
    return escapeHtml(str).replace(/\n/g, '<br>');
}

