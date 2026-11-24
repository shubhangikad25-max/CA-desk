const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'tax-data.json');

let cachedTaxData = null;

/**
 * Loads tax data from JSON file with in-memory caching.
 */
function getTaxData() {
    if (!cachedTaxData) {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        cachedTaxData = JSON.parse(rawData);
    }
    return cachedTaxData;
}

/**
 * Reloads tax data from disk (useful for tests or updates).
 */
function reloadTaxData() {
    cachedTaxData = null;
    return getTaxData();
}

/**
 * Returns supported financial years metadata.
 */
function getSupportedYears() {
    const data = getTaxData();
    return data.supportedYears || [];
}

/**
 * Returns supported taxpayer types.
 */
function getTaxpayerTypes() {
    const data = getTaxData();
    return data.taxpayerTypes || [];
}

/**
 * Section 288A & 288B rounding: rounded to the nearest multiple of ten rupees.
 */
function roundToNearestTen(amount) {
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount / 10) * 10;
}

/**
 * Resolves age category for old regime individual slabs:
 * - 'general': Age < 60
 * - 'seniorCitizen': Age >= 60 and < 80
 * - 'superSeniorCitizen': Age >= 80
 */
function getAgeCategory(age) {
    const numAge = Number(age);
    if (!Number.isFinite(numAge) || numAge < 60) {
        return 'general';
    }
    if (numAge >= 80) {
        return 'superSeniorCitizen';
    }
    return 'seniorCitizen';
}

/**
 * Calculates standard progressive slab tax.
 */
function computeSlabTax(taxableIncome, slabs) {
    let totalTax = 0;
    const slabBreakdown = [];

    for (let i = 0; i < slabs.length; i++) {
        const slab = slabs[i];
        const min = slab.min;
        const max = slab.max;
        const rate = slab.rate;

        let taxableInSlab = 0;
        let taxForSlab = 0;

        if (taxableIncome > min) {
            if (max === null) {
                taxableInSlab = taxableIncome - min;
            } else {
                taxableInSlab = Math.min(taxableIncome, max) - min;
            }

            if (taxableInSlab > 0) {
                taxForSlab = taxableInSlab * rate;
                totalTax += taxForSlab;
            }
        }

        slabBreakdown.push({
            slabLabel: slab.label || (max ? `₹${min.toLocaleString('en-IN')} - ₹${max.toLocaleString('en-IN')}` : `Above ₹${min.toLocaleString('en-IN')}`),
            min,
            max,
            from: min,
            to: max,
            rate,
            ratePercent: Math.round(rate * 100),
            taxableInSlab: Math.round(taxableInSlab),
            taxForSlab: Math.round(taxForSlab),
            tax: Math.round(taxForSlab)
        });
    }

    return { totalTax, slabBreakdown };
}

/**
 * Calculates Section 87A rebate and marginal relief.
 * Resident individuals only. Note: Cannot rebate Section 112A tax as per statute!
 */
function computeRebate87A(taxBeforeRebate, taxableIncome, rebateConfig, isResident, taxEligibleForRebate) {
    if (!isResident || !rebateConfig) {
        return {
            eligible: false,
            rebateAmount: 0,
            hasMarginalRelief: false,
            marginalReliefAmount: 0,
            taxAfterRebate: taxBeforeRebate
        };
    }

    // Default eligible tax is taxBeforeRebate unless constrained by non-rebateable special tax (e.g. 112A)
    const maxRebateableTax = taxEligibleForRebate != null ? Math.min(taxBeforeRebate, taxEligibleForRebate) : taxBeforeRebate;

    const { incomeThreshold, maxRebate, hasMarginalRelief } = rebateConfig;

    if (taxableIncome <= incomeThreshold) {
        // Income is within rebate threshold: 100% tax rebated up to maxRebate against eligible tax
        const rebate = Math.min(maxRebateableTax, maxRebate);
        return {
            eligible: true,
            rebateAmount: rebate,
            hasMarginalRelief: false,
            marginalReliefAmount: 0,
            taxAfterRebate: Math.max(0, taxBeforeRebate - rebate)
        };
    }

    // Income marginally exceeds rebate threshold
    if (hasMarginalRelief) {
        const excessIncome = taxableIncome - incomeThreshold;
        // Statutory marginal relief: tax payable cannot exceed excess of income over threshold
        if (taxBeforeRebate > excessIncome) {
            const taxAfterRelief = excessIncome;
            const effectiveRebate = taxBeforeRebate - taxAfterRelief;
            return {
                eligible: true,
                rebateAmount: effectiveRebate,
                hasMarginalRelief: true,
                marginalReliefAmount: effectiveRebate,
                taxAfterRebate: taxAfterRelief
            };
        }
    }

    return {
        eligible: false,
        rebateAmount: 0,
        hasMarginalRelief: false,
        marginalReliefAmount: 0,
        taxAfterRebate: taxBeforeRebate
    };
}

/**
 * Calculates surcharge and surcharge marginal relief.
 * Handles surcharge cap (e.g. 15% for special capital gains).
 */
function computeSurcharge(taxableIncome, taxAfterRebate, surchargeTable, slabs, maxSurchargeRateCap = null) {
    if (!surchargeTable || surchargeTable.length === 0 || taxableIncome <= surchargeTable[0].min || taxAfterRebate <= 0) {
        return {
            rate: 0,
            ratePercent: 0,
            nominalSurcharge: 0,
            marginalRelief: 0,
            finalSurcharge: 0
        };
    }

    // Find applicable surcharge rate
    let activeBracket = null;
    let bracketIndex = -1;
    for (let i = 0; i < surchargeTable.length; i++) {
        const bracket = surchargeTable[i];
        if (taxableIncome > bracket.min && (bracket.max === null || taxableIncome <= bracket.max)) {
            activeBracket = bracket;
            bracketIndex = i;
            break;
        }
    }

    if (!activeBracket) {
        return {
            rate: 0,
            ratePercent: 0,
            nominalSurcharge: 0,
            marginalRelief: 0,
            finalSurcharge: 0
        };
    }

    let rate = activeBracket.rate;
    if (maxSurchargeRateCap != null && rate > maxSurchargeRateCap) {
        rate = maxSurchargeRateCap;
    }

    const nominalSurcharge = taxAfterRebate * rate;

    // Surcharge Marginal Relief calculation:
    // Tax + Surcharge cannot exceed: (Tax + Surcharge at lower threshold) + (Taxable Income - lower threshold)
    const threshold = activeBracket.min;
    const excessIncome = taxableIncome - threshold;

    let taxAtThreshold = 0;
    if (Array.isArray(slabs)) {
        const res = computeSlabTax(threshold, slabs);
        taxAtThreshold = res.totalTax;
    } else if (typeof slabs === 'number') {
        taxAtThreshold = threshold * slabs; // flat rate entity
    }

    let surchargeAtThreshold = 0;
    if (bracketIndex > 0) {
        const prevBracket = surchargeTable[bracketIndex - 1];
        let prevRate = prevBracket.rate;
        if (maxSurchargeRateCap != null && prevRate > maxSurchargeRateCap) {
            prevRate = maxSurchargeRateCap;
        }
        surchargeAtThreshold = taxAtThreshold * prevRate;
    }

    const maxAllowedTaxAndSurcharge = taxAtThreshold + surchargeAtThreshold + excessIncome;
    const currentTaxAndSurcharge = taxAfterRebate + nominalSurcharge;

    let marginalRelief = 0;
    let finalSurcharge = nominalSurcharge;

    if (currentTaxAndSurcharge > maxAllowedTaxAndSurcharge) {
        marginalRelief = currentTaxAndSurcharge - maxAllowedTaxAndSurcharge;
        finalSurcharge = Math.max(0, nominalSurcharge - marginalRelief);
    }

    return {
        rate,
        ratePercent: rate * 100,
        nominalSurcharge: Math.round(nominalSurcharge),
        marginalRelief: Math.round(marginalRelief),
        finalSurcharge: Math.round(finalSurcharge)
    };
}

