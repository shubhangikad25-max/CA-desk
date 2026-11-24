const test = require('node:test');
const assert = require('node:assert/strict');
const taxService = require('../services/taxService');

test('1. Income of Zero', () => {
    const resNew = taxService.calculateTax({
        income: 0,
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(resNew.totalTax, 0);
    assert.equal(resNew.taxableIncome, 0);

    const resOld = taxService.calculateTax({
        income: 0,
        regime: 'old',
        financialYear: '2026-2027'
    });
    assert.equal(resOld.totalTax, 0);
    assert.equal(resOld.taxableIncome, 0);
});

test('2. Standard Deduction Eligibility (FY 2026-27 & FY 2025-26)', () => {
    // Salaried individual with salary >= 75k gets 75k standard deduction under New Regime
    const resSalaryNew = taxService.calculateTax({
        salaryIncome: 1000000,
        otherIncome: 0,
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(resSalaryNew.deductionBreakdown.standardDeduction, 75000);
    assert.equal(resSalaryNew.taxableIncome, 925000);

    // Salaried individual with salary >= 50k gets 50k standard deduction under Old Regime
    const resSalaryOld = taxService.calculateTax({
        salaryIncome: 1000000,
        otherIncome: 0,
        regime: 'old',
        financialYear: '2026-2027'
    });
    assert.equal(resSalaryOld.deductionBreakdown.standardDeduction, 50000);
    assert.equal(resSalaryOld.taxableIncome, 950000);

    // Non-salaried taxpayer (only other income) does NOT get standard deduction
    const resNonSalary = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 1000000,
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(resNonSalary.deductionBreakdown.standardDeduction, 0);
    assert.equal(resNonSalary.taxableIncome, 1000000);

    // Salary less than standard deduction: standard deduction is capped at salary income
    const resPartialSalary = taxService.calculateTax({
        salaryIncome: 40000,
        otherIncome: 0,
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(resPartialSalary.deductionBreakdown.standardDeduction, 40000);
    assert.equal(resPartialSalary.taxableIncome, 0);
});

test('3. Section 87A Rebate Threshold - FY 2026-27 & FY 2025-26 New Regime (Taxable up to 12L = 0 Tax)', () => {
    // Taxable income exactly ₹12,00,000 (e.g. gross salary ₹12,75,000 - ₹75,000 standard deduction)
    const result = taxService.calculateTax({
        salaryIncome: 1275000,
        otherIncome: 0,
        regime: 'new',
        financialYear: '2026-2027',
        residentialStatus: 'resident'
    });

    assert.equal(result.taxableIncome, 1200000);
    // 0-4L: 0, 4L-8L (5% of 4L) = 20,000, 8L-12L (10% of 4L) = 40,000. Total = 60,000
    assert.equal(result.taxBeforeRebate, 60000);
    assert.equal(result.rebate87A.applicable, true);
    assert.equal(result.rebate87A.amount, 60000);
    assert.equal(result.totalTax, 0);
});

test('4. Section 87A Marginal Relief - FY 2026-27 & FY 2025-26 New Regime (Income marginally above 12L)', () => {
    // Taxable income ₹12,10,000 (excess over 12L is ₹10,000)
    // Non-salaried to have exact taxable income = 12,10,000
    const result = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 1210000,
        regime: 'new',
        financialYear: '2026-2027',
        residentialStatus: 'resident'
    });

    assert.equal(result.taxableIncome, 1210000);
    // Slab tax on 12.10L: 60,000 + 15% of 10,000 = 61,500
    assert.equal(result.taxBeforeRebate, 61500);
    // Proviso to 87A: tax before cess cannot exceed excess over 12L (₹10,000)
    assert.equal(result.rebate87A.hasMarginalRelief, true);
    assert.equal(result.rebate87A.taxAfterRebate, 10000);
    assert.equal(result.rebate87A.marginalReliefAmount, 51500);
    // Cess: 4% of 10,000 = 400
    assert.equal(result.cess, 400);
    // Total Tax = 10,400
    assert.equal(result.totalTax, 10400);
});

test('5. Section 87A Rebate Threshold - FY 2024-25 New Regime (Taxable up to 7L = 0 Tax)', () => {
    // Gross salary 7,75,000 - 75,000 standard deduction = 7,00,000 taxable income
    const result = taxService.calculateTax({
        salaryIncome: 775000,
        otherIncome: 0,
        regime: 'new',
        financialYear: '2024-2025',
        residentialStatus: 'resident'
    });

    assert.equal(result.taxableIncome, 700000);
    // In FY 2024-25 New Regime: 0-3L 0%, 3L-7L 5% = 20,000
    assert.equal(result.taxBeforeRebate, 20000);
    assert.equal(result.rebate87A.applicable, true);
    assert.equal(result.rebate87A.amount, 20000);
    assert.equal(result.totalTax, 0);
});

test('6. Section 87A Marginal Relief - FY 2024-25 New Regime (Income marginally above 7L)', () => {
    // Taxable income ₹7,10,000 (excess over 7L is ₹10,000)
    const result = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 710000,
        regime: 'new',
        financialYear: '2024-2025',
        residentialStatus: 'resident'
    });

    assert.equal(result.taxableIncome, 710000);
    // Slab tax: 20,000 + 10% of 10,000 = 21,000
    assert.equal(result.taxBeforeRebate, 21000);
    // Marginal relief caps tax before cess at excess income (10,000)
    assert.equal(result.rebate87A.hasMarginalRelief, true);
    assert.equal(result.rebate87A.taxAfterRebate, 10000);
    assert.equal(result.totalTax, 10400);
});

test('7. Old Tax Regime - 87A Rebate at 5 Lakh & Strict Cliff (No Marginal Relief)', () => {
    // Exactly 5,00,000 taxable income: Tax is 12,500, full rebate under 87A -> Tax = 0
    const res5L = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 500000,
        regime: 'old',
        financialYear: '2026-2027',
        residentialStatus: 'resident'
    });
    assert.equal(res5L.taxableIncome, 500000);
    assert.equal(res5L.taxBeforeRebate, 12500);
    assert.equal(res5L.rebate87A.applicable, true);
    assert.equal(res5L.totalTax, 0);

    // Taxable income 5,00,010: Exceeds 5L, no 87A rebate in Old Regime!
    const res5L10 = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 500010,
        regime: 'old',
        financialYear: '2026-2027',
        residentialStatus: 'resident'
    });
    assert.equal(res5L10.rebate87A.applicable, false);
    // Tax: 12500 + 20% of 10 = 12502. Cess 4% = 500.08. Total rounded to nearest 10 = 13,000
    assert.equal(res5L10.totalTax, 13000);
});

