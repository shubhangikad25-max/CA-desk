const DataStore = require('../models/dataStore');

const VALID_TAXPAYER_TYPES = [
    'individual',
    'huf',
    'aop_boi_ajp',
    'domestic_company',
    'foreign_company',
    'firm_llp',
    'cooperative_society',
    'local_authority'
];

async function getClients(req, res) {
    try {
        const { search, taxpayerType, status, staffId } = req.query;
        const clients = DataStore.clients.list({ search, taxpayerType, status, staffId });
        return res.json({
            success: true,
            count: clients.length,
            data: clients
        });
    } catch (err) {
        console.error('getClients error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
}

async function getClientById(req, res) {
    try {
        const { id } = req.params;
        const client = DataStore.clients.getById(id);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Aggregate client-specific related counts for the client profile workspace
        const calculations = DataStore.taxCalculations.listByClient(id);
        const tasks = DataStore.tasks.list({ clientId: id });
        const documents = DataStore.documents.list({ clientId: id });
        const compliance = DataStore.compliance.list({ clientId: id });
        const invoices = DataStore.invoices.list({ clientId: id });

        const openTasksCount = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;
        const pendingDocsCount = documents.filter(d => d.reviewStatus === 'Pending Verification' || d.reviewStatus === 'Needs Clarification').length;
        const outstandingBalance = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
        const latestCalculation = calculations.length > 0 ? calculations[0] : null;

        return res.json({
            success: true,
            data: {
                ...client,
                stats: {
                    calculationsCount: calculations.length,
                    openTasksCount,
                    totalTasksCount: tasks.length,
                    documentsCount: documents.length,
                    pendingDocsCount,
                    complianceCount: compliance.length,
                    invoicesCount: invoices.length,
                    outstandingBalance,
                    latestCalculation
                }
            }
        });
    } catch (err) {
        console.error('getClientById error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch client details' });
    }
}

async function createClient(req, res) {
    try {
        const {
            name,
            pan,
            taxpayerType,
            age,
            residentialStatus,
            email,
            phone,
            address,
            assignedStaffId,
            assignedStaffName,
            notes
        } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Client legal/display name is required' });
        }

        if (taxpayerType && !VALID_TAXPAYER_TYPES.includes(taxpayerType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid taxpayer category: ${taxpayerType}. Supported: ${VALID_TAXPAYER_TYPES.join(', ')}`
            });
        }

        // Clean and uppercase PAN if provided
        let cleanPan = '';
        if (pan) {
            cleanPan = pan.trim().toUpperCase();
            // Optional regex check for Indian PAN format (5 letters, 4 digits, 1 letter)
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid PAN format. Standard format is 5 alphabets, 4 numerals, 1 alphabet (e.g. ABCDE1234F).'
                });
            }
        }

        const newClient = DataStore.clients.create({
            name: name.trim(),
            pan: cleanPan,
            taxpayerType: taxpayerType || 'individual',
            age: age ? Number(age) : 35,
            residentialStatus: residentialStatus || 'resident',
            email: email ? email.trim() : '',
            phone: phone ? phone.trim() : '',
            address: address ? address.trim() : '',
            assignedStaffId: assignedStaffId || req.user.id,
            assignedStaffName: assignedStaffName || req.user.name,
            notes: notes ? notes.trim() : ''
        });

        DataStore.auditLogs.log(req.user.id, req.user.name, 'CLIENT_CREATED', 'Client', newClient.id, {
            name: newClient.name,
            taxpayerType: newClient.taxpayerType
        });

        return res.status(201).json({
            success: true,
            message: 'Client profile created successfully',
            data: newClient
        });
    } catch (err) {
        console.error('createClient error:', err);
        return res.status(500).json({ success: false, message: 'Failed to create client' });
    }
}

async function updateClient(req, res) {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.taxpayerType && !VALID_TAXPAYER_TYPES.includes(updates.taxpayerType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid taxpayer category: ${updates.taxpayerType}.`
            });
        }

        if (updates.pan) {
            updates.pan = updates.pan.trim().toUpperCase();
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(updates.pan)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid PAN format (e.g. ABCDE1234F).'
                });
            }
        }

        const updated = DataStore.clients.update(id, updates);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        DataStore.auditLogs.log(req.user.id, req.user.name, 'CLIENT_UPDATED', 'Client', id, updates);

        return res.json({
            success: true,
            message: 'Client profile updated successfully',
            data: updated
        });
    } catch (err) {
        console.error('updateClient error:', err);
        return res.status(500).json({ success: false, message: 'Failed to update client' });
    }
}

async function deleteClient(req, res) {
    try {
        const { id } = req.params;
        const success = DataStore.clients.delete(id);
        if (!success) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        DataStore.auditLogs.log(req.user.id, req.user.name, 'CLIENT_DELETED', 'Client', id);

        return res.json({
            success: true,
            message: 'Client removed successfully'
        });
    } catch (err) {
        console.error('deleteClient error:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete client' });
    }
}

async function getClientActivity(req, res) {
    try {
        const { id } = req.params;
        const allLogs = DataStore.auditLogs.list(500);
        const clientLogs = allLogs.filter(log =>
            (log.entityType === 'Client' && log.entityId === id) ||
            (log.details && log.details.clientId === id)
        );

        return res.json({
            success: true,
            data: clientLogs
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch client activity' });
    }
}

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
    getClientActivity
};