/**
 * Normalizes user inputs across all taxpayer types and all 5 income heads.
 */
function normalizeInputs(input = {}) {
    const data = getTaxData();
    const defaultYear = data.defaultYear || '2026-2027';

    let financialYear = input.financialYear || input.year || defaultYear;
    if (!data.years[financialYear]) {
        financialYear = defaultYear;
    }

    const taxpayerType = input.taxpayerType || 'individual';
    const name = typeof input.name === 'string' ? input.name.trim() : '';

    let age = Number(input.age);
    if (!Number.isFinite(age) || age <= 0) {
        age = 30; // sensible default adult taxpayer
    }

    const residentialStatus = (input.residentialStatus === 'non_resident' || input.residentialStatus === 'nri')
        ? 'non_resident'
        : 'resident';
    const isResident = residentialStatus === 'resident';

    // 1. Salary Income (Individual only)
    let salaryIncome = 0;
    if (taxpayerType === 'individual') {
        if (input.salaryIncome != null || input.salary != null || input.grossSalary != null) {
            salaryIncome = Math.max(0, Number(input.salaryIncome ?? input.salary ?? input.grossSalary) || 0);
        } else if (input.income != null && input.incomeType !== 'other' && input.incomeType !== 'business') {
            salaryIncome = Math.max(0, Number(input.income) || 0);
        }
    }

    // 2. Business / Professional Income
    let businessIncome = 0;
    if (input.businessIncome != null || input.businessProfit != null || input.netProfit != null) {
        businessIncome = Math.max(0, Number(input.businessIncome ?? input.businessProfit ?? input.netProfit) || 0);
    } else if (input.grossTurnover != null || input.turnover != null) {
        const turnover = Math.max(0, Number(input.grossTurnover ?? input.turnover) || 0);
        const expenses = Math.max(0, Number(input.businessExpenses ?? input.expenses) || 0);
        const depreciation = Math.max(0, Number(input.businessDepreciation ?? input.depreciation) || 0);
        businessIncome = Math.max(0, turnover - expenses - depreciation);
    } else if (taxpayerType !== 'individual' && input.income != null) {
        // For companies/firms, default legacy income is business income
        businessIncome = Math.max(0, Number(input.income) || 0);
    }

    // 3. House Property Income
    let housePropertyGrossRent = Math.max(0, Number(input.housePropertyGrossRent ?? input.grossRent) || 0);
    let housePropertyMunicipalTaxes = Math.max(0, Number(input.housePropertyMunicipalTaxes ?? input.municipalTaxes) || 0);
    let housePropertyLoanInterest = Math.max(0, Number(input.housePropertyLoanInterest ?? input.sec24b ?? input.homeLoanInterest) || 0);
    let housePropertyType = input.housePropertyType || (housePropertyGrossRent > 0 ? 'let_out' : 'self_occupied');

    // 4. Capital Gains
    let stcg111A = Math.max(0, Number(input.stcg111A ?? input.stcgEquity) || 0);
    let stcgOther = Math.max(0, Number(input.stcgOther) || 0);
    let ltcg112A = Math.max(0, Number(input.ltcg112A ?? input.ltcgEquity) || 0);
    let ltcg112 = Math.max(0, Number(input.ltcg112 ?? input.ltcgOther) || 0);

    // 5. Other Sources
    let interestIncome = Math.max(0, Number(input.interestIncome ?? input.bankInterest) || 0);
    let dividendIncome = Math.max(0, Number(input.dividendIncome) || 0);
    let otherIncome = Math.max(0, Number(input.otherIncome ?? input.incomeOther) || 0);

    // Legacy fallback: if input.income was provided with input.incomeType === 'other'
    if (input.incomeType === 'other' && salaryIncome === 0 && businessIncome === 0 && otherIncome === 0) {
        otherIncome = Math.max(0, Number(input.income) || 0);
    }

    // Deductions
    const deductionsInput = (input.deductions && typeof input.deductions === 'object') ? input.deductions : input;
    const sec80C = Math.max(0, Number(deductionsInput.sec80C) || 0);
    const sec80CCD1B = Math.max(0, Number(deductionsInput.sec80CCD1B) || 0);
    const sec80D = Math.max(0, Number(deductionsInput.sec80D) || 0);
    const sec24b = Math.max(0, Number(deductionsInput.sec24b ?? housePropertyLoanInterest) || 0);
    const sec80CCD2 = Math.max(0, Number(deductionsInput.sec80CCD2) || 0);
    const sec80E = Math.max(0, Number(deductionsInput.sec80E) || 0);
    const sec80TTA_TTB = Math.max(0, Number(deductionsInput.sec80TTA_TTB ?? deductionsInput.sec80TTA) || 0);
    const otherDeductions = Math.max(0, Number(deductionsInput.otherDeductions) || 0);
    const genericDeduction = Math.max(0, Number(deductionsInput.deduction) || 0);

    // Regime selection
    let regime = (input.regime === 'old' || input.regime === 'new' || input.regime === 'compare')
        ? input.regime
        : 'new';

    // Entity specific options (e.g. domestic company concessional rates)
    const companyOption = input.companyOption || 'standard_30';
    const cooperativeOption = input.cooperativeOption || 'regular';

    return {
        financialYear,
        taxpayerType,
        name,
        age,
        residentialStatus,
        isResident,
        incomes: {
            salary: salaryIncome,
            business: businessIncome,
            houseProperty: {
                type: housePropertyType,
                grossRent: housePropertyGrossRent,
                municipalTaxes: housePropertyMunicipalTaxes,
                loanInterest: sec24b
            },
            capitalGains: {
                stcg111A,
                stcgOther,
                ltcg112A,
                ltcg112
            },
            otherSources: {
                interest: interestIncome,
                dividend: dividendIncome,
                other: otherIncome
            }
        },
        salaryIncome,
        businessIncome,
        otherIncome: interestIncome + dividendIncome + otherIncome,
        itemizedDeductions: {
            sec80C,
            sec80CCD1B,
            sec80D,
            sec24b,
            sec80CCD2,
            sec80E,
            sec80TTA_TTB,
            otherDeductions,
            genericDeduction
        },
        regime,
        companyOption,
        cooperativeOption
    };
}

/**
 * Computes net house property income considering regime loss set-off restrictions.
 */
function computeHousePropertyIncome(hp, isNewRegime) {
    if (!hp || hp.type === 'self_occupied' || (hp.grossRent === 0 && hp.loanInterest === 0)) {
        // Self-occupied home loan interest is claimed under Chapter VI-A / Section 24(b) deductions
        return { netIncome: 0, deduction24a: 0, interestAllowed: 0, unabsorbedLoss: 0 };
    }

    // Let-out property
    const nav = Math.max(0, hp.grossRent - hp.municipalTaxes);
    const deduction24a = Math.round(nav * 0.30); // 30% statutory deduction
    const interestAllowed = hp.loanInterest; // actual interest on let-out
    let netIncome = nav - deduction24a - interestAllowed;
    let unabsorbedLoss = 0;

    if (netIncome < 0) {
        if (isNewRegime) {
            unabsorbedLoss = Math.abs(netIncome);
            netIncome = 0;
        } else {
            if (Math.abs(netIncome) > 200000) {
                unabsorbedLoss = Math.abs(netIncome) - 200000;
                netIncome = -200000;
            }
        }
    }

    return { netIncome, deduction24a, interestAllowed, unabsorbedLoss };
}