test('8. Senior & Super Senior Citizen Slabs in Old Regime', () => {
    // Senior citizen (age 65): Basic exemption 3,00,000
    const resSenior = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 300000,
        age: 65,
        regime: 'old',
        financialYear: '2026-2027'
    });
    assert.equal(resSenior.taxBeforeRebate, 0);
    assert.equal(resSenior.totalTax, 0);

    // Super senior citizen (age 82): Basic exemption 5,00,000
    const resSuperSenior = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 500000,
        age: 82,
        regime: 'old',
        financialYear: '2026-2027'
    });
    assert.equal(resSuperSenior.taxBeforeRebate, 0);
    assert.equal(resSuperSenior.totalTax, 0);
});

test('9. Disallowed Chapter VI-A Deductions under New Regime', () => {
    // User claims 80C (1.5L) and 80D (25k)
    // Under New Regime, these are disallowed, but Standard Deduction (75k) is allowed
    const resNew = taxService.calculateTax({
        salaryIncome: 1500000,
        sec80C: 150000,
        sec80D: 25000,
        regime: 'new',
        financialYear: '2026-2027'
    });

    assert.equal(resNew.totalEligibleDeductions, 75000);
    assert.equal(resNew.taxableIncome, 1425000);

    // Under Old Regime, all are allowed (50k std + 1.5L + 25k = 2.25L)
    const resOld = taxService.calculateTax({
        salaryIncome: 1500000,
        sec80C: 150000,
        sec80D: 25000,
        regime: 'old',
        financialYear: '2026-2027'
    });

    assert.equal(resOld.totalEligibleDeductions, 225000);
    assert.equal(resOld.taxableIncome, 1275000);
});

