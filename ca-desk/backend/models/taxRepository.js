const { ObjectId } = require('mongodb');
const { getDB, hasMongoDB } = require('../config/db');

// In-memory fallback cache only for local offline unit-test runners when MongoDB is not running
const memoryTaxFallback = [];

/**
 * Normalizes any document from the `Tax` collection (supports both existing 117+ legacy
 * records and newly structured records per Section 7 specification).
 */
function normalizeTaxDocument(doc) {
    if (!doc) return null;
    const rawId = doc.calculationId || doc.id || (doc._id ? doc._id.toString() : '');
    const clientName = doc.clientName || doc.taxpayerName || (doc.taxpayer && doc.taxpayer.name) || doc.name || 'Anonymous Taxpayer';
    const pan = doc.pan || (doc.taxpayer && doc.taxpayer.pan) || null;
    const taxpayerType = (doc.taxpayer && doc.taxpayer.taxpayerType) || doc.taxpayerType || 'individual';
    const age = (doc.taxpayer && doc.taxpayer.age != null) ? Number(doc.taxpayer.age) : (doc.age != null ? Number(doc.age) : 35);
    const residentialStatus = (doc.taxpayer && doc.taxpayer.residentialStatus) || doc.residentialStatus || 'resident';
    const financialYear = doc.financialYear || '2026-2027';
    const regimeSelected = doc.regimeSelected || doc.regime || 'new';

    const totalTax = Number(
        (doc.results && doc.results.totalTax != null)
            ? doc.results.totalTax
            : (doc.totalTax != null ? doc.totalTax : (doc.calculatedTax || 0))
    );

    const grossIncome = Number(
        (doc.income && doc.income.grossTotalIncome != null)
            ? doc.income.grossTotalIncome
            : (doc.grossIncome != null ? doc.grossIncome : (doc.income || 0))
    );

    const taxableIncome = Number(
        (doc.results && doc.results.taxableIncome != null)
            ? doc.results.taxableIncome
            : (doc.taxableIncome != null ? doc.taxableIncome : grossIncome)
    );

    const calculatedTax = Number(
        (doc.results && (doc.results.taxBeforeRebate || doc.results.taxOnTotalIncome)) != null
            ? (doc.results.taxBeforeRebate || doc.results.taxOnTotalIncome)
            : (doc.calculatedTax != null ? doc.calculatedTax : totalTax)
    );

    const cess = Number(
        (doc.results && (doc.results.healthAndEducationCess || doc.results.cess)) != null
            ? (doc.results.healthAndEducationCess || doc.results.cess)
            : (doc.cess != null ? doc.cess : 0)
    );

    const effectiveTaxRate = Number(
        (doc.results && doc.results.effectiveTaxRate != null)
            ? doc.results.effectiveTaxRate
            : (doc.effectiveTaxRate != null ? doc.effectiveTaxRate : (grossIncome > 0 ? Math.round((totalTax / grossIncome) * 1000) / 10 : 0))
    );

    const createdAt = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString());
    const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : (doc.updatedAt || createdAt);

    return {
        ...doc,
        _id: doc._id ? doc._id.toString() : rawId,
        id: rawId,
        calculationId: rawId,
        clientId: doc.clientId || null,
        clientName,
        taxpayerName: clientName,
        pan,
        taxpayer: doc.taxpayer || {
            name: clientName,
            pan,
            taxpayerType,
            age,
            residentialStatus
        },
        name: clientName,
        taxpayerType,
        age,
        residentialStatus,
        financialYear,
        assessmentYear: doc.assessmentYear || (financialYear === '2026-2027' ? '2027-2028' : '2026-2027'),
        income: doc.income || {
            salaryIncome: grossIncome,
            housePropertyIncome: 0,
            businessIncome: 0,
            capitalGains: 0,
            otherSourcesIncome: 0,
            grossTotalIncome: grossIncome
        },
        incomeDetails: doc.incomeDetails || doc.income,
        deductions: doc.deductions || {
            section80C: 0,
            section80D: 0,
            section80G: 0,
            section80E: 0,
            hraExemption: 0,
            homeLoanInterest: 0,
            otherDeductions: 0,
            totalDeductions: 0
        },
        regimeSelected,
        regime: regimeSelected,
        taxableIncome,
        calculatedTax,
        cess,
        totalTax,
        results: doc.results || {
            taxableIncome,
            taxBeforeRebate: calculatedTax,
            rebate: 0,
            surcharge: 0,
            marginalRelief: 0,
            cess,
            totalTax,
            effectiveTaxRate,
            monthlyTax: Math.round(totalTax / 12),
            postTaxIncome: Math.max(0, grossIncome - totalTax)
        },
        grossIncome,
        effectiveTaxRate,
        preparedBy: doc.preparedBy || 'CA Staff',
        reviewedBy: doc.reviewedBy || null,
        status: doc.status || 'Calculated',
        calculationSource: doc.calculationSource || 'TaxWise',
        isDemo: doc.isDemo || false,
        version: doc.version || 1,
        createdAt,
        updatedAt
    };
}