/**
 * Calculates tax for an Individual, HUF, or AOP/BOI/AJP under progressive slabs.
 */
function calculateIndividualOrHUF(normalized, regimeType) {
    const data = getTaxData();
    const yearConfig = data.years[normalized.financialYear] || data.years[data.defaultYear];
    const cessRate = yearConfig.cess || 0.04;

    const isNew = regimeType === 'new';
    const regimeConfig = isNew ? yearConfig.individual.newRegime : yearConfig.individual.oldRegime;
    const cgConfig = yearConfig.capitalGains;

    // Slabs selection
    let slabs;
    const ageCategory = (normalized.taxpayerType === 'individual') ? getAgeCategory(normalized.age) : 'general';
    if (isNew) {
        slabs = regimeConfig.slabs;
    } else {
        slabs = regimeConfig.slabs[ageCategory] || regimeConfig.slabs.general;
    }

    // 1. House property calculation
    const hpRes = computeHousePropertyIncome(normalized.incomes.houseProperty, isNew);
    const netHouseProperty = hpRes.netIncome;

    // 2. Standard deduction for salaried (Individual only)
    let standardDeduction = 0;
    if (normalized.taxpayerType === 'individual' && normalized.salaryIncome > 0) {
        const maxStd = regimeConfig.standardDeduction || 0;
        standardDeduction = Math.min(normalized.salaryIncome, maxStd);
    }

    // 3. Gross Ordinary Income (Salary, Business, House Property, Other STCG, Other Sources)
    const netSalary = Math.max(0, normalized.salaryIncome - standardDeduction);
    const ordinaryGross = netSalary + normalized.businessIncome + netHouseProperty +
        normalized.incomes.capitalGains.stcgOther +
        normalized.incomes.otherSources.interest +
        normalized.incomes.otherSources.dividend +
        normalized.incomes.otherSources.other;

    // 4. Eligible Chapter VI-A Deductions
    let totalEligibleDeductions = standardDeduction;
    const deductionBreakdown = { standardDeduction };

    if (isNew) {
        // Under New Regime (Section 115BAC):
        // Only Standard Deduction and Section 80CCD(2) (employer contribution to NPS up to 14% of salary)
        const eligible80CCD2 = Math.min(
            normalized.itemizedDeductions.sec80CCD2,
            normalized.salaryIncome * 0.14
        );
        deductionBreakdown.sec80CCD2 = eligible80CCD2;
        deductionBreakdown.sec24b = 0;
        totalEligibleDeductions += eligible80CCD2;
    } else {
        // Old Regime: 80C (up to 1.5L), 80CCD(1B) (up to 50k), 80D (up to 1L), 24(b) (up to 2L), 80E, 80TTA/TTB, etc.
        const eligible80C = Math.min(normalized.itemizedDeductions.sec80C, 150000);
        const eligible80CCD1B = Math.min(normalized.itemizedDeductions.sec80CCD1B, 50000);
        const eligible80D = Math.min(normalized.itemizedDeductions.sec80D, 100000);
        const eligible24b = Math.min(normalized.itemizedDeductions.sec24b, 200000);
        const eligible80CCD2 = Math.min(normalized.itemizedDeductions.sec80CCD2, normalized.salaryIncome * 0.14);
        const eligible80E = normalized.itemizedDeductions.sec80E;
        const max80TTA = (ageCategory === 'seniorCitizen' || ageCategory === 'superSeniorCitizen') ? 50000 : 10000;
        const eligible80TTA = Math.min(normalized.itemizedDeductions.sec80TTA_TTB, max80TTA);
        const eligibleOther = normalized.itemizedDeductions.otherDeductions;

        let computedDeductions = eligible80C + eligible80CCD1B + eligible80D + eligible24b + eligible80CCD2 + eligible80E + eligible80TTA + eligibleOther;

        if (computedDeductions === 0 && normalized.itemizedDeductions.genericDeduction > 0) {
            computedDeductions = normalized.itemizedDeductions.genericDeduction;
        }

        deductionBreakdown.sec80C = eligible80C;
        deductionBreakdown.sec80CCD1B = eligible80CCD1B;
        deductionBreakdown.sec80D = eligible80D;
        deductionBreakdown.sec24b = eligible24b;
        deductionBreakdown.sec80CCD2 = eligible80CCD2;
        deductionBreakdown.sec80E = eligible80E;
        deductionBreakdown.sec80TTA_TTB = eligible80TTA;
        deductionBreakdown.otherDeductions = eligibleOther;

        totalEligibleDeductions += computedDeductions;
    }

    // Deductions can only reduce ordinary gross income (cannot reduce special-rate capital gains!)
    const deductionsAppliedAgainstOrdinary = Math.min(totalEligibleDeductions - standardDeduction, Math.max(0, ordinaryGross));
    const taxableOrdinaryIncome = roundToNearestTen(Math.max(0, ordinaryGross - deductionsAppliedAgainstOrdinary));

    // Basic Exemption Limit for ordinary income
    const basicExemptionLimit = slabs[0].max || 0;
    let unexhaustedBasicExemption = Math.max(0, basicExemptionLimit - taxableOrdinaryIncome);

    // 5. Special-Rate Capital Gains Calculation
    // Residents can adjust unexhausted basic exemption against special rate capital gains
    let cg112 = normalized.incomes.capitalGains.ltcg112;
    let cg112A = normalized.incomes.capitalGains.ltcg112A;
    let cg111A = normalized.incomes.capitalGains.stcg111A;

    if (normalized.isResident && unexhaustedBasicExemption > 0) {
        // Adjust against 112 first, then 112A, then 111A
        const adj112 = Math.min(cg112, unexhaustedBasicExemption);
        cg112 -= adj112;
        unexhaustedBasicExemption -= adj112;

        const adj112A = Math.min(cg112A, unexhaustedBasicExemption);
        cg112A -= adj112A;
        unexhaustedBasicExemption -= adj112A;

        const adj111A = Math.min(cg111A, unexhaustedBasicExemption);
        cg111A -= adj111A;
        unexhaustedBasicExemption -= adj111A;
    }

    // Special rate taxes
    // Section 111A: 20%
    const taxSTCG111A = Math.round(cg111A * (cgConfig.stcg111A.rate || 0.20));

    // Section 112A: 12.5% on amount exceeding ₹1,25,000 exemption limit
    const ltcg112AExemption = cgConfig.ltcg112A.exemptionLimit || 125000;
    const taxableLTCG112A = Math.max(0, cg112A - ltcg112AExemption);
    const taxLTCG112A = Math.round(taxableLTCG112A * (cgConfig.ltcg112A.rate || 0.125));

    // Section 112: 12.5%
    const taxLTCG112 = Math.round(cg112 * (cgConfig.ltcg112.rate || 0.125));

    const totalSpecialTax = taxSTCG111A + taxLTCG112A + taxLTCG112;

    // 6. Ordinary Slab Tax
    const { totalTax: ordinarySlabTax, slabBreakdown } = computeSlabTax(taxableOrdinaryIncome, slabs);

    const totalTaxBeforeRebate = Math.round(ordinarySlabTax + totalSpecialTax);
    const totalTaxableIncome = taxableOrdinaryIncome + normalized.incomes.capitalGains.stcg111A +
        normalized.incomes.capitalGains.ltcg112A + normalized.incomes.capitalGains.ltcg112;

    // 7. Section 87A Rebate & Marginal Relief
    // Rebate under 87A is ONLY allowed to Resident Individuals
    // Section 112A tax is explicitly NOT eligible for rebate under Section 112A(2)!
    const isIndividualResident = (normalized.taxpayerType === 'individual') && normalized.isResident;
    const taxEligibleForRebate = Math.max(0, totalTaxBeforeRebate - taxLTCG112A);

    const rebateDetails = computeRebate87A(
        totalTaxBeforeRebate,
        totalTaxableIncome,
        regimeConfig.rebate87A,
        isIndividualResident,
        taxEligibleForRebate
    );

    const taxAfterRebate = rebateDetails.taxAfterRebate;

    // 8. Surcharge calculation
    // Surcharge on special capital gains (111A, 112A, 112) is capped at 15%
    const hasSpecialCapitalGains = totalSpecialTax > 0;
    const maxSurchargeCap = hasSpecialCapitalGains ? 0.15 : null;

    const surchargeDetails = computeSurcharge(
        totalTaxableIncome,
        taxAfterRebate,
        regimeConfig.surcharge,
        slabs,
        maxSurchargeCap
    );

    const taxPlusSurcharge = taxAfterRebate + surchargeDetails.finalSurcharge;
    const cess = Math.round(taxPlusSurcharge * cessRate);
    const totalTax = roundToNearestTen(taxPlusSurcharge + cess);

    const grossIncomeTotal = normalized.salaryIncome + normalized.businessIncome +
        Math.max(0, normalized.incomes.houseProperty.grossRent) +
        normalized.incomes.capitalGains.stcg111A + normalized.incomes.capitalGains.stcgOther +
        normalized.incomes.capitalGains.ltcg112A + normalized.incomes.capitalGains.ltcg112 +
        normalized.incomes.otherSources.interest + normalized.incomes.otherSources.dividend +
        normalized.incomes.otherSources.other;

    const effectiveTaxRate = grossIncomeTotal > 0
        ? Number(((totalTax / grossIncomeTotal) * 100).toFixed(2))
        : 0;

    return {
        taxpayerType: normalized.taxpayerType,
        regime: regimeType,
        regimeLabel: isNew ? 'New Tax Regime (Section 115BAC)' : 'Old Tax Regime',
        financialYear: normalized.financialYear,
        assessmentYear: yearConfig.assessmentYear,
        ageCategory,
        grossIncome: grossIncomeTotal,
        headWiseIncome: {
            salary: normalized.salaryIncome,
            business: normalized.businessIncome,
            houseProperty: netHouseProperty,
            capitalGains: normalized.incomes.capitalGains.stcg111A + normalized.incomes.capitalGains.stcgOther +
                normalized.incomes.capitalGains.ltcg112A + normalized.incomes.capitalGains.ltcg112,
            otherSources: normalized.incomes.otherSources.interest + normalized.incomes.otherSources.dividend + normalized.incomes.otherSources.other
        },
        totalEligibleDeductions,
        deductionBreakdown,
        taxableIncome: totalTaxableIncome,
        taxableOrdinaryIncome,
        ordinarySlabTax: Math.round(ordinarySlabTax),
        slabBreakdown,
        specialRateTax: {
            stcg111A: { amount: normalized.incomes.capitalGains.stcg111A, tax: taxSTCG111A, rate: 0.20 },
            ltcg112A: { amount: normalized.incomes.capitalGains.ltcg112A, exemption: ltcg112AExemption, taxableAmount: taxableLTCG112A, tax: taxLTCG112A, rate: 0.125 },
            ltcg112: { amount: normalized.incomes.capitalGains.ltcg112, tax: taxLTCG112, rate: 0.125 },
            totalSpecialTax
        },
        taxBeforeRebate: totalTaxBeforeRebate,
        rebate87A: {
            applicable: rebateDetails.eligible,
            amount: Math.round(rebateDetails.rebateAmount),
            hasMarginalRelief: rebateDetails.hasMarginalRelief,
            marginalReliefAmount: Math.round(rebateDetails.marginalReliefAmount),
            taxAfterRebate: Math.round(taxAfterRebate)
        },
        surcharge: surchargeDetails,
        cess,
        cessRate,
        totalTax,
        effectiveTaxRate,
        monthlyTax: Math.round(totalTax / 12),
        postTaxIncome: Math.max(0, grossIncomeTotal - totalTax)
    };
}