test('10. Surcharge and Surcharge Marginal Relief (Income above 50L)', () => {
    // Old Regime taxable income 51,00,000 (excess over 50L is 1,00,000)
    const res = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 5100000,
        regime: 'old',
        financialYear: '2026-2027'
    });

    assert.equal(res.surcharge.rate, 0.10);
    assert.ok(res.surcharge.marginalRelief > 0, 'Surcharge marginal relief should be applied');
    // Final tax should be verified and rounded to nearest 10
    assert.ok(res.totalTax > 0);
    assert.equal(res.totalTax % 10, 0);
});

test('11. Regime Comparison - Accurately Recommends Lower Estimated Tax', () => {
    // Case A: High income with 0 deductions -> New Regime is significantly lower
    const compA = taxService.compareRegimes(taxService.normalizeInputs({
        salaryIncome: 1500000,
        financialYear: '2026-2027'
    }));
    assert.equal(compA.lowerRegime, 'new');
    assert.ok(compA.taxDifference > 0);
    assert.match(compA.recommendation, /lower estimated tax/i);

    // Case B: High deductions (80C, 80D, 24b Home Loan) where Old Regime might produce lower tax
    const compB = taxService.compareRegimes(taxService.normalizeInputs({
        salaryIncome: 1200000,
        sec80C: 150000,
        sec80CCD1B: 50000,
        sec80D: 50000,
        sec24b: 200000,
        financialYear: '2023-2024'
    }));
    assert.ok(['old', 'new', 'equal'].includes(compB.lowerRegime));
    assert.match(compB.recommendation, /estimated tax/i);
});

test('12. Robustness - Non-Resident (NRI) Ineligible for 87A', () => {
    const resNRI = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 1000000,
        residentialStatus: 'non_resident',
        regime: 'new',
        financialYear: '2026-2027'
    });

    assert.equal(resNRI.rebate87A.applicable, false);
    assert.equal(resNRI.rebate87A.amount, 0);
    // Normal slab tax: 0-4L: 0, 4L-8L: 20,000, 8L-10L (10% of 2L): 20,000 = 40,000 + 4% cess = 41,600
    assert.equal(resNRI.taxBeforeRebate, 40000);
    assert.equal(resNRI.totalTax, 41600);
});

test('13. Robustness - Negative and Edge Value Inputs', () => {
    const resNegative = taxService.calculateTax({
        salaryIncome: -50000,
        otherIncome: -20000,
        sec80C: -10000,
        age: -5,
        regime: 'new'
    });

    assert.equal(resNegative.grossIncome, 0);
    assert.equal(resNegative.totalTax, 0);
    assert.equal(resNegative.ageCategory, 'general');
});