/**
 * Builds the standard Tax Calculation document structure (Section 7).
 */
function buildTaxCalculationDocument({ clientId, clientName, pan, calcInputs, results, user }) {
    const financialYear = calcInputs.financialYear || '2026-2027';
    const assessmentYear = calcInputs.assessmentYear || (financialYear === '2026-2027' ? '2027-2028' : '2026-2027');
    const taxpayerName = calcInputs.name || clientName || 'Anonymous Taxpayer';
    const taxpayerPan = pan || calcInputs.pan || (calcInputs.taxpayer && calcInputs.taxpayer.pan) || null;
    const taxpayerType = calcInputs.taxpayerType || 'individual';
    const age = calcInputs.age != null ? Number(calcInputs.age) : 35;
    const residentialStatus = calcInputs.residentialStatus || 'resident';
    const regimeSelected = results.recommendedRegime || results.regime || (calcInputs.regime === 'old' ? 'old' : 'new');

    const timestamp = Date.now();
    const uniqueSuffix = timestamp.toString().slice(-5);
    const calculationId = calcInputs.calculationId || `CALC-${financialYear.substring(0, 4)}-${uniqueSuffix}`;

    const salaryIncome = Number(calcInputs.salaryIncome) || 0;
    const housePropertyIncome = Number(calcInputs.housePropertyIncome || calcInputs.housePropertyNetIncome) || 0;
    const businessIncome = Number(calcInputs.businessIncome) || 0;
    const capitalGains = Number((calcInputs.stcg111A || 0) + (calcInputs.stcgOther || 0) + (calcInputs.ltcg112A || 0) + (calcInputs.ltcg112 || 0));
    const otherSourcesIncome = Number((calcInputs.interestIncome || 0) + (calcInputs.dividendIncome || 0) + (calcInputs.otherIncome || 0));
    const grossTotalIncome = Number(results.grossTotalIncome != null ? results.grossTotalIncome : (salaryIncome + housePropertyIncome + businessIncome + capitalGains + otherSourcesIncome));

    const sec80C = Number(calcInputs.sec80C) || 0;
    const sec80D = Number(calcInputs.sec80D) || 0;
    const sec80G = Number(calcInputs.sec80G) || 0;
    const sec80E = Number(calcInputs.sec80E) || 0;
    const hraExemption = Number(calcInputs.hraExemption) || 0;
    const homeLoanInterest = Number(calcInputs.sec24b || calcInputs.housePropertyLoanInterest) || 0;
    const otherDeductions = Number(calcInputs.otherDeductions) || 0;
    const totalDeductions = Number(results.totalDeductions != null ? results.totalDeductions : (sec80C + sec80D + sec80G + sec80E + hraExemption + homeLoanInterest + otherDeductions));

    const totalTax = Number(results.totalTax != null ? results.totalTax : 0);
    const taxableIncome = Number(results.taxableIncome != null ? results.taxableIncome : Math.max(0, grossTotalIncome - totalDeductions));
    const calculatedTax = Number(results.taxBeforeRebate || results.taxOnTotalIncome || totalTax);
    const cess = Number(results.healthAndEducationCess || results.cess || 0);
    const effectiveTaxRate = Number(results.effectiveRate != null ? results.effectiveRate : (grossTotalIncome > 0 ? Math.round((totalTax / grossTotalIncome) * 1000) / 10 : 0));
    const postTaxIncome = Math.max(0, grossTotalIncome - totalTax);
    const monthlyTax = Math.round(totalTax / 12);

    const now = new Date();

    const incomeObj = {
        salaryIncome,
        housePropertyIncome,
        businessIncome,
        capitalGains,
        otherSourcesIncome,
        grossTotalIncome
    };

    const deductionsObj = {
        section80C: sec80C,
        section80D: sec80D,
        section80G: sec80G,
        section80E: sec80E,
        hraExemption,
        homeLoanInterest,
        otherDeductions,
        totalDeductions
    };

    const doc = {
        calculationId,
        id: calculationId,
        clientId: clientId || null,
        clientName: clientName || taxpayerName,
        taxpayerName,
        pan: taxpayerPan,

        taxpayer: {
            name: taxpayerName,
            pan: taxpayerPan,
            taxpayerType,
            age,
            residentialStatus
        },

        financialYear,
        assessmentYear,

        regime: regimeSelected,
        regimeSelected,

        income: incomeObj,
        incomeDetails: incomeObj,
        deductions: deductionsObj,

        taxableIncome,
        calculatedTax,
        cess,
        totalTax,

        results: {
            taxableIncome,
            taxBeforeRebate: calculatedTax,
            rebate: Number(results.rebate87A || results.rebate) || 0,
            surcharge: Number(results.surcharge) || 0,
            marginalRelief: Number(results.marginalRelief) || 0,
            cess,
            totalTax,
            effectiveTaxRate,
            monthlyTax,
            postTaxIncome,
            newRegime: results.newRegime || null,
            oldRegime: results.oldRegime || null,
            comparison: results.comparison || null,
            slabBreakdown: results.slabBreakdown || null,
            recommendations: results.recommendations || []
        },

        // Top-level legacy compatibility fields matching older records in Tax collection:
        name: taxpayerName,
        taxpayerType,
        age,
        residentialStatus,
        grossIncome: grossTotalIncome,
        effectiveTaxRate,
        inputs: calcInputs,

        preparedBy: (user && user.name) ? user.name : 'CA Rajesh Sharma',
        reviewedBy: null,
        status: 'Pending Review',

        calculationSource: 'TaxWise',
        isDemo: false,

        createdAt: now,
        updatedAt: now,
        version: 1
    };

    return doc;
}