/**
 * Calculates corporate tax for Domestic or Foreign Company.
 */
function calculateCompanyTax(normalized) {
    const data = getTaxData();
    const yearConfig = data.years[normalized.financialYear] || data.years[data.defaultYear];
    const cessRate = yearConfig.cess || 0.04;
    const isDomestic = normalized.taxpayerType === 'domestic_company';

    const totalIncome = Math.max(0, normalized.businessIncome + normalized.incomes.capitalGains.stcgOther +
        normalized.incomes.capitalGains.ltcg112 + normalized.incomes.otherSources.interest +
        normalized.incomes.otherSources.dividend + normalized.incomes.otherSources.other);

    let taxRate = 0.30;
    let optionLabel = 'Normal Corporate Tax Rate (30%)';
    let isConcessional = false;
    let flatSurchargeRate = null;

    if (isDomestic) {
        const option = normalized.companyOption || 'standard_30';
        if (option === 'turnover_le_400cr_25') {
            taxRate = 0.25;
            optionLabel = 'Turnover <= ₹400 Cr in Base Year (25%)';
        } else if (option === 'sec_115baa_22') {
            taxRate = 0.22;
            flatSurchargeRate = 0.10;
            isConcessional = true;
            optionLabel = 'Section 115BAA Concessional (22% + 10% Surcharge)';
        } else if (option === 'sec_115bab_15') {
            taxRate = 0.15;
            flatSurchargeRate = 0.10;
            isConcessional = true;
            optionLabel = 'Section 115BAB New Manufacturing (15% + 10% Surcharge)';
        }
    } else {
        // Foreign Company: 35% under Finance (No. 2) Act 2024
        taxRate = yearConfig.entities.foreignCompany.rate || 0.35;
        optionLabel = 'Foreign Company Tax Rate (35%)';
    }

    const baseTax = Math.round(totalIncome * taxRate);

    // Surcharge
    let surcharge = { rate: 0, ratePercent: 0, nominalSurcharge: 0, marginalRelief: 0, finalSurcharge: 0 };

    if (isConcessional && flatSurchargeRate != null) {
        const finalSurch = Math.round(baseTax * flatSurchargeRate);
        surcharge = {
            rate: flatSurchargeRate,
            ratePercent: flatSurchargeRate * 100,
            nominalSurcharge: finalSurch,
            marginalRelief: 0,
            finalSurcharge: finalSurch
        };
    } else {
        const entityConfig = isDomestic ? yearConfig.entities.domesticCompany : yearConfig.entities.foreignCompany;
        surcharge = computeSurcharge(totalIncome, baseTax, entityConfig.surcharge, taxRate);
    }

    const taxPlusSurcharge = baseTax + surcharge.finalSurcharge;
    const cess = Math.round(taxPlusSurcharge * cessRate);
    const totalTax = roundToNearestTen(taxPlusSurcharge + cess);

    return {
        taxpayerType: normalized.taxpayerType,
        financialYear: normalized.financialYear,
        assessmentYear: yearConfig.assessmentYear,
        grossIncome: totalIncome,
        taxableIncome: totalIncome,
        totalEligibleDeductions: 0,
        regime: normalized.companyOption,
        regimeLabel: optionLabel,
        baseTax,
        taxBeforeRebate: baseTax,
        rebate87A: { applicable: false, amount: 0, hasMarginalRelief: false, marginalReliefAmount: 0, taxAfterRebate: baseTax },
        surcharge,
        cess,
        cessRate,
        totalTax,
        effectiveTaxRate: totalIncome > 0 ? Number(((totalTax / totalIncome) * 100).toFixed(2)) : 0,
        monthlyTax: Math.round(totalTax / 12),
        postTaxIncome: Math.max(0, totalIncome - totalTax)
    };
}