test('14. FY 2026-27 Slabs at every boundary (4L, 8L, 12L, 16L, 20L, 24L, 30L)', () => {
    // ₹4,00,000 (Non-salaried to test exact taxable = 4L)
    const res4L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 400000, regime: 'new', financialYear: '2026-2027', residentialStatus: 'non_resident' });
    assert.equal(res4L.taxBeforeRebate, 0);
    assert.equal(res4L.totalTax, 0);

    // ₹8,00,000 (Non-resident to inspect slab tax without 87A rebate)
    // 0-4L: 0, 4L-8L (5% of 4L) = 20,000 + 4% cess = 20,800
    const res8L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 800000, regime: 'new', financialYear: '2026-2027', residentialStatus: 'non_resident' });
    assert.equal(res8L.taxBeforeRebate, 20000);
    assert.equal(res8L.totalTax, 20800);

    // ₹12,00,000 (Non-resident)
    // 20,000 + 10% of 4L = 60,000 + 4% cess = 62,400
    const res12L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 1200000, regime: 'new', financialYear: '2026-2027', residentialStatus: 'non_resident' });
    assert.equal(res12L.taxBeforeRebate, 60000);
    assert.equal(res12L.totalTax, 62400);

    // ₹16,00,000 (Resident or Non-resident; 87A ceases)
    // 60,000 + 15% of 4L = 1,20,000 + 4% cess (4,800) = 1,24,800
    const res16L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 1600000, regime: 'new', financialYear: '2026-2027' });
    assert.equal(res16L.taxBeforeRebate, 120000);
    assert.equal(res16L.totalTax, 124800);

    // ₹20,00,000
    // 1,20,000 + 20% of 4L = 2,00,000 + 4% cess (8,000) = 2,08,000
    const res20L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 2000000, regime: 'new', financialYear: '2026-2027' });
    assert.equal(res20L.taxBeforeRebate, 200000);
    assert.equal(res20L.totalTax, 208000);

    // ₹24,00,000
    // 2,00,000 + 25% of 4L = 3,00,000 + 4% cess (12,000) = 3,12,000
    const res24L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 2400000, regime: 'new', financialYear: '2026-2027' });
    assert.equal(res24L.taxBeforeRebate, 300000);
    assert.equal(res24L.totalTax, 312000);

    // ₹30,00,000
    // 3,00,000 + 30% of 6L = 4,80,000 + 4% cess (19,200) = 4,99,200
    const res30L = taxService.calculateTax({ salaryIncome: 0, otherIncome: 3000000, regime: 'new', financialYear: '2026-2027' });
    assert.equal(res30L.taxBeforeRebate, 480000);
    assert.equal(res30L.totalTax, 499200);
});

test('15. Higher Surcharge Brackets (15%, 25%, and Old 37%)', () => {
    // 15% Surcharge for income > 1 Crore and <= 2 Crore under New Regime
    const res1Cr2 = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 12000000, // 1.2 Crore
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(res1Cr2.surcharge.rate, 0.15);
    assert.ok(res1Cr2.surcharge.finalSurcharge > 0);

    // 25% Surcharge for income > 2 Crore under New Regime
    const res2Cr5 = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 25000000, // 2.5 Crore
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(res2Cr5.surcharge.rate, 0.25);
    assert.ok(res2Cr5.surcharge.finalSurcharge > 0);

    // 37% Surcharge for income > 5 Crore under Old Regime
    const res6CrOld = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 60000000, // 6 Crore
        regime: 'old',
        financialYear: '2026-2027'
    });
    assert.equal(res6CrOld.surcharge.rate, 0.37);
    assert.ok(res6CrOld.surcharge.finalSurcharge > 0);
});

test('16. Nested Deductions Object Support', () => {
    const res = taxService.calculateTax({
        salaryIncome: 1200000,
        regime: 'old',
        financialYear: '2026-2027',
        deductions: {
            sec80C: 150000,
            sec80D: 25000,
            sec24b: 100000
        }
    });

    assert.equal(res.deductionBreakdown.standardDeduction, 50000);
    assert.equal(res.deductionBreakdown.sec80C, 150000);
    assert.equal(res.deductionBreakdown.sec80D, 25000);
    assert.equal(res.deductionBreakdown.sec24b, 100000);
    assert.equal(res.totalEligibleDeductions, 325000);
});

test('17. Section 288A and 288B Rounding Rules', () => {
    assert.equal(taxService.roundToNearestTen(1254.4), 1250);
    assert.equal(taxService.roundToNearestTen(1255.0), 1260);
    assert.equal(taxService.roundToNearestTen(1259.9), 1260);

    // Calculation produces exact multiple of 10
    const res = taxService.calculateTax({
        salaryIncome: 0,
        otherIncome: 1215437,
        regime: 'new',
        financialYear: '2026-2027'
    });
    assert.equal(res.taxableIncome % 10, 0);
    assert.equal(res.totalTax % 10, 0);
});

