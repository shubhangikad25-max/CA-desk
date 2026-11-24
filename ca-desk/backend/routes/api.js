const express = require('express');
const router = express.Router();

const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { hasMongoDB } = require('../config/db');

const authController = require('../controllers/authController');
const clientController = require('../controllers/clientController');
const taxCalculationController = require('../controllers/taxCalculationController');
const taskController = require('../controllers/taskController');
const documentController = require('../controllers/documentController');
const complianceController = require('../controllers/complianceController');
const billingController = require('../controllers/billingController');
const alertController = require('../controllers/alertController');
const reportController = require('../controllers/reportController');
const dashboardController = require('../controllers/dashboardController');

// Health Check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'CA Desk Enterprise API',
        mongodb: hasMongoDB(),
        database: hasMongoDB() ? 'Desk-CA' : null,
        timestamp: new Date().toISOString()
    });
});

// Authentication
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getCurrentUser);
router.get('/auth/staff', authenticateToken, authController.getStaffList);
router.post('/auth/switch-demo-user', authController.demoSwitchUser);

// Dashboard
router.get('/dashboard/metrics', optionalAuth, dashboardController.getDashboardData);

// Clients
router.get('/clients', authenticateToken, clientController.getClients);
router.get('/clients/:id', authenticateToken, clientController.getClientById);
router.post('/clients', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), clientController.createClient);
router.put('/clients/:id', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), clientController.updateClient);
router.delete('/clients/:id', authenticateToken, requireRole(['admin']), clientController.deleteClient);
router.get('/clients/:id/activity', authenticateToken, clientController.getClientActivity);

// Integrated TaxWise Module (supports both /tax/calculate and /calculate, /tax/simulate and /simulate)
router.get('/tax/config', optionalAuth, taxCalculationController.getGlobalTaxWiseConfig);
router.post('/tax/calculate', optionalAuth, taxCalculationController.calculateTaxForClient);
router.post('/calculate', optionalAuth, taxCalculationController.calculateTaxForClient);
router.post('/tax/simulate', optionalAuth, taxCalculationController.simulateTaxSaving);
router.post('/simulate', optionalAuth, taxCalculationController.simulateTaxSaving);
router.post('/tax/save', optionalAuth, taxCalculationController.saveCalculation);
router.get('/tax/client/:clientId', optionalAuth, taxCalculationController.getCalculationsByClient);
router.get('/tax/all', optionalAuth, taxCalculationController.getAllCalculations);
router.get('/tax/history', optionalAuth, taxCalculationController.getAllCalculations);
router.get('/history', optionalAuth, taxCalculationController.getAllCalculations);
router.get('/tax/legacy', optionalAuth, taxCalculationController.getLegacyCalculations);
router.get('/tax/:id', optionalAuth, taxCalculationController.getCalculationById);
router.patch('/tax/:id/status', authenticateToken, requireRole(['admin', 'reviewer']), taxCalculationController.updateCalculationStatus);
router.get('/tax/:id/report', optionalAuth, taxCalculationController.generateTaxReport);

// Tasks
router.get('/tasks', authenticateToken, taskController.getTasks);
router.get('/tasks/:id', authenticateToken, taskController.getTaskById);
router.post('/tasks', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), taskController.createTask);
router.put('/tasks/:id', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), taskController.updateTask);
router.delete('/tasks/:id', authenticateToken, requireRole(['admin', 'reviewer']), taskController.deleteTask);

// Documents
router.get('/documents', authenticateToken, documentController.getDocuments);
router.post('/documents/upload', authenticateToken, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, documentController.uploadDocument);
router.patch('/documents/:id/status', authenticateToken, requireRole(['admin', 'reviewer']), documentController.updateDocumentStatus);
router.get('/documents/:id/download', authenticateToken, documentController.downloadDocument);
router.delete('/documents/:id', authenticateToken, requireRole(['admin', 'reviewer']), documentController.deleteDocument);

// Compliance Calendar
router.get('/compliance', authenticateToken, complianceController.getComplianceItems);
router.post('/compliance', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), complianceController.createComplianceItem);
router.patch('/compliance/:id/status', authenticateToken, requireRole(['admin', 'reviewer', 'preparer']), complianceController.updateComplianceStatus);

// Billing & Invoices
router.get('/billing/invoices', authenticateToken, billingController.getInvoices);
router.get('/billing/invoices/:id', authenticateToken, billingController.getInvoiceById);
router.post('/billing/invoices', authenticateToken, requireRole(['admin', 'reviewer']), billingController.createInvoice);
router.post('/billing/invoices/:id/payment', authenticateToken, requireRole(['admin', 'reviewer']), billingController.recordPayment);

// Alerts
router.get('/alerts', authenticateToken, alertController.getAlerts);
router.patch('/alerts/:id/read', authenticateToken, alertController.markAlertRead);
router.post('/alerts/read-all', authenticateToken, alertController.markAllAlertsRead);

// Reports
router.get('/reports/summary', optionalAuth, reportController.getReportsSummary);

module.exports = router;