/**
 * Calculates tax for Firm / LLP or Local Authority (Flat 30%).
 */
function calculateFlatEntityTax(normalized, entityKey) {
    const data = getTaxData();
    const yearConfig = data.years[normalized.financialYear] || data.years[data.defaultYear];
    const cessRate = yearConfig.cess || 0.04;
    const entityConfig = yearConfig.entities[entityKey] || { rate: 0.30 };

    const totalIncome = Math.max(0, normalized.businessIncome + normalized.incomes.capitalGains.stcgOther +
        normalized.incomes.capitalGains.ltcg112 + normalized.incomes.otherSources.interest +
        normalized.incomes.otherSources.dividend + normalized.incomes.otherSources.other);

    const taxRate = entityConfig.rate || 0.30;
    const baseTax = Math.round(totalIncome * taxRate);

    const surcharge = computeSurcharge(totalIncome, baseTax, entityConfig.surcharge, taxRate);
    const taxPlusSurcharge = baseTax + surcharge.finalSurcharge;
    const cess = Math.round(taxPlusSurcharge * cessRate);
    const totalTax = roundToNearestTen(taxPlusSurcharge + cess);

    return {
        taxpayerType: normalized.taxpayerType,
        financialYear: normalized.financialYear,
        assessmentYear: yearConfig.assessmentYear,
        grossIncome: totalIncome,
        taxableIncome: totalIncome,
        totalEligibleDeductions: 0,
        regime: 'flat_30',
        regimeLabel: entityKey === 'firmLLP' ? 'Partnership Firm / LLP (Flat 30%)' : 'Local Authority (Flat 30%)',
        baseTax,
        taxBeforeRebate: baseTax,
        rebate87A: { applicable: false, amount: 0, hasMarginalRelief: false, marginalReliefAmount: 0, taxAfterRebate: baseTax },
        surcharge,
        cess,
        cessRate,
        totalTax,
        effectiveTaxRate: totalIncome > 0 ? Number(((totalTax / totalIncome) * 100).toFixed(2)) : 0,
        monthlyTax: Math.round(totalTax / 12),
        postTaxIncome: Math.max(0, totalIncome - totalTax)
    };
}

/**
 * Calculates tax for Cooperative Society (Regular slabs or Section 115BAD @ 22%).
 */
function calculateCooperativeTax(normalized, regimeType) {
    const data = getTaxData();
    const yearConfig = data.years[normalized.financialYear] || data.years[data.defaultYear];
    const cessRate = yearConfig.cess || 0.04;
    const coopConfig = yearConfig.entities.cooperativeSociety;

    const totalIncome = Math.max(0, normalized.businessIncome + normalized.incomes.capitalGains.stcgOther +
        normalized.incomes.capitalGains.ltcg112 + normalized.incomes.otherSources.interest +
        normalized.incomes.otherSources.dividend + normalized.incomes.otherSources.other);

    const isConcessional = regimeType === 'new' || normalized.cooperativeOption === 'sec115bad';

    let baseTax = 0;
    let surcharge = { rate: 0, ratePercent: 0, nominalSurcharge: 0, marginalRelief: 0, finalSurcharge: 0 };
    let regimeLabel = 'Cooperative Regular Slabs';

    if (isConcessional) {
        regimeLabel = 'Section 115BAD Concessional (22% + 10% Surcharge)';
        baseTax = Math.round(totalIncome * 0.22);
        const finalSurch = Math.round(baseTax * 0.10);
        surcharge = { rate: 0.10, ratePercent: 10, nominalSurcharge: finalSurch, marginalRelief: 0, finalSurcharge: finalSurch };
    } else {
        const { totalTax: slabTax } = computeSlabTax(totalIncome, coopConfig.regularSlabs);
        baseTax = slabTax;
        surcharge = computeSurcharge(totalIncome, baseTax, coopConfig.surcharge, coopConfig.regularSlabs);
    }

    const taxPlusSurcharge = baseTax + surcharge.finalSurcharge;
    const cess = Math.round(taxPlusSurcharge * cessRate);
    const totalTax = roundToNearestTen(taxPlusSurcharge + cess);

    return {
        taxpayerType: 'cooperative_society',
        financialYear: normalized.financialYear,
        assessmentYear: yearConfig.assessmentYear,
        grossIncome: totalIncome,
        taxableIncome: totalIncome,
        totalEligibleDeductions: 0,
        regime: isConcessional ? 'new' : 'old',
        regimeLabel,
        baseTax,
        taxBeforeRebate: baseTax,
        rebate87A: { applicable: false, amount: 0, hasMarginalRelief: false, marginalReliefAmount: 0, taxAfterRebate: baseTax },
        surcharge,
        cess,
        cessRate,
        totalTax,
        effectiveTaxRate: totalIncome > 0 ? Number(((totalTax / totalIncome) * 100).toFixed(2)) : 0,
        monthlyTax: Math.round(totalTax / 12),
        postTaxIncome: Math.max(0, totalIncome - totalTax)
    };
}

/**
 * Calculates tax for a single regime depending on taxpayer category.
 */
function calculateSingleRegime(input, regimeType) {
    const normalized = (input && input.itemizedDeductions) ? input : normalizeInputs(input);

    switch (normalized.taxpayerType) {
        case 'individual':
        case 'huf':
        case 'aop_boi_ajp':
            return calculateIndividualOrHUF(normalized, regimeType || normalized.regime);
        case 'domestic_company':
        case 'foreign_company':
            return calculateCompanyTax(normalized);
        case 'firm_llp':
            return calculateFlatEntityTax(normalized, 'firmLLP');
        case 'local_authority':
            return calculateFlatEntityTax(normalized, 'localAuthority');
        case 'cooperative_society':
            return calculateCooperativeTax(normalized, regimeType || normalized.regime);
        default:
            return calculateIndividualOrHUF(normalized, regimeType || normalized.regime);
    }
}

/**
 * Compares Old Regime vs New Regime (or concessional options for entities).
 */