/**
 * Inserts a new calculation document directly into the existing MongoDB `Tax` collection.
 */
async function insertCalculation(calcData) {
    if (hasMongoDB()) {
        const db = getDB();
        if (!db) throw new Error('MongoDB database instance is not available');
        const col = db.collection('Tax');

        // Check for idempotency: if calculationId already exists, do not duplicate
        if (calcData.calculationId) {
            const existing = await col.findOne({ calculationId: calcData.calculationId });
            if (existing) {
                return normalizeTaxDocument(existing);
            }
        }

        // Additional idempotency: check if identical calculation was recently saved (double-click protection)
        const recentDuplicate = await col.findOne({
            $or: [
                { calculationId: calcData.calculationId },
                {
                    taxpayerName: calcData.taxpayerName,
                    financialYear: calcData.financialYear,
                    totalTax: calcData.totalTax,
                    createdAt: { $gte: new Date(Date.now() - 5000) }
                }
            ]
        });
        if (recentDuplicate) {
            return normalizeTaxDocument(recentDuplicate);
        }

        const res = await col.insertOne(calcData);
        if (!res.acknowledged) {
            throw new Error('MongoDB write acknowledgment failed for Tax collection');
        }

        calcData._id = res.insertedId;
        return normalizeTaxDocument(calcData);
    }

    // In-memory fallback for local offline testing
    memoryTaxFallback.unshift(calcData);
    return normalizeTaxDocument(calcData);
}

/**
 * Fetches all calculations from the `Tax` collection sorted by latest first.
 */
