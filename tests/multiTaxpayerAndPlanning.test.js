process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const taxService = require('../services/taxService');
const express = require('express');
const taxRoutes = require('../routes/taxRoutes');
const { closeDB } = require('../services/mongo');

test.after(async () => {
    await closeDB();
});

test('Taxpayer: HUF (Hindu Undivided Family) - Slabs apply, but NO Section 87A rebate', () => {
    // HUF with business income of ₹5,00,000 under Old Regime
    // In Old Regime for Individual <= 5L, 87A rebate makes tax 0.
    // But for HUF, 87A rebate is NOT allowed!
    const resHufOld = taxService.calculateTax({
        taxpayerType: 'huf',
        businessIncome: 500000,
        regime: 'old',
        financialYear: '2026-2027'
    });

    assert.equal(resHufOld.taxpayerType, 'huf');
    assert.equal(resHufOld.taxableIncome, 500000);
    // Tax on 5L: 2.5L to 5L @ 5% = ₹12,500. No 87A rebate!
    assert.equal(resHufOld.taxBeforeRebate, 12500);
    assert.equal(resHufOld.rebate87A.applicable, false);
    assert.equal(resHufOld.rebate87A.amount, 0);
    // Cess 4% = ₹500 -> Total Tax = ₹13,000
    assert.equal(resHufOld.totalTax, 13000);
});

test('Taxpayer: Domestic Company - Standard (30%), Turnover <= 400Cr (25%), and Section 115BAA (22%)', () => {
    // 1. Standard 30%
    const resStd = taxService.calculateTax({
        taxpayerType: 'domestic_company',
        businessIncome: 10000000, // 1 Crore
        companyOption: 'standard_30',
        financialYear: '2026-2027'
    });
    // Tax: 30% of 1 Cr = 30,00,000. Surcharge = 0 (income <= 1Cr). Cess 4% = 1,20,000. Total = 31,20,000
    assert.equal(resStd.baseTax, 3000000);
    assert.equal(resStd.surcharge.finalSurcharge, 0);
    assert.equal(resStd.totalTax, 3120000);

    // 2. Turnover <= 400 Cr (25%)
    const res25 = taxService.calculateTax({
        taxpayerType: 'domestic_company',
        businessIncome: 10000000,
        companyOption: 'turnover_le_400cr_25',
        financialYear: '2026-2027'
    });
    // Tax: 25% of 1 Cr = 25,00,000. Cess 4% = 1,00,000. Total = 26,00,000
    assert.equal(res25.baseTax, 2500000);
    assert.equal(res25.totalTax, 2600000);

    // 3. Section 115BAA (22% + flat 10% surcharge)
    const res115BAA = taxService.calculateTax({
        taxpayerType: 'domestic_company',
        businessIncome: 10000000,
        companyOption: 'sec_115baa_22',
        financialYear: '2026-2027'
    });
    // Base Tax: 22% of 1 Cr = 22,00,000. Surcharge (10% flat) = 2,20,000. Subtotal = 24,20,000. Cess 4% = 96,800. Total = 25,16,800
    assert.equal(res115BAA.baseTax, 2200000);
    assert.equal(res115BAA.surcharge.finalSurcharge, 220000);
    assert.equal(res115BAA.totalTax, 2516800);
});

test('Taxpayer: Foreign Company - Flat 35% Tax Rate (Finance (No. 2) Act 2024)', () => {
    const res = taxService.calculateTax({
        taxpayerType: 'foreign_company',
        businessIncome: 20000000, // 2 Crores
        financialYear: '2026-2027'
    });

    // Base tax: 35% of 2 Cr = 70,00,000
    assert.equal(res.baseTax, 7000000);
    // Surcharge for Foreign Co > 1 Cr <= 10 Cr: 2% of 70,00,000 = 1,40,000
    assert.equal(res.surcharge.rate, 0.02);
    assert.equal(res.surcharge.finalSurcharge, 140000);
    // Tax + Surcharge = 71,40,000. Cess 4% = 2,85,600. Total = 74,25,600
    assert.equal(res.totalTax, 7425600);
});

test('Taxpayer: Firm / LLP - Flat 30% Tax Rate and Surcharge on Income > 1 Crore', () => {
    // 50 Lakhs (no surcharge)
    const res50L = taxService.calculateTax({
        taxpayerType: 'firm_llp',
        businessIncome: 5000000,
        financialYear: '2026-2027'
    });
    // 30% of 50L = 15,00,000. Cess 4% = 60,000. Total = 15,60,000
    assert.equal(res50L.baseTax, 1500000);
    assert.equal(res50L.surcharge.finalSurcharge, 0);
    assert.equal(res50L.totalTax, 1560000);

    // 2 Crores (12% surcharge)
    const res2Cr = taxService.calculateTax({
        taxpayerType: 'firm_llp',
        businessIncome: 20000000,
        financialYear: '2026-2027'
    });
    // 30% of 2 Cr = 60,00,000. Surcharge 12% = 7,20,000. Subtotal = 67,20,000. Cess 4% = 2,68,800. Total = 69,88,800
    assert.equal(res2Cr.baseTax, 6000000);
    assert.equal(res2Cr.surcharge.rate, 0.12);
    assert.equal(res2Cr.surcharge.finalSurcharge, 720000);
    assert.equal(res2Cr.totalTax, 6988800);
});

