class ApiClient {
    constructor() {
        this.baseUrl = '/api';
    }

    getToken() {
        return localStorage.getItem('nexus_token');
    }

    setToken(token) {
        if (token) {
            localStorage.setItem('nexus_token', token);
        } else {
            localStorage.removeItem('nexus_token');
        }
    }

    getUser() {
        const raw = localStorage.getItem('nexus_user');
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    setUser(user) {
        if (user) {
            localStorage.setItem('nexus_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('nexus_user');
        }
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                this.setToken(null);
                this.setUser(null);
                window.dispatchEvent(new CustomEvent('auth:expired'));
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            const data = await response.json();
            if (!response.ok || data.success === false) {
                throw new Error(data.error || 'Ocorreu um erro na requisição.');
            }

            return data;
        } catch (error) {
            console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error.message);
            throw error;
        }
    }

    // Auth endpoints
    async login(email, password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.setToken(res.data.token);
        this.setUser(res.data.user);
        return res.data;
    }

    async register(name, email, password) {
        const res = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        this.setToken(res.data.token);
        this.setUser(res.data.user);
        return res.data;
    }

    logout() {
        this.setToken(null);
        this.setUser(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }

    // Project endpoints
    async getProjects(filters = {}) {
        const params = new URLSearchParams();
        if (filters.classification) params.append('classification', filters.classification);
        if (filters.type) params.append('type', filters.type);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);
        if (filters.deadline_status) params.append('deadline_status', filters.deadline_status);

        const queryString = params.toString() ? `?${params.toString()}` : '';
        const res = await this.request(`/projects${queryString}`);
        return res.data;
    }

    async getProjectById(id) {
        const res = await this.request(`/projects/${id}`);
        return res.data;
    }

    async createProject(projectData) {
        const res = await this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(projectData)
        });
        return res.data;
    }

    async updateProject(id, projectData) {
        const res = await this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(projectData)
        });
        return res.data;
    }

    async deleteProject(id) {
        const res = await this.request(`/projects/${id}`, {
            method: 'DELETE'
        });
        return res;
    }

    async updateActivityStatus(projectId, activityId, status) {
        const res = await this.request(`/projects/${projectId}/activities/${activityId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        return res.data;
    }
}

const api = new ApiClient();
