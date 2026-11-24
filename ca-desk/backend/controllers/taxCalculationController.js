const path = require('path');
// Reuse the existing TaxWise calculation engine directly without duplicating formulas
const taxService = require('../../../services/taxService');
const DataStore = require('../models/dataStore');
const taxRepository = require('../models/taxRepository');
const { getDB, hasMongoDB } = require('../config/db');

// GET /api/tax/config
function getGlobalTaxWiseConfig(req, res) {
    try {
        const years = taxService.getSupportedYears();
        const types = taxService.getTaxpayerTypes();
        const data = taxService.getTaxData();

        return res.json({
            success: true,
            defaultYear: data.defaultYear,
            years,
            taxpayerTypes: types,
            slabs: data.years
        });
    } catch (err) {
        console.error('getGlobalTaxWiseConfig error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load TaxWise configuration' });
    }
}

// POST /api/tax/calculate
async function calculateTaxForClient(req, res) {
    try {
        const { clientId, ...calcInputs } = req.body;

        let client = null;
        let taxpayerType = calcInputs.taxpayerType || 'individual';
        let clientName = calcInputs.name || 'Anonymous Client';
        let age = calcInputs.age != null ? Number(calcInputs.age) : 35;
        let residentialStatus = calcInputs.residentialStatus || 'resident';
        let pan = calcInputs.pan || null;

        if (clientId) {
            client = DataStore.clients.getById(clientId);
            if (client) {
                clientName = client.name;
                taxpayerType = client.taxpayerType || taxpayerType;
                age = client.age != null ? client.age : age;
                residentialStatus = client.residentialStatus || residentialStatus;
                pan = client.pan || pan;
            }
        }

        const enginePayload = {
            ...calcInputs,
            taxpayerType,
            name: clientName,
            pan,
            age,
            residentialStatus
        };

        // Execute verified calculation engine
        const results = taxService.calculateTax(enginePayload);

        // Build standard document per Section 7 specification and save directly into MongoDB `Tax` collection
        const taxDoc = taxRepository.buildTaxCalculationDocument({
            clientId: clientId || null,
            clientName,
            pan,
            calcInputs: { ...calcInputs, ...enginePayload, pan },
            results,
            user: req.user
        });

        // Insert into MongoDB collection `Tax` and await confirmation
        const savedRecord = await taxRepository.insertCalculation(taxDoc);

        return res.json({
            success: true,
            message: 'Tax computation executed successfully and saved to MongoDB Tax collection',
            calculationId: savedRecord.calculationId,
            id: savedRecord.calculationId,
            savedCalculation: savedRecord,
            clientId: savedRecord.clientId,
            clientName: savedRecord.clientName,
            data: results
        });
    } catch (err) {
        console.error('calculateTaxForClient error:', err);
        return res.status(500).json({
            success: false,
            message: 'Calculation error: ' + err.message
        });
    }
}

// POST /api/tax/simulate
async function simulateTaxSaving(req, res) {
    try {
        const { baseInput, proposedSection, proposedAmount, clientId } = req.body;

        if (!baseInput) {
            return res.status(400).json({
                success: false,
                message: 'Base calculation input is required for simulation.'
            });
        }

        // Run simulation through verified TaxWise engine
        const simulationResult = taxService.simulateTaxSaving({
            baseInput,
            proposedSection,
            proposedAmount
        });

        return res.json({
            success: true,
            message: 'Simulation computed using official tax engine rules',
            data: simulationResult
        });
    } catch (err) {
        console.error('simulateTaxSaving error:', err);
        return res.status(500).json({
            success: false,
            message: 'Simulation error: ' + err.message
        });
    }
}

// POST /api/tax/save
async function saveCalculation(req, res) {
    try {
        const {
            clientId,
            financialYear,
            taxpayerType,
            inputs,
            results,
            regimeSelected,
            status,
            notes
        } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required to link this calculation' });
        }

        const client = DataStore.clients.getById(clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Specified client not found in CA Desk records' });
        }

        const taxDoc = taxRepository.buildTaxCalculationDocument({
            clientId,
            clientName: client.name,
            pan: client.pan || null,
            calcInputs: {
                ...inputs,
                name: client.name,
                pan: client.pan || null,
                taxpayerType: taxpayerType || client.taxpayerType,
                financialYear: financialYear || '2026-2027',
                regime: regimeSelected,
                status: status || 'Draft',
                notes: notes || ''
            },
            results: results || {},
            user: req.user
        });

        const savedRecord = await taxRepository.insertCalculation(taxDoc);

        // Audit log
        DataStore.auditLogs.log(
            req.user ? req.user.id : 'SYSTEM',
            req.user ? req.user.name : 'System',
            'TAX_CALCULATION_SAVED',
            'TaxCalculation',
            savedRecord.calculationId,
            {
                clientId,
                clientName: client.name,
                version: savedRecord.version,
                totalTax: results ? results.totalTax : 0
            }
        );

        // Alert if awaiting review
        if (savedRecord.status === 'Under Review' || savedRecord.status === 'Pending Review') {
            DataStore.alerts.create({
                type: 'calculation',
                severity: 'info',
                title: 'Calculation Submitted for Review',
                message: `Tax computation for ${client.name} (${savedRecord.calculationId}) is ready for CA review.`,
                clientId,
                link: `/clients/${clientId}`
            });
        }

        return res.status(201).json({
            success: true,
            message: `Tax calculation saved successfully in MongoDB Tax collection`,
            id: savedRecord.calculationId,
            calculationId: savedRecord.calculationId,
            data: savedRecord
        });
    } catch (err) {
        console.error('saveCalculation error:', err);
        return res.status(500).json({ success: false, message: 'Failed to save calculation: ' + err.message });
    }
}

