const DataStore = require('../models/dataStore');
const taxRepository = require('../models/taxRepository');

async function getReportsSummary(req, res) {
    try {
        const clients = DataStore.clients.list();
        const calculations = await taxRepository.listAllCalculations();
        const tasks = DataStore.tasks.list();
        const documents = DataStore.documents.list();
        const compliance = DataStore.compliance.list();
        const invoices = DataStore.invoices.list();

        // 1. Tax Liability Breakdown by Regime and Year
        const taxSummaryByYear = {};
        calculations.forEach(c => {
            const yr = c.financialYear || '2026-2027';
            if (!taxSummaryByYear[yr]) {
                taxSummaryByYear[yr] = { totalTaxComputed: 0, count: 0, newRegimeCount: 0, oldRegimeCount: 0 };
            }
            taxSummaryByYear[yr].count++;
            taxSummaryByYear[yr].totalTaxComputed += (c.results ? c.results.totalTax || 0 : 0);
            if (c.regimeSelected === 'new') taxSummaryByYear[yr].newRegimeCount++;
            else taxSummaryByYear[yr].oldRegimeCount++;
        });

        // 2. Calculations Awaiting Review
        const awaitingReview = calculations.filter(c => c.status === 'Under Review' || c.status === 'Draft');

        // 3. Pending/Missing Documents
        const pendingDocs = documents.filter(d => d.reviewStatus === 'Pending Verification' || d.reviewStatus === 'Needs Clarification');

        // 4. Overdue Tasks
        const today = new Date().toISOString().substring(0, 10);
        const overdueTasks = tasks.filter(t => t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled');

        // 5. Billing Summary
        const totalBilled = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
        const totalCollected = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
        const totalOutstanding = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

        // 6. Taxpayer Type Breakdown
        const taxpayerTypeBreakdown = {};
        clients.forEach(cl => {
            const type = cl.taxpayerType || 'individual';
            taxpayerTypeBreakdown[type] = (taxpayerTypeBreakdown[type] || 0) + 1;
        });

        // 7. Recent Calculations (top 6)
        const recentCalculations = calculations.slice(0, 6).map(c => {
            const client = clients.find(cl => cl.id === c.clientId);
            return {
                id: c.id,
                clientName: client ? client.name : (c.name || 'Anonymous Client'),
                taxpayerType: client ? client.taxpayerType : (c.taxpayerType || 'individual'),
                financialYear: c.financialYear || '2026-2027',
                regime: c.regimeSelected || 'new',
                totalTax: c.results ? c.results.totalTax || 0 : 0,
                status: c.status || 'Draft',
                createdAt: c.createdAt
            };
        });

        return res.json({
            success: true,
            data: {
                totalClientsCount: clients.length,
                totalCalculationsCount: calculations.length,
                taxSummaryByYear,
                taxpayerTypeBreakdown,
                recentCalculations,
                awaitingReview,
                pendingDocs,
                overdueTasks,
                complianceOverview: {
                    total: compliance.length,
                    upcoming: compliance.filter(c => c.status === 'Upcoming').length,
                    completed: compliance.filter(c => c.status === 'Filed / Completed').length
                },
                billingOverview: {
                    totalBilled,
                    totalCollected,
                    totalOutstanding,
                    invoicesCount: invoices.length
                }
            }
        });
    } catch (err) {
        console.error('getReportsSummary error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate reports summary' });
    }
}

module.exports = {
    getReportsSummary
};
