process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const taxRoutes = require('../routes/taxRoutes');
const taxService = require('../services/taxService');
const { closeDB } = require('../services/mongo');

function createFullApp() {
    const app = express();
    app.use(express.json());
    // Mount at root, /api, and /api/tax identically to server.js
    app.use('/', taxRoutes);
    app.use('/api', taxRoutes);
    app.use('/api/tax', taxRoutes);
    return app;
}

test.after(async () => {
    await closeDB();
});

test('Enhancement: POST /calculate succeeds at root (resolves Route not found)', async () => {
    const app = createFullApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taxpayerType: 'individual',
                salaryIncome: 1275000,
                regime: 'new',
                financialYear: '2026-2027'
            })
        });

        assert.equal(res.status, 200, 'POST /calculate should return 200 OK');
        const json = await res.json();
        assert.equal(json.success, true);
        assert.equal(json.data.totalTax, 0, 'Salaried 12.75L in FY 26-27 under New Regime should have 0 tax');
        assert.ok(json.data.recommendations.length > 0, 'Recommendations should be generated');
    } finally {
        server.close();
    }
});

test('Enhancement: Section 87A Rebate explicitly excludes Section 112A LTCG tax per Section 112A(2)', () => {
    // Resident individual with ₹4L ordinary salary (basic exemption limit is 4L under FY 26-27 New Regime)
    // + ₹2.25L LTCG 112A (first 1.25L exempt, 1L taxed at 12.5% = ₹12,500 tax)
    // Total taxable income = 4L ordinary + 1L taxable LTCG = 5L (which is under the 12L threshold)
    // BUT Section 112A(2) explicitly forbids Section 87A rebate against Section 112A tax!
    const res = taxService.calculateTax({
        taxpayerType: 'individual',
        salaryIncome: 475000, // 4.75L - 75k std deduction = 4L ordinary taxable
        ltcg112A: 225000,     // 2.25L - 1.25L exempt = 1L taxable @ 12.5% = 12,500
        residentialStatus: 'resident',
        regime: 'new',
        financialYear: '2026-2027'
    });

    assert.equal(res.specialRateTax.ltcg112A.tax, 12500, 'LTCG 112A tax should be 12,500');
    // Ordinary tax is 0 (first 4L is exempt)
    assert.equal(res.ordinarySlabTax, 0);
    // Rebate cannot be claimed against 112A tax!
    assert.equal(res.rebate87A.amount, 0, 'Section 87A rebate must NOT offset Section 112A tax');
    assert.ok(res.totalTax > 0, 'Total tax must reflect Section 112A tax plus cess');
    assert.equal(res.totalTax, 13000); // 12,500 + 4% cess (500) = 13,000
});

test('Enhancement: Simulator disallows Section 80C under New Regime with isRegimeEligible false', () => {
    const sim = taxService.simulateTaxSaving({
        baseInput: {
            taxpayerType: 'individual',
            salaryIncome: 1500000,
            regime: 'new',
            financialYear: '2026-2027'
        },
        proposedSection: 'sec80C',
        proposedAmount: 150000
    });

    assert.equal(sim.isRegimeEligible, false, '80C must be ineligible under New Regime');
    assert.equal(sim.deductionActuallyAllowed, 0, 'Allowed deduction must be 0 in New Regime');
    assert.equal(sim.taxSaved, 0, 'Tax saved must be 0 in New Regime for 80C');
    assert.equal(sim.netCashOutflow, 150000, 'Net cash outflow should equal proposed amount');
    assert.ok(sim.regimeWarning, 'Should contain regime warning');
});

test('Enhancement: Simulator allows Section 80CCD(2) Employer NPS under New Regime', () => {
    const sim = taxService.simulateTaxSaving({
        baseInput: {
            taxpayerType: 'individual',
            salaryIncome: 1500000,
            regime: 'new',
            financialYear: '2026-2027'
        },
        proposedSection: 'sec80CCD2',
        proposedAmount: 100000
    });

    assert.equal(sim.isRegimeEligible, true);
    assert.equal(sim.deductionActuallyAllowed, 100000);
    assert.ok(sim.taxSaved > 0, 'Employer NPS should generate real tax savings in New Regime');
    assert.ok(sim.netCashOutflow < 100000, 'Net cash outflow should be less than proposed amount due to tax saved');
});

test('Enhancement: Category-specific planning recommendations generated for HUF, Company, Firm, Cooperative', () => {
    // 1. HUF
    const hufRecs = taxService.generateRecommendations({
        taxpayerType: 'huf',
        regime: 'old',
        normalizedInput: taxService.normalizeInputs({ taxpayerType: 'huf', businessIncome: 800000, regime: 'old' }),
        taxResult: { totalTax: 75000 }
    });
    assert.ok(hufRecs.length > 0);
    assert.ok(hufRecs.some(r => r.id === 'huf_80c'), 'HUF recommendations should include HUF Section 80C');

    // 2. Domestic Company
    const compRecs = taxService.generateRecommendations({
        taxpayerType: 'domestic_company',
        regime: 'standard_30',
        normalizedInput: taxService.normalizeInputs({ taxpayerType: 'domestic_company', businessIncome: 5000000, companyOption: 'standard_30' }),
        taxResult: { totalTax: 1500000 }
    });
    assert.ok(compRecs.length > 0);
    assert.ok(compRecs.some(r => r.id === 'comp_115baa'), 'Domestic Company recommendations should include Section 115BAA');

    // 3. Firm / LLP
    const firmRecs = taxService.generateRecommendations({
        taxpayerType: 'firm_llp',
        regime: 'flat_30',
        normalizedInput: taxService.normalizeInputs({ taxpayerType: 'firm_llp', businessIncome: 2000000 }),
        taxResult: { totalTax: 624000 }
    });
    assert.ok(firmRecs.length > 0);
    assert.ok(firmRecs.some(r => r.id === 'firm_remuneration'), 'Firm recommendations should include partner remuneration');

    // 4. Cooperative Society
    const coopRecs = taxService.generateRecommendations({
        taxpayerType: 'cooperative_society',
        regime: 'old',
        normalizedInput: taxService.normalizeInputs({ taxpayerType: 'cooperative_society', businessIncome: 500000 }),
        taxResult: { totalTax: 110000 }
    });
    assert.ok(coopRecs.length > 0);
    assert.ok(coopRecs.some(r => r.id === 'coop_115bad'), 'Cooperative recommendations should include Section 115BAD');
});