// GET /api/tax/client/:clientId
async function getCalculationsByClient(req, res) {
    try {
        const { clientId } = req.params;
        const calculations = await taxRepository.listCalculationsByClient(clientId);
        return res.json({
            success: true,
            count: calculations.length,
            data: calculations
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve calculations: ' + err.message });
    }
}

// GET /api/tax/all
async function getAllCalculations(req, res) {
    try {
        const calculations = await taxRepository.listAllCalculations(req.query || {});
        return res.json({
            success: true,
            count: calculations.length,
            data: calculations
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve calculations: ' + err.message });
    }
}

// GET /api/tax/:id
async function getCalculationById(req, res) {
    try {
        const { id } = req.params;
        const calculation = await taxRepository.getCalculationById(id);
        if (!calculation) {
            return res.status(404).json({ success: false, message: 'Calculation record not found' });
        }
        return res.json({
            success: true,
            data: calculation
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve calculation: ' + err.message });
    }
}

// GET /api/tax/legacy (Safe read-only view of Tax collection records)
async function getLegacyCalculations(req, res) {
    try {
        const legacyRecords = await taxRepository.listAllCalculations();
        return res.json({
            success: true,
            count: legacyRecords.length,
            source: 'Tax',
            data: legacyRecords
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve records: ' + err.message });
    }
}

// PATCH /api/tax/:id/status
async function updateCalculationStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const validStatuses = ['Draft', 'Pending Review', 'Calculated', 'Awaiting Documents', 'Under Review', 'Approved', 'Finalized', 'Superseded'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
        }

        const reviewerName = req.user ? req.user.name : 'CA Reviewer';
        const updated = await taxRepository.updateCalculationStatus(id, status, reviewerName, notes);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Calculation not found' });
        }

        DataStore.auditLogs.log(
            req.user ? req.user.id : 'SYSTEM',
            req.user ? req.user.name : 'System',
            'CALCULATION_STATUS_CHANGED',
            'TaxCalculation',
            id,
            { newStatus: status, reviewer: reviewerName }
        );

        return res.json({
            success: true,
            message: `Calculation status updated to '${status}' in Tax collection`,
            data: updated
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update status: ' + err.message });
    }
}

// GET /api/tax/:id/report
async function generateTaxReport(req, res) {
    try {
        const { id } = req.params;
        const calculation = await taxRepository.getCalculationById(id);
        if (!calculation) {
            return res.status(404).json({ success: false, message: 'Calculation record not found' });
        }

        const client = DataStore.clients.getById(calculation.clientId);

        const reportPayload = {
            reportId: `REP-${calculation.id}`,
            generatedAt: new Date().toISOString(),
            firm: {
                name: 'Sharma & Associates, Chartered Accountants',
                address: 'Corporate Suites 401, Nariman Point, Mumbai - 400021',
                frn: '104829W',
                partner: 'CA Rajesh Sharma (FCA 104829)'
            },
            client: {
                id: calculation.clientId,
                name: calculation.clientName,
                pan: client ? client.pan : 'N/A',
                taxpayerType: calculation.taxpayerType,
                residentialStatus: client ? client.residentialStatus : 'resident',
                age: client ? client.age : 35
            },
            taxYear: calculation.financialYear,
            assessmentYear: calculation.financialYear === '2026-2027' ? 'AY 2027-28' : 'AY 2026-27',
            version: calculation.version,
            status: calculation.status,
            preparedBy: calculation.preparedBy,
            reviewedBy: calculation.reviewedBy || 'Pending Review',
            regimeSelected: calculation.regimeSelected,
            computation: calculation.results,
            inputs: calculation.inputs,
            disclaimer: 'CONFIDENTIAL: This Tax Computation Memorandum is an internal chartered accountant advisory estimate prepared pursuant to the provisions of the Income-tax Act, 1961 as amended. It does not constitute statutory filing with the Income Tax Department.'
        };

        return res.json({
            success: true,
            data: reportPayload
        });
    } catch (err) {
        console.error('generateTaxReport error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate tax report' });
    }
}

module.exports = {
    getGlobalTaxWiseConfig,
    calculateTaxForClient,
    simulateTaxSaving,
    saveCalculation,
    getCalculationsByClient,
    getAllCalculations,
    getCalculationById,
    updateCalculationStatus,
    generateTaxReport,
    getLegacyCalculations
};
