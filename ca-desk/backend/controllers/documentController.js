const path = require('path');
const fs = require('fs');
const DataStore = require('../models/dataStore');

async function getDocuments(req, res) {
    try {
        const { clientId, taxYear, category } = req.query;
        const docs = DataStore.documents.list({ clientId, taxYear, category });
        return res.json({
            success: true,
            count: docs.length,
            data: docs
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch documents' });
    }
}

async function uploadDocument(req, res) {
    try {
        const { clientId, taxYear, category, notes } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        const client = DataStore.clients.getById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        let originalName = 'Supporting_Document.pdf';
        let fileName = 'dummy.pdf';
        let fileSize = 102400;
        let mimeType = 'application/pdf';

        if (req.file) {
            originalName = req.file.originalname;
            fileName = req.file.filename;
            fileSize = req.file.size;
            mimeType = req.file.mimetype;
        } else if (req.body.fileName) {
            // Support direct metadata-only submission for demo/testing
            originalName = req.body.fileName;
            fileName = req.body.fileName;
            fileSize = Number(req.body.fileSize) || 150000;
            mimeType = req.body.mimeType || 'application/pdf';
        }

        const newDoc = DataStore.documents.create({
            clientId,
            clientName: client.name,
            taxYear: taxYear || '2026-2027',
            category: category || 'Other supporting documents',
            originalName,
            fileName,
            fileSize,
            mimeType,
            reviewStatus: 'Pending Verification',
            notes: notes || '',
            uploadedBy: req.user ? req.user.name : 'Authorized Staff'
        });

        DataStore.auditLogs.log(
            req.user ? req.user.id : 'SYSTEM',
            req.user ? req.user.name : 'System',
            'DOCUMENT_UPLOADED',
            'Document',
            newDoc.id,
            { clientId, originalName, category: newDoc.category }
        );

        return res.status(201).json({
            success: true,
            message: 'Document uploaded successfully and marked for verification',
            data: newDoc
        });
    } catch (err) {
        console.error('uploadDocument error:', err);
        return res.status(500).json({ success: false, message: 'Failed to upload document' });
    }
}

async function updateDocumentStatus(req, res) {
    try {
        const { id } = req.params;
        const { reviewStatus, notes } = req.body;

        const valid = ['Pending Verification', 'Verified', 'Rejected', 'Needs Clarification'];
        if (!valid.includes(reviewStatus)) {
            return res.status(400).json({ success: false, message: `Invalid review status. Valid values: ${valid.join(', ')}` });
        }

        const verifiedBy = req.user ? req.user.name : 'CA Reviewer';
        const updated = DataStore.documents.updateStatus(id, reviewStatus, verifiedBy, notes);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        DataStore.auditLogs.log(
            req.user.id,
            req.user.name,
            'DOCUMENT_STATUS_CHANGED',
            'Document',
            id,
            { reviewStatus, verifiedBy }
        );

        return res.json({
            success: true,
            message: `Document status changed to '${reviewStatus}'`,
            data: updated
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update document status' });
    }
}

async function downloadDocument(req, res) {
    try {
        const { id } = req.params;
        const doc = DataStore.documents.getById(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        const filePath = path.join(__dirname, '../uploads', doc.fileName);
        if (fs.existsSync(filePath)) {
            return res.download(filePath, doc.originalName);
        } else {
            // Generate a clean text/mock representation if file was demo seed
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}.txt"`);
            return res.send(`CA Desk Document Record: ${doc.originalName}\nClient: ${doc.clientName} (${doc.clientId})\nCategory: ${doc.category}\nStatus: ${doc.reviewStatus}\nUploaded: ${doc.uploadedAt}`);
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to download document' });
    }
}

async function deleteDocument(req, res) {
    try {
        const { id } = req.params;
        const doc = DataStore.documents.getById(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        const success = DataStore.documents.delete(id);
        if (success) {
            const filePath = path.join(__dirname, '../uploads', doc.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            DataStore.auditLogs.log(req.user.id, req.user.name, 'DOCUMENT_DELETED', 'Document', id);
        }

        return res.json({ success: true, message: 'Document deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete document' });
    }
}

module.exports = {
    getDocuments,
    uploadDocument,
    updateDocumentStatus,
    downloadDocument,
    deleteDocument
};
