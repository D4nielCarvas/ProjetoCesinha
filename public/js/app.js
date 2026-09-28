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
    currentDetailProject: null
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
        const iconDark = document.getElementById('theme-icon-dark');
        const iconLight = document.getElementById('theme-icon-light');
        if (!iconDark || !iconLight) return;
        if (theme === this.LIGHT) {
            iconDark.style.display = 'block';
            iconLight.style.display = 'none';
        } else {
            iconDark.style.display = 'none';
            iconLight.style.display = 'block';
        }
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
                    <p class="card-objective">${escapeHtml(project.objective)}</p>

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
                    <button class="btn btn-secondary btn-sm" onclick="openProjectDetailsModal(${project.id})">
                        Ver Detalhes
                    </button>
                    <div style="display: flex; gap: 0.4rem;">
                        <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal(${project.id})" title="Editar Projeto">
                            Editar
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="confirmDeleteProject(${project.id}, '${escapeHtml(project.name)}')" title="Excluir Projeto">
                            Excluir
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

        // Informações de responsáveis
        const respList = document.getElementById('details-resp-list');
        const responsibles = project.responsibles && project.responsibles.length > 0
            ? project.responsibles
            : [{ name: project.responsible_name, email: project.responsible_email, phone: project.responsible_phone }];
        respList.innerHTML = responsibles.map((r, i) => `
            <div style="margin-bottom: ${i < responsibles.length - 1 ? '0.6rem' : '0'}; padding-bottom: ${i < responsibles.length - 1 ? '0.6rem' : '0'}; border-bottom: ${i < responsibles.length - 1 ? '1px solid var(--color-border)' : 'none'}">
                <div style="font-weight: 600; font-size: 0.92rem;">${escapeHtml(r.name)}</div>
                <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.15rem;">
                    <a href="mailto:${escapeHtml(r.email)}" style="color: var(--color-primary-500); text-decoration: underline;">${escapeHtml(r.email)}</a>
                    ${r.phone ? ' &bull; ' + escapeHtml(r.phone) : ''}
                </div>
            </div>
        `).join('');

        // Informações de locais
        const locList = document.getElementById('details-location-list');
        const locations = project.locations && project.locations.length > 0
            ? project.locations
            : [{ name: project.location }];
        locList.innerHTML = locations.map((l, i) => `
            <div style="font-size: 0.92rem; font-weight: 500; margin-bottom: ${i < locations.length - 1 ? '0.35rem' : '0'};">📍 ${escapeHtml(l.name)}</div>
        `).join('');

        // Período
        const startFmt = project.start_date ? project.start_date.split('-').reverse().join('/') : '-';
        const endFmt = project.end_date ? project.end_date.split('-').reverse().join('/') : '-';
        document.getElementById('details-period').textContent = `${startFmt} até ${endFmt}`;
        document.getElementById('details-objective').textContent = project.objective;

        const evalContainer = document.getElementById('details-eval-container');
        if (project.evaluation_analysis) {
            evalContainer.style.display = 'block';
            document.getElementById('details-evaluation').textContent = project.evaluation_analysis;
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

    // 6b. Theme Toggle
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => ThemeManager.toggle());
    }

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