function compareRegimes(input) {
    const normalized = (input && input.itemizedDeductions) ? input : normalizeInputs(input);

    if (normalized.taxpayerType === 'domestic_company') {
        const normalResult = calculateSingleRegime({ ...normalized, companyOption: 'standard_30' }, 'standard_30');
        const concessionalResult = calculateSingleRegime({ ...normalized, companyOption: 'sec_115baa_22' }, 'sec_115baa_22');
        const taxDiff = Math.abs(normalResult.totalTax - concessionalResult.totalTax);
        const lowerRegime = concessionalResult.totalTax <= normalResult.totalTax ? 'sec_115baa_22' : 'standard_30';

        return {
            financialYear: normalized.financialYear,
            taxpayerType: normalized.taxpayerType,
            lowerRegime,
            taxDifference: taxDiff,
            recommendation: lowerRegime === 'sec_115baa_22'
                ? `Section 115BAA produces a lower estimated tax by ₹${taxDiff.toLocaleString('en-IN')}.`
                : `Normal rate produces a lower estimated tax by ₹${taxDiff.toLocaleString('en-IN')}.`,
            optionA: normalResult,
            optionB: concessionalResult
        };
    }

    if (normalized.taxpayerType === 'cooperative_society') {
        const regularResult = calculateCooperativeTax(normalized, 'old');
        const concessionalResult = calculateCooperativeTax(normalized, 'new');
        const taxDiff = Math.abs(regularResult.totalTax - concessionalResult.totalTax);
        const lowerRegime = concessionalResult.totalTax <= regularResult.totalTax ? 'new' : 'old';

        return {
            financialYear: normalized.financialYear,
            taxpayerType: normalized.taxpayerType,
            lowerRegime,
            taxDifference: taxDiff,
            recommendation: lowerRegime === 'new'
                ? `Section 115BAD (22%) produces a lower estimated tax by ₹${taxDiff.toLocaleString('en-IN')}.`
                : `Regular Slabs produce a lower estimated tax by ₹${taxDiff.toLocaleString('en-IN')}.`,
            oldRegime: regularResult,
            newRegime: concessionalResult
        };
    }

    // Default for Individual, HUF, AOP/BOI/AJP
    const newResult = calculateSingleRegime(normalized, 'new');
    const oldResult = calculateSingleRegime(normalized, 'old');
    const taxDifference = Math.abs(newResult.totalTax - oldResult.totalTax);

    let lowerRegime = 'equal';
    let recommendation = 'Both tax regimes yield the exact same estimated tax liability for your income profile.';

    if (newResult.totalTax < oldResult.totalTax) {
        lowerRegime = 'new';
        recommendation = `The New Tax Regime produces a lower estimated tax by ₹${taxDifference.toLocaleString('en-IN')}.`;
    } else if (oldResult.totalTax < newResult.totalTax) {
        lowerRegime = 'old';
        recommendation = `The Old Tax Regime produces a lower estimated tax by ₹${taxDifference.toLocaleString('en-IN')} due to eligible deductions and exemptions.`;
    }

    return {
        financialYear: normalized.financialYear,
        taxpayerType: normalized.taxpayerType,
        name: normalized.name,
        age: normalized.age,
        residentialStatus: normalized.residentialStatus,
        grossIncome: normalized.grossIncome,
        lowerRegime,
        taxDifference,
        recommendation,
        newRegime: newResult,
        oldRegime: oldResult,
        deductionComparison: {
            newRegimeDeductions: newResult.totalEligibleDeductions,
            oldRegimeDeductions: oldResult.totalEligibleDeductions,
            differenceInDeductions: oldResult.totalEligibleDeductions - newResult.totalEligibleDeductions
        }
    };
}

/**
 * Tax Planning & Recommendation Generator
 * Generates tailored, rank-ordered recommendations for every taxpayer category.
 */