async function listAllCalculations(filter = {}) {
    if (hasMongoDB()) {
        const db = getDB();
        if (db) {
            const query = {};
            if (filter.clientId) query.clientId = filter.clientId;
            if (filter.financialYear) query.financialYear = filter.financialYear;
            if (filter.status && filter.status !== 'all') query.status = filter.status;

            const docs = await db.collection('Tax')
                .find(query)
                .sort({ createdAt: -1, _id: -1 })
                .toArray();

            return docs.map(normalizeTaxDocument);
        }
    }
    return memoryTaxFallback.map(normalizeTaxDocument);
}

/**
 * Fetches a single calculation by calculationId, id, or _id from `Tax`.
 */
async function getCalculationById(id) {
    if (!id) return null;
    if (hasMongoDB()) {
        const db = getDB();
        if (db) {
            const query = {
                $or: [
                    { calculationId: id },
                    { id: id }
                ]
            };
            // If it's a 24-char hex string, also check _id
            if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
                query.$or.push({ _id: new ObjectId(id) });
            }
            const doc = await db.collection('Tax').findOne(query);
            if (doc) return normalizeTaxDocument(doc);
        }
    }
    const mem = memoryTaxFallback.find(c => c.calculationId === id || c.id === id);
    return mem ? normalizeTaxDocument(mem) : null;
}

/**
 * Fetches calculations for a specific client from `Tax`.
 */
async function listCalculationsByClient(clientId) {
    if (!clientId) return [];
    return listAllCalculations({ clientId });
}

/**
 * Updates review status or notes for a calculation in `Tax`.
 */
async function updateCalculationStatus(id, status, reviewerName, notes) {
    const updateFields = {
        status,
        updatedAt: new Date()
    };
    if (reviewerName) updateFields.reviewedBy = reviewerName;
    if (notes) updateFields.notes = notes;

    if (hasMongoDB()) {
        const db = getDB();
        if (db) {
            const query = {
                $or: [
                    { calculationId: id },
                    { id: id }
                ]
            };
            if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
                query.$or.push({ _id: new ObjectId(id) });
            }

            const res = await db.collection('Tax').findOneAndUpdate(
                query,
                { $set: updateFields },
                { returnDocument: 'after' }
            );
            if (res) return normalizeTaxDocument(res);
        }
    }

    const mem = memoryTaxFallback.find(c => c.calculationId === id || c.id === id);
    if (mem) {
        Object.assign(mem, updateFields);
        return normalizeTaxDocument(mem);
    }
    return null;
}

/**
 * Returns dashboard metrics aggregated directly from the `Tax` collection in MongoDB.
 */
async function getTaxMetrics() {
    if (hasMongoDB()) {
        const db = getDB();
        if (db) {
            const totalCount = await db.collection('Tax').countDocuments();
            const pendingCount = await db.collection('Tax').countDocuments({
                $or: [
                    { status: 'Pending Review' },
                    { status: 'Under Review' },
                    { status: 'Draft' },
                    { status: 'Awaiting Documents' },
                    { status: { $exists: false } }
                ]
            });
            const approvedCount = await db.collection('Tax').countDocuments({
                $or: [
                    { status: 'Approved' },
                    { status: 'Finalized' }
                ]
            });

            const recentDocs = await db.collection('Tax')
                .find({})
                .sort({ createdAt: -1, _id: -1 })
                .limit(6)
                .toArray();

            return {
                totalCount,
                pendingCount,
                approvedCount,
                recentCalculations: recentDocs.map(normalizeTaxDocument)
            };
        }
    }

    return {
        totalCount: memoryTaxFallback.length,
        pendingCount: memoryTaxFallback.filter(c => c.status !== 'Approved').length,
        approvedCount: memoryTaxFallback.filter(c => c.status === 'Approved').length,
        recentCalculations: memoryTaxFallback.slice(0, 6).map(normalizeTaxDocument)
    };
}

module.exports = {
    normalizeTaxDocument,
    buildTaxCalculationDocument,
    insertCalculation,
    listAllCalculations,
    getCalculationById,
    listCalculationsByClient,
    updateCalculationStatus,
    getTaxMetrics
};
