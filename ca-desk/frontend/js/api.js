// CA Desk Client API Layer
const API = {
    BASE_URL: '/api',

    getToken() {
        return localStorage.getItem('cadesk_token');
    },

    setToken(token) {
        localStorage.setItem('cadesk_token', token);
    },

    clearToken() {
        localStorage.removeItem('cadesk_token');
        localStorage.removeItem('cadesk_user');
    },

    getCurrentStoredUser() {
        try {
            const raw = localStorage.getItem('cadesk_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    setCurrentStoredUser(user) {
        localStorage.setItem('cadesk_user', JSON.stringify(user));
    },

    async request(endpoint, options = {}, isRetry = false) {
        const headers = options.headers || {};
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Auto JSON header if not FormData
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            ...options,
            headers
        };

        try {
            let response = await fetch(`${this.BASE_URL}${endpoint}`, config);

            // Handle 401 Unauthorized or 403 Forbidden (expired or invalid token)
            if ((response.status === 401 || response.status === 403) && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/switch-demo-user')) {
                console.warn(`[CA Desk API] Session expired or rejected (${response.status}) on ${endpoint}. Auto-renewing demo session...`);
                const storedUser = this.getCurrentStoredUser();
                this.clearToken();

                try {
                    let reAuthSuccess = false;
                    // First try restoring session for the active demo user
                    if (storedUser && storedUser.id) {
                        const switchRes = await fetch(`${this.BASE_URL}/auth/switch-demo-user`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: storedUser.id })
                        });
                        const sData = await switchRes.json();
                        if (sData.success && sData.token) {
                            this.setToken(sData.token);
                            this.setCurrentStoredUser(sData.user);
                            reAuthSuccess = true;
                        }
                    }

                    // Fallback to default Managing Partner login
                    if (!reAuthSuccess) {
                        const loginRes = await fetch(`${this.BASE_URL}/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: 'rajesh@sharmaca.in', password: 'admin123' })
                        });
                        const lData = await loginRes.json();
                        if (lData.success && lData.token) {
                            this.setToken(lData.token);
                            this.setCurrentStoredUser(lData.user);
                            reAuthSuccess = true;
                        }
                    }

                    if (reAuthSuccess) {
                        return await this.request(endpoint, options, true);
                    }
                } catch (reAuthErr) {
                    console.error('[CA Desk API] Session recovery failed:', reAuthErr);
                }
            }

            const data = await response.json().catch(() => ({ success: false, message: 'Invalid response from server' }));

            if (!response.ok && !data.success) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // Auth
    async getHealth() {
        return this.request('/health');
    },

    async login(email, password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (res.token) {
            this.setToken(res.token);
            this.setCurrentStoredUser(res.user);
        }
        return res;
    },

    async getMe() {
        return this.request('/auth/me');
    },

    async getStaff() {
        return this.request('/auth/staff');
    },

    async switchDemoUser(userId) {
        const res = await this.request('/auth/switch-demo-user', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
        if (res.token) {
            this.setToken(res.token);
            this.setCurrentStoredUser(res.user);
        }
        return res;
    },

    // Dashboard
    async getDashboardMetrics() {
        return this.request('/dashboard/metrics');
    },

    // Clients
    async getClients(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/clients${query ? '?' + query : ''}`);
    },

    async getClientById(id) {
        return this.request(`/clients/${id}`);
    },

    async createClient(clientData) {
        return this.request('/clients', {
            method: 'POST',
            body: JSON.stringify(clientData)
        });
    },

    async updateClient(id, updates) {
        return this.request(`/clients/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteClient(id) {
        return this.request(`/clients/${id}`, { method: 'DELETE' });
    },

    async getClientActivity(id) {
        return this.request(`/clients/${id}/activity`);
    },

    // Integrated TaxWise
    async getTaxConfig() {
        return this.request('/tax/config');
    },

    async calculateTax(payload) {
        return this.request('/tax/calculate', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async simulateTax(payload) {
        return this.request('/tax/simulate', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async saveCalculation(payload) {
        return this.request('/tax/save', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async getClientCalculations(clientId) {
        return this.request(`/tax/client/${clientId}`);
    },

    async getAllCalculations() {
        return this.request('/tax/all');
    },

    async getCalculationById(id) {
        return this.request(`/tax/${id}`);
    },

    async updateCalculationStatus(id, status, notes) {
        return this.request(`/tax/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, notes })
        });
    },

    async getCalculationReport(id) {
        return this.request(`/tax/${id}/report`);
    },

    async getLegacyCalculations() {
        return this.request('/tax/legacy');
    },

    // Tasks
    async getTasks(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/tasks${query ? '?' + query : ''}`);
    },

    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    },

    async updateTask(id, updates) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, { method: 'DELETE' });
    },

    // Documents
    async getDocuments(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/documents${query ? '?' + query : ''}`);
    },

    async uploadDocument(formDataOrJson) {
        const isForm = formDataOrJson instanceof FormData;
        return this.request('/documents/upload', {
            method: 'POST',
            body: isForm ? formDataOrJson : JSON.stringify(formDataOrJson)
        });
    },

    async updateDocumentStatus(id, reviewStatus, notes) {
        return this.request(`/documents/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ reviewStatus, notes })
        });
    },

    async deleteDocument(id) {
        return this.request(`/documents/${id}`, { method: 'DELETE' });
    },

    // Compliance
    async getCompliance(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/compliance${query ? '?' + query : ''}`);
    },

    async createCompliance(complianceData) {
        return this.request('/compliance', {
            method: 'POST',
            body: JSON.stringify(complianceData)
        });
    },

    async updateComplianceStatus(id, status, notes) {
        return this.request(`/compliance/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, notes })
        });
    },

    // Billing
    async getInvoices(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/billing/invoices${query ? '?' + query : ''}`);
    },

    async getInvoiceById(id) {
        return this.request(`/billing/invoices/${id}`);
    },

    async createInvoice(invoiceData) {
        return this.request('/billing/invoices', {
            method: 'POST',
            body: JSON.stringify(invoiceData)
        });
    },

    async recordPayment(invoiceId, paymentData) {
        return this.request(`/billing/invoices/${invoiceId}/payment`, {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    },

    // Alerts
    async getAlerts() {
        return this.request('/alerts');
    },

    async markAlertRead(id) {
        return this.request(`/alerts/${id}/read`, { method: 'PATCH' });
    },

    async markAllAlertsRead() {
        return this.request('/alerts/read-all', { method: 'POST' });
    },

    // Reports
    async getReportsSummary() {
        return this.request('/reports/summary');
    }
};

window.API = API;