function generateRecommendations({ taxpayerType, regime, normalizedInput, taxResult }) {
    const data = getTaxData();
    const catalog = data.planningCatalog || {};
    const items = catalog[taxpayerType] || catalog.individual || [];

    const recommendations = [];
    const isNewRegime = (regime === 'new');
    const isCompare = (regime === 'compare');
    const isOldRegime = (regime === 'old');
    const currentTax = taxResult ? taxResult.totalTax : 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let amountClaimed = 0;
        let remainingEligible = null;
        let estimatedTaxSaving = 0;
        let eligibilityStatus = 'Potentially Eligible';
        let statusClass = 'status-potential';

        // Check user claimed amounts and regime compatibility
        if (item.id === 'sec80C' || item.id === 'huf_80c') {
            amountClaimed = normalizedInput.itemizedDeductions.sec80C || 0;
            const maxCap = item.maxLimit || 150000;
            remainingEligible = Math.max(0, maxCap - amountClaimed);

            if (isNewRegime) {
                eligibilityStatus = 'Not Available Under Selected Regime';
                statusClass = 'status-disallowed';
                remainingEligible = 0;
                estimatedTaxSaving = 0;
            } else if (remainingEligible === 0) {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-claimed';
                estimatedTaxSaving = 0;
            } else {
                eligibilityStatus = currentTax > 0 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
                statusClass = 'status-eligible';
                if (currentTax > 0) {
                    const sim = simulateTaxSaving({ baseInput: normalizedInput, proposedSection: 'sec80C', proposedAmount: remainingEligible });
                    estimatedTaxSaving = sim.taxSaved;
                }
            }
        } else if (item.id === 'sec80CCD1B') {
            amountClaimed = normalizedInput.itemizedDeductions.sec80CCD1B || 0;
            const maxCap = item.maxLimit || 50000;
            remainingEligible = Math.max(0, maxCap - amountClaimed);

            if (isNewRegime) {
                eligibilityStatus = 'Not Available Under Selected Regime';
                statusClass = 'status-disallowed';
                remainingEligible = 0;
                estimatedTaxSaving = 0;
            } else if (remainingEligible === 0) {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-claimed';
                estimatedTaxSaving = 0;
            } else {
                eligibilityStatus = currentTax > 0 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
                statusClass = 'status-eligible';
                if (currentTax > 0) {
                    const sim = simulateTaxSaving({ baseInput: normalizedInput, proposedSection: 'sec80CCD1B', proposedAmount: remainingEligible });
                    estimatedTaxSaving = sim.taxSaved;
                }
            }
        } else if (item.id === 'sec80CCD2') {
            amountClaimed = normalizedInput.itemizedDeductions.sec80CCD2 || 0;
            const max14 = Math.round((normalizedInput.salaryIncome || 0) * 0.14);
            remainingEligible = Math.max(0, max14 - amountClaimed);

            if (normalizedInput.salaryIncome > 0) {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-eligible';
                if (remainingEligible > 0 && currentTax > 0) {
                    const sim = simulateTaxSaving({ baseInput: normalizedInput, proposedSection: 'sec80CCD2', proposedAmount: remainingEligible });
                    estimatedTaxSaving = sim.taxSaved;
                }
            } else {
                eligibilityStatus = 'More Information Required';
                statusClass = 'status-inforeq';
            }
        } else if (item.id === 'sec80D' || item.id === 'huf_80d') {
            amountClaimed = normalizedInput.itemizedDeductions.sec80D || 0;
            const maxCap = item.maxLimit || 100000;
            remainingEligible = Math.max(0, maxCap - amountClaimed);

            if (isNewRegime) {
                eligibilityStatus = 'Not Available Under Selected Regime';
                statusClass = 'status-disallowed';
                remainingEligible = 0;
                estimatedTaxSaving = 0;
            } else if (remainingEligible === 0) {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-claimed';
                estimatedTaxSaving = 0;
            } else {
                eligibilityStatus = currentTax > 0 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
                statusClass = 'status-eligible';
                if (currentTax > 0) {
                    const sim = simulateTaxSaving({ baseInput: normalizedInput, proposedSection: 'sec80D', proposedAmount: Math.min(25000, remainingEligible) });
                    estimatedTaxSaving = sim.taxSaved;
                }
            }
        } else if (item.id === 'sec24b' || item.id === 'huf_24b') {
            amountClaimed = normalizedInput.itemizedDeductions.sec24b || 0;
            const maxCap = item.maxLimit || 200000;
            remainingEligible = Math.max(0, maxCap - amountClaimed);

            if (isNewRegime) {
                eligibilityStatus = 'Not Available Under Selected Regime';
                statusClass = 'status-disallowed';
                remainingEligible = 0;
                estimatedTaxSaving = 0;
            } else if (remainingEligible === 0) {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-claimed';
            } else {
                eligibilityStatus = currentTax > 0 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
                statusClass = 'status-eligible';
                if (currentTax > 0) {
                    const sim = simulateTaxSaving({ baseInput: normalizedInput, proposedSection: 'sec24b', proposedAmount: remainingEligible });
                    estimatedTaxSaving = sim.taxSaved;
                }
            }
        } else if (item.id === 'comp_115baa') {
            if (normalizedInput.companyOption === 'sec_115baa_22') {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-eligible';
            } else {
                eligibilityStatus = 'Potentially Eligible';
                statusClass = 'status-potential';
                // Compare 30% vs 22%
                const resNormal = calculateCompanyTax({ ...normalizedInput, companyOption: 'standard_30' });
                const resConcessional = calculateCompanyTax({ ...normalizedInput, companyOption: 'sec_115baa_22' });
                if (resConcessional.totalTax < resNormal.totalTax) {
                    estimatedTaxSaving = resNormal.totalTax - resConcessional.totalTax;
                }
            }
        } else if (item.id === 'comp_80jjaa') {
            eligibilityStatus = 'More Information Required';
            statusClass = 'status-inforeq';
        } else if (item.id === 'comp_advance_tax') {
            eligibilityStatus = currentTax >= 10000 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
            statusClass = 'status-eligible';
        } else if (item.id === 'fc_rate_reduction') {
            eligibilityStatus = 'Eligible Based on Provided Information';
            statusClass = 'status-eligible';
        } else if (item.id === 'fc_dtaa') {
            eligibilityStatus = 'Requires Professional Review';
            statusClass = 'status-review';
        } else if (item.id === 'firm_remuneration') {
            eligibilityStatus = normalizedInput.businessIncome > 0 ? 'Eligible Based on Provided Information' : 'Potentially Eligible';
            statusClass = 'status-eligible';
            if (normalizedInput.businessIncome > 0) {
                // Statutory limits on remuneration: 90% of first 3L + 60% on balance
                const bProfit = normalizedInput.businessIncome;
                const maxRemun = bProfit <= 300000 ? Math.max(150000, bProfit * 0.90) : (270000 + (bProfit - 300000) * 0.60);
                remainingEligible = Math.round(maxRemun);
                estimatedTaxSaving = Math.round(remainingEligible * 0.30); // 30% flat tax
            }
        } else if (item.id === 'firm_interest') {
            eligibilityStatus = 'Requires Professional Review';
            statusClass = 'status-review';
        } else if (item.id === 'coop_115bad') {
            if (normalizedInput.cooperativeOption === 'sec115bad') {
                eligibilityStatus = 'Eligible Based on Provided Information';
                statusClass = 'status-eligible';
            } else {
                eligibilityStatus = 'Potentially Eligible';
                statusClass = 'status-potential';
                const resReg = calculateCooperativeTax(normalizedInput, 'old');
                const resConc = calculateCooperativeTax(normalizedInput, 'new');
                if (resConc.totalTax < resReg.totalTax) {
                    estimatedTaxSaving = resReg.totalTax - resConc.totalTax;
                }
            }
        } else if (item.id === 'coop_80p') {
            eligibilityStatus = 'More Information Required';
            statusClass = 'status-inforeq';
        } else if (item.id === 'aop_regime_choice') {
            eligibilityStatus = 'Eligible Based on Provided Information';
            statusClass = 'status-eligible';
        } else if (item.id === 'local_auth_exempt') {
            eligibilityStatus = 'Eligible Based on Provided Information';
            statusClass = 'status-eligible';
        }

        // Why it helps explanation tailored to category
        let whyItHelps = item.whyItHelps || item.description;
        if (item.id === 'sec80C') {
            whyItHelps = 'Lowers taxable total income by up to ₹1,50,000 under the Old Regime, yielding up to ₹46,800 in direct tax savings.';
        } else if (item.id === 'sec80CCD1B') {
            whyItHelps = 'Exclusive ₹50,000 deduction exclusively for NPS Tier-1 subscriptions, providing up to ₹15,600 additional tax reduction.';
        } else if (item.id === 'sec80CCD2') {
            whyItHelps = 'Employer NPS contributions up to 14% of Basic Salary are deductible in BOTH New and Old regimes without altering overall CTC.';
        } else if (item.id === 'sec80D') {
            whyItHelps = 'Provides health security for your family while saving up to ₹1,00,000 in taxable income under the Old Regime.';
        } else if (item.id === 'comp_115baa') {
            whyItHelps = 'Slashing corporate tax rate from 30% to 22% and completely exempting the company from Minimum Alternate Tax (MAT).';
        } else if (item.id === 'firm_remuneration') {
            whyItHelps = 'Remuneration paid to working partners is deductible from the firm\'s profit, preventing 30% flat firm taxation on that portion.';
        }

        const documentsRequired = item.documentsRequired || (
            item.id === 'sec80C' ? 'PPF/ELSS investment receipts, life insurance premium receipts, tuition fee receipts' :
            item.id === 'sec80CCD1B' ? 'PRAN statement, NPS transaction receipt' :
            item.id === 'sec80CCD2' ? 'Employer salary annexure, Form 16 Part B' :
            item.id === 'sec80D' ? 'Health insurance premium receipt paid via digital mode, 80D certificate' :
            item.id === 'sec24b' ? 'Lender bank interest & principal certificate, possession letter' :
            item.id === 'comp_115baa' ? 'Form 10-IC filed with Income Tax Department prior to return due date' :
            item.id === 'firm_remuneration' ? 'Registered partnership deed authorizing remuneration, audited profit & loss statement' :
            'Relevant vouchers, official bank records, and statutory certificates'
        );

        recommendations.push({
            id: item.id,
            title: item.title,
            explanation: item.description,
            whyItHelps,
            taxpayerCategory: taxpayerType,
            taxYear: normalizedInput.financialYear,
            regime: item.regime,
            legalProvision: `${item.section} of the Income-tax Act, 1961`,
            maxLimit: item.maxLimit != null ? item.maxLimit : null,
            maxLimitPercentage: item.maxLimitPercentage,
            amountClaimed,
            remainingEligible,
            estimatedTaxSaving,
            riskLockIn: item.lockIn || 'Product specific / Statutory conditions apply',
            documentsRequired,
            nextAction: item.action,
            eligibilityStatus,
            statusClass
        });
    }

    // Step 6: Rank suggestions strictly by:
    // 1. Legal eligibility
    // 2. Potential estimated tax benefit
    // 3. Remaining eligible headroom
    // 4. Practical relevance
    const statusPriority = {
        'Eligible Based on Provided Information': 5,
        'Potentially Eligible': 4,
        'More Information Required': 3,
        'Requires Professional Review': 2,
        'Not Available Under Selected Regime': 1
    };

    recommendations.sort((a, b) => {
        const pA = statusPriority[a.eligibilityStatus] || 0;
        const pB = statusPriority[b.eligibilityStatus] || 0;
        if (pA !== pB) return pB - pA;
        if (b.estimatedTaxSaving !== a.estimatedTaxSaving) return b.estimatedTaxSaving - a.estimatedTaxSaving;
        return (b.remainingEligible || 0) - (a.remainingEligible || 0);
    });

    return recommendations;
}

/**
 * Interactive Tax-Saving Simulator
 * Recalculates tax by adding proposed additional investment using real calculation engine.
 */
