
const DataStore = require('../models/dataStore');

async function getComplianceItems(req, res) {
    try {
        const { clientId, complianceType, status } = req.query;
        const items = DataStore.compliance.list({ clientId, complianceType, status });
        return res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch compliance items' });
    }
}

async function createComplianceItem(req, res) {
    try {
        const {
            title,
            complianceType,
            clientId,
            taxYear,
            dueDate,
            assignedStaffId,
            assignedStaffName,
            notes
        } = req.body;

        if (!title || !dueDate) {
            return res.status(400).json({ success: false, message: 'Title and statutory due date are required' });
        }

        let clientName = 'General Office';
        if (clientId) {
            const client = DataStore.clients.getById(clientId);
            if (client) clientName = client.name;
        }

        const newItem = DataStore.compliance.create({
            title: title.trim(),
            complianceType: complianceType || 'Income Tax',
            clientId: clientId || null,
            clientName,
            taxYear: taxYear || '2026-2027',
            dueDate,
            assignedStaffId: assignedStaffId || req.user.id,
            assignedStaffName: assignedStaffName || req.user.name,
            status: 'Upcoming',
            notes: notes || ''
        });

        DataStore.auditLogs.log(req.user.id, req.user.name, 'COMPLIANCE_CREATED', 'Compliance', newItem.id, {
            title: newItem.title,
            dueDate: newItem.dueDate
        });

        return res.status(201).json({
            success: true,
            message: 'Compliance record created successfully',
            data: newItem
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to create compliance item' });
    }
}

async function updateComplianceStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const valid = ['Upcoming', 'Due Soon', 'Overdue', 'Filed / Completed'];
        if (!valid.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${valid.join(', ')}` });
        }

        const updates = { status };
        if (status === 'Filed / Completed') {
            updates.completedAt = new Date().toISOString();
        }
        if (notes) {
            updates.notes = notes;
        }

        const updated = DataStore.compliance.update(id, updates);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Compliance record not found' });
        }

        DataStore.auditLogs.log(req.user.id, req.user.name, 'COMPLIANCE_STATUS_UPDATED', 'Compliance', id, { status });

        return res.json({
            success: true,
            message: `Compliance status updated to '${status}'`,
            data: updated
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update compliance status' });
    }
}

module.exports = {
    getComplianceItems,
    createComplianceItem,
    updateComplianceStatus
};
