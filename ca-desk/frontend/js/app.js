// CA Desk Main Application Controller
(function() {
    'use strict';

    // Application Global State
    const state = {
        currentUser: null,
        staffList: [],
        currentRoute: 'dashboard',
        routeParams: {},
        activeClientTab: 'overview',
        clients: [],
        activeClient: null,
        taxConfig: null,
        lastTaxCalculation: null,
        unreadAlertsCount: 0
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Helper: Format INR currency
    function formatINR(amount) {
        if (amount == null || isNaN(amount)) return '₹0';
        return '₹' + Number(amount).toLocaleString('en-IN');
    }

    // Helper: Format Date
    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
    }

    // Toast notification manager
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span style="font-weight: 600;">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    // Modal Manager
    function openModal(title, bodyHtml, footerHtml = '') {
        const overlay = document.getElementById('app-modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');

        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalFooter.innerHTML = footerHtml;
        overlay.classList.add('active');
    }

    function closeModal() {
        const overlay = document.getElementById('app-modal-overlay');
        overlay.classList.remove('active');
    }

    // Simple Hash Router
    function navigateTo(route, params = {}) {
        state.currentRoute = route;
        state.routeParams = params;
        window.location.hash = `#${route}` + (params.id ? `/${params.id}` : '');
        renderApp();
    }

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        const parts = hash.split('/');
        state.currentRoute = parts[0] || 'dashboard';
        state.routeParams = parts[1] ? { id: parts[1] } : {};
        renderApp();
    }

    // Authentication Init
    async function initAuth() {
        let user = API.getCurrentStoredUser();
        let token = API.getToken();

        let validSession = false;
        if (token && user) {
            try {
                const meRes = await API.getMe();
                if (meRes && meRes.success && meRes.user) {
                    validSession = true;
                    user = meRes.user;
                }
            } catch (err) {
                console.warn('Existing session token rejected. Refreshing session...', err);
            }
        }

        if (!validSession) {
            API.clearToken();
            try {
                if (user && user.id) {
                    const switchRes = await API.switchDemoUser(user.id);
                    if (switchRes && switchRes.success) {
                        user = switchRes.user;
                        validSession = true;
                    }
                }
                if (!validSession) {
                    const res = await API.login('rajesh@sharmaca.in', 'admin123');
                    user = res.user;
                }
            } catch (err) {
                console.warn('Auto login demo fallback:', err);
            }
        }
        state.currentUser = user;

        try {
            const staffRes = await API.getStaff();
            if (staffRes.success) {
                state.staffList = staffRes.data;
            }
            const configRes = await API.getTaxConfig();
            if (configRes.success) {
                state.taxConfig = configRes;
            }
            const alertRes = await API.getAlerts();
            if (alertRes.success) {
                state.unreadAlertsCount = alertRes.unreadCount || 0;
            }
        } catch (e) {
            console.error('Initialization error:', e);
        }
    }

    // Main Render Switcher
    async function renderApp() {
        updateSidebarNav();
        updateTopbar();

        const contentEl = document.getElementById('workspace-content');
        if (!contentEl) return;

        contentEl.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; min-height:300px; color:var(--text-muted);">
                <div style="text-align:center;">
                    <div style="display:inline-block; width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                    <div style="margin-top:12px; font-weight:500;">Loading CA Desk...</div>
                </div>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;

        try {
            switch (state.currentRoute) {
                case 'dashboard':
                    await renderDashboard(contentEl);
                    break;
                case 'clients':
                    if (state.routeParams.id) {
                        await renderClientWorkspace(contentEl, state.routeParams.id);
                    } else {
                        await renderClientsList(contentEl);
                    }
                    break;
                case 'taxwise':
                    await renderTaxWiseGlobal(contentEl);
                    break;
                case 'tasks':
                    await renderTasksPage(contentEl);
                    break;
                case 'documents':
                    await renderDocumentsPage(contentEl);
                    break;
                case 'compliance':
                    await renderCompliancePage(contentEl);
                    break;
                case 'billing':
                    await renderBillingPage(contentEl);
                    break;
                case 'alerts':
                    await renderAlertsPage(contentEl);
                    break;
                case 'reports':
                    await renderReportsPage(contentEl);
                    break;
                case 'settings':
                    await renderSettingsPage(contentEl);
                    break;
                default:
                    await renderDashboard(contentEl);
            }
        } catch (err) {
            console.error('Render error:', err);
            const isAuthErr = err.message && (err.message.includes('token') || err.message.includes('session') || err.message.includes('sign in') || err.message.includes('401') || err.message.includes('403'));
            contentEl.innerHTML = `
                <div class="card" style="border-left: 4px solid var(--danger); max-width:600px; margin:20px 0;">
                    <h3 style="color:var(--danger); margin-bottom:8px;">Failed to load view</h3>
                    <p style="color:var(--text-secondary); line-height:1.5;">${escapeHtml(err.message)}</p>
                    <div style="margin-top:16px; display:flex; gap:12px;">
                        <button class="btn btn-primary btn-sm" onclick="API.clearToken(); location.reload();">Reset Session & Reload</button>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Reload Page</button>
                    </div>
                </div>
            `;
        }
    }

    // Topbar update
    function updateTopbar() {
        const roleSwitcher = document.getElementById('role-switcher-select');
        if (roleSwitcher && state.staffList.length > 0) {
            roleSwitcher.innerHTML = state.staffList.map(s => `
                <option value="${s.id}" ${state.currentUser && state.currentUser.id === s.id ? 'selected' : ''}>
                    ${s.name} (${s.role.toUpperCase()})
                </option>
            `).join('');
        }

        const unreadDot = document.getElementById('topbar-alert-dot');
        if (unreadDot) {
            unreadDot.style.display = state.unreadAlertsCount > 0 ? 'block' : 'none';
        }
    }

    // Sidebar Nav Active State update
    function updateSidebarNav() {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            const route = item.getAttribute('data-route');
            if (route === state.currentRoute) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update footer user profile
        const footerUser = document.getElementById('sidebar-user-name');
        const footerRole = document.getElementById('sidebar-user-role');
        const footerAvatar = document.getElementById('sidebar-user-avatar');
        if (state.currentUser) {
            if (footerUser) footerUser.textContent = state.currentUser.name;
            if (footerRole) footerRole.textContent = state.currentUser.title || state.currentUser.role.toUpperCase();
            if (footerAvatar) {
                const initials = state.currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2);
                footerAvatar.textContent = initials;
            }
        }
    }

    // ==========================================
    // 1. DASHBOARD VIEW
    // ==========================================
    async function renderDashboard(container) {
        const metricsRes = await API.getDashboardMetrics();
        const m = metricsRes.data || {};

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Executive Office Dashboard</h1>
                    <p class="page-description">Welcome back, ${state.currentUser ? state.currentUser.name : 'Partner'}. Here is your CA practice summary for today.</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" id="btn-quick-taxwise">
                        <svg class="icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        Open TaxWise
                    </button>
                    <button class="btn btn-secondary" id="btn-quick-new-client">
                        + Add Client
                    </button>
                </div>
            </div>

            <!-- Metric Cards -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Active Clients</span>
                        <div class="metric-icon-wrap metric-icon-blue">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                    </div>
                    <div class="metric-value">${m.activeClients || 0}</div>
                    <div class="metric-subtext">Total Registered: ${m.totalClients || 0}</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Open Tasks</span>
                        <div class="metric-icon-wrap ${m.overdueTasks > 0 ? 'metric-icon-red' : 'metric-icon-amber'}">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        </div>
                    </div>
                    <div class="metric-value">${m.openTasks || 0}</div>
                    <div class="metric-subtext" style="${m.overdueTasks > 0 ? 'color:var(--danger); font-weight:600;' : ''}">
                        ${m.overdueTasks || 0} overdue tasks
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Upcoming Compliance</span>
                        <div class="metric-icon-wrap metric-icon-purple">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                    </div>
                    <div class="metric-value">${m.upcomingCompliance || 0}</div>
                    <div class="metric-subtext">Statutory deadlines pending</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Tax Calculations</span>
                        <div class="metric-icon-wrap metric-icon-green">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
                        </div>
                    </div>
                    <div class="metric-value">${m.taxCalculationsCompleted || 0}</div>
                    <div class="metric-subtext" style="${m.calculationsAwaitingReview > 0 ? 'color:var(--warning-text); font-weight:600;' : ''}">
                        ${m.calculationsAwaitingReview || 0} awaiting review
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-title">Outstanding Billing</span>
                        <div class="metric-icon-wrap metric-icon-amber">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                    </div>
                    <div class="metric-value">${formatINR(m.outstandingAmount)}</div>
                    <div class="metric-subtext">${m.outstandingInvoicesCount || 0} pending invoices</div>
                </div>
            </div>

            <!-- Two-column grid -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 24px;">
                <!-- Recent Tax Calculations -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>
                            Recent Tax Calculations
                        </h2>
                        <a href="#taxwise" class="btn btn-secondary btn-sm">View All</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Client</th>
                                    <th>Year</th>
                                    <th>Regime</th>
                                    <th>Est. Tax</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(m.recentCalculations || []).map(calc => `
                                    <tr>
                                        <td>
                                            <a href="#clients/${calc.clientId}" style="font-weight:600; color:var(--primary); text-decoration:none;">
                                                ${calc.clientName}
                                            </a>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">${calc.taxpayerType.toUpperCase()} (v${calc.version})</div>
                                        </td>
                                        <td>${calc.financialYear}</td>
                                        <td><span class="badge ${calc.regimeSelected === 'new' ? 'badge-success' : 'badge-info'}">${calc.regimeSelected.toUpperCase()}</span></td>
                                        <td style="font-weight:700;">${formatINR(calc.results ? calc.results.totalTax : 0)}</td>
                                        <td>
                                            <span class="badge ${calc.status === 'Approved' ? 'badge-success' : calc.status === 'Under Review' ? 'badge-warning' : 'badge-gray'}">
                                                ${calc.status}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('') || `<tr><td colspan="5" class="empty-state">No tax calculations saved yet.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Upcoming Statutory Compliance -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Upcoming Compliance Deadlines
                        </h2>
                        <a href="#compliance" class="btn btn-secondary btn-sm">Calendar</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Due Date</th>
                                    <th>Compliance Item</th>
                                    <th>Client</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(m.upcomingComplianceList || []).map(cmp => `
                                    <tr>
                                        <td style="font-weight:600; color:var(--primary); white-space:nowrap;">
                                            ${formatDate(cmp.dueDate)}
                                        </td>
                                        <td>
                                            <div style="font-weight:600;">${cmp.title}</div>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">${cmp.complianceType}</div>
                                        </td>
                                        <td>${cmp.clientName}</td>
                                        <td><span class="badge badge-warning">${cmp.status}</span></td>
                                    </tr>
                                `).join('') || `<tr><td colspan="4" class="empty-state">No upcoming compliance deadlines.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Recent Tasks & Active Clients -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 24px; margin-top:24px;">
                <!-- Recent Office Tasks -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            Assigned Office Tasks
                        </h2>
                        <a href="#tasks" class="btn btn-secondary btn-sm">All Tasks</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Task</th>
                                    <th>Client</th>
                                    <th>Due</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(m.recentTasks || []).map(task => `
                                    <tr>
                                        <td style="font-weight:600;">${task.title}</td>
                                        <td>${task.clientName || 'General'}</td>
                                        <td>${formatDate(task.dueDate)}</td>
                                        <td>
                                            <span class="badge ${task.priority === 'Urgent' ? 'badge-danger' : task.priority === 'High' ? 'badge-warning' : 'badge-info'}">
                                                ${task.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${task.status === 'Completed' ? 'badge-success' : task.status === 'Under Review' ? 'badge-purple' : 'badge-gray'}">
                                                ${task.status}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('') || `<tr><td colspan="5" class="empty-state">No tasks created.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Recently Accessed Clients -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            Client Accounts
                        </h2>
                        <a href="#clients" class="btn btn-secondary btn-sm">Client Directory</a>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Client Name</th>
                                    <th>Category</th>
                                    <th>PAN</th>
                                    <th>Assigned CA</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(m.recentClients || []).map(c => `
                                    <tr>
                                        <td>
                                            <a href="#clients/${c.id}" style="font-weight:700; color:var(--text-primary); text-decoration:none;">
                                                ${c.name}
                                            </a>
                                            ${c.isDemo ? '<span class="badge badge-demo" style="margin-left:4px;">DEMO</span>' : ''}
                                        </td>
                                        <td><span class="badge badge-gray">${c.taxpayerType.replace('_', ' ').toUpperCase()}</span></td>
                                        <td style="font-family:monospace; font-weight:600;">${c.pan || 'N/A'}</td>
                                        <td>${c.assignedStaffName || 'Unassigned'}</td>
                                        <td>
                                            <a href="#clients/${c.id}" class="btn btn-secondary btn-sm">Workspace</a>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-quick-taxwise').addEventListener('click', () => navigateTo('taxwise'));
        document.getElementById('btn-quick-new-client').addEventListener('click', () => openAddClientModal());
    }

    // ==========================================
    // 2. CLIENTS DIRECTORY VIEW
    // ==========================================
    async function renderClientsList(container) {
        const clientsRes = await API.getClients();
        const clients = clientsRes.data || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Client Management Directory</h1>
                    <p class="page-description">Manage all individual, business, corporate, and trust client accounts.</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-primary" id="btn-add-client-modal">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add New Client
                    </button>
                </div>
            </div>

            <!-- Search and Filter Bar -->
            <div class="card" style="padding: 16px 20px; margin-bottom: 20px;">
                <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
                    <div style="flex:1; min-width:240px; position:relative;">
                        <input type="text" id="filter-client-search" class="form-input" placeholder="Search by Client Name, PAN, or Email...">
                    </div>
                    <div style="width:200px;">
                        <select id="filter-client-category" class="form-select">
                            <option value="all">All Taxpayer Categories</option>
                            <option value="individual">Individual</option>
                            <option value="huf">HUF</option>
                            <option value="domestic_company">Domestic Company</option>
                            <option value="foreign_company">Foreign Company</option>
                            <option value="firm_llp">Firm / LLP</option>
                            <option value="cooperative_society">Cooperative Society</option>
                            <option value="local_authority">Local Authority</option>
                            <option value="aop_boi_ajp">AOP / BOI / AJP</option>
                        </select>
                    </div>
                    <div style="width:160px;">
                        <select id="filter-client-status" class="form-select">
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Clients Table -->
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table" id="clients-table">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Category</th>
                                <th>PAN</th>
                                <th>Contact Details</th>
                                <th>Assigned Staff</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="clients-table-body">
                            ${renderClientsTableRows(clients)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-client-modal').addEventListener('click', openAddClientModal);

        // Filter event listeners
        const searchInput = document.getElementById('filter-client-search');
        const catSelect = document.getElementById('filter-client-category');
        const statusSelect = document.getElementById('filter-client-status');

        const applyFilters = async () => {
            const res = await API.getClients({
                search: searchInput.value,
                taxpayerType: catSelect.value,
                status: statusSelect.value
            });
            document.getElementById('clients-table-body').innerHTML = renderClientsTableRows(res.data || []);
        };

        searchInput.addEventListener('input', debounce(applyFilters, 250));
        catSelect.addEventListener('change', applyFilters);
        statusSelect.addEventListener('change', applyFilters);
    }

    function renderClientsTableRows(clients) {
        if (!clients || clients.length === 0) {
            return `<tr><td colspan="7" class="empty-state">No matching clients found.</td></tr>`;
        }

        return clients.map(c => `
            <tr>
                <td>
                    <a href="#clients/${c.id}" style="font-weight:700; color:var(--primary); text-decoration:none; font-size:0.95rem;">
                        ${c.name}
                    </a>
                    ${c.isDemo ? '<span class="badge badge-demo" style="margin-left:6px;">DEMO</span>' : ''}
                    <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${c.id}</div>
                </td>
                <td>
                    <span class="badge badge-gray">${c.taxpayerType.replace(/_/g, ' ').toUpperCase()}</span>
                </td>
                <td style="font-family:monospace; font-weight:600; letter-spacing:0.04em;">
                    ${c.pan || '<span style="color:#94a3b8">Not Provided</span>'}
                </td>
                <td>
                    <div style="font-size:0.85rem;">${c.email || '—'}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${c.phone || '—'}</div>
                </td>
                <td>${c.assignedStaffName || 'Unassigned'}</td>
                <td>
                    <span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-gray'}">
                        ${c.status}
                    </span>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <a href="#clients/${c.id}" class="btn btn-secondary btn-sm">Workspace</a>
                        <button class="btn btn-primary btn-sm" onclick="window.launchTaxWiseForClient('${c.id}')" title="Calculate Tax">
                            TaxWise
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // Modal to add a client
    function openAddClientModal() {
        const bodyHtml = `
            <form id="form-add-client">
                <div class="form-row">
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label">Client Legal / Display Name *</label>
                        <input type="text" id="new-client-name" class="form-input" placeholder="e.g. Anand Murthy or Sunrise Trading Pvt Ltd" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Taxpayer Category *</label>
                        <select id="new-client-type" class="form-select" required>
                            <option value="individual">Individual</option>
                            <option value="huf">HUF (Hindu Undivided Family)</option>
                            <option value="domestic_company">Domestic Company</option>
                            <option value="foreign_company">Foreign Company</option>
                            <option value="firm_llp">Partnership Firm / LLP</option>
                            <option value="cooperative_society">Cooperative Society</option>
                            <option value="local_authority">Local Authority</option>
                            <option value="aop_boi_ajp">AOP / BOI / AJP</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Permanent Account Number (PAN)</label>
                        <input type="text" id="new-client-pan" class="form-input" placeholder="ABCDE1234F" maxlength="10" style="text-transform:uppercase;">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Age (for Individual)</label>
                        <input type="number" id="new-client-age" class="form-input" value="35" min="1" max="125">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Residential Status</label>
                        <select id="new-client-residence" class="form-select">
                            <option value="resident">Resident</option>
                            <option value="non_resident">Non-Resident (NRI)</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" id="new-client-email" class="form-input" placeholder="client@example.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone / Mobile</label>
                        <input type="text" id="new-client-phone" class="form-input" placeholder="+91 98000 00000">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Office / Residential Address</label>
                    <textarea id="new-client-address" class="form-textarea" rows="2" placeholder="Full postal address..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Assigned Staff / CA</label>
                    <select id="new-client-staff" class="form-select">
                        ${state.staffList.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name} (${s.title || s.role})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Internal Notes / Tax Profile Remarks</label>
                    <textarea id="new-client-notes" class="form-textarea" rows="2" placeholder="Key tax history, special exemptions, or business description..."></textarea>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-new-client">Create Client Record</button>
        `;

        openModal('Add New Client Account', bodyHtml, footerHtml);

        document.getElementById('btn-save-new-client').addEventListener('click', async () => {
            const name = document.getElementById('new-client-name').value;
            const taxpayerType = document.getElementById('new-client-type').value;
            const pan = document.getElementById('new-client-pan').value;
            const age = document.getElementById('new-client-age').value;
            const residentialStatus = document.getElementById('new-client-residence').value;
            const email = document.getElementById('new-client-email').value;
            const phone = document.getElementById('new-client-phone').value;
            const address = document.getElementById('new-client-address').value;
            const staffSelect = document.getElementById('new-client-staff');
            const assignedStaffId = staffSelect.value;
            const assignedStaffName = staffSelect.selectedOptions[0]?.getAttribute('data-name');
            const notes = document.getElementById('new-client-notes').value;

            if (!name.trim()) {
                showToast('Please enter the client name.', 'error');
                return;
            }

            try {
                const res = await API.createClient({
                    name,
                    taxpayerType,
                    pan,
                    age,
                    residentialStatus,
                    email,
                    phone,
                    address,
                    assignedStaffId,
                    assignedStaffName,
                    notes
                });

                closeModal();
                showToast(`Client '${res.data.name}' added successfully!`);
                navigateTo('clients', { id: res.data.id });
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // ==========================================
    // 3. DEDICATED CLIENT PROFILE WORKSPACE
    // ==========================================
    async function renderClientWorkspace(container, clientId) {
        const clientRes = await API.getClientById(clientId);
        const client = clientRes.data;
        if (!client) {
            container.innerHTML = `<div class="card"><p>Client not found.</p><a href="#clients" class="btn btn-secondary">Back to Clients</a></div>`;
            return;
        }

        state.activeClient = client;

        container.innerHTML = `
            <!-- Client Hero Card -->
            <div class="client-hero-card">
                <div class="client-hero-info">
                    <div class="client-avatar-large">
                        ${client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <h1 class="client-hero-title">${client.name}</h1>
                            ${client.isDemo ? '<span class="badge badge-demo">DEMO ACCOUNT</span>' : ''}
                            <span class="badge ${client.status === 'active' ? 'badge-success' : 'badge-gray'}">${client.status}</span>
                        </div>
                        <div class="client-meta-pills">
                            <span class="meta-pill">ID: ${client.id}</span>
                            <span class="meta-pill">PAN: ${client.pan || 'Not Recorded'}</span>
                            <span class="meta-pill">Category: ${client.taxpayerType.replace(/_/g, ' ').toUpperCase()}</span>
                            <span class="meta-pill">Assigned: ${client.assignedStaffName || 'CA Pooja Verma'}</span>
                        </div>
                    </div>
                </div>
                <div class="client-hero-actions">
                    <button class="btn btn-primary" id="btn-tab-launch-taxwise">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>
                        Compute Tax in TaxWise
                    </button>
                    <button class="btn btn-secondary" id="btn-edit-client-profile" style="color:#ffffff; border-color:#475569; background:#334155;">
                        Edit Profile
                    </button>
                </div>
            </div>

            <!-- Workspace Tabs -->
            <div class="tabs-nav" id="client-workspace-tabs">
                <button class="tab-btn ${state.activeClientTab === 'overview' ? 'active' : ''}" data-tab="overview">
                    Overview
                </button>
                <button class="tab-btn ${state.activeClientTab === 'taxwise' ? 'active' : ''}" data-tab="taxwise">
                    TaxWise Calculator
                </button>
                <button class="tab-btn ${state.activeClientTab === 'tax-history' ? 'active' : ''}" data-tab="tax-history">
                    Tax History <span class="tab-badge">${client.stats.calculationsCount}</span>
                </button>
                <button class="tab-btn ${state.activeClientTab === 'documents' ? 'active' : ''}" data-tab="documents">
                    Documents <span class="tab-badge">${client.stats.documentsCount}</span>
                </button>
                <button class="tab-btn ${state.activeClientTab === 'tasks' ? 'active' : ''}" data-tab="tasks">
                    Tasks <span class="tab-badge">${client.stats.openTasksCount}</span>
                </button>
                <button class="tab-btn ${state.activeClientTab === 'compliance' ? 'active' : ''}" data-tab="compliance">
                    Compliance <span class="tab-badge">${client.stats.complianceCount}</span>
                </button>
                <button class="tab-btn ${state.activeClientTab === 'billing' ? 'active' : ''}" data-tab="billing">
                    Billing <span class="tab-badge">${client.stats.invoicesCount}</span>
                </button>
                <button class="tab-btn ${state.activeClientTab === 'activity' ? 'active' : ''}" data-tab="activity">
                    Audit Log
                </button>
            </div>

            <!-- Tab Content Container -->
            <div id="client-tab-content"></div>
        `;

        document.getElementById('btn-tab-launch-taxwise').addEventListener('click', () => {
            switchClientTab('taxwise', clientId);
        });

        document.getElementById('btn-edit-client-profile').addEventListener('click', () => {
            openEditClientModal(client);
        });

        document.querySelectorAll('#client-workspace-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                switchClientTab(tab, clientId);
            });
        });

        // Render initially active tab
        renderClientTabContent(clientId, state.activeClientTab);
    }

    function switchClientTab(tabName, clientId) {
        state.activeClientTab = tabName;
        document.querySelectorAll('#client-workspace-tabs .tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        renderClientTabContent(clientId, tabName);
    }

    async function renderClientTabContent(clientId, tabName) {
        const container = document.getElementById('client-tab-content');
        if (!container) return;

        switch (tabName) {
            case 'overview':
                await renderClientTabOverview(container, state.activeClient);
                break;
            case 'taxwise':
                await renderClientTabTaxWise(container, state.activeClient);
                break;
            case 'tax-history':
                await renderClientTabTaxHistory(container, state.activeClient);
                break;
            case 'documents':
                await renderClientTabDocuments(container, state.activeClient);
                break;
            case 'tasks':
                await renderClientTabTasks(container, state.activeClient);
                break;
            case 'compliance':
                await renderClientTabCompliance(container, state.activeClient);
                break;
            case 'billing':
                await renderClientTabBilling(container, state.activeClient);
                break;
            case 'activity':
                await renderClientTabActivity(container, state.activeClient);
                break;
        }
    }

    // Tab 1: Overview
    async function renderClientTabOverview(container, client) {
        const stats = client.stats || {};
        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
                <!-- Profile Information Card -->
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:16px;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile Information
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:12px; font-size:0.9rem;">
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Legal Name:</strong> ${client.name}</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">PAN:</strong> <span style="font-family:monospace; font-weight:700;">${client.pan || 'N/A'}</span></div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Tax Category:</strong> ${client.taxpayerType.replace(/_/g, ' ').toUpperCase()}</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Age / Status:</strong> ${client.age ? client.age + ' Yrs' : 'N/A'} (${client.residentialStatus === 'non_resident' ? 'Non-Resident NRI' : 'Resident'})</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Email:</strong> ${client.email || 'N/A'}</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Phone:</strong> ${client.phone || 'N/A'}</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Address:</strong> ${client.address || 'N/A'}</div>
                        <div><strong style="color:var(--text-muted); display:inline-block; width:130px;">Assigned CA:</strong> ${client.assignedStaffName || 'Unassigned'}</div>
                    </div>
                </div>

                <!-- Latest Tax Calculation Card -->
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:16px;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/></svg>
                        Latest Tax Computation
                    </h3>
                    ${stats.latestCalculation ? `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-md); padding:16px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <span style="font-weight:700; color:var(--primary);">${stats.latestCalculation.financialYear} (v${stats.latestCalculation.version})</span>
                                <span class="badge badge-warning">${stats.latestCalculation.status}</span>
                            </div>
                            <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin-bottom:6px;">
                                ${formatINR(stats.latestCalculation.results?.totalTax)}
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">
                                Selected Regime: <strong>${stats.latestCalculation.regimeSelected.toUpperCase()}</strong> | Effective Rate: <strong>${stats.latestCalculation.results?.effectiveTaxRate || 0}%</strong>
                            </div>
                            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:14px; font-style:italic;">
                                "${stats.latestCalculation.notes || 'Calculation prepared and saved via CA Desk.'}"
                            </p>
                            <button class="btn btn-primary btn-sm" onclick="window.loadSavedCalculationIntoTaxWise('${stats.latestCalculation.id}')">
                                Reopen & Review in TaxWise
                            </button>
                        </div>
                    ` : `
                        <div class="empty-state">
                            <p>No tax calculations saved for this client yet.</p>
                            <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="window.launchTaxWiseForClient('${client.id}')">
                                Calculate Tax Now
                            </button>
                        </div>
                    `}
                </div>

                <!-- Billing Summary Card -->
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:16px;">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Financial & Billing Status
                    </h3>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding:12px; background:#f8fafc; border-radius:8px;">
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Outstanding Balance</div>
                            <div style="font-size:1.4rem; font-weight:700; color:${stats.outstandingBalance > 0 ? 'var(--danger)' : 'var(--success)'};">
                                ${formatINR(stats.outstandingBalance)}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Total Invoices</div>
                            <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary); text-align:right;">
                                ${stats.invoicesCount || 0}
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="window.switchClientTab('billing', '${client.id}')">
                        View Billing History
                    </button>
                </div>
            </div>
        `;
    }

    // Modal to Edit Client Profile
    function openEditClientModal(client) {
        const bodyHtml = `
            <form id="form-edit-client">
                <div class="form-group">
                    <label class="form-label">Client Display Name</label>
                    <input type="text" id="edit-client-name" class="form-input" value="${client.name}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">PAN</label>
                        <input type="text" id="edit-client-pan" class="form-input" value="${client.pan || ''}" maxlength="10" style="text-transform:uppercase;">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="edit-client-status" class="form-select">
                            <option value="active" ${client.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${client.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" id="edit-client-email" class="form-input" value="${client.email || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone</label>
                        <input type="text" id="edit-client-phone" class="form-input" value="${client.phone || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Address</label>
                    <textarea id="edit-client-address" class="form-textarea" rows="2">${client.address || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Assigned Staff / CA</label>
                    <select id="edit-client-staff" class="form-select">
                        ${state.staffList.map(s => `<option value="${s.id}" data-name="${s.name}" ${client.assignedStaffId === s.id ? 'selected' : ''}>${s.name} (${s.title || s.role})</option>`).join('')}
                    </select>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-edit-client">Save Changes</button>
        `;

        openModal(`Edit Profile: ${client.name}`, bodyHtml, footerHtml);

        document.getElementById('btn-save-edit-client').addEventListener('click', async () => {
            const name = document.getElementById('edit-client-name').value;
            const pan = document.getElementById('edit-client-pan').value;
            const status = document.getElementById('edit-client-status').value;
            const email = document.getElementById('edit-client-email').value;
            const phone = document.getElementById('edit-client-phone').value;
            const address = document.getElementById('edit-client-address').value;
            const staffSelect = document.getElementById('edit-client-staff');
            const assignedStaffId = staffSelect.value;
            const assignedStaffName = staffSelect.selectedOptions[0]?.getAttribute('data-name');

            try {
                await API.updateClient(client.id, {
                    name,
                    pan,
                    status,
                    email,
                    phone,
                    address,
                    assignedStaffId,
                    assignedStaffName
                });
                closeModal();
                showToast('Client profile updated successfully!');
                navigateTo('clients', { id: client.id });
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // ==========================================
    // 4. TAB 2 & GLOBAL: INTEGRATED TAXWISE CALCULATOR MODULE
    // ==========================================
    async function renderClientTabTaxWise(container, client) {
        // Preload TaxWise inside client profile
        if (window.TaxWiseCore) {
            window.TaxWiseCore.initTaxWise(container, client);
            // Auto-restore client's latest saved calculation from MongoDB cad_taxCalculations if available
            try {
                const res = await API.getClientCalculations(client.id);
                if (res && res.data && res.data.length > 0) {
                    window.TaxWiseCore.restoreSavedCalculation(res.data[0]);
                }
            } catch (e) {
                console.warn('Could not restore client calculation:', e);
            }
        } else {
            renderTaxWiseInterface(container, client);
        }
    }

    async function renderTaxWiseGlobal(container) {
        // Global TaxWise page with client picker and MongoDB calculation history
        const clientsRes = await API.getClients();
        const clients = clientsRes.data || [];

        let savedCalculations = [];
        try {
            const calcsRes = await API.getAllCalculations();
            savedCalculations = calcsRes.data || [];
        } catch (e) {
            console.warn('Could not load calculation history:', e);
        }

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">TaxWise Indian Income Tax Calculator & Planning Hub</h1>
                    <p class="page-description">Official tax engine running inside CA Desk for progressive slab computation, regime comparison, and tax-saving simulations.</p>
                </div>
            </div>

            <!-- Client & Calculation History Selector Banner -->
            <div class="card" style="padding:16px 20px; background:#eff6ff; border-color:#bfdbfe; margin-bottom:20px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <strong style="color:var(--primary-text); font-size:0.88rem;">Client Profile:</strong>
                        <select id="global-taxwise-client-select" class="form-select" style="max-width:280px; background:#ffffff;">
                            <option value="">-- Walk-in / Prospective Client --</option>
                            ${clients.map(c => `<option value="${c.id}">${c.name} (${c.taxpayerType.toUpperCase()})</option>`).join('')}
                        </select>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <strong style="color:#1e40af; font-size:0.88rem;">MongoDB Tax Calculations:</strong>
                        <select id="global-taxwise-history-select" class="form-select" style="max-width:320px; background:#ffffff;">
                            <option value="">-- Tax Calculations History (${savedCalculations.length}) --</option>
                            ${savedCalculations.map(c => {
                                const cId = c.calculationId || c.id;
                                const taxAmt = (c.results && c.results.totalTax != null) ? c.results.totalTax : (c.totalTax || 0);
                                return `<option value="${cId}">${cId} - ${c.clientName || c.name || 'Assessee'} (${c.financialYear || '2026-27'}) - Tax: ₹${Number(taxAmt).toLocaleString('en-IN')}</option>`;
                            }).join('')}
                        </select>
                        <button id="btn-view-legacy-tax" class="btn btn-outline" style="font-size:0.8rem; padding:6px 10px; background:#ffffff;" title="Inspect calculations in MongoDB Tax collection">
                            Tax Registry (${savedCalculations.length})
                        </button>
                    </div>
                </div>
            </div>

            <div id="global-taxwise-calc-container"></div>
        `;

        const calcContainer = document.getElementById('global-taxwise-calc-container');
        if (window.TaxWiseCore) {
            window.TaxWiseCore.initTaxWise(calcContainer, null);

            // Auto-restore calculation across page refreshes from MongoDB Tax collection:
            const lastCalcId = localStorage.getItem('cadesk_last_calc_id');
            let docToRestore = null;
            if (lastCalcId && savedCalculations.length > 0) {
                docToRestore = savedCalculations.find(c => (c.calculationId === lastCalcId || c.id === lastCalcId));
            }
            if (!docToRestore && savedCalculations.length > 0) {
                docToRestore = savedCalculations[0];
            }
            if (docToRestore) {
                window.TaxWiseCore.restoreSavedCalculation(docToRestore);
                const historySelect = document.getElementById('global-taxwise-history-select');
                if (historySelect) historySelect.value = docToRestore.calculationId || docToRestore.id;
            }
        } else {
            renderTaxWiseInterface(calcContainer, null);
        }

        // Listener: Client select change
        document.getElementById('global-taxwise-client-select').addEventListener('change', async (e) => {
            const cid = e.target.value;
            const c = cid ? clients.find(cl => cl.id === cid) : null;
            if (window.TaxWiseCore) {
                window.TaxWiseCore.initTaxWise(calcContainer, c);
                // Check if this client has calculations in Tax collection
                if (c) {
                    const clientCalcs = savedCalculations.filter(sc => sc.clientId === c.id);
                    if (clientCalcs.length > 0) {
                        window.TaxWiseCore.restoreSavedCalculation(clientCalcs[0]);
                        const historySelect = document.getElementById('global-taxwise-history-select');
                        if (historySelect) historySelect.value = clientCalcs[0].calculationId || clientCalcs[0].id;
                    }
                }
            } else {
                renderTaxWiseInterface(calcContainer, c);
            }
        });

        // Listener: Saved calculation history select change
        document.getElementById('global-taxwise-history-select').addEventListener('change', (e) => {
            const selectedId = e.target.value;
            if (!selectedId) return;
            const chosen = savedCalculations.find(sc => (sc.calculationId === selectedId || sc.id === selectedId));
            if (chosen && window.TaxWiseCore) {
                window.TaxWiseCore.restoreSavedCalculation(chosen);
                const activeId = chosen.calculationId || chosen.id;
                localStorage.setItem('cadesk_last_calc_id', activeId);
                // If linked to a client, update client selector as well
                if (chosen.clientId) {
                    const clientSelect = document.getElementById('global-taxwise-client-select');
                    if (clientSelect) clientSelect.value = chosen.clientId;
                }
            }
        });

        // Callback when a calculation is saved
        window.CA_DESK_ON_CALC_SAVED = async (newDoc) => {
            if (!newDoc) return;
            const docId = newDoc.calculationId || newDoc.id;
            try {
                const refreshed = await API.getAllCalculations();
                savedCalculations = refreshed.data || [];
                const historySelect = document.getElementById('global-taxwise-history-select');
                if (historySelect) {
                    historySelect.innerHTML = `
                        <option value="">-- Tax Calculations History (${savedCalculations.length}) --</option>
                        ${savedCalculations.map(c => {
                            const cId = c.calculationId || c.id;
                            const taxAmt = (c.results && c.results.totalTax != null) ? c.results.totalTax : (c.totalTax || 0);
                            return `<option value="${cId}">${cId} - ${c.clientName || c.name || 'Assessee'} (${c.financialYear || '2026-27'}) - Tax: ₹${Number(taxAmt).toLocaleString('en-IN')}</option>`;
                        }).join('')}
                    `;
                    if (docId) historySelect.value = docId;
                }
            } catch (err) {
                console.warn('Failed to refresh calculation history dropdown:', err);
            }
        };

        // Listener: View records in read-only modal
        document.getElementById('btn-view-legacy-tax').addEventListener('click', async () => {
            try {
                const legRes = await API.getLegacyCalculations();
                const records = legRes.data || [];
                const tableRows = records.slice(0, 50).map(r => `
                    <tr>
                        <td style="padding:8px 12px; font-weight:600;">${r.clientName || r.name || 'Anonymous'}</td>
                        <td style="padding:8px 12px;">${r.financialYear || '2026-2027'}</td>
                        <td style="padding:8px 12px; text-transform:uppercase;">${r.regimeSelected || r.regime || 'new'}</td>
                        <td style="padding:8px 12px; font-family:monospace;">₹${Number(r.grossIncome || (r.income && r.income.grossTotalIncome) || 0).toLocaleString('en-IN')}</td>
                        <td style="padding:8px 12px; font-weight:700; color:#1e40af; font-family:monospace;">₹${Number(r.totalTax || (r.results && r.results.totalTax) || 0).toLocaleString('en-IN')}</td>
                        <td style="padding:8px 12px; color:var(--text-muted); font-size:0.8rem;">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Historical'}</td>
                    </tr>
                `).join('');

                const modalHtml = `
                    <p style="margin-bottom:12px; font-size:0.88rem; color:var(--text-secondary);">
                        Currently viewing <strong>${records.length} records</strong> stored directly in MongoDB <code>Desk-CA.Tax</code> collection.
                    </p>
                    <div style="max-height:400px; overflow-y:auto; border:1px solid var(--card-border); border-radius:4px;">
                        <table class="table" style="width:100%; text-align:left; font-size:0.85rem; border-collapse:collapse;">
                            <thead style="background:#f1f5f9; position:sticky; top:0;">
                                <tr>
                                    <th style="padding:8px 12px;">Taxpayer</th>
                                    <th style="padding:8px 12px;">FY</th>
                                    <th style="padding:8px 12px;">Regime</th>
                                    <th style="padding:8px 12px;">Gross Income</th>
                                    <th style="padding:8px 12px;">Total Tax</th>
                                    <th style="padding:8px 12px;">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || '<tr><td colspan="6" style="padding:16px; text-align:center;">No records found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
                openModal('Tax Calculations Registry (Tax Collection)', modalHtml, `<button class="btn btn-secondary" onclick="document.getElementById('app-modal-overlay').classList.remove('active')">Close</button>`);
            } catch (err) {
                alert('Could not retrieve records: ' + err.message);
            }
        });
    }

    // Unified TaxWise Interface Component
    function renderTaxWiseInterface(container, client = null) {
        const taxpayerType = client ? client.taxpayerType : 'individual';
        const clientName = client ? client.name : '';
        const clientAge = client && client.age ? client.age : 35;
        const residentialStatus = client && client.residentialStatus ? client.residentialStatus : 'resident';

        container.innerHTML = `
            <div class="taxwise-container">
                <div class="taxwise-banner">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:1.3rem; font-weight:800; letter-spacing:-0.02em;">TaxWise</span>
                            <span style="background:rgba(255,255,255,0.25); padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">INCOME TAX INDIA</span>
                        </div>
                        <div style="font-size:0.85rem; opacity:0.9; margin-top:2px;">
                            ${client ? `Client Workspace: <strong>${client.name}</strong> (${client.taxpayerType.toUpperCase()})` : 'Comprehensive Indian Tax Computation & Planning Engine'}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:0.82rem; font-weight:600;">Financial Year:</span>
                        <select id="taxwise-fy-select" class="form-select" style="width:230px; background:#ffffff; color:var(--text-primary); font-weight:600;">
                            <option value="2026-2027" selected>FY 2026-27 (AY 2027-28) - Current</option>
                            <option value="2025-2026">FY 2025-26 (AY 2026-27)</option>
                            <option value="2024-2025">FY 2024-25 (AY 2025-26)</option>
                        </select>
                    </div>
                </div>

                <form id="taxwise-calc-form">
                    <!-- Taxpayer Category and Basic Details -->
                    <div class="card" style="margin-bottom:20px; background:#f8fafc;">
                        <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:14px;">
                            1. Taxpayer Category & Assessment Profile
                        </h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Taxpayer Category</label>
                                <select id="tw-taxpayer-type" class="form-select">
                                    <option value="individual" ${taxpayerType === 'individual' ? 'selected' : ''}>Individual</option>
                                    <option value="huf" ${taxpayerType === 'huf' ? 'selected' : ''}>HUF (Hindu Undivided Family)</option>
                                    <option value="domestic_company" ${taxpayerType === 'domestic_company' ? 'selected' : ''}>Domestic Company</option>
                                    <option value="foreign_company" ${taxpayerType === 'foreign_company' ? 'selected' : ''}>Foreign Company (35% Flat)</option>
                                    <option value="firm_llp" ${taxpayerType === 'firm_llp' ? 'selected' : ''}>Partnership Firm / LLP (30% Flat)</option>
                                    <option value="cooperative_society" ${taxpayerType === 'cooperative_society' ? 'selected' : ''}>Cooperative Society</option>
                                    <option value="local_authority" ${taxpayerType === 'local_authority' ? 'selected' : ''}>Local Authority</option>
                                    <option value="aop_boi_ajp" ${taxpayerType === 'aop_boi_ajp' ? 'selected' : ''}>AOP / BOI / AJP</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Client Name</label>
                                <input type="text" id="tw-client-name" class="form-input" value="${clientName}" placeholder="Taxpayer Legal Name">
                            </div>
                            <div class="form-group" id="tw-age-group">
                                <label class="form-label">Age (for Individual slabs)</label>
                                <input type="number" id="tw-client-age" class="form-input" value="${clientAge}" min="1" max="125">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Residential Status</label>
                                <select id="tw-client-residence" class="form-select">
                                    <option value="resident" ${residentialStatus === 'resident' ? 'selected' : ''}>Resident</option>
                                    <option value="non_resident" ${residentialStatus === 'non_resident' ? 'selected' : ''}>Non-Resident (NRI)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- 5 Income Heads -->
                    <div class="card" style="margin-bottom:20px;">
                        <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:14px;">
                            2. Five Heads of Income (₹)
                        </h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Income from Salary (Gross)</label>
                                <input type="number" id="tw-inc-salary" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 2500000 : 0}">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Standard deduction ₹75,000 (New) / ₹50,000 (Old) applied automatically</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Profits & Gains of Business / Profession</label>
                                <input type="number" id="tw-inc-business" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1002' ? 3600000 : client && client.id === 'CLI-1004' ? 8500000 : client && client.id === 'CLI-1005' ? 4200000 : 0}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">House Property (Home Loan Interest u/s 24b)</label>
                                <input type="number" id="tw-inc-hp-interest" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 200000 : 0}">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Deductible up to ₹2,00,000 in Old Regime</span>
                            </div>
                        </div>

                        <div class="form-row" style="margin-top:10px;">
                            <div class="form-group">
                                <label class="form-label">Capital Gains: STCG Sec 111A (Equity 20%)</label>
                                <input type="number" id="tw-inc-stcg" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 50000 : 0}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Capital Gains: LTCG Sec 112A (Equity 12.5%)</label>
                                <input type="number" id="tw-inc-ltcg" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 180000 : 0}">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Statutory ₹1.25L exemption applied</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Income from Other Sources (Interest / Dividend)</label>
                                <input type="number" id="tw-inc-other" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 45000 : client && client.id === 'CLI-1002' ? 80000 : 0}">
                            </div>
                        </div>
                    </div>

                    <!-- Deductions (Chapter VI-A) -->
                    <div class="card" style="margin-bottom:20px;">
                        <h4 style="font-size:0.95rem; font-weight:700; color:var(--text-primary); margin-bottom:14px;">
                            3. Deductions & Statutory Exemptions (₹)
                        </h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Section 80C (PPF, ELSS, EPF, Life Ins.)</label>
                                <input type="number" id="tw-ded-80c" class="form-input" placeholder="0" min="0" max="150000" value="${client && (client.id === 'CLI-1001' || client.id === 'CLI-1002') ? 150000 : 0}">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Max ₹1,50,000 (Old Regime)</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Section 80D (Health Insurance Premium)</label>
                                <input type="number" id="tw-ded-80d" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 25000 : client && client.id === 'CLI-1002' ? 50000 : 0}">
                                <span style="font-size:0.75rem; color:var(--text-muted);">Self/Family + Parents</span>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Section 80CCD(2) (Employer NPS)</label>
                                <input type="number" id="tw-ded-80ccd2" class="form-input" placeholder="0" min="0" value="${client && client.id === 'CLI-1001' ? 120000 : 0}">
                                <span style="font-size:0.75rem; color:var(--success); font-weight:600;">Allowed in BOTH New & Old Regimes (up to 14%)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display:flex; gap:12px; align-items:center; margin-bottom:24px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-primary" id="btn-run-taxwise-calc" style="padding:11px 24px; font-size:0.95rem;">
                            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Compute Tax & Compare Regimes
                        </button>
                        <button type="reset" class="btn btn-secondary" style="padding:11px 18px;">
                            Reset Inputs
                        </button>
                        ${client ? `
                            <button type="button" class="btn btn-success" id="btn-save-client-calc" style="margin-left:auto; display:none;">
                                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                Save to Client Profile
                            </button>
                        ` : ''}
                    </div>
                </form>

                <!-- Computation Results Area -->
                <div id="taxwise-results-area" style="display:none;"></div>
            </div>
        `;

        // Event listener for calculation
        document.getElementById('btn-run-taxwise-calc').addEventListener('click', async () => {
            await executeTaxCalculation(client);
        });

        if (client) {
            document.getElementById('btn-save-client-calc').addEventListener('click', async () => {
                await saveActiveCalculationToClient(client);
            });
        }
    }

    // Execute Tax Calculation
    async function executeTaxCalculation(client = null) {
        const resultsArea = document.getElementById('taxwise-results-area');
        if (!resultsArea) return;

        resultsArea.style.display = 'block';
        resultsArea.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-muted);">
                <div style="display:inline-block; width:28px; height:28px; border:3px solid #cbd5e1; border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                <div style="margin-top:8px; font-weight:600;">Executing official TaxWise calculation engine...</div>
            </div>
        `;

        const financialYear = document.getElementById('taxwise-fy-select').value;
        const taxpayerType = document.getElementById('tw-taxpayer-type').value;
        const name = document.getElementById('tw-client-name').value || (client ? client.name : 'Anonymous');
        const age = Number(document.getElementById('tw-client-age').value) || 35;
        const residentialStatus = document.getElementById('tw-client-residence').value;

        const salaryIncome = Number(document.getElementById('tw-inc-salary').value) || 0;
        const businessIncome = Number(document.getElementById('tw-inc-business').value) || 0;
        const housePropertyLoanInterest = Number(document.getElementById('tw-inc-hp-interest').value) || 0;
        const stcg111A = Number(document.getElementById('tw-inc-stcg').value) || 0;
        const ltcg112A = Number(document.getElementById('tw-inc-ltcg').value) || 0;
        const interestIncome = Number(document.getElementById('tw-inc-other').value) || 0;

        const sec80C = Number(document.getElementById('tw-ded-80c').value) || 0;
        const sec80D = Number(document.getElementById('tw-ded-80d').value) || 0;
        const sec80CCD2 = Number(document.getElementById('tw-ded-80ccd2').value) || 0;

        const calcPayload = {
            clientId: client ? client.id : null,
            name,
            taxpayerType,
            financialYear,
            age,
            residentialStatus,
            salaryIncome,
            businessIncome,
            housePropertyLoanInterest,
            stcg111A,
            ltcg112A,
            interestIncome,
            sec80C,
            sec80D,
            sec80CCD2,
            regime: 'compare'
        };

        try {
            const res = await API.calculateTax(calcPayload);
            const data = res.data;
            state.lastTaxCalculation = {
                inputs: calcPayload,
                results: data
            };

            renderCalculationResults(resultsArea, data, client);

            const saveBtn = document.getElementById('btn-save-client-calc');
            if (saveBtn) saveBtn.style.display = 'inline-flex';
        } catch (err) {
            resultsArea.innerHTML = `
                <div class="card" style="border-left:4px solid var(--danger);">
                    <h4 style="color:var(--danger);">Calculation Error</h4>
                    <p style="color:var(--text-secondary);">${err.message}</p>
                </div>
            `;
        }
    }

    // Render Calculation Results & Slabs & Recommendations
    function renderCalculationResults(container, data, client) {
        const comp = data.comparison || {};
        const newR = comp.newRegime || (data.regime === 'new' ? data : null);
        const oldR = comp.oldRegime || (data.regime === 'old' ? data : null);
        const recRegime = comp.recommendedRegime || (newR && oldR ? (newR.totalTax <= oldR.totalTax ? 'new' : 'old') : data.regime);
        const savings = comp.taxDifference || (newR && oldR ? Math.abs(newR.totalTax - oldR.totalTax) : 0);

        container.innerHTML = `
            <!-- Regime Comparison Grid -->
            <div style="margin-top:24px;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:12px;">
                    <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-primary);">
                        Tax Regime Comparison & Recommendation
                    </h3>
                    ${comp.recommendationText ? `
                        <span class="badge badge-success" style="font-size:0.85rem; padding:6px 12px;">
                            ${comp.recommendationText}
                        </span>
                    ` : ''}
                </div>

                <div class="regime-comparison-grid">
                    <!-- New Regime Card -->
                    <div class="regime-box ${recRegime === 'new' ? 'recommended' : ''}">
                        ${recRegime === 'new' ? '<span class="badge badge-success" style="position:absolute; top:12px; right:12px;">RECOMMENDED OPTION</span>' : ''}
                        <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
                            New Tax Regime (Section 115BAC)
                        </h4>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:14px;">
                            Concessional tax slabs, standard deduction ₹75,000, Section 87A rebate up to ₹12L
                        </div>

                        <div style="font-size:2rem; font-weight:800; color:${recRegime === 'new' ? 'var(--success)' : 'var(--text-primary)'}; margin-bottom:8px;">
                            ${formatINR(newR ? newR.totalTax : data.totalTax)}
                        </div>

                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem; border-top:1px solid #e2e8f0; padding-top:12px; margin-top:12px;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>Gross Income:</span>
                                <strong>${formatINR(newR ? newR.grossIncome : data.grossIncome)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Standard Deduction:</span>
                                <strong>${formatINR(newR ? newR.standardDeduction : 75000)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Taxable Income:</span>
                                <strong>${formatINR(newR ? newR.taxableIncome : data.taxableIncome)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Section 87A Rebate:</span>
                                <strong style="color:var(--success);">${formatINR(newR ? newR.rebate87A?.amount : 0)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Health & Edu Cess (4%):</span>
                                <strong>${formatINR(newR ? newR.cess : data.cess)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Old Regime Card -->
                    <div class="regime-box ${recRegime === 'old' ? 'recommended' : ''}">
                        ${recRegime === 'old' ? '<span class="badge badge-success" style="position:absolute; top:12px; right:12px;">RECOMMENDED OPTION</span>' : ''}
                        <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin-bottom:4px;">
                            Old Tax Regime (With Chapter VI-A)
                        </h4>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:14px;">
                            Full itemized deductions (80C, 80D, 24b Home Loan), higher progressive slab rates
                        </div>

                        <div style="font-size:2rem; font-weight:800; color:${recRegime === 'old' ? 'var(--success)' : 'var(--text-primary)'}; margin-bottom:8px;">
                            ${formatINR(oldR ? oldR.totalTax : 'N/A')}
                        </div>

                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem; border-top:1px solid #e2e8f0; padding-top:12px; margin-top:12px;">
                            <div style="display:flex; justify-content:space-between;">
                                <span>Gross Income:</span>
                                <strong>${formatINR(oldR ? oldR.grossIncome : '—')}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Total Deductions Claimed:</span>
                                <strong>${formatINR(oldR ? oldR.totalEligibleDeductions : '—')}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Taxable Income:</span>
                                <strong>${formatINR(oldR ? oldR.taxableIncome : '—')}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Effective Tax Rate:</span>
                                <strong>${oldR ? oldR.effectiveTaxRate : 0}%</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between;">
                                <span>Health & Edu Cess (4%):</span>
                                <strong>${formatINR(oldR ? oldR.cess : '—')}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progressive Slab Breakdown Card -->
            <div class="card" style="margin-top:24px;">
                <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary); margin-bottom:12px;">
                    Progressive Slab Breakdown (Active Regime)
                </h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Income Slab Range</th>
                                <th>Applicable Rate</th>
                                <th>Taxable Amount in Slab</th>
                                <th>Computed Slab Tax</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.slabBreakdown || (newR && newR.slabBreakdown) || []).map(slab => `
                                <tr>
                                    <td style="font-weight:600;">₹${slab.from.toLocaleString('en-IN')} - ${slab.to ? '₹' + slab.to.toLocaleString('en-IN') : 'Above'}</td>
                                    <td><span class="badge badge-info">${slab.rate}%</span></td>
                                    <td>${formatINR(slab.taxableInSlab)}</td>
                                    <td style="font-weight:700;">${formatINR(slab.tax)}</td>
                                </tr>
                            `).join('') || `<tr><td colspan="4">No slab breakdown available.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Tax-Planning Recommendations -->
            <div class="card" style="margin-top:24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
                    <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">
                        Tax-Planning Recommendations & Advisory Provisions
                    </h4>
                    <span style="font-size:0.8rem; color:var(--text-muted);">
                        Tailored for ${data.taxpayerType ? data.taxpayerType.toUpperCase() : 'TAXPAYER'}
                    </span>
                </div>
                ${(data.recommendations || []).slice(0, 4).map(rec => `
                    <div class="recommendation-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                            <strong style="color:var(--text-primary); font-size:0.95rem;">${rec.title}</strong>
                            <span class="badge ${rec.eligibilityStatus.includes('Eligible') ? 'badge-success' : 'badge-warning'}">
                                ${rec.eligibilityStatus}
                            </span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">${rec.explanation}</p>
                        <div style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:16px; flex-wrap:wrap;">
                            <span><strong>Legal Provision:</strong> ${rec.legalProvision}</span>
                            <span><strong>Required Docs:</strong> ${rec.documentsRequired}</span>
                            ${rec.estimatedTaxSaving > 0 ? `<span style="color:var(--success); font-weight:700;">Est. Potential Saving: ${formatINR(rec.estimatedTaxSaving)}</span>` : ''}
                        </div>
                    </div>
                `).join('') || `<div class="empty-state">No specific recommendations for this income profile.</div>`}
            </div>

            <!-- Interactive Tax-Saving Simulator -->
            <div class="card" style="margin-top:24px; background:#faf5ff; border-color:#e9d5ff;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <svg width="20" height="20" fill="none" stroke="#7c3aed" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <h4 style="font-size:1.05rem; font-weight:700; color:#581c87;">
                        Interactive Tax-Saving Investment Simulator
                    </h4>
                </div>
                <p style="font-size:0.85rem; color:#6b21a8; margin-bottom:16px;">
                    Simulate how additional investments or restructuring reduce tax liability using the exact tax rules.
                </p>
                <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-end;">
                    <div style="flex:1; min-width:200px;">
                        <label class="form-label">Proposed Tax Section</label>
                        <select id="tw-sim-section" class="form-select" style="background:#ffffff;">
                            <option value="sec80CCD2">Section 80CCD(2) - Employer NPS (Allowed in New & Old)</option>
                            <option value="sec80C">Section 80C - PPF / ELSS / Life Insurance (Old Regime)</option>
                            <option value="sec80D">Section 80D - Health Insurance (Old Regime)</option>
                            <option value="sec24b">Section 24(b) - Home Loan Interest (Old Regime)</option>
                        </select>
                    </div>
                    <div style="width:180px;">
                        <label class="form-label">Proposed Amount (₹)</label>
                        <input type="number" id="tw-sim-amount" class="form-input" style="background:#ffffff;" value="50000" min="5000" step="5000">
                    </div>
                    <button type="button" class="btn btn-primary" id="btn-run-simulation" style="background:#7c3aed; border-color:#6d28d9;">
                        Simulate Saving
                    </button>
                </div>
                <div id="simulation-output-area" style="margin-top:16px;"></div>
            </div>

            <!-- Report and Action Area -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:12px;">
                <div style="font-size:0.85rem; color:var(--text-muted);">
                    Internal computation memo prepared pursuant to the Income-tax Act, 1961.
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" onclick="window.printCalculationMemo()">
                        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print Computation Report
                    </button>
                </div>
            </div>
        `;

        // Simulation runner
        document.getElementById('btn-run-simulation').addEventListener('click', async () => {
            const section = document.getElementById('tw-sim-section').value;
            const amount = Number(document.getElementById('tw-sim-amount').value) || 0;
            const simArea = document.getElementById('simulation-output-area');

            try {
                const simRes = await API.simulateTax({
                    baseInput: state.lastTaxCalculation.inputs,
                    proposedSection: section,
                    proposedAmount: amount,
                    clientId: client ? client.id : null
                });

                const s = simRes.data;
                simArea.innerHTML = `
                    <div style="background:#ffffff; border:1px solid #d8b4fe; border-radius:8px; padding:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong style="color:#581c87; font-size:1rem;">Simulation Outcome:</strong>
                            <span class="badge ${s.isRegimeEligible ? 'badge-success' : 'badge-danger'}">
                                ${s.isRegimeEligible ? 'Regime Eligible' : 'Disallowed in Active Regime'}
                            </span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">${s.explanation}</p>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; background:#faf5ff; padding:10px; border-radius:6px; font-size:0.85rem;">
                            <div>Original Tax: <strong>${formatINR(s.currentTax)}</strong></div>
                            <div>Revised Tax: <strong>${formatINR(s.revisedTax)}</strong></div>
                            <div>Net Tax Saved: <strong style="color:var(--success);">${formatINR(s.taxSaved)}</strong></div>
                            <div>Net Cash Outflow: <strong>${formatINR(s.netCashOutflow)}</strong></div>
                            <div>ROI / Efficiency: <strong>${s.efficiencyPercentage}%</strong></div>
                        </div>
                    </div>
                `;
            } catch (err) {
                simArea.innerHTML = `<p style="color:var(--danger); font-size:0.85rem;">Simulation failed: ${err.message}</p>`;
            }
        });
    }

    // Save calculation linked to client with versioning
    async function saveActiveCalculationToClient(client) {
        if (!state.lastTaxCalculation) {
            showToast('Please run the tax calculation first before saving.', 'error');
            return;
        }

        const bodyHtml = `
            <div class="form-group">
                <label class="form-label">Review Status</label>
                <select id="calc-save-status" class="form-select">
                    <option value="Under Review" selected>Under Review (Submit for CA Review)</option>
                    <option value="Calculated">Calculated</option>
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Tax Assessment Notes / Remarks</label>
                <textarea id="calc-save-notes" class="form-textarea" rows="3" placeholder="Notes on deductions claimed, AIS/26AS reconciliation, or filing advice..."></textarea>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-save-calc">Save Versioned Calculation</button>
        `;

        openModal(`Save Tax Calculation: ${client.name}`, bodyHtml, footerHtml);

        document.getElementById('btn-confirm-save-calc').addEventListener('click', async () => {
            const status = document.getElementById('calc-save-status').value;
            const notes = document.getElementById('calc-save-notes').value;

            try {
                const res = await API.saveCalculation({
                    clientId: client.id,
                    financialYear: state.lastTaxCalculation.inputs.financialYear,
                    taxpayerType: state.lastTaxCalculation.inputs.taxpayerType,
                    inputs: state.lastTaxCalculation.inputs,
                    results: state.lastTaxCalculation.results,
                    regimeSelected: state.lastTaxCalculation.results.comparison?.recommendedRegime || 'new',
                    status,
                    notes
                });

                closeModal();
                showToast(`Saved calculation as Version ${res.data.version} for ${client.name}!`);
                // Switch to Tax History tab to inspect saved record
                switchClientTab('tax-history', client.id);
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Tab 3: Tax History
    async function renderClientTabTaxHistory(container, client) {
        const calcsRes = await API.getClientCalculations(client.id);
        const calculations = calcsRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Tax Computation History & Version Audit</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                            Complete audit trail of versioned calculations prepared for ${client.name}.
                        </p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="window.switchClientTab('taxwise', '${client.id}')">
                        + New Calculation Version
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Tax Year</th>
                                <th>Date Prepared</th>
                                <th>Regime</th>
                                <th>Computed Tax</th>
                                <th>Prepared By</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${calculations.map(calc => `
                                <tr>
                                    <td style="font-weight:700;">v${calc.version}</td>
                                    <td style="font-weight:600; color:var(--primary);">${calc.financialYear}</td>
                                    <td>${formatDate(calc.createdAt)}</td>
                                    <td><span class="badge ${calc.regimeSelected === 'new' ? 'badge-success' : 'badge-info'}">${calc.regimeSelected.toUpperCase()}</span></td>
                                    <td style="font-weight:700;">${formatINR(calc.results?.totalTax)}</td>
                                    <td>${calc.preparedBy || 'Staff'}</td>
                                    <td>
                                        <span class="badge ${calc.status === 'Approved' ? 'badge-success' : calc.status === 'Under Review' ? 'badge-warning' : calc.status === 'Superseded' ? 'badge-gray' : 'badge-info'}">
                                            ${calc.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <button class="btn btn-secondary btn-sm" onclick="window.loadSavedCalculationIntoTaxWise('${calc.id}')">
                                                Reopen
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="window.openStatusModal('${calc.id}', '${calc.status}')">
                                                Status
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="window.viewCalculationReport('${calc.id}')">
                                                Report
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="8" class="empty-state">No saved tax calculations yet.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Modal to change calculation status (e.g. Approve)
    window.openStatusModal = function(calcId, currentStatus) {
        const bodyHtml = `
            <div class="form-group">
                <label class="form-label">Update Review Status</label>
                <select id="update-status-val" class="form-select">
                    <option value="Under Review" ${currentStatus === 'Under Review' ? 'selected' : ''}>Under Review</option>
                    <option value="Approved" ${currentStatus === 'Approved' ? 'selected' : ''}>Approved (CA Verified)</option>
                    <option value="Finalized" ${currentStatus === 'Finalized' ? 'selected' : ''}>Finalized</option>
                    <option value="Awaiting Documents" ${currentStatus === 'Awaiting Documents' ? 'selected' : ''}>Awaiting Documents</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Reviewer Notes</label>
                <textarea id="update-status-notes" class="form-textarea" rows="2" placeholder="Add verification feedback..."></textarea>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-status-update">Update Status</button>
        `;

        openModal(`Update Calculation Status (${calcId})`, bodyHtml, footerHtml);

        document.getElementById('btn-save-status-update').addEventListener('click', async () => {
            const status = document.getElementById('update-status-val').value;
            const notes = document.getElementById('update-status-notes').value;

            try {
                await API.updateCalculationStatus(calcId, status, notes);
                closeModal();
                showToast(`Status updated to ${status}`);
                if (state.activeClient) {
                    renderClientTabTaxHistory(document.getElementById('client-tab-content'), state.activeClient);
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    // Load saved calculation back into TaxWise inputs
    window.loadSavedCalculationIntoTaxWise = async function(calcId) {
        try {
            const res = await API.getCalculationById(calcId);
            const calc = res.data;
            if (!calc) return;

            // Switch to TaxWise tab
            if (state.activeClient) {
                switchClientTab('taxwise', state.activeClient.id);
            } else {
                navigateTo('taxwise');
            }

            // Fill form inputs via TaxWiseCore
            setTimeout(() => {
                if (window.TaxWiseCore) {
                    window.TaxWiseCore.populateFormFromData(calc);
                    showToast(`Loaded calculation Version ${calc.version} into TaxWise!`);
                } else if (calc.inputs) {
                    const inp = calc.inputs;
                    if (document.getElementById('taxwise-fy-select')) document.getElementById('taxwise-fy-select').value = calc.financialYear || '2026-2027';
                    if (document.getElementById('tw-taxpayer-type')) document.getElementById('tw-taxpayer-type').value = calc.taxpayerType || 'individual';
                    if (document.getElementById('tw-inc-salary')) document.getElementById('tw-inc-salary').value = inp.salaryIncome || 0;
                    if (document.getElementById('tw-inc-business')) document.getElementById('tw-inc-business').value = inp.businessIncome || 0;
                    if (document.getElementById('tw-inc-hp-interest')) document.getElementById('tw-inc-hp-interest').value = inp.housePropertyLoanInterest || 0;
                    if (document.getElementById('tw-inc-stcg')) document.getElementById('tw-inc-stcg').value = inp.stcg111A || 0;
                    if (document.getElementById('tw-inc-ltcg')) document.getElementById('tw-inc-ltcg').value = inp.ltcg112A || 0;
                    if (document.getElementById('tw-inc-other')) document.getElementById('tw-inc-other').value = inp.interestIncome || 0;
                    if (document.getElementById('tw-ded-80c')) document.getElementById('tw-ded-80c').value = inp.sec80C || 0;
                    if (document.getElementById('tw-ded-80d')) document.getElementById('tw-ded-80d').value = inp.sec80D || 0;
                    if (document.getElementById('tw-ded-80ccd2')) document.getElementById('tw-ded-80ccd2').value = inp.sec80CCD2 || 0;

                    const resultsArea = document.getElementById('taxwise-results-area');
                    if (resultsArea && calc.results) {
                        resultsArea.style.display = 'block';
                        state.lastTaxCalculation = {
                            inputs: calc.inputs,
                            results: calc.results
                        };
                        renderCalculationResults(resultsArea, calc.results, state.activeClient);
                        showToast(`Loaded calculation Version ${calc.version} into TaxWise!`);
                    }
                }
            }, 120);
        } catch (err) {
            showToast('Failed to load calculation: ' + err.message, 'error');
        }
    };

    // View & Print Detailed Tax Memorandum
    window.viewCalculationReport = async function(calcId) {
        try {
            const res = await API.getCalculationReport(calcId);
            const rep = res.data;
            if (!rep) return;

            const bodyHtml = `
                <div id="print-tax-report-content" style="font-family:'Plus Jakarta Sans', sans-serif; color:#0f172a; line-height:1.5;">
                    <!-- Firm Header -->
                    <div style="border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h2 style="font-size:1.3rem; font-weight:800; color:#0f172a; margin:0;">${rep.firm.name}</h2>
                            <div style="font-size:0.8rem; color:#475569;">${rep.firm.address} | FRN: ${rep.firm.frn}</div>
                            <div style="font-size:0.8rem; color:#475569;">Signatory: ${rep.firm.partner}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="background:#0f172a; color:#ffffff; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:4px;">
                                TAX COMPUTATION MEMO
                            </span>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:4px;">Report ID: ${rep.reportId}</div>
                            <div style="font-size:0.78rem; color:#64748b;">Generated: ${formatDate(rep.generatedAt)}</div>
                        </div>
                    </div>

                    <!-- Client Summary -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:18px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.85rem;">
                        <div><strong>Client Name:</strong> ${rep.client.name}</div>
                        <div><strong>PAN:</strong> <span style="font-family:monospace; font-weight:700;">${rep.client.pan}</span></div>
                        <div><strong>Assessment Year:</strong> ${rep.assessmentYear} (${rep.taxYear})</div>
                        <div><strong>Taxpayer Category:</strong> ${rep.client.taxpayerType.toUpperCase()}</div>
                        <div><strong>Calculation Version:</strong> v${rep.version} (${rep.status})</div>
                        <div><strong>Prepared By:</strong> ${rep.preparedBy}</div>
                    </div>

                    <!-- Computation Breakdown Table -->
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:18px;">
                        <thead>
                            <tr style="background:#f1f5f9; text-align:left;">
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1;">Particulars</th>
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Gross Total Income (5 Heads)</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:700;">${formatINR(rep.computation.grossIncome)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Standard Deduction</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(rep.computation.standardDeduction || 75000)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Chapter VI-A / Other Deductions Claimed</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(rep.computation.totalEligibleDeductions || 0)}</td>
                            </tr>
                            <tr style="background:#fafafa;">
                                <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-weight:700;">Taxable Total Income</td>
                                <td style="padding:8px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">${formatINR(rep.computation.taxableIncome)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Ordinary Progressive Slab Tax</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(rep.computation.ordinarySlabTax || rep.computation.baseTax)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Special Rate Tax (Capital Gains 111A/112A)</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(rep.computation.specialRateTax?.totalSpecialTax || 0)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; color:var(--success);">Less: Section 87A Tax Rebate</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right; color:var(--success); font-weight:700;">-${formatINR(rep.computation.rebate87A?.amount || 0)}</td>
                            </tr>
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9;">Health & Education Cess (4%)</td>
                                <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(rep.computation.cess)}</td>
                            </tr>
                            <tr style="background:#ecfdf5; font-size:1rem;">
                                <td style="padding:10px 8px; border-top:2px solid #10b981; font-weight:800; color:#065f46;">NET ESTIMATED TAX PAYABLE</td>
                                <td style="padding:10px 8px; border-top:2px solid #10b981; text-align:right; font-weight:800; color:#065f46;">${formatINR(rep.computation.totalTax)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="font-size:0.75rem; color:#64748b; font-style:italic; border-top:1px dashed #cbd5e1; padding-top:8px;">
                        ${rep.disclaimer}
                    </div>
                </div>
            `;

            const footerHtml = `
                <button class="btn btn-secondary" onclick="window.closeAppModal()">Close</button>
                <button class="btn btn-primary" onclick="window.printReportContent()">Print Memorandum</button>
            `;

            openModal('Tax Computation Memorandum', bodyHtml, footerHtml);
        } catch (err) {
            showToast('Failed to generate report: ' + err.message, 'error');
        }
    };

    window.printReportContent = function() {
        window.print();
    };

    window.printCalculationMemo = function() {
        window.print();
    };

    // Tab 4: Documents
    async function renderClientTabDocuments(container, client) {
        const docsRes = await API.getDocuments({ clientId: client.id });
        const docs = docsRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Client Tax & Audit Documents</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                            Securely uploaded Form 16, interest certificates, AIS statements, and financials.
                        </p>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-upload-doc-modal">
                        + Upload Document
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Document Name</th>
                                <th>Category</th>
                                <th>Tax Year</th>
                                <th>Size</th>
                                <th>Upload Date</th>
                                <th>Review Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${docs.map(doc => `
                                <tr>
                                    <td>
                                        <div style="font-weight:600;">${doc.originalName}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">${doc.notes || 'No remarks'}</div>
                                    </td>
                                    <td><span class="badge badge-gray">${doc.category}</span></td>
                                    <td>${doc.taxYear}</td>
                                    <td>${Math.round(doc.fileSize / 1024)} KB</td>
                                    <td>${formatDate(doc.uploadedAt)}</td>
                                    <td>
                                        <span class="badge ${doc.reviewStatus === 'Verified' ? 'badge-success' : doc.reviewStatus === 'Needs Clarification' ? 'badge-warning' : doc.reviewStatus === 'Rejected' ? 'badge-danger' : 'badge-info'}">
                                            ${doc.reviewStatus}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <a href="/api/documents/${doc.id}/download" class="btn btn-secondary btn-sm" target="_blank">
                                                Download
                                            </a>
                                            <button class="btn btn-secondary btn-sm" onclick="window.verifyDocModal('${doc.id}', '${doc.reviewStatus}')">
                                                Verify
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="7" class="empty-state">No documents uploaded for this client.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-upload-doc-modal').addEventListener('click', () => openUploadDocModal(client));
    }

    function openUploadDocModal(client) {
        const bodyHtml = `
            <form id="form-upload-doc">
                <div class="form-group">
                    <label class="form-label">Document Category *</label>
                    <select id="doc-upload-category" class="form-select" required>
                        <option value="Salary statements">Salary statements (Form 16)</option>
                        <option value="Bank statements">Bank statements & Interest Certificates</option>
                        <option value="Investment proofs">Investment proofs (80C, 80D, NPS)</option>
                        <option value="Loan interest certificates">Loan interest certificates (Sec 24b)</option>
                        <option value="Financial statements">Financial statements & P&L</option>
                        <option value="Business records">Business records & Invoices</option>
                        <option value="Tax computation reports">Tax computation reports</option>
                        <option value="Filing acknowledgements">Filing acknowledgements (ITR-V)</option>
                        <option value="Other supporting documents">Other supporting documents</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Select File *</label>
                    <input type="file" id="doc-upload-file" class="form-input">
                    <span style="font-size:0.75rem; color:var(--text-muted);">PDF, Excel, Word or Images up to 25MB</span>
                </div>
                <div class="form-group">
                    <label class="form-label">Tax Assessment Year</label>
                    <select id="doc-upload-year" class="form-select">
                        <option value="2026-2027">FY 2026-27 (AY 2027-28)</option>
                        <option value="2025-2026">FY 2025-26 (AY 2026-27)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Document Notes / Verification Remarks</label>
                    <textarea id="doc-upload-notes" class="form-textarea" rows="2" placeholder="e.g. HDFC Bank Housing Loan interest certificate..."></textarea>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-upload-doc">Upload Document</button>
        `;

        openModal(`Upload Document: ${client.name}`, bodyHtml, footerHtml);

        document.getElementById('btn-submit-upload-doc').addEventListener('click', async () => {
            const fileInput = document.getElementById('doc-upload-file');
            const category = document.getElementById('doc-upload-category').value;
            const taxYear = document.getElementById('doc-upload-year').value;
            const notes = document.getElementById('doc-upload-notes').value;

            const formData = new FormData();
            formData.append('clientId', client.id);
            formData.append('category', category);
            formData.append('taxYear', taxYear);
            formData.append('notes', notes);

            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            } else {
                // Metadata demo fallback
                formData.append('fileName', 'Manual_Proof_' + Date.now() + '.pdf');
            }

            try {
                await API.uploadDocument(formData);
                closeModal();
                showToast('Document uploaded and marked for CA verification!');
                renderClientTabDocuments(document.getElementById('client-tab-content'), client);
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    window.verifyDocModal = function(docId, currentStatus) {
        const bodyHtml = `
            <div class="form-group">
                <label class="form-label">Verification Decision</label>
                <select id="verify-doc-status" class="form-select">
                    <option value="Verified" ${currentStatus === 'Verified' ? 'selected' : ''}>Verified (Matches 26AS/AIS)</option>
                    <option value="Needs Clarification" ${currentStatus === 'Needs Clarification' ? 'selected' : ''}>Needs Clarification from Client</option>
                    <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected (Ineligible / Disallowed)</option>
                    <option value="Pending Verification" ${currentStatus === 'Pending Verification' ? 'selected' : ''}>Pending Verification</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Review Remarks</label>
                <textarea id="verify-doc-notes" class="form-textarea" rows="2" placeholder="e.g. Verified with TRACES portal..."></textarea>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-doc-verify">Save Verification</button>
        `;

        openModal('Verify Client Document', bodyHtml, footerHtml);

        document.getElementById('btn-save-doc-verify').addEventListener('click', async () => {
            const status = document.getElementById('verify-doc-status').value;
            const notes = document.getElementById('verify-doc-notes').value;

            try {
                await API.updateDocumentStatus(docId, status, notes);
                closeModal();
                showToast(`Document status updated to ${status}`);
                if (state.activeClient) {
                    renderClientTabDocuments(document.getElementById('client-tab-content'), state.activeClient);
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    // Tab 5: Tasks
    async function renderClientTabTasks(container, client) {
        const tasksRes = await API.getTasks({ clientId: client.id });
        const tasks = tasksRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Client Tasks & Assignments</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                            Track preparation, review, and follow-ups for ${client.name}.
                        </p>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-add-client-task">
                        + New Task
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Task Title</th>
                                <th>Category</th>
                                <th>Due Date</th>
                                <th>Priority</th>
                                <th>Assigned Staff</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tasks.map(t => `
                                <tr>
                                    <td>
                                        <div style="font-weight:600;">${t.title}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">${t.description || ''}</div>
                                    </td>
                                    <td><span class="badge badge-gray">${t.category}</span></td>
                                    <td style="font-weight:600;">${formatDate(t.dueDate)}</td>
                                    <td>
                                        <span class="badge ${t.priority === 'Urgent' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : 'badge-info'}">
                                            ${t.priority}
                                        </span>
                                    </td>
                                    <td>${t.assignedStaffName || 'Staff'}</td>
                                    <td>
                                        <span class="badge ${t.status === 'Completed' ? 'badge-success' : t.status === 'Under Review' ? 'badge-purple' : 'badge-gray'}">
                                            ${t.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="window.openEditTaskModal('${t.id}')">
                                            Update
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="7" class="empty-state">No open tasks for this client.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-client-task').addEventListener('click', () => openNewTaskModal(client));
    }

    function openNewTaskModal(client = null) {
        const bodyHtml = `
            <form id="form-new-task">
                <div class="form-group">
                    <label class="form-label">Task Title *</label>
                    <input type="text" id="task-title" class="form-input" placeholder="e.g. Verify Form 16 and Reconcile AIS" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Detailed Instructions</label>
                    <textarea id="task-desc" class="form-textarea" rows="2" placeholder="Specific items to review..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select id="task-priority" class="form-select">
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date</label>
                        <input type="date" id="task-duedate" class="form-input" value="${new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10)}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="task-category" class="form-select">
                            <option value="Tax Computation">Tax Computation</option>
                            <option value="Document Collection">Document Collection</option>
                            <option value="Audit">Audit</option>
                            <option value="Filing">Filing</option>
                            <option value="Compliance">Compliance</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Assign To Staff</label>
                        <select id="task-staff" class="form-select">
                            ${state.staffList.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name} (${s.role})</option>`).join('')}
                        </select>
                    </div>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-create-task">Create Task</button>
        `;

        openModal('Create New Office Task', bodyHtml, footerHtml);

        document.getElementById('btn-submit-create-task').addEventListener('click', async () => {
            const title = document.getElementById('task-title').value;
            const description = document.getElementById('task-desc').value;
            const priority = document.getElementById('task-priority').value;
            const dueDate = document.getElementById('task-duedate').value;
            const category = document.getElementById('task-category').value;
            const staffSelect = document.getElementById('task-staff');
            const assignedStaffId = staffSelect.value;
            const assignedStaffName = staffSelect.selectedOptions[0]?.getAttribute('data-name');

            if (!title.trim()) {
                showToast('Please enter a task title.', 'error');
                return;
            }

            try {
                await API.createTask({
                    title,
                    description,
                    priority,
                    dueDate,
                    category,
                    assignedStaffId,
                    assignedStaffName,
                    clientId: client ? client.id : null
                });

                closeModal();
                showToast('Task created successfully!');
                if (client) {
                    renderClientTabTasks(document.getElementById('client-tab-content'), client);
                } else if (state.currentRoute === 'tasks') {
                    renderTasksPage(document.getElementById('workspace-content'));
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    window.openEditTaskModal = async function(taskId) {
        try {
            const res = await API.getTasks();
            const task = (res.data || []).find(t => t.id === taskId);
            if (!task) return;

            const bodyHtml = `
                <div class="form-group">
                    <label class="form-label">Task Status</label>
                    <select id="edit-task-status" class="form-select">
                        <option value="To Do" ${task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                        <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Waiting for Client" ${task.status === 'Waiting for Client' ? 'selected' : ''}>Waiting for Client</option>
                        <option value="Under Review" ${task.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                        <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${task.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Priority</label>
                    <select id="edit-task-priority" class="form-select">
                        <option value="Urgent" ${task.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
                        <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                        <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                        <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
                    </select>
                </div>
            `;

            const footerHtml = `
                <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
                <button class="btn btn-primary" id="btn-save-edit-task">Update Task</button>
            `;

            openModal(`Update Task: ${task.title}`, bodyHtml, footerHtml);

            document.getElementById('btn-save-edit-task').addEventListener('click', async () => {
                const status = document.getElementById('edit-task-status').value;
                const priority = document.getElementById('edit-task-priority').value;

                try {
                    await API.updateTask(taskId, { status, priority });
                    closeModal();
                    showToast('Task updated successfully!');
                    if (state.activeClient) {
                        renderClientTabTasks(document.getElementById('client-tab-content'), state.activeClient);
                    } else if (state.currentRoute === 'tasks') {
                        renderTasksPage(document.getElementById('workspace-content'));
                    }
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        } catch (e) {
            showToast('Error loading task: ' + e.message, 'error');
        }
    };

    // Tab 6: Compliance
    async function renderClientTabCompliance(container, client) {
        const cmpRes = await API.getCompliance({ clientId: client.id });
        const items = cmpRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Statutory Compliance Calendar</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                            Statutory Advance Tax, TDS, and ITR deadlines for ${client.name}.
                        </p>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-add-client-compliance">
                        + Add Compliance Deadline
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Statutory Due Date</th>
                                <th>Compliance Event</th>
                                <th>Type</th>
                                <th>Year</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td style="font-weight:700; color:var(--primary);">${formatDate(item.dueDate)}</td>
                                    <td>
                                        <div style="font-weight:600;">${item.title}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">${item.notes || ''}</div>
                                    </td>
                                    <td><span class="badge badge-info">${item.complianceType}</span></td>
                                    <td>${item.taxYear}</td>
                                    <td>
                                        <span class="badge ${item.status === 'Filed / Completed' ? 'badge-success' : item.status === 'Due Soon' ? 'badge-warning' : 'badge-purple'}">
                                            ${item.status}
                                        </span>
                                    </td>
                                    <td>
                                        ${item.status !== 'Filed / Completed' ? `
                                            <button class="btn btn-success btn-sm" onclick="window.markComplianceCompleted('${item.id}')">
                                                Mark Filed
                                            </button>
                                        ` : `
                                            <span style="font-size:0.8rem; color:var(--success);">✓ Completed</span>
                                        `}
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="6" class="empty-state">No statutory deadlines recorded.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-client-compliance').addEventListener('click', () => openNewComplianceModal(client));
    }

    function openNewComplianceModal(client = null) {
        const bodyHtml = `
            <form id="form-new-compliance">
                <div class="form-group">
                    <label class="form-label">Statutory Compliance Title *</label>
                    <input type="text" id="cmp-title" class="form-input" placeholder="e.g. Advance Tax 1st Installment (15%)" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Compliance Type</label>
                        <select id="cmp-type" class="form-select">
                            <option value="Income Tax">Income Tax</option>
                            <option value="TDS">TDS</option>
                            <option value="GST">GST</option>
                            <option value="Corporate">Corporate</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Statutory Due Date *</label>
                        <input type="date" id="cmp-duedate" class="form-input" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Tax Assessment Year</label>
                    <select id="cmp-year" class="form-select">
                        <option value="2026-2027">FY 2026-27 (AY 2027-28)</option>
                        <option value="2025-2026">FY 2025-26 (AY 2026-27)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Statutory Section / Notes</label>
                    <textarea id="cmp-notes" class="form-textarea" rows="2" placeholder="e.g. Under Section 208/211 of the Income-tax Act, 1961..."></textarea>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-compliance">Save Compliance Item</button>
        `;

        openModal('Add Compliance Item', bodyHtml, footerHtml);

        document.getElementById('btn-submit-compliance').addEventListener('click', async () => {
            const title = document.getElementById('cmp-title').value;
            const complianceType = document.getElementById('cmp-type').value;
            const dueDate = document.getElementById('cmp-duedate').value;
            const taxYear = document.getElementById('cmp-year').value;
            const notes = document.getElementById('cmp-notes').value;

            if (!title || !dueDate) {
                showToast('Please enter title and due date.', 'error');
                return;
            }

            try {
                await API.createCompliance({
                    title,
                    complianceType,
                    dueDate,
                    taxYear,
                    notes,
                    clientId: client ? client.id : null
                });

                closeModal();
                showToast('Compliance deadline scheduled successfully!');
                if (client) {
                    renderClientTabCompliance(document.getElementById('client-tab-content'), client);
                } else if (state.currentRoute === 'compliance') {
                    renderCompliancePage(document.getElementById('workspace-content'));
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    window.markComplianceCompleted = async function(id) {
        try {
            await API.updateComplianceStatus(id, 'Filed / Completed', 'Statutory filing executed and verified.');
            showToast('Compliance marked as Filed / Completed!');
            if (state.activeClient) {
                renderClientTabCompliance(document.getElementById('client-tab-content'), state.activeClient);
            } else if (state.currentRoute === 'compliance') {
                renderCompliancePage(document.getElementById('workspace-content'));
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Tab 7: Billing
    async function renderClientTabBilling(container, client) {
        const invRes = await API.getInvoices({ clientId: client.id });
        const invoices = invRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">Client Billing & Fee Invoices</h3>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:2px;">
                            Professional fee invoices, GST computation, and payment records for ${client.name}.
                        </p>
                    </div>
                    <button class="btn btn-primary btn-sm" id="btn-create-client-inv">
                        + Generate Invoice
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Issue Date</th>
                                <th>Due Date</th>
                                <th>Total Fee</th>
                                <th>Paid</th>
                                <th>Balance Due</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoices.map(inv => `
                                <tr>
                                    <td style="font-weight:700; color:var(--primary); font-family:monospace;">${inv.invoiceNumber}</td>
                                    <td>${formatDate(inv.issueDate)}</td>
                                    <td>${formatDate(inv.dueDate)}</td>
                                    <td style="font-weight:700;">${formatINR(inv.totalAmount)}</td>
                                    <td style="color:var(--success); font-weight:600;">${formatINR(inv.paidAmount)}</td>
                                    <td style="color:${inv.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:700;">${formatINR(inv.balanceDue)}</td>
                                    <td>
                                        <span class="badge ${inv.status === 'Paid' ? 'badge-success' : inv.status === 'Partially Paid' ? 'badge-warning' : 'badge-info'}">
                                            ${inv.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            ${inv.balanceDue > 0 ? `
                                                <button class="btn btn-success btn-sm" onclick="window.openRecordPaymentModal('${inv.id}', ${inv.balanceDue})">
                                                    Record Pay
                                                </button>
                                            ` : ''}
                                            <button class="btn btn-secondary btn-sm" onclick="window.viewPrintInvoice('${inv.id}')">
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="8" class="empty-state">No invoices issued for this client yet.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-create-client-inv').addEventListener('click', () => openNewInvoiceModal(client));
    }

    function openNewInvoiceModal(client = null) {
        const bodyHtml = `
            <form id="form-new-invoice">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Service Line Item 1 Description *</label>
                        <input type="text" id="inv-desc-1" class="form-input" value="Income Tax Return Preparation & Planning FY 26-27" required>
                    </div>
                    <div class="form-group" style="width:160px;">
                        <label class="form-label">Amount (₹) *</label>
                        <input type="number" id="inv-amt-1" class="form-input" value="15000" min="500" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Service Line Item 2 Description (Optional)</label>
                        <input type="text" id="inv-desc-2" class="form-input" placeholder="e.g. Capital Gains & TDS Reconciliation">
                    </div>
                    <div class="form-group" style="width:160px;">
                        <label class="form-label">Amount (₹)</label>
                        <input type="number" id="inv-amt-2" class="form-input" placeholder="0" min="0">
                    </div>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:14px; font-size:0.85rem;">
                    <strong>GST Applicability:</strong> Standard Chartered Accountant services (SAC 998231) are taxed at 18% GST (9% CGST + 9% SGST or 18% IGST for interstate clients).
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Issue Date</label>
                        <input type="date" id="inv-issue-date" class="form-input" value="${new Date().toISOString().substring(0, 10)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Payment Due Date</label>
                        <input type="date" id="inv-due-date" class="form-input" value="${new Date(Date.now() + 15 * 86400000).toISOString().substring(0, 10)}">
                    </div>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-submit-create-inv">Generate Official Invoice</button>
        `;

        openModal(`Generate Invoice: ${client ? client.name : 'Client'}`, bodyHtml, footerHtml);

        document.getElementById('btn-submit-create-inv').addEventListener('click', async () => {
            const desc1 = document.getElementById('inv-desc-1').value;
            const amt1 = Number(document.getElementById('inv-amt-1').value) || 0;
            const desc2 = document.getElementById('inv-desc-2').value;
            const amt2 = Number(document.getElementById('inv-amt-2').value) || 0;
            const issueDate = document.getElementById('inv-issue-date').value;
            const dueDate = document.getElementById('inv-due-date').value;

            const items = [{ description: desc1, amount: amt1, hsnSac: '998231', taxRate: 18 }];
            if (desc2 && amt2 > 0) {
                items.push({ description: desc2, amount: amt2, hsnSac: '998231', taxRate: 18 });
            }

            try {
                const res = await API.createInvoice({
                    clientId: client ? client.id : state.clients[0]?.id,
                    items,
                    issueDate,
                    dueDate
                });

                closeModal();
                showToast(`Invoice ${res.data.invoiceNumber} created for ${formatINR(res.data.totalAmount)}!`);
                if (client) {
                    renderClientTabBilling(document.getElementById('client-tab-content'), client);
                } else if (state.currentRoute === 'billing') {
                    renderBillingPage(document.getElementById('workspace-content'));
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    window.openRecordPaymentModal = function(invId, balanceDue) {
        const bodyHtml = `
            <div class="form-group">
                <label class="form-label">Payment Amount (₹) *</label>
                <input type="number" id="pay-amount" class="form-input" value="${balanceDue}" max="${balanceDue}" min="100" required>
                <span style="font-size:0.75rem; color:var(--text-muted);">Outstanding Balance: ${formatINR(balanceDue)}</span>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Payment Mode</label>
                    <select id="pay-mode" class="form-select">
                        <option value="UPI / NetBanking">UPI / NetBanking</option>
                        <option value="Cheque / NEFT">Cheque / NEFT</option>
                        <option value="Bank Transfer">Direct Bank Transfer</option>
                        <option value="Cash Receipt">Cash Receipt (Sec 269ST compliant)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Transaction Reference No.</label>
                    <input type="text" id="pay-ref" class="form-input" placeholder="UTR / UPI Ref Number">
                </div>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-success" id="btn-submit-record-pay">Record Authorized Payment</button>
        `;

        openModal('Record Client Fee Payment', bodyHtml, footerHtml);

        document.getElementById('btn-submit-record-pay').addEventListener('click', async () => {
            const amount = Number(document.getElementById('pay-amount').value) || 0;
            const mode = document.getElementById('pay-mode').value;
            const referenceNo = document.getElementById('pay-ref').value;

            try {
                await API.recordPayment(invId, { amount, mode, referenceNo });
                closeModal();
                showToast(`Payment of ${formatINR(amount)} recorded successfully!`);
                if (state.activeClient) {
                    renderClientTabBilling(document.getElementById('client-tab-content'), state.activeClient);
                } else if (state.currentRoute === 'billing') {
                    renderBillingPage(document.getElementById('workspace-content'));
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    window.viewPrintInvoice = async function(invId) {
        try {
            const res = await API.getInvoiceById(invId);
            const inv = res.data;
            if (!inv) return;

            const bodyHtml = `
                <div id="print-invoice-content" style="font-family:'Plus Jakarta Sans', sans-serif; color:#0f172a; line-height:1.5;">
                    <!-- Firm Header -->
                    <div style="border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h2 style="font-size:1.3rem; font-weight:800; color:#0f172a; margin:0;">${inv.firmDetails?.name || 'Sharma & Associates'}</h2>
                            <div style="font-size:0.8rem; color:#475569;">${inv.firmDetails?.address}</div>
                            <div style="font-size:0.8rem; color:#475569;">GSTIN: ${inv.firmDetails?.gstin} | PAN: ${inv.firmDetails?.pan}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="background:#4f46e5; color:#ffffff; font-size:0.8rem; font-weight:700; padding:4px 10px; border-radius:4px;">
                                TAX INVOICE
                            </span>
                            <div style="font-size:0.85rem; font-weight:700; color:#0f172a; margin-top:6px;">${inv.invoiceNumber}</div>
                            <div style="font-size:0.78rem; color:#64748b;">Date: ${formatDate(inv.issueDate)}</div>
                        </div>
                    </div>

                    <!-- Bill To -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.85rem;">
                        <strong>Billed To:</strong> ${inv.clientName}<br>
                        <strong>PAN:</strong> ${inv.clientPan || 'N/A'} | <strong>Address:</strong> ${inv.clientAddress || 'Client on Record'}
                    </div>

                    <!-- Items Table -->
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:16px;">
                        <thead>
                            <tr style="background:#f1f5f9; text-align:left;">
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1;">Description</th>
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1;">SAC</th>
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">Taxable Amt</th>
                                <th style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">Total (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.items.map(item => `
                                <tr>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${item.description}</td>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9;">${item.hsnSac}</td>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right;">${formatINR(item.amount)}</td>
                                    <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:700;">${formatINR(item.total)}</td>
                                </tr>
                            `).join('')}
                            <tr style="background:#fafafa;">
                                <td colspan="3" style="padding:8px; text-align:right; font-weight:600;">Subtotal:</td>
                                <td style="padding:8px; text-align:right; font-weight:700;">${formatINR(inv.subtotal)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding:6px 8px; text-align:right; color:#64748b;">CGST (9%):</td>
                                <td style="padding:6px 8px; text-align:right;">${formatINR(inv.cgst)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding:6px 8px; text-align:right; color:#64748b;">SGST (9%):</td>
                                <td style="padding:6px 8px; text-align:right;">${formatINR(inv.sgst)}</td>
                            </tr>
                            <tr style="background:#eef2ff; font-size:1rem;">
                                <td colspan="3" style="padding:10px 8px; text-align:right; font-weight:800; color:var(--primary);">TOTAL INVOICE AMOUNT:</td>
                                <td style="padding:10px 8px; text-align:right; font-weight:800; color:var(--primary);">${formatINR(inv.totalAmount)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding:6px 8px; text-align:right; font-weight:600; color:var(--success);">Amount Paid:</td>
                                <td style="padding:6px 8px; text-align:right; font-weight:700; color:var(--success);">${formatINR(inv.paidAmount)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding:6px 8px; text-align:right; font-weight:700; color:${inv.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)'};">Balance Due:</td>
                                <td style="padding:6px 8px; text-align:right; font-weight:800; color:${inv.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${formatINR(inv.balanceDue)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            const footerHtml = `
                <button class="btn btn-secondary" onclick="window.closeAppModal()">Close</button>
                <button class="btn btn-primary" onclick="window.print();">Print Invoice</button>
            `;

            openModal(`Invoice: ${inv.invoiceNumber}`, bodyHtml, footerHtml);
        } catch (e) {
            showToast('Failed to view invoice: ' + e.message, 'error');
        }
    };

    // Tab 8: Activity / Audit Log
    async function renderClientTabActivity(container, client) {
        const actRes = await API.getClientActivity(client.id);
        const logs = actRes.data || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Client Account Activity & Audit History</h3>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Staff Member</th>
                                <th>Action Performed</th>
                                <th>Entity</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${new Date(log.timestamp).toLocaleString('en-IN')}</td>
                                    <td style="font-weight:600;">${log.userName}</td>
                                    <td><span class="badge badge-purple">${log.action}</span></td>
                                    <td>${log.entityType}</td>
                                    <td style="font-size:0.8rem; font-family:monospace;">${JSON.stringify(log.details || {})}</td>
                                </tr>
                            `).join('') || `<tr><td colspan="5" class="empty-state">No recorded activity logs for this client.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================
    // 5. GLOBAL PAGES: TASKS, DOCUMENTS, COMPLIANCE, BILLING, ALERTS, REPORTS, SETTINGS
    // ==========================================
    async function renderTasksPage(container) {
        const res = await API.getTasks();
        const tasks = res.data || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Office Task Management</h1>
                    <p class="page-description">Assign and track preparation, document review, and client filings.</p>
                </div>
                <button class="btn btn-primary" id="btn-global-new-task">+ New Task</button>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Task Title</th>
                                <th>Client</th>
                                <th>Due Date</th>
                                <th>Priority</th>
                                <th>Assigned Staff</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tasks.map(t => `
                                <tr>
                                    <td style="font-weight:600;">${t.title}</td>
                                    <td>
                                        ${t.clientId ? `<a href="#clients/${t.clientId}" style="color:var(--primary); font-weight:600; text-decoration:none;">${t.clientName}</a>` : 'General Office'}
                                    </td>
                                    <td>${formatDate(t.dueDate)}</td>
                                    <td><span class="badge ${t.priority === 'Urgent' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : 'badge-info'}">${t.priority}</span></td>
                                    <td>${t.assignedStaffName || 'Staff'}</td>
                                    <td><span class="badge ${t.status === 'Completed' ? 'badge-success' : 'badge-purple'}">${t.status}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="window.openEditTaskModal('${t.id}')">Update</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('btn-global-new-task').addEventListener('click', () => openNewTaskModal());
    }

    async function renderDocumentsPage(container) {
        const res = await API.getDocuments();
        const docs = res.data || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Document Verification Repository</h1>
                    <p class="page-description">Central store of client tax documents with verification status tracking.</p>
                </div>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Document</th>
                                <th>Client</th>
                                <th>Category</th>
                                <th>Year</th>
                                <th>Upload Date</th>
                                <th>Review Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${docs.map(d => `
                                <tr>
                                    <td style="font-weight:600;">${d.originalName}</td>
                                    <td><a href="#clients/${d.clientId}" style="color:var(--primary); font-weight:600; text-decoration:none;">${d.clientName}</a></td>
                                    <td><span class="badge badge-gray">${d.category}</span></td>
                                    <td>${d.taxYear}</td>
                                    <td>${formatDate(d.uploadedAt)}</td>
                                    <td><span class="badge ${d.reviewStatus === 'Verified' ? 'badge-success' : 'badge-warning'}">${d.reviewStatus}</span></td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            <a href="/api/documents/${d.id}/download" class="btn btn-secondary btn-sm" target="_blank">Download</a>
                                            <button class="btn btn-secondary btn-sm" onclick="window.verifyDocModal('${d.id}', '${d.reviewStatus}')">Verify</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async function renderCompliancePage(container) {
        const res = await API.getCompliance();
        const items = res.data || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Statutory Compliance Calendar</h1>
                    <p class="page-description">Official Advance Tax, TDS return (Form 24Q/26Q), ITR, and Tax Audit (Form 3CA/3CD) deadlines.</p>
                </div>
                <button class="btn btn-primary" id="btn-global-new-compliance">+ Add Compliance Deadline</button>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Statutory Due Date</th>
                                <th>Compliance Event</th>
                                <th>Client</th>
                                <th>Type</th>
                                <th>Year</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td style="font-weight:700; color:var(--primary);">${formatDate(item.dueDate)}</td>
                                    <td style="font-weight:600;">${item.title}</td>
                                    <td>${item.clientName || 'All Clients'}</td>
                                    <td><span class="badge badge-info">${item.complianceType}</span></td>
                                    <td>${item.taxYear}</td>
                                    <td><span class="badge ${item.status === 'Filed / Completed' ? 'badge-success' : 'badge-warning'}">${item.status}</span></td>
                                    <td>
                                        ${item.status !== 'Filed / Completed' ? `
                                            <button class="btn btn-success btn-sm" onclick="window.markComplianceCompleted('${item.id}')">Mark Filed</button>
                                        ` : '<span style="color:var(--success); font-weight:600;">✓ Done</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('btn-global-new-compliance').addEventListener('click', () => openNewComplianceModal());
    }

    async function renderBillingPage(container) {
        const res = await API.getInvoices();
        const invoices = res.data || [];

        const totalBilled = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
        const totalCollected = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
        const totalOutstanding = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Billing & Fee Invoices</h1>
                    <p class="page-description">CA professional fee billing, GST invoices, and collection receipts.</p>
                </div>
                <button class="btn btn-primary" id="btn-global-new-inv">+ Create Invoice</button>
            </div>

            <!-- Billing Summary Metrics -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <span class="metric-title">Total Fees Billed</span>
                    <div class="metric-value" style="margin-top:6px;">${formatINR(totalBilled)}</div>
                </div>
                <div class="metric-card">
                    <span class="metric-title">Total Collected</span>
                    <div class="metric-value" style="margin-top:6px; color:var(--success);">${formatINR(totalCollected)}</div>
                </div>
                <div class="metric-card">
                    <span class="metric-title">Outstanding Receivable</span>
                    <div class="metric-value" style="margin-top:6px; color:${totalOutstanding > 0 ? 'var(--danger)' : 'var(--text-primary)'};">${formatINR(totalOutstanding)}</div>
                </div>
            </div>

            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Client Name</th>
                                <th>Date</th>
                                <th>Total Fee</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoices.map(inv => `
                                <tr>
                                    <td style="font-weight:700; color:var(--primary); font-family:monospace;">${inv.invoiceNumber}</td>
                                    <td><a href="#clients/${inv.clientId}" style="color:var(--text-primary); font-weight:600; text-decoration:none;">${inv.clientName}</a></td>
                                    <td>${formatDate(inv.issueDate)}</td>
                                    <td style="font-weight:700;">${formatINR(inv.totalAmount)}</td>
                                    <td style="color:var(--success);">${formatINR(inv.paidAmount)}</td>
                                    <td style="font-weight:700; color:${inv.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${formatINR(inv.balanceDue)}</td>
                                    <td><span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></td>
                                    <td>
                                        <div style="display:flex; gap:6px;">
                                            ${inv.balanceDue > 0 ? `<button class="btn btn-success btn-sm" onclick="window.openRecordPaymentModal('${inv.id}', ${inv.balanceDue})">Record Pay</button>` : ''}
                                            <button class="btn btn-secondary btn-sm" onclick="window.viewPrintInvoice('${inv.id}')">View</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('btn-global-new-inv').addEventListener('click', () => openNewInvoiceModal());
    }

    async function renderAlertsPage(container) {
        const res = await API.getAlerts();
        const alerts = res.data || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Office Alerts & Notifications</h1>
                    <p class="page-description">Real-time alerts for impending statutory deadlines, unreviewed tax calculations, and missing documents.</p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-mark-all-alerts">Mark All as Read</button>
            </div>
            <div class="card">
                <div style="display:flex; flex-direction:column; gap:12px;">
                    ${alerts.map(a => `
                        <div style="padding:14px; border-radius:8px; border:1px solid ${a.isRead ? '#e2e8f0' : '#bfdbfe'}; background:${a.isRead ? '#ffffff' : '#eff6ff'}; display:flex; justify-content:space-between; align-items:flex-start; gap:14px;">
                            <div>
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                    <strong style="color:var(--text-primary); font-size:0.95rem;">${a.title}</strong>
                                    <span class="badge ${a.severity === 'warning' ? 'badge-warning' : a.severity === 'danger' ? 'badge-danger' : 'badge-info'}">${a.type.toUpperCase()}</span>
                                    ${!a.isRead ? '<span class="badge badge-primary">NEW</span>' : ''}
                                </div>
                                <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">${a.message}</p>
                                <span style="font-size:0.75rem; color:var(--text-muted); display:inline-block; margin-top:4px;">${new Date(a.createdAt).toLocaleString('en-IN')}</span>
                            </div>
                            <div style="display:flex; gap:6px;">
                                ${!a.isRead ? `<button class="btn btn-secondary btn-sm" onclick="window.markAlertAsRead('${a.id}')">Mark Read</button>` : ''}
                                ${a.link ? `<a href="#${a.link.replace('/', '')}" class="btn btn-primary btn-sm">Inspect</a>` : ''}
                            </div>
                        </div>
                    `).join('') || `<div class="empty-state">No alerts. Everything is on schedule!</div>`}
                </div>
            </div>
        `;

        document.getElementById('btn-mark-all-alerts').addEventListener('click', async () => {
            await API.markAllAlertsRead();
            state.unreadAlertsCount = 0;
            renderAlertsPage(container);
        });
    }

    window.markAlertAsRead = async function(id) {
        await API.markAlertRead(id);
        state.unreadAlertsCount = Math.max(0, state.unreadAlertsCount - 1);
        renderAlertsPage(document.getElementById('workspace-content'));
    };

    async function renderReportsPage(container) {
        const res = await API.getReportsSummary();
        const rep = res.data || {};
        const bill = rep.billingOverview || {};
        const comp = rep.complianceOverview || {};
        const recents = rep.recentCalculations || [];

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Executive Reports & Firm Analytics</h1>
                    <p class="page-description">Live aggregated insights across client tax liabilities, quality reviews, billing, and statutory compliance.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-secondary" id="refresh-reports-btn">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Refresh Analytics
                    </button>
                    <button class="btn btn-primary" onclick="window.print()">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print Summary
                    </button>
                </div>
            </div>

            <!-- Top Row: Tax Liabilities & Quality Control -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 class="card-title" style="margin:0;">Tax Liabilities by Assessment Year</h3>
                        <span style="font-size:0.75rem; background:#eff6ff; color:#2563eb; padding:2px 8px; border-radius:4px; font-weight:600;">LIVE AGGREGATE</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${Object.entries(rep.taxSummaryByYear || {}).map(([yr, data]) => `
                            <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:var(--primary); font-size:1rem;">FY ${yr}</strong>
                                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                                        ${data.count} calculations (${data.newRegimeCount} New Regime, ${data.oldRegimeCount} Old Regime)
                                    </div>
                                </div>
                                <div style="font-weight:800; font-size:1.15rem; color:var(--text-primary);">${formatINR(data.totalTaxComputed)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 class="card-title" style="margin:0;">Review & Quality Control</h3>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Click to inspect</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;">
                        <a href="#tasks" style="text-decoration:none; color:inherit; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f8fafc; border-radius:6px; transition:all 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span>Calculations Awaiting Review</span>
                            <span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;">${(rep.awaitingReview || []).length} pending &rarr;</span>
                        </a>
                        <a href="#documents" style="text-decoration:none; color:inherit; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f8fafc; border-radius:6px; transition:all 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                            <span>Pending Documents to Verify</span>
                            <span class="badge" style="background:#dbeafe; color:#1e40af; font-weight:700;">${(rep.pendingDocs || []).length} unverified &rarr;</span>
                        </a>
                        <a href="#tasks" style="text-decoration:none; color:inherit; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fef2f2; border-radius:6px; transition:all 0.15s ease;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">
                            <span style="color:#991b1b; font-weight:600;">Overdue Office Tasks</span>
                            <span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:800;">${(rep.overdueTasks || []).length} overdue &rarr;</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Middle Row: Operational Health (Billing & Statutory Compliance) -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; margin-bottom:24px;">
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 class="card-title" style="margin:0;">Firm Billing & Collections Health</h3>
                        <a href="#billing" style="font-size:0.8rem; color:var(--primary); font-weight:600; text-decoration:none;">Go to Invoices &rarr;</a>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; text-align:center;">
                        <div style="padding:10px; background:#f8fafc; border-radius:6px;">
                            <div style="font-size:0.75rem; color:var(--text-muted);">Total Billed</div>
                            <div style="font-size:1rem; font-weight:700; color:var(--text-primary); margin-top:2px;">${formatINR(bill.totalBilled)}</div>
                        </div>
                        <div style="padding:10px; background:#f0fdf4; border-radius:6px;">
                            <div style="font-size:0.75rem; color:#166534;">Collected</div>
                            <div style="font-size:1rem; font-weight:700; color:#15803d; margin-top:2px;">${formatINR(bill.totalCollected)}</div>
                        </div>
                        <div style="padding:10px; background:#fef2f2; border-radius:6px;">
                            <div style="font-size:0.75rem; color:#991b1b;">Receivable</div>
                            <div style="font-size:1rem; font-weight:700; color:#b91c1c; margin-top:2px;">${formatINR(bill.totalOutstanding)}</div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 class="card-title" style="margin:0;">Statutory Compliance Health</h3>
                        <a href="#compliance" style="font-size:0.8rem; color:var(--primary); font-weight:600; text-decoration:none;">Go to Calendar &rarr;</a>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; text-align:center;">
                        <div style="padding:10px; background:#eff6ff; border-radius:6px;">
                            <div style="font-size:0.75rem; color:#1e40af;">Upcoming Filings</div>
                            <div style="font-size:1.1rem; font-weight:700; color:#1d4ed8; margin-top:2px;">${comp.upcoming || 0} Deadlines</div>
                        </div>
                        <div style="padding:10px; background:#f0fdf4; border-radius:6px;">
                            <div style="font-size:0.75rem; color:#166534;">Filed / Completed</div>
                            <div style="font-size:1.1rem; font-weight:700; color:#15803d; margin-top:2px;">${comp.completed || 0} Returns</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Row: Recent Client Tax Computations Table -->
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <h3 class="card-title" style="margin:0;">Recent Client Tax Computations (Audit Feed)</h3>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${rep.totalCalculationsCount || 0} total computations on record</span>
                </div>
                <div class="table-container">
                    <table class="table" style="width:100%;">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Category</th>
                                <th>Financial Year</th>
                                <th>Regime</th>
                                <th>Computed Tax</th>
                                <th>Review Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recents.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No calculations recorded yet.</td></tr>' : recents.map(c => `
                                <tr>
                                    <td><strong>${escapeHtml(c.clientName)}</strong></td>
                                    <td><span style="text-transform:uppercase; font-size:0.75rem; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${escapeHtml(c.taxpayerType)}</span></td>
                                    <td>${escapeHtml(c.financialYear)}</td>
                                    <td><span class="badge" style="${c.regime === 'new' ? 'background:#dbeafe; color:#1e40af;' : 'background:#f1f5f9; color:#475569;'}">${(c.regime || 'new').toUpperCase()}</span></td>
                                    <td style="font-weight:700;">${formatINR(c.totalTax)}</td>
                                    <td>
                                        <span class="badge" style="${
                                            c.status === 'Approved' ? 'background:#dcfce7; color:#15803d;' :
                                            c.status === 'Under Review' ? 'background:#fef3c7; color:#92400e;' :
                                            c.status === 'Finalized' ? 'background:#e0e7ff; color:#3730a3;' :
                                            'background:#f1f5f9; color:#475569;'
                                        }">${escapeHtml(c.status)}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('refresh-reports-btn').addEventListener('click', async () => {
            showToast('Refreshing live reports data...', 'info');
            await renderReportsPage(container);
            showToast('Analytics updated with latest database state!', 'success');
        });
    }

    async function renderSettingsPage(container) {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Firm Settings & Staff Roles</h1>
                    <p class="page-description">Chartered Accountant office profile, staff access control, and database synchronization.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:24px;">
                <div class="card">
                    <h3 class="card-title" style="margin-bottom:14px;">Firm Profile</h3>
                    <div style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;">
                        <div><strong>Firm Name:</strong> Sharma & Associates, Chartered Accountants</div>
                        <div><strong>Firm Registration No (FRN):</strong> 104829W</div>
                        <div><strong>Principal Place:</strong> Corporate Suites 401, Nariman Point, Mumbai - 400021</div>
                        <div><strong>Managing Partner:</strong> CA Rajesh Sharma (FCA 104829)</div>
                        <div><strong>Integrated Tax Engine:</strong> TaxWise Indian Income Tax Calculator (Active)</div>
                        <div><strong>Local Port:</strong> Port 3001 (CA Desk) | Port 3000 (TaxWise Standalone)</div>
                    </div>
                </div>

                <div class="card">
                    <h3 class="card-title" style="margin-bottom:14px;">Staff Members & Role Permissions</h3>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${state.staffList.map(s => `
                            <div style="padding:10px; background:#f8fafc; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <strong style="color:var(--text-primary);">${s.name}</strong>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">${s.email}</div>
                                </div>
                                <span class="badge ${s.role === 'admin' ? 'badge-danger' : s.role === 'reviewer' ? 'badge-warning' : 'badge-info'}">
                                    ${s.role.toUpperCase()}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Helper: Debounce
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Global Exposed Functions
    window.launchTaxWiseForClient = function(clientId) {
        state.activeClientTab = 'taxwise';
        navigateTo('clients', { id: clientId });
    };

    window.closeAppModal = closeModal;
    window.openAppModal = openModal;
    window.showAppToast = showToast;
    window.openModal = openModal;
    window.showToast = showToast;
    window.switchClientTab = switchClientTab;
    window.navigateTo = navigateTo;
    window.getState = () => state;

    // Attach Topbar & Navigation Event Listeners
    function setupEventListeners() {
        window.addEventListener('hashchange', handleHashChange);

        // Sidebar Navigation clicks
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const route = item.getAttribute('data-route');
                navigateTo(route);
            });
        });

        // Topbar Role Switcher
        const roleSwitcher = document.getElementById('role-switcher-select');
        if (roleSwitcher) {
            roleSwitcher.addEventListener('change', async (e) => {
                const userId = e.target.value;
                try {
                    const res = await API.switchDemoUser(userId);
                    state.currentUser = res.user;
                    showToast(`Active staff switched to: ${res.user.name} (${res.user.role.toUpperCase()})`);
                    renderApp();
                } catch (err) {
                    showToast('Failed to switch staff: ' + err.message, 'error');
                }
            });
        }

        // Global search input in topbar
        const globalSearch = document.getElementById('global-search-input');
        const searchClearBtn = document.getElementById('global-search-clear');
        const searchDropdown = document.getElementById('global-search-dropdown');
        const searchContainer = document.getElementById('global-search-container');

        if (globalSearch) {
            const handleLiveSearch = debounce(async (query) => {
                query = (query || '').trim();
                if (!searchDropdown) return;

                if (!query) {
                    searchDropdown.style.display = 'none';
                    searchDropdown.innerHTML = '';
                    if (searchClearBtn) searchClearBtn.style.display = 'none';
                    return;
                }

                if (searchClearBtn) searchClearBtn.style.display = 'flex';

                try {
                    let clients = state.clients || [];
                    if (!clients.length) {
                        const res = await API.getClients();
                        clients = res.data || [];
                        state.clients = clients;
                    }

                    const qLower = query.toLowerCase();
                    const matched = clients.filter(c => 
                        (c.name && c.name.toLowerCase().includes(qLower)) ||
                        (c.pan && c.pan.toLowerCase().includes(qLower)) ||
                        (c.email && c.email.toLowerCase().includes(qLower)) ||
                        (c.taxpayerType && c.taxpayerType.toLowerCase().includes(qLower))
                    );

                    if (matched.length === 0) {
                        searchDropdown.innerHTML = `
                            <div style="padding:14px; text-align:center; color:#64748b; font-size:0.82rem;">
                                No clients matching "<strong>${escapeHtml(query)}</strong>"
                                <div style="margin-top:4px; font-size:0.75rem; color:#94a3b8;">Press <kbd style="background:#f1f5f9; padding:2px 5px; border-radius:4px; font-weight:600;">↵ Enter</kbd> to search across all records</div>
                            </div>
                        `;
                    } else {
                        searchDropdown.innerHTML = `
                            <div class="search-result-group-title">Matched Client Profiles (${matched.length})</div>
                            ${matched.slice(0, 5).map(c => `
                                <div class="search-result-item" data-client-id="${c.id}">
                                    <div class="search-result-item-left">
                                        <span class="search-result-item-badge">${c.taxpayerType ? c.taxpayerType.replace('_', ' ').toUpperCase() : 'CLIENT'}</span>
                                        <div>
                                            <div class="search-result-item-name">${escapeHtml(c.name)}</div>
                                            <div class="search-result-item-sub">PAN: ${escapeHtml(c.pan || 'N/A')}</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:6px; align-items:center;">
                                        <span class="search-result-item-action" onclick="event.stopPropagation(); window.launchTaxWiseForClient('${c.id}')" title="Open TaxWise for ${escapeHtml(c.name)}">TaxWise ↗</span>
                                    </div>
                                </div>
                            `).join('')}
                        `;

                        searchDropdown.querySelectorAll('.search-result-item').forEach(item => {
                            item.addEventListener('click', () => {
                                const cid = item.getAttribute('data-client-id');
                                searchDropdown.style.display = 'none';
                                navigateTo('clients', { id: cid });
                            });
                        });
                    }

                    searchDropdown.style.display = 'block';
                } catch (err) {
                    console.error('Search error:', err);
                }
            }, 180);

            globalSearch.addEventListener('input', (e) => {
                handleLiveSearch(e.target.value);
            });

            globalSearch.addEventListener('focus', (e) => {
                if (e.target.value.trim().length > 0) {
                    handleLiveSearch(e.target.value);
                }
            });

            globalSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (searchDropdown) searchDropdown.style.display = 'none';
                    const q = globalSearch.value;
                    navigateTo('clients');
                    setTimeout(() => {
                        const filterInput = document.getElementById('filter-client-search');
                        if (filterInput) {
                            filterInput.value = q;
                            filterInput.dispatchEvent(new Event('input'));
                        }
                    }, 100);
                }
            });

            if (searchClearBtn) {
                searchClearBtn.addEventListener('click', () => {
                    globalSearch.value = '';
                    searchClearBtn.style.display = 'none';
                    if (searchDropdown) {
                        searchDropdown.style.display = 'none';
                        searchDropdown.innerHTML = '';
                    }
                    globalSearch.focus();
                });
            }

            document.addEventListener('click', (e) => {
                if (searchContainer && !searchContainer.contains(e.target)) {
                    if (searchDropdown) searchDropdown.style.display = 'none';
                }
            });
        }

        // Modal backdrop click to close
        const modalOverlay = document.getElementById('app-modal-overlay');
        const modalCloseBtn = document.getElementById('modal-close-btn');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
        }
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }
    }

    // App Bootstrapping
    async function init() {
        setupEventListeners();
        await initAuth();
        handleHashChange();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