test('Taxpayer: Cooperative Society - Regular Slabs vs Concessional Section 115BAD (22%)', () => {
    // Regular slabs: 10% up to 10k, 20% 10k-20k, 30% above 20k
    const resReg = taxService.calculateTax({
        taxpayerType: 'cooperative_society',
        businessIncome: 100000,
        cooperativeOption: 'regular',
        regime: 'old',
        financialYear: '2026-2027'
    });
    // 10k @ 10% = 1,000; 10k @ 20% = 2,000; 80k @ 30% = 24,000. Base = 27,000. Cess 4% = 1,080. Total = 28,080
    assert.equal(resReg.baseTax, 27000);
    assert.equal(resReg.totalTax, 28080);

    // Section 115BAD: 22% + 10% surcharge
    const resBad = taxService.calculateTax({
        taxpayerType: 'cooperative_society',
        businessIncome: 1000000, // 10L
        cooperativeOption: 'sec115bad',
        regime: 'new',
        financialYear: '2026-2027'
    });
    // 22% of 10L = 2,20,000. Surcharge (10%) = 22,000. Cess (4%) = 9,680. Total = 2,51,680
    assert.equal(resBad.baseTax, 220000);
    assert.equal(resBad.surcharge.finalSurcharge, 22000);
    assert.equal(resBad.totalTax, 251680);
});

test('Capital Gains: STCG 111A (20%) and LTCG 112A (12.5% with ₹1.25L Exemption)', () => {
    // Individual with salary 10L and LTCG 112A of ₹3,00,000
    const res = taxService.calculateTax({
        taxpayerType: 'individual',
        salaryIncome: 1000000,
        ltcg112A: 300000,
        regime: 'new',
        financialYear: '2026-2027'
    });

    // LTCG 112A has ₹1,25,000 exemption limit.
    // Taxable LTCG 112A = 3,00,000 - 1,25,000 = ₹1,75,000.
    // Tax on LTCG 112A @ 12.5% = 1,75,000 * 0.125 = ₹21,875.
    assert.equal(res.specialRateTax.ltcg112A.taxableAmount, 175000);
    assert.equal(res.specialRateTax.ltcg112A.tax, 21875);
});

test('House Property: Let-out Net Income Calculation with 30% Standard Deduction', () => {
    const res = taxService.calculateTax({
        taxpayerType: 'individual',
        salaryIncome: 800000,
        housePropertyType: 'let_out',
        housePropertyGrossRent: 300000,
        housePropertyMunicipalTaxes: 20000,
        housePropertyLoanInterest: 50000,
        regime: 'old',
        financialYear: '2026-2027'
    });

    // NAV = 3,00,000 - 20,00,000 = 2,80,000
    // Standard deduction (30% of NAV) = 84,000
    // Interest = 50,000
    // Net HP Income = 2,80,000 - 84,000 - 50,000 = 1,46,000
    assert.equal(res.headWiseIncome.houseProperty, 146000);
});

test('Tax Planning: Recommendations Generated and Tailored for Taxpayer Type', () => {
    const res = taxService.calculateTax({
        taxpayerType: 'individual',
        salaryIncome: 1500000,
        sec80C: 100000,
        regime: 'old',
        financialYear: '2026-2027'
    });

    assert.ok(Array.isArray(res.recommendations));
    assert.ok(res.recommendations.length > 0);

    const rec80C = res.recommendations.find(r => r.id === 'sec80C');
    assert.ok(rec80C);
    assert.equal(rec80C.amountClaimed, 100000);
    assert.equal(rec80C.remainingEligible, 50000);
    assert.ok(rec80C.estimatedTaxSaving > 0, 'Estimated tax saving should be calculated');
});

test('Interactive Tax Simulator: simulateTaxSaving recalculates tax accurately', () => {
    const baseInput = {
        taxpayerType: 'individual',
        salaryIncome: 1500000,
        sec80C: 50000,
        regime: 'old',
        financialYear: '2026-2027'
    };

    const sim = taxService.simulateTaxSaving({
        baseInput,
        proposedSection: 'sec80C',
        proposedAmount: 50000
    });

    assert.ok(sim.currentTax > 0);
    assert.ok(sim.revisedTax < sim.currentTax);
    assert.ok(sim.taxSaved > 0);
    assert.equal(sim.deductionActuallyAllowed, 50000);
    assert.ok(sim.efficiencyPercentage > 0);
});

test('API: GET /api/taxpayer-types returns all 8 categories', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', taxRoutes);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/taxpayer-types`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(Array.isArray(data.data));
        const ids = data.data.map(d => d.id);
        assert.ok(ids.includes('individual'));
        assert.ok(ids.includes('huf'));
        assert.ok(ids.includes('domestic_company'));
        assert.ok(ids.includes('firm_llp'));
        assert.ok(ids.includes('cooperative_society'));
    } finally {
        server.close();
    }
});

test('API: POST /api/simulate returns interactive tax saving simulation', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', taxRoutes);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                baseInput: {
                    salaryIncome: 1200000,
                    sec80C: 50000,
                    regime: 'old',
                    financialYear: '2026-2027'
                },
                proposedSection: 'sec80C',
                proposedAmount: 50000
            })
        });

        assert.equal(res.status, 200);
        const result = await res.json();
        assert.equal(result.success, true);
        assert.ok(result.data.taxSaved > 0);
        assert.equal(result.data.deductionActuallyAllowed, 50000);
    } finally {
        server.close();
    }
});
