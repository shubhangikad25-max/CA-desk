const taxService = require('../services/taxService');
const { connectDB } = require('../services/mongo');

async function logTaxToMongo(entry) {
    if (process.env.NODE_ENV === 'test') return;
    try {
        const db = await connectDB();
        if (db) {
            await db.collection('Tax').insertOne(entry);
        }
    } catch (e) {
        // Safe catch, non-blocking
    }
}

function healthCheck(req, res) {
    res.json({
        success: true,
        service: 'TaxWise API',
        timestamp: new Date().toISOString()
    });
}

function getSupportedYears(req, res) {
    try {
        const years = taxService.getSupportedYears();
        res.json({
            success: true,
            years
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

function getTaxpayerTypes(req, res) {
    try {
        const data = taxService.getTaxpayerTypes();
        res.json({
            success: true,
            data
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

function getTaxSlabs(req, res) {
    try {
        const { financialYear } = req.query;
        const taxData = taxService.getTaxData();
        const fyData = financialYear ? taxData.years[financialYear] : taxData.years[taxData.defaultYear || '2026-2027'];
        if (!fyData) {
            return res.status(404).json({ success: false, message: `Financial year ${financialYear} not found` });
        }
        // Return individual slabs with newRegime & oldRegime for compatibility
        const data = fyData.individual ? { ...fyData.individual, financialYear: fyData.financialYear } : fyData;
        res.json({
            success: true,
            data
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

function calculateTax(req, res) {
    try {
        const body = req.body || {};
        const errors = [];

        // Validate income
        if (body.income != null && Number(body.income) < 0) {
            errors.push('Income cannot be negative');
        }
        if (body.salaryIncome != null && Number(body.salaryIncome) < 0) {
            errors.push('Salary income cannot be negative');
        }
        if (body.businessIncome != null && Number(body.businessIncome) < 0) {
            errors.push('Business income cannot be negative');
        }
        if (body.otherIncome != null && Number(body.otherIncome) < 0) {
            errors.push('Other income cannot be negative');
        }

        // Validate age
        if (body.age != null && (Number(body.age) < 0 || Number(body.age) > 120)) {
            errors.push('Invalid age. Must be between 0 and 120');
        }

        // Validate deduction
        if (body.deduction != null && Number(body.deduction) < 0) {
            errors.push('Deductions cannot be negative');
        }
        if (body.deductions && typeof body.deductions === 'object') {
            for (const [key, val] of Object.entries(body.deductions)) {
                if (Number(val) < 0) {
                    errors.push(`Deduction ${key} cannot be negative`);
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
                message: errors.join('; ')
            });
        }

        const result = taxService.calculateTax(body);

        logTaxToMongo({
            name: body.name || 'TaxWise Online User',
            taxpayerType: body.taxpayerType || 'individual',
            age: body.age != null ? Number(body.age) : 35,
            residentialStatus: body.residentialStatus || 'resident',
            grossIncome: result.grossTotalIncome != null ? result.grossTotalIncome : (Number(body.income) || 0),
            financialYear: body.financialYear || result.financialYear || '2026-2027',
            regime: result.recommendedRegime || result.regime || (body.regime || 'new'),
            totalTax: result.totalTax != null ? result.totalTax : (result.netTaxLiability || 0),
            effectiveTaxRate: result.effectiveRate || (result.grossTotalIncome ? Math.round(((result.totalTax || 0) / result.grossTotalIncome) * 1000) / 10 : 0),
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
}

function compareTaxRegimes(req, res) {
    try {
        const result = taxService.compareTaxRegimes(req.body);

        const lowerTax = Math.min(
            result.regimeNew ? (result.regimeNew.totalTax || 0) : Infinity,
            result.regimeOld ? (result.regimeOld.totalTax || 0) : Infinity
        );
        logTaxToMongo({
            name: req.body.name || 'TaxWise Online User',
            taxpayerType: req.body.taxpayerType || 'individual',
            age: req.body.age != null ? Number(req.body.age) : 35,
            residentialStatus: req.body.residentialStatus || 'resident',
            grossIncome: result.grossTotalIncome != null ? result.grossTotalIncome : (Number(req.body.income) || 0),
            financialYear: req.body.financialYear || '2026-2027',
            regime: result.recommendedRegime || 'new',
            totalTax: isFinite(lowerTax) ? lowerTax : 0,
            effectiveTaxRate: result.effectiveRate || 0,
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
}

function simulateTaxSaving(req, res) {
    try {
        const result = taxService.simulateTaxSaving(req.body);
        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            message: err.message
        });
    }
}

module.exports = {
    healthCheck,
    getSupportedYears,
    getTaxpayerTypes,
    getTaxSlabs,
    calculateTax,
    compareTaxRegimes,
    simulateTaxSaving
};
