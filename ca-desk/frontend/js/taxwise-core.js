/**
 * TaxWise Core Engine & UI Controller for CA Desk
 * Fully preserves and restores the original TaxWise Indian Income Tax Calculator,
 * including 2-column layout, dynamic taxpayer categories, 5 heads of income,
 * Chapter VI-A deductions, side-by-side regime comparison, 3 visual charts,
 * itemized progressive slab breakdowns, tax-planning recommendations,
 * interactive simulator, sample presets, and CA Desk client persistence.
 */

(function(window) {
    'use strict';

    let lastCalculationResult = null;
    let lastInputPayload = null;
    let currentActiveClient = null;

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Returns the full original TaxWise HTML structure.
     */
    function getTaxWiseHTML(client = null) {
        const clientName = client ? client.name : '';
        const clientPan = client && client.pan ? client.pan : '';
        const clientCat = client && client.taxpayerType ? client.taxpayerType : 'individual';
        const clientAge = client && client.age ? client.age : 30;
        const clientRes = client && client.residentialStatus ? client.residentialStatus : 'resident';

        return `
        <div class="taxwise-module-wrapper">
            <!-- TaxWise Sub-header Controls -->
            <div class="header-controls-bar" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:12px 18px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-block; width:12px; height:12px; background:#4f46e5; border-radius:3px;"></span>
                        <strong style="font-size:1.05rem; color:#0f172a; font-weight:700;">TaxWise India</strong>
                        <span style="font-size:0.75rem; background:#ff9933; color:#ffffff; font-weight:700; padding:2px 6px; border-radius:4px; text-transform:uppercase;">Enacted Slabs</span>
                    </div>
                    ${client ? `
                        <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:4px 10px; border-radius:6px; font-size:0.82rem; color:#1e40af; display:flex; align-items:center; gap:6px;">
                            <span>Client:</span> <strong>${escapeHtml(client.name)}</strong>
                            <span style="opacity:0.6;">|</span>
                            <span>PAN: <strong style="font-family:monospace;">${clientPan || 'N/A'}</strong></span>
                        </div>
                    ` : ''}
                </div>

                <div class="header-controls" style="display:flex; align-items:center; gap:12px;">
                    <div class="fy-selector-wrap">
                        <label for="financialYear" class="fy-label">Tax Year / FY:</label>
                        <select id="financialYear" class="fy-select" onchange="window.TaxWiseCore.handleYearChange()">
                            <option value="2026-2027" selected>FY 2026-27 (AY 2027-28) - Current</option>
                            <option value="2025-2026">FY 2025-26 (AY 2026-27)</option>
                            <option value="2024-2025">FY 2024-25 (AY 2025-26)</option>
                            <option value="2023-2024">FY 2023-24 (AY 2024-25)</option>
                        </select>
                    </div>

                    <button type="button" class="btn-preset-trigger" onclick="window.TaxWiseCore.togglePresetsModal()" title="Load Sample Scenarios">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                        </svg>
                        <span>Sample Profiles</span>
                    </button>

                    ${client ? `
                        <button type="button" class="btn btn-success btn-sm" id="btn-save-to-client-top" onclick="window.TaxWiseCore.saveCurrentCalculation()" style="background:#10b981; color:#ffffff; font-weight:600; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; border:none; cursor:pointer;">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            Save to Client Profile
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Original Main Layout (Two-Column Grid) -->
            <main class="main-layout" style="margin:0; padding:0; max-width:100%;">
                <!-- Left Column: Input Form Panel -->
                <section class="calculator-panel">
                    <form id="taxForm" class="tax-form" onsubmit="event.preventDefault(); window.TaxWiseCore.calculateTax();">
                        <!-- Year Highlights Banner -->
                        <div class="year-banner" id="yearBanner">
                            <div class="year-banner-badge" id="yearBadgeText">Budget 2025 / 2026 Rules Active</div>
                            <p class="year-banner-text" id="yearBannerText">
                                Under New Regime, resident individuals pay <strong>₹0 tax up to ₹12 Lakh taxable income</strong> (₹12.75L with ₹75k standard deduction). STCG Sec 111A is 20%, and LTCG Sec 112A is 12.5% over ₹1.25L.
                            </p>
                        </div>

                        <!-- Section 1: Type of Taxpayer / Assessee -->
                        <div class="form-section">
                            <div class="section-header">
                                <span class="section-num">1</span>
                                <h2 class="section-title">Type of Taxpayer / Assessee</h2>
                            </div>

                            <div class="form-group">
                                <label for="taxpayerType">Select Assessee Category <span class="label-required">*</span></label>
                                <select id="taxpayerType" class="highlight-select" onchange="window.TaxWiseCore.handleTaxpayerTypeChange()">
                                    <option value="individual" ${clientCat === 'individual' ? 'selected' : ''}>1. Individual (Natural Person)</option>
                                    <option value="huf" ${clientCat === 'huf' ? 'selected' : ''}>2. Hindu Undivided Family (HUF)</option>
                                    <option value="aop_boi_ajp" ${clientCat === 'aop_boi_ajp' ? 'selected' : ''}>3. Association of Persons (AOP) / BOI / AJP</option>
                                    <option value="domestic_company" ${clientCat === 'domestic_company' ? 'selected' : ''}>4. Company — Domestic (Indian Company)</option>
                                    <option value="foreign_company" ${clientCat === 'foreign_company' ? 'selected' : ''}>5. Company — Foreign (Rate: 35%)</option>
                                    <option value="firm_llp" ${clientCat === 'firm_llp' ? 'selected' : ''}>6. Firm / LLP (Flat 30% Tax)</option>
                                    <option value="cooperative_society" ${clientCat === 'cooperative_society' ? 'selected' : ''}>7. Cooperative Society (Slabs / Sec 115BAD)</option>
                                    <option value="local_authority" ${clientCat === 'local_authority' ? 'selected' : ''}>8. Local Authority (Flat 30% Tax)</option>
                                </select>
                                <span class="field-hint" id="taxpayerTypeHint">Progressive slabs, Section 87A rebate, and standard deduction apply to resident individuals.</span>
                            </div>

                            <!-- Individual Specific Demographics -->
                            <div id="individualFieldsGroup">
                                <div class="form-row">
                                    <div class="form-group flex-2">
                                        <label for="name">
                                            Name <span class="label-optional">(Optional)</span>
                                        </label>
                                        <input type="text" id="name" value="${escapeHtml(clientName)}" placeholder="e.g. Rahul Sharma" autocomplete="name" maxlength="100">
                                    </div>

                                    <div class="form-group flex-1">
                                        <label for="pan">
                                            PAN <span class="label-optional">(Optional)</span>
                                        </label>
                                        <input type="text" id="pan" value="${escapeHtml(clientPan)}" placeholder="e.g. ABCDE1234F" maxlength="10" style="text-transform:uppercase; font-family:monospace;">
                                    </div>

                                    <div class="form-group flex-1" id="ageFormGroup">
                                        <label for="age">
                                            Age <span class="label-required">*</span>
                                        </label>
                                        <input type="number" id="age" value="${clientAge}" min="1" max="120" oninput="window.TaxWiseCore.handleAgeChange()">
                                        <span class="age-category-tag" id="ageCategoryTag">General (&lt;60 yrs)</span>
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="residentialStatus">Residential Status</label>
                                        <select id="residentialStatus" onchange="window.TaxWiseCore.handleResidentialChange()">
                                            <option value="resident" ${clientRes === 'resident' ? 'selected' : ''}>Resident Individual (Eligible for Section 87A Rebate)</option>
                                            <option value="non_resident" ${clientRes === 'non_resident' ? 'selected' : ''}>Non-Resident / NRI (Section 87A Rebate Ineligible)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Domestic Company Specific Options -->
                            <div id="domesticCompanyFieldsGroup" style="display: none;">
                                <div class="form-group">
                                    <label for="companyOption">Domestic Corporate Tax Option</label>
                                    <select id="companyOption" onchange="window.TaxWiseCore.handleCompanyOptionChange()">
                                        <option value="standard_30" selected>Normal Corporate Tax Rate (30%)</option>
                                        <option value="turnover_le_400cr_25">Turnover &le; ₹400 Cr in base year (25%)</option>
                                        <option value="sec_115baa_22">Section 115BAA Concessional (22% + 10% Surcharge, No MAT)</option>
                                        <option value="sec_115bab_15">Section 115BAB New Manufacturing (15% + 10% Surcharge)</option>
                                    </select>
                                    <span class="field-hint">Section 115BAA offers effective 25.168% tax rate with no Minimum Alternate Tax (MAT).</span>
                                </div>
                            </div>

                            <!-- Cooperative Society Specific Options -->
                            <div id="cooperativeFieldsGroup" style="display: none;">
                                <div class="form-group">
                                    <label for="cooperativeOption">Cooperative Society Tax Option</label>
                                    <select id="cooperativeOption" onchange="window.TaxWiseCore.handleCooperativeOptionChange()">
                                        <option value="regular" selected>Regular Progressive Slabs (10%, 20%, 30%)</option>
                                        <option value="sec115bad">Section 115BAD Concessional (22% + 10% Surcharge, No AMT)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Income Sources (Multi-Head Income) -->
                        <div class="form-section">
                            <div class="section-header">
                                <span class="section-num">2</span>
                                <h2 class="section-title">Income Sources (Multi-Head)</h2>
                            </div>

                            <!-- Head A: Salary Income (Individual Only) -->
                            <div class="income-head-card" id="salaryHeadGroup">
                                <div class="income-head-header">
                                    <span class="head-title">A. Income from Salary</span>
                                    <span class="std-badge" id="stdDeductionBadge">Std Ded: ₹75,000 Auto-Applied</span>
                                </div>
                                <div class="form-group">
                                    <label for="salaryIncome">Gross Annual Salary (₹)</label>
                                    <div class="currency-input-wrap">
                                        <span class="currency-symbol">₹</span>
                                        <input type="number" id="salaryIncome" placeholder="e.g. 1200000" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                    </div>
                                    <span class="field-hint">Salary, allowances, and perquisites before standard deduction.</span>
                                </div>
                            </div>

                            <!-- Head B: Business / Professional Income -->
                            <div class="income-head-card" id="businessHeadGroup">
                                <div class="income-head-header">
                                    <span class="head-title">B. Business &amp; Profession</span>
                                    <span class="head-tag">PGBP</span>
                                </div>
                                <div class="form-group">
                                    <label for="businessIncome">Net Business / Professional Profit (₹)</label>
                                    <div class="currency-input-wrap">
                                        <span class="currency-symbol">₹</span>
                                        <input type="number" id="businessIncome" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                    </div>
                                    <span class="field-hint">Net taxable business profit after deducting allowable business expenses and depreciation.</span>
                                </div>
                            </div>

                            <!-- Head C: House Property Income -->
                            <div class="income-head-card" id="housePropertyHeadGroup">
                                <div class="income-head-header">
                                    <span class="head-title">C. House Property</span>
                                    <span class="head-tag">Rental / Housing</span>
                                </div>
                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <label for="housePropertyType">Property Status</label>
                                        <select id="housePropertyType" onchange="window.TaxWiseCore.handleHousePropertyTypeChange()">
                                            <option value="self_occupied" selected>Self-Occupied (Home Loan Interest)</option>
                                            <option value="let_out">Let-Out / Rented Property</option>
                                        </select>
                                    </div>
                                    <div class="form-group flex-1" id="homeLoanInterestGroup">
                                        <label for="sec24b">Home Loan Interest (₹)</label>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec24b" placeholder="0" min="0" max="200000" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                        <span class="field-hint">Max ₹2,00,000 for self-occupied (Old Regime only).</span>
                                    </div>
                                </div>

                                <div id="letOutFieldsGroup" style="display: none;">
                                    <div class="form-row">
                                        <div class="form-group flex-1">
                                            <label for="housePropertyGrossRent">Annual Gross Rent Received (₹)</label>
                                            <div class="currency-input-wrap">
                                                <span class="currency-symbol">₹</span>
                                                <input type="number" id="housePropertyGrossRent" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                            </div>
                                        </div>
                                        <div class="form-group flex-1">
                                            <label for="housePropertyMunicipalTaxes">Municipal Taxes Paid (₹)</label>
                                            <div class="currency-input-wrap">
                                                <span class="currency-symbol">₹</span>
                                                <input type="number" id="housePropertyMunicipalTaxes" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                            </div>
                                        </div>
                                    </div>
                                    <span class="field-hint">Standard statutory deduction of 30% under Section 24(a) is auto-calculated on Net Annual Value.</span>
                                </div>
                            </div>

                            <!-- Head D: Capital Gains (Special Rates) -->
                            <div class="income-head-card" id="capitalGainsHeadGroup">
                                <div class="income-head-header">
                                    <span class="head-title">D. Capital Gains (Special Rates)</span>
                                    <span class="head-tag">Budget 2024 / 2025</span>
                                </div>
                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="stcg111A">STCG Sec 111A (Equity)</label>
                                            <span class="cap-tag badge-special">20% Tax</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="stcg111A" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                        <span class="field-hint">Listed equity shares / equity funds subject to STT.</span>
                                    </div>
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="stcgOther">Other STCG</label>
                                            <span class="cap-tag">Slab Rate</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="stcgOther" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                        <span class="field-hint">STCG on debt funds, gold, unlisted shares, real estate.</span>
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="ltcg112A">LTCG Sec 112A (Equity)</label>
                                            <span class="cap-tag badge-special">12.5% &gt; ₹1.25L</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="ltcg112A" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                        <span class="field-hint">First ₹1,25,000 exempt; balance taxed at 12.5%.</span>
                                    </div>
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="ltcg112">Other LTCG (Sec 112)</label>
                                            <span class="cap-tag badge-special">12.5%</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="ltcg112" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                        <span class="field-hint">LTCG on property, gold, unlisted assets (12.5% without indexation).</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Head E: Income from Other Sources -->
                            <div class="income-head-card" id="otherSourcesHeadGroup">
                                <div class="income-head-header">
                                    <span class="head-title">E. Other Sources</span>
                                    <span class="head-tag">Interest &amp; Dividends</span>
                                </div>
                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <label for="interestIncome">Bank &amp; Deposit Interest (₹)</label>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="interestIncome" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                    </div>
                                    <div class="form-group flex-1">
                                        <label for="dividendIncome">Dividend Receipts (₹)</label>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="dividendIncome" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label for="otherIncome">Other Miscellaneous Income (₹)</label>
                                    <div class="currency-input-wrap">
                                        <span class="currency-symbol">₹</span>
                                        <input type="number" id="otherIncome" placeholder="0" min="0" step="1000" oninput="window.TaxWiseCore.updateGrossIncomeDisplay()">
                                    </div>
                                </div>
                            </div>

                            <!-- Gross Total Income Indicator Bar -->
                            <div class="gross-summary-bar">
                                <span class="gross-label">Combined Gross Income:</span>
                                <span class="gross-value" id="grossIncomeDisplay">₹0</span>
                            </div>

                            <!-- Hidden inputs -->
                            <input type="hidden" id="income" value="0">
                            <input type="hidden" id="deduction" value="0">
                        </div>

                        <!-- Section 3: Deductions & Exemptions (Individual & HUF) -->
                        <div class="form-section" id="deductionsSection">
                            <div class="section-header collapsable-header" onclick="window.TaxWiseCore.toggleDeductionsAccordion()">
                                <div class="header-left">
                                    <span class="section-num">3</span>
                                    <h2 class="section-title">Eligible Deductions (Chapter VI-A)</h2>
                                </div>
                                <span class="toggle-icon" id="deductionsToggleIcon">▼</span>
                            </div>

                            <div class="deductions-content" id="deductionsContent">
                                <div class="deduction-notice">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                    </svg>
                                    <span>Deductions below primarily reduce tax under the <strong>Old Regime</strong>. Only Section 80CCD(2) (Employer NPS) is permitted under the New Regime.</span>
                                </div>

                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="sec80C">Section 80C</label>
                                            <span class="cap-tag">Max ₹1.5 Lakh</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec80C" placeholder="0" min="0" max="150000" step="1000">
                                        </div>
                                        <span class="field-hint">EPF, PPF, ELSS, Life Insurance, Tuition fee, NSC.</span>
                                    </div>

                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="sec80CCD1B">Section 80CCD(1B) (NPS)</label>
                                            <span class="cap-tag">Max ₹50,000</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec80CCD1B" placeholder="0" min="0" max="50000" step="1000">
                                        </div>
                                        <span class="field-hint">Self-contribution to National Pension System.</span>
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="sec80D">Section 80D (Health Insurance)</label>
                                            <span class="cap-tag">Up to ₹1 Lakh</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec80D" placeholder="0" min="0" max="100000" step="1000">
                                        </div>
                                        <span class="field-hint">Health insurance premium (Self, Family &amp; Parents).</span>
                                    </div>

                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="sec80CCD2">Section 80CCD(2) (Employer NPS)</label>
                                            <span class="cap-tag badge-both">Both Regimes</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec80CCD2" placeholder="0" min="0" step="1000">
                                        </div>
                                        <span class="field-hint">Employer contribution to employee NPS (Up to 14% of Basic).</span>
                                    </div>
                                </div>

                                <div class="form-row">
                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="sec80E">Section 80E (Education Loan)</label>
                                            <span class="cap-tag">No Upper Cap</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="sec80E" placeholder="0" min="0" step="1000">
                                        </div>
                                        <span class="field-hint">Interest on loan for higher education of self/children.</span>
                                    </div>

                                    <div class="form-group flex-1">
                                        <div class="label-with-cap">
                                            <label for="otherDeductions">Other Deductions</label>
                                            <span class="cap-tag">Old Regime</span>
                                        </div>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="otherDeductions" placeholder="0" min="0" step="1000">
                                        </div>
                                        <span class="field-hint">Section 80G, 80TTA/80TTB interest deductions, etc.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Section 4: Regime Selection -->
                        <div class="form-section" id="regimeSelectionSection">
                            <div class="section-header">
                                <span class="section-num">4</span>
                                <h2 class="section-title">Tax Regime Selection</h2>
                            </div>

                            <div class="regime-selector-group">
                                <label class="regime-radio-card active" id="regimeCardCompare">
                                    <input type="radio" name="regimeChoice" value="compare" checked onchange="window.TaxWiseCore.handleRegimeChoiceChange('compare')">
                                    <div class="radio-card-content">
                                        <div class="radio-card-title">
                                            <span>Compare Both Regimes</span>
                                            <span class="badge-recommended">Recommended</span>
                                        </div>
                                        <p class="radio-card-desc">Evaluates both New &amp; Old Regimes side-by-side to identify the lower estimated tax.</p>
                                    </div>
                                </label>

                                <label class="regime-radio-card" id="regimeCardNew">
                                    <input type="radio" name="regimeChoice" value="new" onchange="window.TaxWiseCore.handleRegimeChoiceChange('new')">
                                    <div class="radio-card-content">
                                        <div class="radio-card-title">
                                            <span>New Tax Regime</span>
                                            <span class="badge-default">Default (Sec 115BAC)</span>
                                        </div>
                                        <p class="radio-card-desc">Concessional slabs, higher rebate (up to ₹12L in FY 26-27), no investment lock-in required.</p>
                                    </div>
                                </label>

                                <label class="regime-radio-card" id="regimeCardOld">
                                    <input type="radio" name="regimeChoice" value="old" onchange="window.TaxWiseCore.handleRegimeChoiceChange('old')">
                                    <div class="radio-card-content">
                                        <div class="radio-card-title">
                                            <span>Old Tax Regime</span>
                                            <span class="badge-opt">With Deductions</span>
                                        </div>
                                        <p class="radio-card-desc">Higher slab rates, but permits 80C, 80D, HRA, home loan interest, and other deductions.</p>
                                    </div>
                                </label>
                            </div>

                            <select id="regime" style="display: none;">
                                <option value="compare" selected>Compare Both</option>
                                <option value="new">New Regime</option>
                                <option value="old">Old Regime</option>
                            </select>
                        </div>

                        <!-- Action Buttons -->
                        <div class="form-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="submit" class="btn btn-primary" id="calculateBtn">
                                <span class="btn-spinner" id="btnSpinner" style="display: none;"></span>
                                <svg class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <line x1="8" y1="10" x2="16" y2="10"></line>
                                    <line x1="12" y1="6" x2="12" y2="14"></line>
                                </svg>
                                <span>Calculate Tax</span>
                            </button>

                            <button type="button" class="btn btn-secondary" onclick="window.TaxWiseCore.resetForm()">
                                <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                                    <path d="M3 3v5h5"></path>
                                </svg>
                                <span>Reset</span>
                            </button>

                            ${client ? `
                                <button type="button" class="btn btn-success" id="btn-save-to-client-bottom" onclick="window.TaxWiseCore.saveCurrentCalculation()" style="background:#10b981; color:#ffffff; font-weight:600; margin-left:auto;">
                                    Save to Client
                                </button>
                            ` : ''}
                        </div>

                        <!-- Validation Alerts Box -->
                        <div class="alert-box alert-error" id="formErrorAlert" style="display: none;">
                            <div class="alert-icon">⚠️</div>
                            <div class="alert-message" id="formErrorMessage"></div>
                        </div>
                    </form>
                </section>

                <!-- Right Column: Results & Analytics Dashboard -->
                <section class="results-panel" id="resultBox">
                    <!-- Empty State -->
                    <div class="empty-state" id="emptyState">
                        <div class="empty-hero-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <h2 class="empty-title">Ready for Multi-Head Tax Calculation</h2>
                        <p class="empty-desc">
                            Select your taxpayer type, enter your income across Salary, Business, House Property, and Capital Gains, and click <strong>Calculate Tax</strong> to generate the comprehensive tax report, regime comparison, and tailored tax-saving strategies.
                        </p>

                        <div class="highlights-grid">
                            <div class="highlight-card">
                                <span class="highlight-tag">FY 2026-27 Slabs</span>
                                <div class="highlight-value">₹0 Tax up to ₹12.75L</div>
                                <p class="highlight-text">For resident salaried individuals under New Regime (₹12L income + ₹75,000 standard deduction).</p>
                            </div>
                            <div class="highlight-card">
                                <span class="highlight-tag">Multi-Taxpayer Support</span>
                                <div class="highlight-value">8 Assessee Categories</div>
                                <p class="highlight-text">Accurate rates for Individuals, HUFs, Domestic &amp; Foreign Companies, Firms, LLPs, and Cooperatives.</p>
                            </div>
                            <div class="highlight-card">
                                <span class="highlight-tag">Interactive Simulator</span>
                                <div class="highlight-value">Tax Planning Engine</div>
                                <p class="highlight-text">Live tax-saving recommendations and proposed investment simulator using the authoritative calculation engine.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Active Calculation Results (Hidden initially) -->
                    <div class="active-results" id="activeResults" style="display: none;">
                        <!-- Header & Actions -->
                        <div class="results-top-bar">
                            <div class="results-title-group">
                                <h2 class="results-heading" id="welcome">Tax Calculation Statement</h2>
                                <span class="results-timestamp" id="calcTimestamp">Calculated on: --</span>
                            </div>
                            <div class="report-actions">
                                <button type="button" class="btn-action" onclick="window.TaxWiseCore.printTaxReport()" title="Print / Save as PDF">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                        <rect x="6" y="14" width="12" height="8"></rect>
                                    </svg>
                                    <span>Print Report</span>
                                </button>
                                <button type="button" class="btn-action" onclick="window.TaxWiseCore.downloadTaxReport()" title="Download Statement">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    <span>Download Statement</span>
                                </button>
                                ${client ? `
                                    <button type="button" class="btn-action" onclick="window.TaxWiseCore.saveCurrentCalculation()" style="color:#10b981; border-color:#a7f3d0;" title="Save Record">
                                        <span>Save to Profile</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Recommendation Hero Card -->
                        <div class="recommendation-hero" id="recommendationHero">
                            <div class="rec-icon" id="recIcon">✓</div>
                            <div class="rec-content">
                                <div class="rec-badge" id="recBadge">LOWER ESTIMATED TAX</div>
                                <h3 class="rec-title" id="recTitle">New Tax Regime is beneficial</h3>
                                <p class="rec-explanation" id="recExplanation">
                                    The New Tax Regime produces a lower estimated tax by ₹0.
                                </p>
                            </div>
                        </div>

                        <!-- 7 Summary Metric Cards -->
                        <div class="metrics-grid">
                            <div class="metric-card">
                                <span class="metric-label">Combined Gross Income</span>
                                <div class="metric-value" id="showIncome">₹0</div>
                                <span class="metric-subtext">Across all income heads</span>
                            </div>

                            <div class="metric-card">
                                <span class="metric-label">Total Eligible Deductions</span>
                                <div class="metric-value metric-savings" id="showDeduction">₹0</div>
                                <span class="metric-subtext" id="deductionSubtext">Eligible under active regime</span>
                            </div>

                            <div class="metric-card">
                                <span class="metric-label">Taxable Income</span>
                                <div class="metric-value" id="showTaxable">₹0</div>
                                <span class="metric-subtext">Rounded per Section 288A</span>
                            </div>

                            <div class="metric-card metric-card-tax">
                                <span class="metric-label">Total Estimated Tax</span>
                                <div class="metric-value metric-tax-amount" id="totalTax">₹0</div>
                                <span class="metric-subtext" id="totalTaxSubtext">Includes cess &amp; marginal relief</span>
                            </div>

                            <div class="metric-card">
                                <span class="metric-label">Monthly Tax Equivalent</span>
                                <div class="metric-value" id="monthlyTax">₹0</div>
                                <span class="metric-subtext">Annual tax divided by 12</span>
                            </div>

                            <div class="metric-card">
                                <span class="metric-label">Effective Tax Rate</span>
                                <div class="metric-value" id="effectiveTaxRate">0.00%</div>
                                <span class="metric-subtext">Tax as % of Gross Income</span>
                            </div>

                            <div class="metric-card metric-card-posttax">
                                <div class="metric-label-with-tip">
                                    <span class="metric-label">Est. Post-Tax Income</span>
                                    <span class="info-tip" title="Gross income minus estimated income tax.">ℹ</span>
                                </div>
                                <div class="metric-value" id="postTaxIncome">₹0</div>
                                <span class="metric-subtext">Estimated annual post-tax income</span>
                            </div>
                        </div>

                        <!-- Multi-Head Income Breakdown Table -->
                        <div class="dashboard-card" id="headWiseCard">
                            <div class="card-header">
                                <h3 class="card-title">Income Breakdown by Head</h3>
                                <span class="card-tag">5 Heads of Income</span>
                            </div>
                            <div class="table-responsive">
                                <table class="comparison-table">
                                    <thead>
                                        <tr>
                                            <th>Income Head</th>
                                            <th>Gross Amount (₹)</th>
                                            <th>Adjustments / Deductions</th>
                                            <th>Net Taxable Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="headWiseTableBody">
                                        <!-- Populated dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Side-by-Side Regime Comparison Section -->
                        <div class="dashboard-card" id="comparisonCard">
                            <div class="card-header">
                                <h3 class="card-title">Regime Direct Comparison</h3>
                                <span class="card-tag">Side-by-Side Analysis</span>
                            </div>
                            <div class="table-responsive">
                                <table class="comparison-table">
                                    <thead>
                                        <tr>
                                            <th>Parameter</th>
                                            <th id="compColNew">New Tax Regime</th>
                                            <th id="compColOld">Old Tax Regime</th>
                                            <th>Difference / Impact</th>
                                        </tr>
                                    </thead>
                                    <tbody id="comparisonTableBody">
                                        <!-- Populated dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Visual Charts Section -->
                        <div class="charts-row">
                            <!-- Chart 1: Income Allocation -->
                            <div class="dashboard-card chart-card flex-1">
                                <div class="card-header">
                                    <h3 class="card-title">Income Allocation</h3>
                                    <span class="card-tag">Distribution</span>
                                </div>
                                <div class="chart-container" id="incomeAllocationChart"></div>
                                <div class="chart-legend" id="incomeLegend"></div>
                            </div>

                            <!-- Chart 2: Regime Comparison Bars -->
                            <div class="dashboard-card chart-card flex-1">
                                <div class="card-header">
                                    <h3 class="card-title">Regime Tax Comparison</h3>
                                    <span class="card-tag">Comparison</span>
                                </div>
                                <div class="chart-container" id="regimeComparisonChart"></div>
                                <div class="chart-legend" id="regimeLegend"></div>
                            </div>
                        </div>

                        <!-- Chart 3: Progressive Tax Slab Breakdown -->
                        <div class="dashboard-card chart-card">
                            <div class="card-header">
                                <h3 class="card-title">Progressive Slab Breakdown</h3>
                                <span class="card-tag" id="slabChartTag">Active Slabs</span>
                            </div>
                            <div class="chart-container chart-horizontal" id="slabBreakdownChart"></div>
                        </div>

                        <!-- Detailed Tax Calculation Table -->
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3 class="card-title">Progressive Slab &amp; Special Tax Computation</h3>
                                <span class="card-tag" id="detailedBreakdownTag">Itemized Breakdown</span>
                            </div>

                            <div class="table-responsive">
                                <table class="breakdown-table">
                                    <thead>
                                        <tr>
                                            <th>Bracket / Component</th>
                                            <th>Rate</th>
                                            <th>Taxable Slice (₹)</th>
                                            <th>Tax for Slice (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody id="slabBreakdownTableBody">
                                        <!-- Populated dynamically -->
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colspan="3" class="table-summary-label">Tax before Rebate:</td>
                                            <td class="table-summary-val" id="showTax">₹0</td>
                                        </tr>
                                        <tr id="rebateRow">
                                            <td colspan="3" class="table-summary-label">
                                                Less: Section 87A Tax Rebate
                                                <span class="badge-rebate" id="rebateBadge" style="display: none;">Marginal Relief</span>
                                            </td>
                                            <td class="table-summary-val text-green" id="showRebate">-₹0</td>
                                        </tr>
                                        <tr id="surchargeRow">
                                            <td colspan="3" class="table-summary-label">
                                                Add: Surcharge
                                                <span class="badge-surcharge" id="surchargeBadge" style="display: none;">0%</span>
                                            </td>
                                            <td class="table-summary-val" id="showSurcharge">₹0</td>
                                        </tr>
                                        <tr>
                                            <td colspan="3" class="table-summary-label">Add: Health &amp; Education Cess (4%):</td>
                                            <td class="table-summary-val" id="showCess">₹0</td>
                                        </tr>
                                        <tr class="table-final-row">
                                            <td colspan="3" class="table-summary-label">Total Estimated Tax Liability (Rounded per Sec 288B):</td>
                                            <td class="table-summary-val text-bold-purple" id="tableTotalTax">₹0</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <!-- DEDICATED FEATURE: Tax Planning & Tax-Saving Recommendations -->
                        <div class="dashboard-card tax-planning-card" id="taxPlanningSection">
                            <div class="card-header">
                                <div>
                                    <h3 class="card-title">💡 Tax Planning &amp; Tax-Saving Recommendations</h3>
                                    <p class="planning-subtitle" id="planningCategorySubtitle">Tailored strategies for the selected taxpayer category</p>
                                </div>
                                <span class="card-tag badge-planning">Personalized Insights</span>
                            </div>

                            <!-- Interactive Tax-Saving Simulator Widget -->
                            <div class="simulator-box">
                                <div class="simulator-header">
                                    <span class="simulator-icon">⚡</span>
                                    <div>
                                        <h4 class="simulator-title">Interactive Tax-Saving Simulator</h4>
                                        <p class="simulator-desc">Test how an additional eligible investment or payment impacts your actual tax liability in real time.</p>
                                    </div>
                                </div>

                                <div class="simulator-controls">
                                    <div class="sim-group flex-2">
                                        <label for="simSectionSelect">Tax-Saving Section / Instrument</label>
                                        <select id="simSectionSelect">
                                            <option value="sec80C">Section 80C (PPF, ELSS, EPF, Life Insurance - Max ₹1.5L)</option>
                                            <option value="sec80CCD1B">Section 80CCD(1B) (NPS Self Contribution - Max ₹50,000)</option>
                                            <option value="sec80CCD2">Section 80CCD(2) (Employer NPS - Both Regimes)</option>
                                            <option value="sec80D">Section 80D (Health Insurance Premium)</option>
                                            <option value="sec24b">Section 24(b) (Home Loan Interest - Max ₹2L)</option>
                                            <option value="otherDeductions">Other Deductions (80E, 80G, 80TTA)</option>
                                        </select>
                                    </div>

                                    <div class="sim-group flex-1">
                                        <label for="simAmountInput">Proposed Investment (₹)</label>
                                        <div class="currency-input-wrap">
                                            <span class="currency-symbol">₹</span>
                                            <input type="number" id="simAmountInput" placeholder="e.g. 50000" min="0" step="5000">
                                        </div>
                                    </div>

                                    <div class="sim-group-btn">
                                        <button type="button" class="btn btn-simulate" onclick="window.TaxWiseCore.runTaxSimulation()">
                                            <span>Simulate Savings</span>
                                        </button>
                                        <button type="button" class="btn btn-sim-reset" onclick="window.TaxWiseCore.resetTaxSimulation()" title="Reset Simulator">
                                            <span>Reset</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Simulator Live Results Bar -->
                                <div class="sim-results-bar" id="simResultsBar" style="display: none;">
                                    <div class="sim-metrics-grid">
                                        <div class="sim-metric">
                                            <span class="sim-label">Proposed Outflow</span>
                                            <span class="sim-value" id="simProposedAmt">₹0</span>
                                        </div>
                                        <div class="sim-metric">
                                            <span class="sim-label">Allowed Deduction</span>
                                            <span class="sim-value text-green" id="simAllowedAmt">₹0</span>
                                        </div>
                                        <div class="sim-metric">
                                            <span class="sim-label">Revised Taxable</span>
                                            <span class="sim-value" id="simRevisedTaxable">₹0</span>
                                        </div>
                                        <div class="sim-metric">
                                            <span class="sim-label">Revised Tax</span>
                                            <span class="sim-value" id="simRevisedTax">₹0</span>
                                        </div>
                                        <div class="sim-metric sim-highlight">
                                            <span class="sim-label">Estimated Tax Saved</span>
                                            <span class="sim-value text-green" id="simTaxSaved">₹0</span>
                                        </div>
                                        <div class="sim-metric">
                                            <span class="sim-label">Net Cash Outflow</span>
                                            <span class="sim-value" id="simNetOutflow">₹0</span>
                                        </div>
                                        <div class="sim-metric">
                                            <span class="sim-label">Tax Saved / Outflow</span>
                                            <span class="sim-value text-bold-purple" id="simEfficiency">0%</span>
                                        </div>
                                    </div>
                                    <div class="sim-explanation-box" id="simExplanationBox">
                                        <span class="sim-exp-icon">ℹ</span>
                                        <p class="sim-exp-text" id="simExplanationText"></p>
                                    </div>
                                </div>
                            </div>

                            <!-- Expandable Taxpayer Recommendation Cards Grid -->
                            <div class="recommendations-grid" id="recommendationsGrid">
                                <!-- Populated dynamically -->
                            </div>
                        </div>

                        <!-- Assumptions and Notes -->
                        <div class="dashboard-card assumptions-card">
                            <div class="card-header">
                                <h3 class="card-title">Calculation Assumptions &amp; Provisions</h3>
                            </div>
                            <ul class="assumptions-list" id="assumptionsList"></ul>
                        </div>

                        <!-- Statutory Legal Disclaimer -->
                        <div class="disclaimer-box">
                            <div class="disclaimer-icon">⚖️</div>
                            <p class="disclaimer-text">
                                <strong>Statutory Disclaimer:</strong> This income tax calculator and planning engine is designed strictly for informational, educational, and personal planning purposes based on the Indian Income-tax Act, 1961 as amended for the selected Financial Year. It provides an estimate of income tax liability and does not constitute formal tax, legal, accounting, or personalized investment advice. Users should consult a certified Chartered Accountant (CA) or tax professional before making financial investments or filing official returns.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <!-- Sample Scenarios Modal -->
            <div class="modal-backdrop" id="presetsModal" style="display: none;" onclick="window.TaxWiseCore.handleModalBackdropClick(event)">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Load Sample Taxpayer Profiles</h3>
                        <button type="button" class="btn-close" onclick="window.TaxWiseCore.togglePresetsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-desc">Select a preset to test various taxpayer categories, income thresholds, capital gains, and corporate rates:</p>
                        <div class="presets-list">
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('salaried12L')">
                                <div class="preset-title">Individual: Salaried Professional - ₹12.75 Lakh (FY 26-27 Zero Tax)</div>
                                <div class="preset-desc">₹12.75L salary - ₹75k standard deduction = ₹12L taxable. 100% tax rebated under Sec 87A (₹0 Tax).</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('salariedMarginal')">
                                <div class="preset-title">Individual: Section 87A Marginal Relief - ₹12.85 Lakh</div>
                                <div class="preset-desc">Taxable income ₹12.10 Lakh (₹10,000 above threshold). Demonstrates Section 87A marginal relief capping tax.</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('individualInvestments')">
                                <div class="preset-title">Individual: Salaried with Eligible Investments - ₹16 Lakh</div>
                                <div class="preset-desc">₹16L Salary + ₹1.5L 80C + ₹50k NPS 80CCD(1B) + ₹50k 80D + ₹2L Home loan interest. Compares Old vs New regime benefit.</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('capitalGainsEarner')">
                                <div class="preset-title">Individual: Multi-Head Salary &amp; Capital Gains (Sec 111A + 112A)</div>
                                <div class="preset-desc">₹15L Salary + ₹2L STCG (20%) + ₹3L LTCG 112A (12.5% &gt; ₹1.25L). Tests separate special rate calculations.</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('hufBusiness')">
                                <div class="preset-title">HUF: Business &amp; Rental Earner - ₹10 Lakh</div>
                                <div class="preset-desc">HUF assessed under Old vs New regime without personal salary or Section 87A rebate.</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('domesticCompany')">
                                <div class="preset-title">Domestic Company: Section 115BAA (22% Concessional Rate)</div>
                                <div class="preset-desc">Business income ₹1 Crore taxed at 22% + 10% flat surcharge = effective 25.168% rate with no MAT.</div>
                            </button>
                            <button type="button" class="preset-item" onclick="window.TaxWiseCore.loadPreset('firmLLP')">
                                <div class="preset-title">Firm / LLP: Flat 30% Tax &amp; Surcharge</div>
                                <div class="preset-desc">Partnership firm with ₹1.5 Crore income. Tests flat 30% rate and 12% surcharge with marginal relief.</div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hidden Printable Report Container -->
            <div id="printReportContainer" class="print-only"></div>
        </div>
        `;
    }

    /**
     * Initializes TaxWise inside a container, pre-filling client data if provided.
     */
    function initTaxWise(container, client = null, prefillData = null) {
        currentActiveClient = client;
        container.innerHTML = getTaxWiseHTML(client);

        // Pre-fill numbers if provided
        if (prefillData) {
            populateFormFromData(prefillData);
        } else if (client) {
            prefillFromClientProfile(client);
        }

        // Initialize state & field visibility
        handleYearChange();
        handleTaxpayerTypeChange();
        updateGrossIncomeDisplay();
    }

    function prefillFromClientProfile(client) {
        if (!client) return;

        const typeSelect = document.getElementById('taxpayerType');
        if (typeSelect && client.taxpayerType) {
            typeSelect.value = client.taxpayerType;
        }

        const nameInput = document.getElementById('name');
        if (nameInput && client.name) {
            nameInput.value = client.name;
        }

        const ageInput = document.getElementById('age');
        if (ageInput && client.age) {
            ageInput.value = client.age;
        }

        const resSelect = document.getElementById('residentialStatus');
        if (resSelect && client.residentialStatus) {
            resSelect.value = client.residentialStatus;
        }

        // Demo seed numbers for realism if present in demo
        if (client.id === 'CLI-1001') {
            document.getElementById('salaryIncome').value = 2500000;
            document.getElementById('sec24b').value = 200000;
            document.getElementById('stcg111A').value = 50000;
            document.getElementById('ltcg112A').value = 180000;
            document.getElementById('interestIncome').value = 45000;
            document.getElementById('sec80C').value = 150000;
            document.getElementById('sec80D').value = 25000;
            document.getElementById('sec80CCD2').value = 120000;
        } else if (client.id === 'CLI-1002') {
            document.getElementById('businessIncome').value = 3600000;
            document.getElementById('interestIncome').value = 80000;
            document.getElementById('sec80C').value = 150000;
            document.getElementById('sec80D').value = 50000;
        } else if (client.id === 'CLI-1003') {
            document.getElementById('businessIncome').value = 1450000;
            document.getElementById('interestIncome').value = 400000;
            document.getElementById('sec80C').value = 150000;
        } else if (client.id === 'CLI-1004') {
            document.getElementById('businessIncome').value = 8500000;
            if (document.getElementById('companyOption')) {
                document.getElementById('companyOption').value = 'sec_115baa_22';
            }
        } else if (client.id === 'CLI-1005') {
            document.getElementById('businessIncome').value = 4200000;
        }
    }

    function populateFormFromData(data) {
        if (!data) return;
        const inp = data.inputs || data;

        if (inp.financialYear && document.getElementById('financialYear')) document.getElementById('financialYear').value = inp.financialYear;
        if (inp.taxpayerType && document.getElementById('taxpayerType')) document.getElementById('taxpayerType').value = inp.taxpayerType;
        if (inp.name && document.getElementById('name')) document.getElementById('name').value = inp.name;
        const panVal = inp.pan || (data.taxpayer && data.taxpayer.pan) || data.pan;
        if (panVal && document.getElementById('pan')) document.getElementById('pan').value = panVal;
        if (inp.age && document.getElementById('age')) document.getElementById('age').value = inp.age;
        if (inp.residentialStatus && document.getElementById('residentialStatus')) document.getElementById('residentialStatus').value = inp.residentialStatus;
        if (inp.companyOption && document.getElementById('companyOption')) document.getElementById('companyOption').value = inp.companyOption;
        if (inp.cooperativeOption && document.getElementById('cooperativeOption')) document.getElementById('cooperativeOption').value = inp.cooperativeOption;

        if (document.getElementById('salaryIncome')) document.getElementById('salaryIncome').value = inp.salaryIncome || 0;
        if (document.getElementById('businessIncome')) document.getElementById('businessIncome').value = inp.businessIncome || 0;
        if (document.getElementById('housePropertyType')) document.getElementById('housePropertyType').value = inp.housePropertyType || 'self_occupied';
        if (document.getElementById('sec24b')) document.getElementById('sec24b').value = inp.sec24b || inp.housePropertyLoanInterest || 0;
        if (document.getElementById('housePropertyGrossRent')) document.getElementById('housePropertyGrossRent').value = inp.housePropertyGrossRent || 0;
        if (document.getElementById('housePropertyMunicipalTaxes')) document.getElementById('housePropertyMunicipalTaxes').value = inp.housePropertyMunicipalTaxes || 0;

        if (document.getElementById('stcg111A')) document.getElementById('stcg111A').value = inp.stcg111A || 0;
        if (document.getElementById('stcgOther')) document.getElementById('stcgOther').value = inp.stcgOther || 0;
        if (document.getElementById('ltcg112A')) document.getElementById('ltcg112A').value = inp.ltcg112A || 0;
        if (document.getElementById('ltcg112')) document.getElementById('ltcg112').value = inp.ltcg112 || 0;

        if (document.getElementById('interestIncome')) document.getElementById('interestIncome').value = inp.interestIncome || 0;
        if (document.getElementById('dividendIncome')) document.getElementById('dividendIncome').value = inp.dividendIncome || 0;
        if (document.getElementById('otherIncome')) document.getElementById('otherIncome').value = inp.otherIncome || 0;

        if (document.getElementById('sec80C')) document.getElementById('sec80C').value = inp.sec80C || 0;
        if (document.getElementById('sec80CCD1B')) document.getElementById('sec80CCD1B').value = inp.sec80CCD1B || 0;
        if (document.getElementById('sec80D')) document.getElementById('sec80D').value = inp.sec80D || 0;
        if (document.getElementById('sec80CCD2')) document.getElementById('sec80CCD2').value = inp.sec80CCD2 || 0;
        if (document.getElementById('sec80E')) document.getElementById('sec80E').value = inp.sec80E || 0;
        if (document.getElementById('otherDeductions')) document.getElementById('otherDeductions').value = inp.otherDeductions || 0;

        if (inp.regime) {
            handleRegimeChoiceChange(inp.regime);
        }

        if (data.clientId && window.getState) {
            const st = window.getState();
            if (st && st.clients) {
                const found = st.clients.find(c => c.id === data.clientId);
                if (found) currentActiveClient = found;
            }
        }

        handleYearChange();
        handleTaxpayerTypeChange();
        updateGrossIncomeDisplay();
        calculateTax();
    }

    /**
     * Updates UI hints based on selected Financial Year.
     */
    function handleYearChange() {
        const fyEl = document.getElementById("financialYear");
        if (!fyEl) return;
        const fy = fyEl.value;
        const badgeText = document.getElementById("yearBadgeText");
        const bannerText = document.getElementById("yearBannerText");
        const stdBadge = document.getElementById("stdDeductionBadge");

        if (fy === "2026-2027" || fy === "2025-2026") {
            if (badgeText) badgeText.textContent = "Budget 2025 / 2026 Active";
            if (bannerText) bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹12 Lakh taxable income</strong> (₹12.75L with ₹75k standard deduction). STCG Sec 111A is 20%, and LTCG Sec 112A is 12.5% over ₹1.25L.";
            if (stdBadge) stdBadge.textContent = "Std Ded: ₹75,000 Auto-Applied";
        } else if (fy === "2024-2025") {
            if (badgeText) badgeText.textContent = "Finance (No. 2) Act 2024 Slabs";
            if (bannerText) bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹7.75 Lakh</strong> (₹7L taxable income + ₹75,000 standard deduction). STCG 20%, LTCG 12.5%.";
            if (stdBadge) stdBadge.textContent = "Std Ded: ₹75,000 Auto-Applied";
        } else {
            if (badgeText) badgeText.textContent = "Budget 2023 Rules";
            if (bannerText) bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹7.5 Lakh</strong> (₹7L taxable income + ₹50,000 standard deduction).";
            if (stdBadge) stdBadge.textContent = "Std Ded: ₹50,000 Auto-Applied";
        }

        if (lastCalculationResult) {
            calculateTax();
        }
    }

    /**
     * DYNAMIC TAXPAYER CATEGORY FIELD VISIBILITY:
     * - Individual: Shows Name, Age, Residential Status, Salary head, Chapter VI-A deductions, Regime options.
     * - HUF: HIDES Age, HIDES Residential Status, HIDES Salary head. Shows deductions & regimes.
     * - Domestic Company: HIDES Age, HIDES Residential Status, HIDES Salary, HIDES Deductions, HIDES Regimes. SHOWS Corporate Options (30%, 25%, 115BAA 22%, 115BAB 15%).
     * - Foreign Company: HIDES Age, HIDES Residential Status, HIDES Salary, HIDES Deductions. Flat 35% applies.
     * - Firm / LLP: HIDES Age, HIDES Residential Status, HIDES Salary, HIDES Deductions. Flat 30% applies.
     * - Cooperative Society: HIDES Age, HIDES Residential Status, HIDES Salary, HIDES Deductions. SHOWS Cooperative Options (Regular vs 115BAD).
     * - Local Authority: HIDES Age, HIDES Salary, HIDES Deductions. Flat 30% applies.
     */
    function handleTaxpayerTypeChange() {
        const typeEl = document.getElementById("taxpayerType");
        if (!typeEl) return;
        const type = typeEl.value;

        const individualFields = document.getElementById("individualFieldsGroup");
        const domesticCompanyFields = document.getElementById("domesticCompanyFieldsGroup");
        const cooperativeFields = document.getElementById("cooperativeFieldsGroup");
        const salaryHead = document.getElementById("salaryHeadGroup");
        const deductionsSection = document.getElementById("deductionsSection");
        const regimeSection = document.getElementById("regimeSelectionSection");
        const hint = document.getElementById("taxpayerTypeHint");

        // Safe reset visibility
        if (individualFields) individualFields.style.display = "none";
        if (domesticCompanyFields) domesticCompanyFields.style.display = "none";
        if (cooperativeFields) cooperativeFields.style.display = "none";
        if (salaryHead) salaryHead.style.display = "none";
        if (deductionsSection) deductionsSection.style.display = "none";
        if (regimeSection) regimeSection.style.display = "none";

        if (type === "individual") {
            if (individualFields) individualFields.style.display = "block";
            if (salaryHead) salaryHead.style.display = "block";
            if (deductionsSection) deductionsSection.style.display = "block";
            if (regimeSection) regimeSection.style.display = "block";
            if (hint) hint.textContent = "Progressive slabs, Section 87A rebate, and standard deduction apply to resident individuals.";
        } else if (type === "huf") {
            // HUF has no Age, no residential status, no salary income
            if (deductionsSection) deductionsSection.style.display = "block";
            if (regimeSection) regimeSection.style.display = "block";
            if (hint) hint.textContent = "Assessed under progressive slabs. Note: Section 87A rebate does NOT apply to HUF.";
        } else if (type === "aop_boi_ajp") {
            if (regimeSection) regimeSection.style.display = "block";
            if (hint) hint.textContent = "Covered under Section 115BAC New Regime or Old Regime slabs.";
        } else if (type === "domestic_company") {
            // Domestic Company has no individual age or residential status
            if (domesticCompanyFields) domesticCompanyFields.style.display = "block";
            if (hint) hint.textContent = "Choose between standard corporate rates (25%/30%) or concessional Section 115BAA (22%).";
        } else if (type === "foreign_company") {
            // Foreign Company flat 35%
            if (hint) hint.textContent = "Statutory corporate tax rate is 35% under Finance (No. 2) Act 2024.";
        } else if (type === "firm_llp") {
            // Firm/LLP flat 30%
            if (hint) hint.textContent = "Flat 30% tax rate applies. Surcharge of 12% applies if income exceeds ₹1 Crore.";
        } else if (type === "cooperative_society") {
            if (cooperativeFields) cooperativeFields.style.display = "block";
            if (hint) hint.textContent = "Choose between regular progressive slabs (10%, 20%, 30%) or Section 115BAD (22%).";
        } else if (type === "local_authority") {
            if (hint) hint.textContent = "Flat 30% tax rate applies on taxable income.";
        }

        updateGrossIncomeDisplay();
    }

    /**
     * Handles age input and updates age category badge.
     */
    function handleAgeChange() {
        const ageEl = document.getElementById("age");
        if (!ageEl) return;
        const age = Number(ageEl.value) || 30;
        const tag = document.getElementById("ageCategoryTag");
        if (!tag) return;

        if (age < 60) {
            tag.textContent = "General (<60 yrs)";
            tag.className = "age-category-tag";
        } else if (age < 80) {
            tag.textContent = "Senior Citizen (60-79 yrs)";
            tag.className = "age-category-tag tag-senior";
        } else {
            tag.textContent = "Super Senior Citizen (80+ yrs)";
            tag.className = "age-category-tag tag-supersenior";
        }
    }

    /**
     * Handles residential status changes.
     */
    function handleResidentialChange() {
        const resEl = document.getElementById("residentialStatus");
        if (!resEl) return;
        const status = resEl.value;
        if (status === "non_resident") {
            showError("Note: Non-Resident Individuals (NRIs) are not eligible for Section 87A rebate per statutory law.");
        } else {
            clearError();
        }
    }

    /**
     * Handles house property type toggling.
     */
    function handleHousePropertyTypeChange() {
        const typeEl = document.getElementById("housePropertyType");
        if (!typeEl) return;
        const type = typeEl.value;
        const letOutGroup = document.getElementById("letOutFieldsGroup");

        if (letOutGroup) {
            letOutGroup.style.display = (type === "let_out") ? "block" : "none";
        }
        updateGrossIncomeDisplay();
    }

    function handleCompanyOptionChange() {
        if (lastCalculationResult) calculateTax();
    }

    function handleCooperativeOptionChange() {
        if (lastCalculationResult) calculateTax();
    }

    /**
     * Collapses or expands Chapter VI-A deductions section.
     */
    function toggleDeductionsAccordion() {
        const content = document.getElementById("deductionsContent");
        const icon = document.getElementById("deductionsToggleIcon");
        if (!content || !icon) return;

        if (content.style.display === "none") {
            content.style.display = "block";
            icon.textContent = "▼";
        } else {
            content.style.display = "none";
            icon.textContent = "▶";
        }
    }

    /**
     * Updates regime radio selection and hidden field.
     */
    function handleRegimeChoiceChange(val) {
        const regimeEl = document.getElementById("regime");
        if (regimeEl) regimeEl.value = val;

        document.querySelectorAll(".regime-radio-card").forEach(c => c.classList.remove("active"));
        if (val === "compare" && document.getElementById("regimeCardCompare")) document.getElementById("regimeCardCompare").classList.add("active");
        if (val === "new" && document.getElementById("regimeCardNew")) document.getElementById("regimeCardNew").classList.add("active");
        if (val === "old" && document.getElementById("regimeCardOld")) document.getElementById("regimeCardOld").classList.add("active");

        if (lastCalculationResult) calculateTax();
    }

    /**
     * Recalculates and displays combined gross income across all heads.
     */
    function updateGrossIncomeDisplay() {
        const typeEl = document.getElementById("taxpayerType");
        const type = typeEl ? typeEl.value : 'individual';

        let salary = (type === "individual") ? (Number(document.getElementById("salaryIncome")?.value) || 0) : 0;
        let business = Number(document.getElementById("businessIncome")?.value) || 0;
        let rent = Number(document.getElementById("housePropertyGrossRent")?.value) || 0;
        let stcg111A = Number(document.getElementById("stcg111A")?.value) || 0;
        let stcgOther = Number(document.getElementById("stcgOther")?.value) || 0;
        let ltcg112A = Number(document.getElementById("ltcg112A")?.value) || 0;
        let ltcg112 = Number(document.getElementById("ltcg112")?.value) || 0;
        let interest = Number(document.getElementById("interestIncome")?.value) || 0;
        let dividend = Number(document.getElementById("dividendIncome")?.value) || 0;
        let other = Number(document.getElementById("otherIncome")?.value) || 0;

        const totalGross = salary + business + rent + stcg111A + stcgOther + ltcg112A + ltcg112 + interest + dividend + other;
        const display = document.getElementById("grossIncomeDisplay");
        if (display) {
            display.textContent = "₹" + totalGross.toLocaleString("en-IN");
        }
    }

    /**
     * Collects input payload from the form.
     */
    function getFormPayload() {
        const taxpayerType = document.getElementById("taxpayerType")?.value || 'individual';
        const financialYear = document.getElementById("financialYear")?.value || '2026-2027';
        const name = document.getElementById("name")?.value.trim() || (currentActiveClient ? currentActiveClient.name : '');
        const pan = document.getElementById("pan")?.value.trim().toUpperCase() || (currentActiveClient ? currentActiveClient.pan : null);
        const age = Number(document.getElementById("age")?.value) || 30;
        const residentialStatus = document.getElementById("residentialStatus")?.value || 'resident';
        const regime = document.getElementById("regime")?.value || 'compare';
        const companyOption = document.getElementById("companyOption")?.value || 'standard_30';
        const cooperativeOption = document.getElementById("cooperativeOption")?.value || 'regular';

        const salaryIncome = (taxpayerType === "individual") ? (Number(document.getElementById("salaryIncome")?.value) || 0) : 0;
        const businessIncome = Number(document.getElementById("businessIncome")?.value) || 0;
        const housePropertyType = document.getElementById("housePropertyType")?.value || 'self_occupied';
        const housePropertyGrossRent = Number(document.getElementById("housePropertyGrossRent")?.value) || 0;
        const housePropertyMunicipalTaxes = Number(document.getElementById("housePropertyMunicipalTaxes")?.value) || 0;
        const sec24b = Number(document.getElementById("sec24b")?.value) || 0;

        const stcg111A = Number(document.getElementById("stcg111A")?.value) || 0;
        const stcgOther = Number(document.getElementById("stcgOther")?.value) || 0;
        const ltcg112A = Number(document.getElementById("ltcg112A")?.value) || 0;
        const ltcg112 = Number(document.getElementById("ltcg112")?.value) || 0;

        const interestIncome = Number(document.getElementById("interestIncome")?.value) || 0;
        const dividendIncome = Number(document.getElementById("dividendIncome")?.value) || 0;
        const otherIncome = Number(document.getElementById("otherIncome")?.value) || 0;

        const sec80C = (taxpayerType === "individual" || taxpayerType === "huf") ? (Number(document.getElementById("sec80C")?.value) || 0) : 0;
        const sec80CCD1B = (taxpayerType === "individual") ? (Number(document.getElementById("sec80CCD1B")?.value) || 0) : 0;
        const sec80D = (taxpayerType === "individual" || taxpayerType === "huf") ? (Number(document.getElementById("sec80D")?.value) || 0) : 0;
        const sec80CCD2 = (taxpayerType === "individual") ? (Number(document.getElementById("sec80CCD2")?.value) || 0) : 0;
        const sec80E = (taxpayerType === "individual") ? (Number(document.getElementById("sec80E")?.value) || 0) : 0;
        const otherDeductions = (taxpayerType === "individual" || taxpayerType === "huf") ? (Number(document.getElementById("otherDeductions")?.value) || 0) : 0;

        return {
            taxpayerType,
            financialYear,
            name,
            pan,
            age,
            residentialStatus,
            regime,
            companyOption,
            cooperativeOption,
            salaryIncome,
            businessIncome,
            housePropertyType,
            housePropertyGrossRent,
            housePropertyMunicipalTaxes,
            housePropertyLoanInterest: sec24b,
            stcg111A,
            stcgOther,
            ltcg112A,
            ltcg112,
            interestIncome,
            dividendIncome,
            otherIncome,
            sec80C,
            sec80CCD1B,
            sec80D,
            sec80CCD2,
            sec80E,
            otherDeductions,
            clientId: currentActiveClient ? currentActiveClient.id : null
        };
    }

    /**
     * Main Tax Calculation Caller
     */
    async function calculateTax() {
        clearError();
        const payload = getFormPayload();
        lastInputPayload = payload;

        const spinner = document.getElementById("btnSpinner");
        const calcBtn = document.getElementById("calculateBtn");
        if (spinner) spinner.style.display = "inline-block";
        if (calcBtn) calcBtn.disabled = true;

        try {
            const token = localStorage.getItem('cadesk_token');
            const headers = { "Content-Type": "application/json" };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch("/api/calculate", {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                showError(json.message || "Failed to calculate tax. Please check the provided inputs.");
                return;
            }

            const data = json.data;
            lastCalculationResult = data;
            const savedCalc = json.savedCalculation || (json.calculationId || json.id ? { calculationId: json.calculationId || json.id, id: json.calculationId || json.id, inputs: payload, results: data } : null);

            // Persist locally for instant refresh survival
            const calcId = savedCalc ? (savedCalc.calculationId || savedCalc.id) : null;
            if (calcId) {
                try {
                    localStorage.setItem('cadesk_last_calc_id', calcId);
                    localStorage.setItem('cadesk_last_calc_doc', JSON.stringify(savedCalc));
                } catch (e) {}
            }

            displayCalculationResults(data, payload, savedCalc);

            // Notify CA Desk host components of new calculation
            if (window.CA_DESK_ON_CALC_SAVED) {
                window.CA_DESK_ON_CALC_SAVED(savedCalc || { calculationId: calcId, id: calcId, inputs: payload, results: data });
            }

        } catch (e) {
            console.error("Calculation error:", e);
            const msg = (e && e.message && e.message.includes('fetch'))
                ? "Network or server connection error. Please verify the backend server is running on port 3001/3000."
                : (e && e.message ? `Tax computation display error: ${e.message}` : "Network or server error while connecting to tax engine.");
            showError(msg);
        } finally {
            if (spinner) spinner.style.display = "none";
            if (calcBtn) calcBtn.disabled = false;
        }
    }

    /**
     * Display Calculation Results Statement
     */
    function displayCalculationResults(data, payload, savedDoc = null) {
        if (!data) return;

        // Display Results Panel
        const emptyState = document.getElementById("emptyState");
        const activeResults = document.getElementById("activeResults");
        if (emptyState) emptyState.style.display = "none";
        if (activeResults) activeResults.style.display = "block";

        // Timestamp & Persistence Confirmation
        const tsEl = document.getElementById("calcTimestamp");
        if (tsEl) {
            const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const savedId = savedDoc ? (savedDoc.calculationId || savedDoc.id) : null;
            const savedRef = savedId ? ` | ✓ Saved to MongoDB Tax collection (${savedId})` : '';
            tsEl.textContent = "Calculated on: " + timeStr + " (" + (payload.financialYear || '2026-2027') + ")" + savedRef;
        }

        // Assessee Title
        const welcomeEl = document.getElementById("welcome");
        if (welcomeEl) {
            const displayName = payload.name ? payload.name : (currentActiveClient ? currentActiveClient.name : "Assessee");
            welcomeEl.textContent = "Tax Calculation Statement: " + displayName;
        }

        // Render all components
        renderRecommendationHero(data, payload);
        renderSummaryMetrics(data, payload);
        renderHeadWiseBreakdown(data, payload);
        renderComparisonTable(data, payload);
        renderVisualCharts(data, payload);
        renderDetailedSlabTable(data);
        renderTaxPlanningSection(data, payload);
        renderAssumptions(data, payload);

        // Notify CA Desk state
        if (window.CA_DESK_SET_LAST_CALC) {
            window.CA_DESK_SET_LAST_CALC({ inputs: payload, results: data });
        }
    }

    /**
     * Restore a previously saved calculation document from MongoDB cad_taxCalculations
     */
    function restoreSavedCalculation(calcDoc) {
        if (!calcDoc) return;
        const inputs = calcDoc.inputs || {};
        populateFormFromData(inputs);
        handleYearChange();
        handleTaxpayerTypeChange();
        updateGrossIncomeDisplay();

        const results = calcDoc.results || calcDoc.data || null;
        if (results && (results.totalTax != null || results.grossTotalIncome != null || results.newRegime || results.oldRegime)) {
            displayCalculationResults(results, inputs, calcDoc);
            lastCalculationResult = results;
            lastInputPayload = inputs;
        }
    }

    /**
     * Renders Recommendation Hero
     */
    function renderRecommendationHero(data, payload) {
        const hero = document.getElementById("recommendationHero");
        const badge = document.getElementById("recBadge");
        const title = document.getElementById("recTitle");
        const exp = document.getElementById("recExplanation");
        if (!hero || !badge || !title || !exp) return;

        if (data.comparison) {
            hero.style.display = "flex";
            const c = data.comparison;
            const isNew = c.lowerRegime === "new" || c.lowerRegime === "sec_115baa_22";
            badge.textContent = isNew ? "RECOMMENDED: NEW REGIME" : "RECOMMENDED: OLD REGIME";
            title.textContent = c.recommendation || "Tax Regime Evaluation Completed";
            exp.textContent = `Lower estimated tax by ₹${(c.taxDifference || 0).toLocaleString("en-IN")}. ${isNew ? 'New Regime concessional rates yield lower liability.' : 'Old Regime deductions reduce overall tax liability.'}`;
        } else {
            hero.style.display = "none";
        }
    }

    /**
     * Renders 7 Metric Summary Cards
     */
    function renderSummaryMetrics(data, payload) {
        const showIncome = document.getElementById("showIncome");
        const showDeduction = document.getElementById("showDeduction");
        const showTaxable = document.getElementById("showTaxable");
        const totalTax = document.getElementById("totalTax");
        const monthlyTax = document.getElementById("monthlyTax");
        const effectiveTaxRate = document.getElementById("effectiveTaxRate");
        const postTaxIncome = document.getElementById("postTaxIncome");

        if (showIncome) showIncome.textContent = "₹" + (data.grossIncome || 0).toLocaleString("en-IN");
        if (showDeduction) showDeduction.textContent = "₹" + (data.totalEligibleDeductions || 0).toLocaleString("en-IN");
        if (showTaxable) showTaxable.textContent = "₹" + (data.taxableIncome || 0).toLocaleString("en-IN");
        if (totalTax) totalTax.textContent = "₹" + (data.totalTax || 0).toLocaleString("en-IN");
        if (monthlyTax) monthlyTax.textContent = "₹" + Math.round((data.totalTax || 0) / 12).toLocaleString("en-IN");
        if (effectiveTaxRate) effectiveTaxRate.textContent = (data.effectiveTaxRate || 0).toFixed(2) + "%";
        if (postTaxIncome) postTaxIncome.textContent = "₹" + ((data.grossIncome || 0) - (data.totalTax || 0)).toLocaleString("en-IN");
    }

    /**
     * Renders 5 Heads Income Breakdown Table
     */
    function renderHeadWiseBreakdown(data, payload) {
        const tbody = document.getElementById("headWiseTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const heads = [
            { name: "Salary Income", gross: payload.salaryIncome || 0, ded: data.standardDeduction || 0, net: Math.max(0, (payload.salaryIncome || 0) - (data.standardDeduction || 0)) },
            { name: "Profits & Gains of Business / Profession", gross: payload.businessIncome || 0, ded: 0, net: payload.businessIncome || 0 },
            { name: "Income from House Property", gross: payload.housePropertyGrossRent || 0, ded: payload.housePropertyLoanInterest || 0, net: Math.max(0, (payload.housePropertyGrossRent || 0) - (payload.housePropertyLoanInterest || 0)) },
            { name: "Capital Gains (STCG & LTCG)", gross: (payload.stcg111A || 0) + (payload.stcgOther || 0) + (payload.ltcg112A || 0) + (payload.ltcg112 || 0), ded: 0, net: (payload.stcg111A || 0) + (payload.stcgOther || 0) + (payload.ltcg112A || 0) + (payload.ltcg112 || 0) },
            { name: "Income from Other Sources", gross: (payload.interestIncome || 0) + (payload.dividendIncome || 0) + (payload.otherIncome || 0), ded: 0, net: (payload.interestIncome || 0) + (payload.dividendIncome || 0) + (payload.otherIncome || 0) }
        ];

        heads.forEach(h => {
            if (h.gross > 0 || h.net > 0) {
                tbody.innerHTML += `
                    <tr>
                        <td style="font-weight:600;">${h.name}</td>
                        <td>₹${h.gross.toLocaleString("en-IN")}</td>
                        <td>₹${h.ded.toLocaleString("en-IN")}</td>
                        <td style="font-weight:700;">₹${h.net.toLocaleString("en-IN")}</td>
                    </tr>
                `;
            }
        });

        if (tbody.children.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No income entered across the 5 heads.</td></tr>`;
        }
    }

    /**
     * Renders Side-by-Side Regime Comparison Table
     */
    function renderComparisonTable(data, payload) {
        const tbody = document.getElementById("comparisonTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!data.comparison) {
            document.getElementById("comparisonCard").style.display = "none";
            return;
        }

        document.getElementById("comparisonCard").style.display = "block";
        const c = data.comparison;
        const newR = c.newRegime || c.optionB || data;
        const oldR = c.oldRegime || c.optionA || data;

        const rows = [
            { param: "Gross Income", newV: newR.grossIncome, oldV: oldR.grossIncome, diff: Math.abs(newR.grossIncome - oldR.grossIncome) },
            { param: "Eligible Deductions", newV: newR.totalEligibleDeductions, oldV: oldR.totalEligibleDeductions, diff: oldR.totalEligibleDeductions - newR.totalEligibleDeductions },
            { param: "Taxable Income", newV: newR.taxableIncome, oldV: oldR.taxableIncome, diff: oldR.taxableIncome - newR.taxableIncome },
            { param: "Base Slab Tax", newV: newR.ordinarySlabTax || newR.baseTax, oldV: oldR.ordinarySlabTax || oldR.baseTax, diff: Math.abs((newR.ordinarySlabTax || newR.baseTax) - (oldR.ordinarySlabTax || oldR.baseTax)) },
            { param: "Section 87A Rebate", newV: newR.rebate87A?.amount || 0, oldV: oldR.rebate87A?.amount || 0, diff: (newR.rebate87A?.amount || 0) - (oldR.rebate87A?.amount || 0) },
            { param: "Total Tax Liability", newV: newR.totalTax, oldV: oldR.totalTax, diff: Math.abs(newR.totalTax - oldR.totalTax) }
        ];

        rows.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${r.param}</td>
                    <td style="${r.param === 'Total Tax Liability' && newR.totalTax <= oldR.totalTax ? 'font-weight:700; color:#10b981;' : ''}">₹${(r.newV || 0).toLocaleString("en-IN")}</td>
                    <td style="${r.param === 'Total Tax Liability' && oldR.totalTax < newR.totalTax ? 'font-weight:700; color:#10b981;' : ''}">₹${(r.oldV || 0).toLocaleString("en-IN")}</td>
                    <td style="font-weight:600;">₹${Math.abs(r.diff || 0).toLocaleString("en-IN")}</td>
                </tr>
            `;
        });
    }

    /**
     * Renders Visual SVG Charts (Income Donut, Regime Comparison, Progressive Slab Bar)
     */
    function renderVisualCharts(data, payload) {
        renderIncomeAllocationChart(data);
        renderRegimeComparisonChart(data, payload);
        renderProgressiveSlabChart(data);
    }

    function renderIncomeAllocationChart(data) {
        const container = document.getElementById("incomeAllocationChart");
        const legend = document.getElementById("incomeLegend");
        if (!container || !legend) return;

        const totalTax = data.totalTax || 0;
        const gross = data.grossIncome || 1;
        const postTax = Math.max(0, gross - totalTax);
        const taxPct = Math.round((totalTax / gross) * 100);
        const postTaxPct = Math.max(0, 100 - taxPct);

        container.innerHTML = `
            <div style="width:100%; height:140px; display:flex; flex-direction:column; justify-content:center;">
                <div style="height:26px; border-radius:6px; overflow:hidden; display:flex; background:#e2e8f0;">
                    <div style="width:${postTaxPct}%; background:#10b981; transition:width 0.4s ease;" title="Post-Tax: ₹${postTax.toLocaleString('en-IN')}"></div>
                    <div style="width:${taxPct}%; background:#6366f1; transition:width 0.4s ease;" title="Tax: ₹${totalTax.toLocaleString('en-IN')}"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#64748b; margin-top:8px;">
                    <span>Post-Tax: <strong>${postTaxPct}%</strong> (₹${postTax.toLocaleString('en-IN')})</span>
                    <span>Tax: <strong>${taxPct}%</strong> (₹${totalTax.toLocaleString('en-IN')})</span>
                </div>
            </div>
        `;

        legend.innerHTML = `
            <div style="display:flex; gap:16px; justify-content:center; font-size:0.75rem; color:#64748b; margin-top:4px;">
                <span style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#10b981; border-radius:2px;"></span> Post-Tax Income</span>
                <span style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#6366f1; border-radius:2px;"></span> Estimated Tax</span>
            </div>
        `;
    }

    function renderRegimeComparisonChart(data, payload) {
        const container = document.getElementById("regimeComparisonChart");
        const legend = document.getElementById("regimeLegend");
        if (!container || !legend) return;

        if (!data.comparison) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:0.85rem;">Single regime calculation active.</div>`;
            return;
        }

        const c = data.comparison;
        const newTax = (c.newRegime ? c.newRegime.totalTax : (c.optionB ? c.optionB.totalTax : data.totalTax)) || 0;
        const oldTax = (c.oldRegime ? c.oldRegime.totalTax : (c.optionA ? c.optionA.totalTax : data.totalTax)) || 0;
        const maxVal = Math.max(newTax, oldTax, 1);

        const newH = Math.max(12, Math.round((newTax / maxVal) * 100));
        const oldH = Math.max(12, Math.round((oldTax / maxVal) * 100));
        const isNewLower = newTax <= oldTax;

        container.innerHTML = `
            <div style="display:flex; height:140px; align-items:flex-end; justify-content:space-around; padding:10px 0; border-bottom:1px solid #e2e8f0;">
                <div style="text-align:center; width:40%;">
                    <div style="font-size:0.78rem; font-weight:700; color:${isNewLower ? '#10b981' : '#64748b'}; margin-bottom:4px;">₹${newTax.toLocaleString('en-IN')}</div>
                    <div style="height:${newH}px; background:${isNewLower ? '#10b981' : '#6366f1'}; border-radius:6px 6px 0 0; transition:height 0.4s ease;"></div>
                    <div style="font-size:0.78rem; font-weight:600; margin-top:6px;">New Regime</div>
                </div>
                <div style="text-align:center; width:40%;">
                    <div style="font-size:0.78rem; font-weight:700; color:${!isNewLower ? '#10b981' : '#64748b'}; margin-bottom:4px;">₹${oldTax.toLocaleString('en-IN')}</div>
                    <div style="height:${oldH}px; background:${!isNewLower ? '#10b981' : '#64748b'}; border-radius:6px 6px 0 0; transition:height 0.4s ease;"></div>
                    <div style="font-size:0.78rem; font-weight:600; margin-top:6px;">Old Regime</div>
                </div>
            </div>
        `;

        legend.innerHTML = `
            <div style="text-align:center; font-size:0.75rem; color:#10b981; font-weight:600; margin-top:6px;">
                ✓ ${isNewLower ? 'New Regime saves ₹' + (oldTax - newTax).toLocaleString('en-IN') : 'Old Regime saves ₹' + (newTax - oldTax).toLocaleString('en-IN')}
            </div>
        `;
    }

    function renderProgressiveSlabChart(data) {
        const container = document.getElementById("slabBreakdownChart");
        if (!container) return;

        const slabs = data.slabBreakdown || (data.comparison?.newRegime?.slabBreakdown) || [];
        if (slabs.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:10px; color:#94a3b8; font-size:0.8rem;">No progressive slab breakdown available for this taxpayer category.</div>`;
            return;
        }

        const colors = ['#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81'];
        container.innerHTML = `
            <div style="display:flex; height:32px; border-radius:8px; overflow:hidden; background:#e2e8f0; margin-bottom:8px;">
                ${slabs.map((s, idx) => {
                    const ratePct = s.ratePercent != null ? s.ratePercent : (s.rate > 1 ? s.rate : Math.round((s.rate || 0) * 100));
                    const taxableInSlab = s.taxableInSlab || 0;
                    return `<div style="flex:${taxableInSlab || 1}; background:${colors[idx % colors.length]}; display:flex; align-items:center; justify-content:center; color:#ffffff; font-size:0.75rem; font-weight:700;" title="${ratePct}% Slab: ₹${taxableInSlab.toLocaleString('en-IN')}">${ratePct}%</div>`;
                }).join('')}
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#64748b; flex-wrap:wrap; gap:4px;">
                ${slabs.map(s => {
                    const ratePct = s.ratePercent != null ? s.ratePercent : (s.rate > 1 ? s.rate : Math.round((s.rate || 0) * 100));
                    const taxAmt = s.taxForSlab != null ? s.taxForSlab : (s.tax || 0);
                    return `<span>${ratePct}%: ₹${taxAmt.toLocaleString('en-IN')}</span>`;
                }).join(' • ')}
            </div>
        `;
    }

    /**
     * Renders Itemized Slab & Special Tax Computation Table
     */
    function renderDetailedSlabTable(data) {
        const tbody = document.getElementById("slabBreakdownTableBody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const slabs = data.slabBreakdown || (data.comparison?.newRegime?.slabBreakdown) || [];
        slabs.forEach(s => {
            const minVal = s.min != null ? s.min : (s.from != null ? s.from : 0);
            const maxVal = s.max != null ? s.max : s.to;
            const ratePct = s.ratePercent != null ? s.ratePercent : (s.rate > 1 ? s.rate : Math.round((s.rate || 0) * 100));
            const taxableAmt = s.taxableInSlab || 0;
            const taxAmt = s.taxForSlab != null ? s.taxForSlab : (s.tax || 0);
            const label = s.slabLabel || (maxVal ? `₹${minVal.toLocaleString('en-IN')} - ₹${maxVal.toLocaleString('en-IN')}` : `Above ₹${minVal.toLocaleString('en-IN')}`);

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:600;">${escapeHtml(label)}</td>
                    <td>${ratePct}%</td>
                    <td>₹${taxableAmt.toLocaleString("en-IN")}</td>
                    <td style="font-weight:700;">₹${taxAmt.toLocaleString("en-IN")}</td>
                </tr>
            `;
        });

        if (data.specialRateTax && data.specialRateTax.totalSpecialTax > 0) {
            const sp = data.specialRateTax;
            if (sp.stcg111A?.tax > 0) {
                tbody.innerHTML += `
                    <tr style="background:#f5f3ff;">
                        <td><strong>STCG Sec 111A (Listed Equity)</strong></td>
                        <td>20%</td>
                        <td>₹${sp.stcg111A.amount.toLocaleString("en-IN")}</td>
                        <td>₹${sp.stcg111A.tax.toLocaleString("en-IN")}</td>
                    </tr>
                `;
            }
            if (sp.ltcg112A?.tax > 0) {
                tbody.innerHTML += `
                    <tr style="background:#f5f3ff;">
                        <td><strong>LTCG Sec 112A (Over ₹1.25L Exemption)</strong></td>
                        <td>12.5%</td>
                        <td>₹${sp.ltcg112A.taxableAmount.toLocaleString("en-IN")}</td>
                        <td>₹${sp.ltcg112A.tax.toLocaleString("en-IN")}</td>
                    </tr>
                `;
            }
            if (sp.ltcg112?.tax > 0) {
                tbody.innerHTML += `
                    <tr style="background:#f5f3ff;">
                        <td><strong>Other LTCG Sec 112</strong></td>
                        <td>12.5%</td>
                        <td>₹${sp.ltcg112.amount.toLocaleString("en-IN")}</td>
                        <td>₹${sp.ltcg112.tax.toLocaleString("en-IN")}</td>
                    </tr>
                `;
            }
        }

        document.getElementById("showTax").textContent = "₹" + (data.taxBeforeRebate || 0).toLocaleString("en-IN");

        const rebateRow = document.getElementById("rebateRow");
        if (data.rebate87A && data.rebate87A.amount > 0) {
            rebateRow.style.display = "table-row";
            document.getElementById("showRebate").textContent = "-₹" + data.rebate87A.amount.toLocaleString("en-IN");
            const badge = document.getElementById("rebateBadge");
            if (badge) {
                badge.style.display = data.rebate87A.hasMarginalRelief ? "inline-block" : "none";
                badge.textContent = "Marginal Relief Active";
            }
        } else {
            rebateRow.style.display = "none";
        }

        const surchargeRow = document.getElementById("surchargeRow");
        if (data.surcharge && data.surcharge.finalSurcharge > 0) {
            surchargeRow.style.display = "table-row";
            document.getElementById("showSurcharge").textContent = "₹" + data.surcharge.finalSurcharge.toLocaleString("en-IN");
            const badge = document.getElementById("surchargeBadge");
            if (badge) {
                badge.style.display = "inline-block";
                badge.textContent = `${data.surcharge.ratePercent}% Surcharge`;
            }
        } else {
            surchargeRow.style.display = "none";
        }

        document.getElementById("showCess").textContent = "₹" + (data.cess || 0).toLocaleString("en-IN");
        document.getElementById("tableTotalTax").textContent = "₹" + (data.totalTax || 0).toLocaleString("en-IN");
    }

    /**
     * Renders Tax Planning Recommendations Grid
     */
    function renderTaxPlanningSection(data, payload) {
        const grid = document.getElementById("recommendationsGrid");
        if (!grid) return;
        grid.innerHTML = "";

        const typeTitle = document.getElementById("taxpayerType")?.options[document.getElementById("taxpayerType").selectedIndex]?.text || payload.taxpayerType;
        const sub = document.getElementById("planningCategorySubtitle");
        if (sub) sub.textContent = `Strategic tax-saving opportunities for: ${typeTitle}`;

        const recs = data.recommendations || [];
        if (recs.length === 0) {
            grid.innerHTML = `
                <div class="empty-recommendations-banner" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; color:#64748b; font-size:0.85rem;">
                    💡 No additional tax investments required for this scenario. Your estimated tax liability is already optimal.
                </div>
            `;
            return;
        }

        recs.forEach(r => {
            const card = document.createElement("div");
            card.className = "recommendation-card";
            card.innerHTML = `
                <div class="rec-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <span class="rec-section-tag" style="font-size:0.75rem; color:#4f46e5; font-weight:700;">${escapeHtml(r.legalProvision || r.regime)}</span>
                        <h4 class="rec-card-title" style="font-size:0.95rem; font-weight:700; color:#0f172a; margin:2px 0;">${escapeHtml(r.title)}</h4>
                    </div>
                    <span class="rec-status-badge badge-eligible" style="font-size:0.72rem; padding:2px 8px; border-radius:4px; font-weight:600; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;">${escapeHtml(r.eligibilityStatus)}</span>
                </div>
                <p class="rec-card-desc" style="font-size:0.82rem; color:#475569; margin-bottom:8px;">${escapeHtml(r.explanation)}</p>
                <div style="background:#f1f5f9; padding:8px 10px; border-radius:6px; font-size:0.78rem; color:#334155; margin-bottom:8px;">
                    <strong>Why it helps:</strong> ${escapeHtml(r.whyItHelps)}
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:#64748b; border-top:1px solid #f1f5f9; padding-top:6px;">
                    <span>Limit: <strong>${r.maxLimit ? '₹' + r.maxLimit.toLocaleString('en-IN') : 'Statutory'}</strong></span>
                    ${r.estimatedTaxSaving > 0 ? `<span style="color:#10b981; font-weight:700;">Est. Saving: ₹${r.estimatedTaxSaving.toLocaleString('en-IN')}</span>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    /**
     * Interactive Tax-Saving Simulator
     */
    async function runTaxSimulation() {
        if (!lastInputPayload) {
            showError("Please calculate your baseline tax first.");
            return;
        }

        const section = document.getElementById("simSectionSelect")?.value || 'sec80CCD2';
        const amount = Number(document.getElementById("simAmountInput")?.value) || 0;

        if (amount <= 0) {
            showError("Please enter a proposed investment amount greater than zero.");
            return;
        }

        try {
            const token = localStorage.getItem('cadesk_token');
            const headers = { "Content-Type": "application/json" };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch("/api/simulate", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    baseInput: lastInputPayload,
                    proposedSection: section,
                    proposedAmount: amount
                })
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                showError(json.message || "Simulation failed.");
                return;
            }

            const sim = json.data;
            const bar = document.getElementById("simResultsBar");
            if (bar) bar.style.display = "block";

            document.getElementById("simProposedAmt").textContent = "₹" + sim.proposedAmount.toLocaleString("en-IN");
            document.getElementById("simAllowedAmt").textContent = "₹" + sim.deductionActuallyAllowed.toLocaleString("en-IN");
            document.getElementById("simRevisedTaxable").textContent = "₹" + (sim.revisedTaxableIncome || 0).toLocaleString("en-IN");
            document.getElementById("simRevisedTax").textContent = "₹" + sim.revisedTax.toLocaleString("en-IN");
            document.getElementById("simTaxSaved").textContent = "₹" + sim.taxSaved.toLocaleString("en-IN");
            document.getElementById("simNetOutflow").textContent = "₹" + (sim.netCashOutflow || 0).toLocaleString("en-IN");
            document.getElementById("simEfficiency").textContent = sim.efficiencyPercentage.toFixed(1) + "%";

            const expText = document.getElementById("simExplanationText");
            if (expText) expText.textContent = sim.explanation || "";

        } catch (e) {
            console.error("Simulation error:", e);
            showError("Simulation request failed.");
        }
    }

    function resetTaxSimulation() {
        if (document.getElementById("simAmountInput")) document.getElementById("simAmountInput").value = "";
        const bar = document.getElementById("simResultsBar");
        if (bar) bar.style.display = "none";
    }

    function renderAssumptions(data, payload) {
        const list = document.getElementById("assumptionsList");
        if (!list) return;
        list.innerHTML = "";

        const items = [
            `Assessment Year: ${payload.financialYear === '2026-2027' ? 'AY 2027-28' : 'AY 2026-27'} (${payload.financialYear})`,
            `Standard deduction of ₹${(data.standardDeduction || 75000).toLocaleString('en-IN')} applied automatically on salary income`,
            `Health & Education Cess calculated at 4% across all heads per Section 115BAA/Income-tax Act`,
            `Rounding of taxable income to nearest multiple of ₹10 per Section 288A and final tax liability per Section 288B`
        ];

        items.forEach(it => {
            const li = document.createElement("li");
            li.textContent = it;
            list.appendChild(li);
        });
    }

    /**
     * Presets Modal and Scenarios
     */
    function togglePresetsModal() {
        const modal = document.getElementById("presetsModal");
        if (!modal) return;
        modal.style.display = (modal.style.display === "none") ? "flex" : "none";
    }

    function handleModalBackdropClick(e) {
        if (e.target.id === "presetsModal") {
            togglePresetsModal();
        }
    }

    function loadPreset(key) {
        togglePresetsModal();
        resetForm();

        const typeEl = document.getElementById("taxpayerType");
        const fyEl = document.getElementById("financialYear");

        if (key === 'salaried12L') {
            typeEl.value = 'individual';
            fyEl.value = '2026-2027';
            document.getElementById('name').value = 'Rohan Deshmukh';
            document.getElementById('salaryIncome').value = 1275000;
        } else if (key === 'salariedMarginal') {
            typeEl.value = 'individual';
            fyEl.value = '2026-2027';
            document.getElementById('name').value = 'Priya Nair';
            document.getElementById('salaryIncome').value = 1285000;
        } else if (key === 'individualInvestments') {
            typeEl.value = 'individual';
            document.getElementById('name').value = 'Arun Mehta';
            document.getElementById('salaryIncome').value = 1600000;
            document.getElementById('sec80C').value = 150000;
            document.getElementById('sec80CCD1B').value = 50000;
            document.getElementById('sec80D').value = 50000;
            document.getElementById('sec24b').value = 200000;
        } else if (key === 'capitalGainsEarner') {
            typeEl.value = 'individual';
            document.getElementById('name').value = 'Kunal Bansal';
            document.getElementById('salaryIncome').value = 1500000;
            document.getElementById('stcg111A').value = 200000;
            document.getElementById('ltcg112A').value = 300000;
        } else if (key === 'hufBusiness') {
            typeEl.value = 'huf';
            document.getElementById('name').value = 'Mehta & Sons HUF';
            document.getElementById('businessIncome').value = 1000000;
        } else if (key === 'domesticCompany') {
            typeEl.value = 'domestic_company';
            document.getElementById('name').value = 'TechnoSoft Private Limited';
            document.getElementById('businessIncome').value = 10000000;
            if (document.getElementById('companyOption')) document.getElementById('companyOption').value = 'sec_115baa_22';
        } else if (key === 'firmLLP') {
            typeEl.value = 'firm_llp';
            document.getElementById('name').value = 'Apex Associates LLP';
            document.getElementById('businessIncome').value = 15000000;
        }

        handleYearChange();
        handleTaxpayerTypeChange();
        updateGrossIncomeDisplay();
        calculateTax();
    }

    function resetForm() {
        document.getElementById("taxForm")?.reset();
        clearError();
        handleTaxpayerTypeChange();
        updateGrossIncomeDisplay();
        const emptyState = document.getElementById("emptyState");
        const activeResults = document.getElementById("activeResults");
        if (emptyState) emptyState.style.display = "block";
        if (activeResults) activeResults.style.display = "none";
        lastCalculationResult = null;
        lastInputPayload = null;
    }

    function showError(msg) {
        const box = document.getElementById("formErrorAlert");
        const text = document.getElementById("formErrorMessage");
        if (box && text) {
            text.textContent = msg;
            box.style.display = "flex";
        }
    }

    function clearError() {
        const box = document.getElementById("formErrorAlert");
        if (box) box.style.display = "none";
    }

    function printTaxReport() {
        window.print();
    }

    function downloadTaxReport() {
        window.print();
    }

    /**
     * CA DESK INTEGRATION: Save calculation against client with versioning
     */
    async function saveCurrentCalculation() {
        if (!lastCalculationResult || !lastInputPayload) {
            if (window.showAppToast) window.showAppToast('Please run the tax calculation first before saving.', 'error');
            else alert('Please run the tax calculation first before saving.');
            return;
        }

        let client = currentActiveClient;
        if (!client && window.getState && window.getState().activeClient) {
            client = window.getState().activeClient;
            currentActiveClient = client;
        }

        if (!client) {
            if (window.showAppToast) window.showAppToast('Please select or open a client profile before saving this calculation.', 'error');
            else alert('Please select or open a client profile before saving this calculation.');
            return;
        }

        // Open status selection modal
        const bodyHtml = `
            <div class="form-group">
                <label class="form-label">Client Name</label>
                <input type="text" class="form-input" value="${escapeHtml(client.name)}" disabled>
            </div>
            <div class="form-group">
                <label class="form-label">Review Status</label>
                <select id="calc-save-status-select" class="form-select">
                    <option value="Under Review" selected>Under Review (Submit for CA Review)</option>
                    <option value="Approved">Approved (CA Verified)</option>
                    <option value="Calculated">Calculated</option>
                    <option value="Draft">Draft</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Tax Assessment Notes</label>
                <textarea id="calc-save-notes-text" class="form-textarea" rows="3" placeholder="Notes on verified documents, regime choice, or tax-saving advice..."></textarea>
            </div>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="window.closeAppModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-save-calc-version">Save Versioned Record</button>
        `;

        if (window.openAppModal) {
            window.openAppModal(`Save Calculation: ${client.name}`, bodyHtml, footerHtml);
            document.getElementById('btn-confirm-save-calc-version').onclick = async () => {
                const status = document.getElementById('calc-save-status-select').value;
                const notes = document.getElementById('calc-save-notes-text').value;

                try {
                    const res = await window.API.saveCalculation({
                        clientId: client.id,
                        financialYear: lastInputPayload.financialYear,
                        taxpayerType: lastInputPayload.taxpayerType,
                        inputs: lastInputPayload,
                        results: lastCalculationResult,
                        regimeSelected: lastCalculationResult.comparison?.lowerRegime || lastCalculationResult.regime || 'new',
                        status,
                        notes
                    });

                    window.closeAppModal();
                    if (window.showAppToast) {
                        window.showAppToast(`Saved calculation as Version ${res.data.version} for ${client.name}!`);
                    }
                    if (window.switchClientTab) {
                        window.switchClientTab('tax-history', client.id);
                    }
                } catch (err) {
                    alert('Save failed: ' + err.message);
                }
            };
        }
    }

    // Export module
    window.TaxWiseCore = {
        initTaxWise,
        getTaxWiseHTML,
        handleYearChange,
        handleTaxpayerTypeChange,
        handleAgeChange,
        handleResidentialChange,
        handleHousePropertyTypeChange,
        handleCompanyOptionChange,
        handleCooperativeOptionChange,
        toggleDeductionsAccordion,
        handleRegimeChoiceChange,
        updateGrossIncomeDisplay,
        calculateTax,
        runTaxSimulation,
        resetTaxSimulation,
        togglePresetsModal,
        handleModalBackdropClick,
        loadPreset,
        resetForm,
        printTaxReport,
        downloadTaxReport,
        saveCurrentCalculation,
        populateFormFromData,
        displayCalculationResults,
        restoreSavedCalculation
    };

})(window);