function simulateTaxSaving({ baseInput, proposedSection, proposedAmount }) {
    const numAmount = Math.max(0, Number(proposedAmount) || 0);
    const normalized = (baseInput && baseInput.itemizedDeductions) ? baseInput : normalizeInputs(baseInput);

    // Current tax
    const currentResult = calculateSingleRegime(normalized, normalized.regime);
    const currentTax = currentResult.totalTax;

    if (numAmount <= 0) {
        return {
            currentTax,
            proposedSection: proposedSection || 'sec80C',
            proposedAmount: 0,
            deductionActuallyAllowed: 0,
            revisedTaxableIncome: currentResult.taxableIncome,
            revisedOrdinaryTax: currentResult.ordinarySlabTax || currentResult.baseTax || 0,
            revisedSpecialTax: currentResult.specialRateTax ? currentResult.specialRateTax.totalSpecialTax : 0,
            revisedRebate: currentResult.rebate87A ? currentResult.rebate87A.amount : 0,
            revisedMarginalRelief: currentResult.rebate87A ? currentResult.rebate87A.marginalReliefAmount : 0,
            revisedSurcharge: currentResult.surcharge ? currentResult.surcharge.finalSurcharge : 0,
            revisedCess: currentResult.cess || 0,
            revisedTax: currentTax,
            taxSaved: 0,
            netCashOutflow: 0,
            efficiencyPercentage: 0,
            isRegimeEligible: true,
            explanation: 'Please enter a proposed investment amount greater than zero to simulate tax impact.'
        };
    }

    // Regime restriction check: Section 80C, 80CCD(1B), 80D, 24b are disallowed in New Regime
    const isNew = normalized.regime === 'new';
    const oldRegimeOnlySections = ['sec80C', 'sec80CCD1B', 'sec80D', 'sec24b', 'sec80E', 'otherDeductions'];
    const sectionKey = proposedSection || 'sec80C';

    if (isNew && oldRegimeOnlySections.includes(sectionKey)) {
        return {
            currentTax,
            proposedSection: sectionKey,
            proposedAmount: numAmount,
            deductionActuallyAllowed: 0,
            revisedTaxableIncome: currentResult.taxableIncome,
            revisedOrdinaryTax: currentResult.ordinarySlabTax || currentResult.baseTax || 0,
            revisedSpecialTax: currentResult.specialRateTax ? currentResult.specialRateTax.totalSpecialTax : 0,
            revisedRebate: currentResult.rebate87A ? currentResult.rebate87A.amount : 0,
            revisedMarginalRelief: currentResult.rebate87A ? currentResult.rebate87A.marginalReliefAmount : 0,
            revisedSurcharge: currentResult.surcharge ? currentResult.surcharge.finalSurcharge : 0,
            revisedCess: currentResult.cess || 0,
            revisedTax: currentTax,
            taxSaved: 0,
            netCashOutflow: numAmount,
            efficiencyPercentage: 0,
            isRegimeEligible: false,
            regimeWarning: 'Section disallowed under Section 115BAC New Regime',
            explanation: `${sectionKey} is not permissible as a deduction under the New Tax Regime (Section 115BAC). Your proposed amount generates ₹0 tax savings in the active New Regime. Switch to the Old Regime to claim this deduction.`
        };
    }

    // Build modified input with proposed amount added to existing claimed
    const modifiedInput = JSON.parse(JSON.stringify(normalized));

    if (modifiedInput.itemizedDeductions[sectionKey] != null) {
        modifiedInput.itemizedDeductions[sectionKey] += numAmount;
    } else {
        modifiedInput.itemizedDeductions[sectionKey] = numAmount;
    }

    const revisedResult = calculateSingleRegime(modifiedInput, normalized.regime);
    const revisedTax = revisedResult.totalTax;

    const taxSaved = Math.max(0, currentTax - revisedTax);
    const deductionActuallyAllowed = Math.max(0, revisedResult.totalEligibleDeductions - currentResult.totalEligibleDeductions);
    const efficiencyPercentage = numAmount > 0 ? Number(((taxSaved / numAmount) * 100).toFixed(2)) : 0;
    const netCashOutflow = Math.max(0, numAmount - taxSaved);

    let explanation = '';
    if (taxSaved === 0 && currentTax === 0) {
        explanation = 'Your current estimated tax liability is already ₹0 (covered by basic exemption / Section 87A rebate). Additional deductions do not reduce tax further for this year.';
    } else if (deductionActuallyAllowed === 0) {
        explanation = 'The proposed investment exceeded allowable statutory limits or could not offset additional taxable income.';
    } else {
        explanation = `Proposed deduction of ₹${deductionActuallyAllowed.toLocaleString('en-IN')} reduces taxable income to ₹${revisedResult.taxableIncome.toLocaleString('en-IN')}, saving ₹${taxSaved.toLocaleString('en-IN')} in tax (Net cash outflow: ₹${netCashOutflow.toLocaleString('en-IN')}).`;
    }

    return {
        currentTax,
        proposedSection: sectionKey,
        proposedAmount: numAmount,
        deductionActuallyAllowed,
        revisedTaxableIncome: revisedResult.taxableIncome,
        revisedOrdinaryTax: revisedResult.ordinarySlabTax || revisedResult.baseTax || 0,
        revisedSpecialTax: revisedResult.specialRateTax ? revisedResult.specialRateTax.totalSpecialTax : 0,
        revisedRebate: revisedResult.rebate87A ? revisedResult.rebate87A.amount : 0,
        revisedMarginalRelief: revisedResult.rebate87A ? revisedResult.rebate87A.marginalReliefAmount : 0,
        revisedSurcharge: revisedResult.surcharge ? revisedResult.surcharge.finalSurcharge : 0,
        revisedCess: revisedResult.cess || 0,
        revisedTax,
        taxSaved,
        netCashOutflow,
        efficiencyPercentage,
        isRegimeEligible: true,
        explanation
    };
}

/**
 * Main calculation handler.
 */
function calculateTax(input) {
    const normalized = normalizeInputs(input);

    let result;
    if (normalized.regime === 'compare') {
        const comparison = compareRegimes(normalized);
        const primaryResult = (comparison.newRegime && comparison.oldRegime)
            ? (comparison.newRegime.totalTax <= comparison.oldRegime.totalTax ? comparison.newRegime : comparison.oldRegime)
            : (comparison.optionB || comparison.optionA);

        result = {
            ...primaryResult,
            name: normalized.name,
            comparison
        };
    } else {
        const singleResult = calculateSingleRegime(normalized, normalized.regime);
        let comparison = null;
        if (['individual', 'huf', 'aop_boi_ajp', 'cooperative_society', 'domestic_company'].includes(normalized.taxpayerType)) {
            comparison = compareRegimes(normalized);
        }

        result = {
            ...singleResult,
            name: normalized.name,
            income: singleResult.grossIncome,
            deduction: singleResult.totalEligibleDeductions,
            calculatedTax: singleResult.taxBeforeRebate,
            comparison
        };
    }

    // Add tailored tax planning recommendations
    const recommendations = generateRecommendations({
        taxpayerType: normalized.taxpayerType,
        regime: normalized.regime,
        normalizedInput: normalized,
        taxResult: result
    });

    result.recommendations = recommendations;
    return result;
}

module.exports = {
    getTaxData,
    reloadTaxData,
    getSupportedYears,
    getTaxpayerTypes,
    normalizeInputs,
    getAgeCategory,
    computeSlabTax,
    computeRebate87A,
    computeSurcharge,
    computeHousePropertyIncome,
    roundToNearestTen,
    calculateSingleRegime,
    compareRegimes,
    generateRecommendations,
    simulateTaxSaving,
    calculateTax
};
