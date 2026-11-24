/**
 * TaxWise India - Client Script
 * Handles dynamic form rendering, multi-taxpayer categories, multi-head income calculations,
 * interactive tax-saving simulator, visualizations, and downloadable reports.
 */

let lastCalculationResult = null;
let lastInputPayload = null;

document.addEventListener("DOMContentLoaded", () => {
    handleYearChange();
    handleTaxpayerTypeChange();
    updateGrossIncomeDisplay();
});

/**
 * Updates UI hints based on selected Financial Year.
 */
function handleYearChange() {
    const fy = document.getElementById("financialYear").value;
    const badgeText = document.getElementById("yearBadgeText");
    const bannerText = document.getElementById("yearBannerText");
    const stdBadge = document.getElementById("stdDeductionBadge");

    if (fy === "2026-2027" || fy === "2025-2026") {
        badgeText.textContent = "Budget 2025 / 2026 Active";
        bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹12 Lakh taxable income</strong> (₹12.75L with ₹75k standard deduction). STCG Sec 111A is 20%, and LTCG Sec 112A is 12.5% over ₹1.25L.";
        stdBadge.textContent = "Std Ded: ₹75,000 Auto-Applied";
    } else if (fy === "2024-2025") {
        badgeText.textContent = "Finance (No. 2) Act 2024 Slabs";
        bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹7.75 Lakh</strong> (₹7L taxable income + ₹75,000 standard deduction). STCG 20%, LTCG 12.5%.";
        stdBadge.textContent = "Std Ded: ₹75,000 Auto-Applied";
    } else {
        badgeText.textContent = "Budget 2023 Rules";
        bannerText.innerHTML = "Under New Regime, resident individuals pay <strong>₹0 tax up to ₹7.5 Lakh</strong> (₹7L taxable income + ₹50,000 standard deduction).";
        stdBadge.textContent = "Std Ded: ₹50,000 Auto-Applied";
    }

    if (lastCalculationResult) {
        calculateTax();
    }
}

/**
 * Handles Taxpayer Type / Assessee changes and updates form field visibility.
 */
function handleTaxpayerTypeChange() {
    const type = document.getElementById("taxpayerType").value;
    const individualFields = document.getElementById("individualFieldsGroup");
    const domesticCompanyFields = document.getElementById("domesticCompanyFieldsGroup");
    const cooperativeFields = document.getElementById("cooperativeFieldsGroup");
    const salaryHead = document.getElementById("salaryHeadGroup");
    const deductionsSection = document.getElementById("deductionsSection");
    const regimeSection = document.getElementById("regimeSelectionSection");
    const hint = document.getElementById("taxpayerTypeHint");

    // Reset visibility
    individualFields.style.display = "none";
    domesticCompanyFields.style.display = "none";
    cooperativeFields.style.display = "none";
    salaryHead.style.display = "none";
    deductionsSection.style.display = "none";
    regimeSection.style.display = "none";

    if (type === "individual") {
        individualFields.style.display = "block";
        salaryHead.style.display = "block";
        deductionsSection.style.display = "block";
        regimeSection.style.display = "block";
        hint.textContent = "Progressive slabs, Section 87A rebate, and standard deduction apply to resident individuals.";
    } else if (type === "huf") {
        deductionsSection.style.display = "block";
        regimeSection.style.display = "block";
        hint.textContent = "Assessed under progressive slabs. Note: Section 87A rebate does NOT apply to HUF.";
    } else if (type === "aop_boi_ajp") {
        regimeSection.style.display = "block";
        hint.textContent = "Covered under Section 115BAC New Regime or Old Regime slabs.";
    } else if (type === "domestic_company") {
        domesticCompanyFields.style.display = "block";
        hint.textContent = "Choose between standard corporate rates (25%/30%) or concessional Section 115BAA (22%).";
    } else if (type === "foreign_company") {
        hint.textContent = "Statutory corporate tax rate is 35% under Finance (No. 2) Act 2024.";
    } else if (type === "firm_llp") {
        hint.textContent = "Flat 30% tax rate applies. Surcharge of 12% applies if income exceeds ₹1 Crore.";
    } else if (type === "cooperative_society") {
        cooperativeFields.style.display = "block";
        hint.textContent = "Choose between regular progressive slabs (10%, 20%, 30%) or Section 115BAD (22%).";
    } else if (type === "local_authority") {
        hint.textContent = "Flat 30% tax rate applies on taxable income.";
    }

    updateGrossIncomeDisplay();
}

/**
 * Handles age input and updates age category badge.
 */
function handleAgeChange() {
    const age = Number(document.getElementById("age").value) || 30;
    const tag = document.getElementById("ageCategoryTag");

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
    const status = document.getElementById("residentialStatus").value;
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
    const type = document.getElementById("housePropertyType").value;
    const letOutGroup = document.getElementById("letOutFieldsGroup");

    if (type === "let_out") {
        letOutGroup.style.display = "block";
    } else {
        letOutGroup.style.display = "none";
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
    document.getElementById("regime").value = val;
    document.querySelectorAll(".regime-radio-card").forEach(c => c.classList.remove("active"));

    if (val === "compare") document.getElementById("regimeCardCompare").classList.add("active");
    if (val === "new") document.getElementById("regimeCardNew").classList.add("active");
    if (val === "old") document.getElementById("regimeCardOld").classList.add("active");

    if (lastCalculationResult) calculateTax();
}

/**
 * Recalculates and displays combined gross income across all heads.
 */
function updateGrossIncomeDisplay() {
    const type = document.getElementById("taxpayerType").value;
    let salary = (type === "individual") ? (Number(document.getElementById("salaryIncome").value) || 0) : 0;
    let business = Number(document.getElementById("businessIncome").value) || 0;
    let rent = Number(document.getElementById("housePropertyGrossRent").value) || 0;
    let stcg111A = Number(document.getElementById("stcg111A").value) || 0;
    let stcgOther = Number(document.getElementById("stcgOther").value) || 0;
    let ltcg112A = Number(document.getElementById("ltcg112A").value) || 0;
    let ltcg112 = Number(document.getElementById("ltcg112").value) || 0;
    let interest = Number(document.getElementById("interestIncome").value) || 0;
    let dividend = Number(document.getElementById("dividendIncome").value) || 0;
    let other = Number(document.getElementById("otherIncome").value) || 0;

    const totalGross = salary + business + rent + stcg111A + stcgOther + ltcg112A + ltcg112 + interest + dividend + other;
    document.getElementById("grossIncomeDisplay").textContent = "₹" + totalGross.toLocaleString("en-IN");
}

/**
 * Collects input payload from the form.
 */
function getFormPayload() {
    const taxpayerType = document.getElementById("taxpayerType").value;
    const financialYear = document.getElementById("financialYear").value;
    const name = document.getElementById("name").value.trim();
    const age = Number(document.getElementById("age").value) || 30;
    const residentialStatus = document.getElementById("residentialStatus").value;
    const regime = document.getElementById("regime").value;
    const companyOption = document.getElementById("companyOption").value;
    const cooperativeOption = document.getElementById("cooperativeOption").value;

    const salaryIncome = (taxpayerType === "individual") ? (Number(document.getElementById("salaryIncome").value) || 0) : 0;
    const businessIncome = Number(document.getElementById("businessIncome").value) || 0;
    const housePropertyType = document.getElementById("housePropertyType").value;
    const housePropertyGrossRent = Number(document.getElementById("housePropertyGrossRent").value) || 0;
    const housePropertyMunicipalTaxes = Number(document.getElementById("housePropertyMunicipalTaxes").value) || 0;
    const sec24b = Number(document.getElementById("sec24b").value) || 0;

    const stcg111A = Number(document.getElementById("stcg111A").value) || 0;
    const stcgOther = Number(document.getElementById("stcgOther").value) || 0;
    const ltcg112A = Number(document.getElementById("ltcg112A").value) || 0;
    const ltcg112 = Number(document.getElementById("ltcg112").value) || 0;

    const interestIncome = Number(document.getElementById("interestIncome").value) || 0;
    const dividendIncome = Number(document.getElementById("dividendIncome").value) || 0;
    const otherIncome = Number(document.getElementById("otherIncome").value) || 0;

    const sec80C = Number(document.getElementById("sec80C").value) || 0;
    const sec80CCD1B = Number(document.getElementById("sec80CCD1B").value) || 0;
    const sec80D = Number(document.getElementById("sec80D").value) || 0;
    const sec80CCD2 = Number(document.getElementById("sec80CCD2").value) || 0;
    const sec80E = Number(document.getElementById("sec80E").value) || 0;
    const otherDeductions = Number(document.getElementById("otherDeductions").value) || 0;

    return {
        taxpayerType,
        financialYear,
        name,
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
        sec24b,
        sec80CCD2,
        sec80E,
        otherDeductions
    };
}

/**
 * Main tax calculation triggered by form submission.
 */
async function calculateTax() {
    clearError();
    const payload = getFormPayload();
    lastInputPayload = payload;

    const btn = document.getElementById("calculateBtn");
    const spinner = document.getElementById("btnSpinner");
    btn.disabled = true;
    spinner.style.display = "inline-block";

    try {
        const response = await fetch("/api/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await response.json();

        if (!response.ok || !json.success) {
            showError(json.message || "Tax calculation failed. Please check your inputs.");
            return;
        }

        const data = json.data;
        lastCalculationResult = data;

        // Render results dashboard
        renderResultsDashboard(data, payload);

        // Render recommendations and simulator
        renderTaxPlanningSection(data, payload);

    } catch (err) {
        console.error("Calculation fetch error:", err);
        showError("Failed to connect to the tax calculation server. Please try again.");
    } finally {
        btn.disabled = false;
        spinner.style.display = "none";
    }
}

/**
 * Renders the primary results dashboard.
 */
function renderResultsDashboard(data, payload) {
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("activeResults").style.display = "block";

    // Personalized greeting
    const titleText = payload.name ? `Tax Statement for ${escapeHtml(payload.name)}` : `Tax Statement (${data.regimeLabel})`;
    document.getElementById("welcome").textContent = titleText;
    document.getElementById("calcTimestamp").textContent = `Calculated on: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;

    // Metric cards
    document.getElementById("showIncome").textContent = "₹" + data.grossIncome.toLocaleString("en-IN");
    document.getElementById("showDeduction").textContent = "₹" + (data.totalEligibleDeductions || 0).toLocaleString("en-IN");
    document.getElementById("showTaxable").textContent = "₹" + data.taxableIncome.toLocaleString("en-IN");
    document.getElementById("totalTax").textContent = "₹" + data.totalTax.toLocaleString("en-IN");
    document.getElementById("monthlyTax").textContent = "₹" + (data.monthlyTax || 0).toLocaleString("en-IN");
    document.getElementById("effectiveTaxRate").textContent = (data.effectiveTaxRate || 0).toFixed(2) + "%";
    document.getElementById("postTaxIncome").textContent = "₹" + (data.postTaxIncome || 0).toLocaleString("en-IN");

    // Regime recommendation card
    renderRecommendationHero(data);

    // Multi-head income breakdown table
    renderHeadWiseTable(data);

    // Side-by-side comparison table
    renderComparisonTable(data);

    // Slabs & special tax table
    renderSlabsBreakdownTable(data);

    // Visual Charts (SVG)
    renderIncomeAllocationChart(data);
    renderRegimeComparisonChart(data);
    renderSlabChart(data);

    // Assumptions
    renderAssumptionsList(data);

    // Scroll smoothly to results
    document.getElementById("resultBox").scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Renders the recommendation hero banner.
 */
function renderRecommendationHero(data) {
    const hero = document.getElementById("recommendationHero");
    const title = document.getElementById("recTitle");
    const explanation = document.getElementById("recExplanation");
    const icon = document.getElementById("recIcon");

    if (data.comparison) {
        hero.style.display = "flex";
        const comp = data.comparison;
        if (comp.lowerRegime === "new") {
            title.textContent = "New Tax Regime yields lower estimated tax";
            explanation.textContent = comp.recommendation;
            icon.textContent = "✓";
            icon.className = "rec-icon rec-icon-new";
        } else if (comp.lowerRegime === "old") {
            title.textContent = "Old Tax Regime yields lower estimated tax";
            explanation.textContent = comp.recommendation;
            icon.textContent = "★";
            icon.className = "rec-icon rec-icon-old";
        } else {
            title.textContent = "Both regimes yield equal estimated tax";
            explanation.textContent = comp.recommendation;
            icon.textContent = "⚖";
            icon.className = "rec-icon";
        }
    } else {
        hero.style.display = "none";
    }
}

/**
 * Renders 5-head income breakdown.
 */
function renderHeadWiseTable(data) {
    const tbody = document.getElementById("headWiseTableBody");
    tbody.innerHTML = "";

    const heads = data.headWiseIncome || {};
    const rows = [
        { name: "Salary Income", gross: heads.salary || 0, deduction: data.deductionBreakdown ? data.deductionBreakdown.standardDeduction : 0 },
        { name: "Business / Profession", gross: heads.business || 0, deduction: 0 },
        { name: "House Property", gross: heads.houseProperty || 0, deduction: 0 },
        { name: "Capital Gains", gross: heads.capitalGains || 0, deduction: 0 },
        { name: "Other Sources (Interest & Dividends)", gross: heads.otherSources || 0, deduction: 0 }
    ];

    rows.forEach(r => {
        if (r.gross > 0 || r.deduction > 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td>₹${r.gross.toLocaleString("en-IN")}</td>
                <td>${r.deduction > 0 ? "-₹" + r.deduction.toLocaleString("en-IN") : "₹0"}</td>
                <td><strong>₹${Math.max(0, r.gross - r.deduction).toLocaleString("en-IN")}</strong></td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (tbody.children.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #888;">No income recorded.</td></tr>`;
    }
}

/**
 * Renders the Old vs New regime direct comparison table.
 */
function renderComparisonTable(data) {
    const card = document.getElementById("comparisonCard");
    const tbody = document.getElementById("comparisonTableBody");

    if (!data.comparison || (!data.comparison.newRegime && !data.comparison.optionA)) {
        card.style.display = "none";
        return;
    }

    card.style.display = "block";
    tbody.innerHTML = "";

    const comp = data.comparison;
    const resA = comp.newRegime || comp.optionB;
    const resB = comp.oldRegime || comp.optionA;

    document.getElementById("compColNew").textContent = resA.regimeLabel;
    document.getElementById("compColOld").textContent = resB.regimeLabel;

    const rows = [
        { label: "Gross Income", valA: resA.grossIncome, valB: resB.grossIncome },
        { label: "Eligible Deductions", valA: resA.totalEligibleDeductions, valB: resB.totalEligibleDeductions },
        { label: "Taxable Income", valA: resA.taxableIncome, valB: resB.taxableIncome },
        { label: "Tax before Rebate", valA: resA.taxBeforeRebate, valB: resB.taxBeforeRebate },
        { label: "Section 87A Rebate", valA: resA.rebate87A ? resA.rebate87A.amount : 0, valB: resB.rebate87A ? resB.rebate87A.amount : 0 },
        { label: "Surcharge", valA: resA.surcharge ? resA.surcharge.finalSurcharge : 0, valB: resB.surcharge ? resB.surcharge.finalSurcharge : 0 },
        { label: "Health & Education Cess (4%)", valA: resA.cess, valB: resB.cess },
        { label: "Final Tax Liability", valA: resA.totalTax, valB: resB.totalTax, isHighlight: true }
    ];

    rows.forEach(r => {
        const tr = document.createElement("tr");
        const diff = Math.abs(r.valA - r.valB);
        let diffText = "₹0";

        if (r.valA < r.valB) {
            diffText = `<span class="text-green">${resA.regimeLabel} saves ₹${diff.toLocaleString("en-IN")}</span>`;
        } else if (r.valB < r.valA) {
            diffText = `<span class="text-green">${resB.regimeLabel} saves ₹${diff.toLocaleString("en-IN")}</span>`;
        } else {
            diffText = `<span class="text-muted">Equal</span>`;
        }

        tr.innerHTML = `
            <td><strong>${escapeHtml(r.label)}</strong></td>
            <td class="${r.isHighlight ? 'text-bold' : ''}">₹${r.valA.toLocaleString("en-IN")}</td>
            <td class="${r.isHighlight ? 'text-bold' : ''}">₹${r.valB.toLocaleString("en-IN")}</td>
            <td>${diffText}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Renders the itemized slab breakdown table.
 */
function renderSlabsBreakdownTable(data) {
    const tbody = document.getElementById("slabBreakdownTableBody");
    tbody.innerHTML = "";

    if (Array.isArray(data.slabBreakdown)) {
        data.slabBreakdown.forEach(s => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(s.slabLabel)}</td>
                <td>${s.ratePercent}%</td>
                <td>₹${s.taxableInSlab.toLocaleString("en-IN")}</td>
                <td>₹${s.taxForSlab.toLocaleString("en-IN")}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Special rate capital gains breakdown
    if (data.specialRateTax && data.specialRateTax.totalSpecialTax > 0) {
        const sp = data.specialRateTax;
        if (sp.stcg111A.tax > 0) {
            tbody.innerHTML += `
                <tr class="special-rate-row">
                    <td><strong>STCG Sec 111A (Listed Equity)</strong></td>
                    <td>20%</td>
                    <td>₹${sp.stcg111A.amount.toLocaleString("en-IN")}</td>
                    <td>₹${sp.stcg111A.tax.toLocaleString("en-IN")}</td>
                </tr>
            `;
        }
        if (sp.ltcg112A.tax > 0) {
            tbody.innerHTML += `
                <tr class="special-rate-row">
                    <td><strong>LTCG Sec 112A (Over ₹1.25L Exemption)</strong></td>
                    <td>12.5%</td>
                    <td>₹${sp.ltcg112A.taxableAmount.toLocaleString("en-IN")}</td>
                    <td>₹${sp.ltcg112A.tax.toLocaleString("en-IN")}</td>
                </tr>
            `;
        }
        if (sp.ltcg112.tax > 0) {
            tbody.innerHTML += `
                <tr class="special-rate-row">
                    <td><strong>Other LTCG Sec 112</strong></td>
                    <td>12.5%</td>
                    <td>₹${sp.ltcg112.amount.toLocaleString("en-IN")}</td>
                    <td>₹${sp.ltcg112.tax.toLocaleString("en-IN")}</td>
                </tr>
            `;
        }
    }

    // Footers
    document.getElementById("showTax").textContent = "₹" + data.taxBeforeRebate.toLocaleString("en-IN");

    const rebateRow = document.getElementById("rebateRow");
    if (data.rebate87A && data.rebate87A.applicable && data.rebate87A.amount > 0) {
        rebateRow.style.display = "table-row";
        document.getElementById("showRebate").textContent = "-₹" + data.rebate87A.amount.toLocaleString("en-IN");
        const rebateBadge = document.getElementById("rebateBadge");
        if (data.rebate87A.hasMarginalRelief) {
            rebateBadge.style.display = "inline-block";
            rebateBadge.textContent = "Marginal Relief Active";
        } else {
            rebateBadge.style.display = "none";
        }
    } else {
        rebateRow.style.display = "none";
    }

    const surchargeRow = document.getElementById("surchargeRow");
    if (data.surcharge && data.surcharge.finalSurcharge > 0) {
        surchargeRow.style.display = "table-row";
        document.getElementById("showSurcharge").textContent = "₹" + data.surcharge.finalSurcharge.toLocaleString("en-IN");
        const surchBadge = document.getElementById("surchargeBadge");
        surchBadge.style.display = "inline-block";
        surchBadge.textContent = `${data.surcharge.ratePercent}% Surcharge`;
    } else {
        surchargeRow.style.display = "none";
    }

    document.getElementById("showCess").textContent = "₹" + data.cess.toLocaleString("en-IN");
    document.getElementById("tableTotalTax").textContent = "₹" + data.totalTax.toLocaleString("en-IN");
}

/**
 * DEDICATED FEATURE: Renders the Tax Planning & Tax-Saving Recommendations
 */
function renderTaxPlanningSection(data, payload) {
    const grid = document.getElementById("recommendationsGrid");
    grid.innerHTML = "";

    const typeTitle = document.getElementById("taxpayerType").options[document.getElementById("taxpayerType").selectedIndex].text;
    document.getElementById("planningCategorySubtitle").textContent = `Strategic tax-saving opportunities for: ${typeTitle}`;

    const recs = data.recommendations || [];

    if (recs.length === 0) {
        let emptyMsg = "No additional tax-saving deductions are required for this income scenario.";
        if (data.totalTax === 0) {
            emptyMsg = `Your estimated tax liability is already ₹0 under the ${escapeHtml(data.regimeLabel)} (benefit of Section 87A rebate & basic exemption). No additional tax investments are needed to reduce your tax for this financial year.`;
        } else if (payload.regime === "new") {
            emptyMsg = "The New Tax Regime (Section 115BAC) offers lower slab rates in exchange for forgoing traditional Chapter VI-A deductions (except Employer NPS 80CCD(2)). If you have substantial investments in 80C, 80D, or housing loan interest, evaluate switching to the Old Regime.";
        }
        grid.innerHTML = `
            <div class="empty-recommendations-banner">
                <div class="rec-empty-icon">💡</div>
                <div class="rec-empty-content">
                    <h4 class="rec-empty-title">Tax Planning Summary</h4>
                    <p class="rec-empty-desc">${emptyMsg}</p>
                </div>
            </div>
        `;
        return;
    }

    recs.forEach(r => {
        const card = document.createElement("div");
        card.className = "recommendation-card";

        // Map status to badge class
        let badgeClass = "badge-eligible";
        if (r.eligibilityStatus === "Not Available Under Selected Regime") badgeClass = "badge-regime-only";
        else if (r.eligibilityStatus === "Limit Reached") badgeClass = "badge-claimed";
        else if (r.eligibilityStatus === "More Information Required") badgeClass = "badge-inforeq";
        else if (r.eligibilityStatus === "Requires Professional Review") badgeClass = "badge-review";

        card.innerHTML = `
            <div class="rec-card-header">
                <div>
                    <span class="rec-section-tag">${escapeHtml(r.legalProvision || r.regime)}</span>
                    <h4 class="rec-card-title">${escapeHtml(r.title)}</h4>
                </div>
                <span class="rec-status-badge ${badgeClass}">${escapeHtml(r.eligibilityStatus)}</span>
            </div>

            <p class="rec-card-desc">${escapeHtml(r.explanation)}</p>

            <div class="rec-why-box">
                <span class="why-label">Why it helps this taxpayer:</span>
                <p class="why-text">${escapeHtml(r.whyItHelps)}</p>
            </div>

            <div class="rec-meta-grid">
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Assessee Category:</span>
                    <span class="rec-meta-val">${escapeHtml(r.taxpayerCategory)}</span>
                </div>
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Statutory Limit:</span>
                    <span class="rec-meta-val">${r.maxLimit ? "₹" + r.maxLimit.toLocaleString("en-IN") : (r.maxLimitPercentage ? r.maxLimitPercentage + "% limit" : "No Upper Cap")}</span>
                </div>
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Claimed by You:</span>
                    <span class="rec-meta-val">₹${(r.amountClaimed || 0).toLocaleString("en-IN")}</span>
                </div>
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Remaining Headroom:</span>
                    <span class="rec-meta-val ${r.remainingEligible > 0 ? 'text-green' : ''}">${r.remainingEligible != null ? "₹" + r.remainingEligible.toLocaleString("en-IN") : "Eligible"}</span>
                </div>
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Potential Tax Saved:</span>
                    <span class="rec-meta-val text-bold-purple">${r.estimatedTaxSaving > 0 ? "Up to ₹" + r.estimatedTaxSaving.toLocaleString("en-IN") : (r.eligibilityStatus === 'Not Available Under Selected Regime' ? "Disallowed in New Regime" : "Evaluated in computation")}</span>
                </div>
                <div class="rec-meta-item">
                    <span class="rec-meta-lbl">Tax Year &amp; Regime:</span>
                    <span class="rec-meta-val">${escapeHtml(r.taxYear)} • ${escapeHtml(r.regime)}</span>
                </div>
            </div>

            <div class="rec-footer-details">
                <div class="rec-lockin"><strong>Lock-in &amp; Liquidity:</strong> ${escapeHtml(r.riskLockIn)}</div>
                <div class="rec-docs"><strong>Documents Required:</strong> ${escapeHtml(r.documentsRequired)}</div>
                <div class="rec-action"><strong>Next Action:</strong> ${escapeHtml(r.nextAction)}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * INTERACTIVE SIMULATOR: Runs live simulation on proposed additional investment.
 */
async function runTaxSimulation() {
    if (!lastInputPayload) {
        showError("Please calculate your baseline tax first.");
        return;
    }

    const section = document.getElementById("simSectionSelect").value;
    const amount = Number(document.getElementById("simAmountInput").value) || 0;

    if (amount <= 0) {
        showError("Please enter a positive proposed investment amount to simulate.");
        return;
    }

    try {
        const res = await fetch("/api/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
        bar.style.display = "block";

        document.getElementById("simProposedAmt").textContent = "₹" + sim.proposedAmount.toLocaleString("en-IN");
        document.getElementById("simAllowedAmt").textContent = "₹" + sim.deductionActuallyAllowed.toLocaleString("en-IN");
        document.getElementById("simRevisedTaxable").textContent = "₹" + (sim.revisedTaxableIncome || 0).toLocaleString("en-IN");
        document.getElementById("simRevisedTax").textContent = "₹" + sim.revisedTax.toLocaleString("en-IN");
        document.getElementById("simTaxSaved").textContent = "₹" + sim.taxSaved.toLocaleString("en-IN");
        document.getElementById("simNetOutflow").textContent = "₹" + (sim.netCashOutflow || 0).toLocaleString("en-IN");
        document.getElementById("simEfficiency").textContent = sim.efficiencyPercentage.toFixed(1) + "%";

        const expBox = document.getElementById("simExplanationBox");
        const expText = document.getElementById("simExplanationText");
        expText.textContent = sim.explanation || "";

        if (!sim.isRegimeEligible) {
            expBox.className = "sim-explanation-box sim-warning";
        } else {
            expBox.className = "sim-explanation-box sim-success";
        }

    } catch (e) {
        console.error("Simulation error:", e);
        showError("Error connecting to simulation engine.");
    }
}

/**
 * Resets the interactive simulator.
 */
function resetTaxSimulation() {
    document.getElementById("simAmountInput").value = "";
    document.getElementById("simSectionSelect").selectedIndex = 0;
    const bar = document.getElementById("simResultsBar");
    if (bar) bar.style.display = "none";
}

/**
 * Formats a number to compact Indian rupees string.
 */
function formatCompactRupees(num) {
    if (!num) return "₹0";
    if (num >= 10000000) return "₹" + (num / 10000000).toFixed(2) + " Cr";
    if (num >= 100000) return "₹" + (num / 100000).toFixed(2) + " L";
    if (num >= 1000) return "₹" + (num / 1000).toFixed(1) + " k";
    return "₹" + Math.round(num).toLocaleString("en-IN");
}

/**
 * Renders SVG Donut Chart for Income Allocation across actual income heads.
 */
function renderIncomeAllocationChart(data) {
    const container = document.getElementById("incomeAllocationChart");
    const legend = document.getElementById("incomeLegend");

    const p = lastInputPayload || {};
    const heads = data.headWiseIncome || {};

    const salary = heads.salary || (p.salaryIncome || 0);
    const business = heads.business || (p.businessIncome || 0);
    const houseProp = Math.max(0, heads.houseProperty || (p.housePropertyGrossRent || 0));
    const stcg = (p.stcg111A || 0) + (p.stcgOther || 0);
    const ltcg = (p.ltcg112A || 0) + (p.ltcg112 || 0);
    const interestDividends = (p.interestIncome || 0) + (p.dividendIncome || 0);
    const otherSources = (p.otherIncome || 0);

    const categories = [
        { name: "Salary", amount: salary, color: "#4f46e5" },
        { name: "Business / Profession", amount: business, color: "#8b5cf6" },
        { name: "House Property", amount: houseProp, color: "#0ea5e9" },
        { name: "Short-Term Capital Gains", amount: stcg, color: "#f59e0b" },
        { name: "Long-Term Capital Gains", amount: ltcg, color: "#10b981" },
        { name: "Interest & Dividends", amount: interestDividends, color: "#06b6d4" },
        { name: "Other Sources", amount: otherSources, color: "#ec4899" }
    ];

    const activeSlices = categories.filter(c => c.amount > 0);
    const totalGross = activeSlices.reduce((sum, c) => sum + c.amount, 0);

    // Empty state if total gross income is 0
    if (totalGross === 0) {
        container.innerHTML = `
            <div class="chart-empty-donut">
                <svg viewBox="0 0 200 200" class="donut-svg" width="190" height="190">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8f0" stroke-width="22" stroke-dasharray="6 6"></circle>
                    <text x="100" y="96" text-anchor="middle" font-size="16" font-weight="700" fill="#64748b">₹0</text>
                    <text x="100" y="114" text-anchor="middle" font-size="11" font-weight="500" fill="#94a3b8">No Income</text>
                </svg>
            </div>
        `;
        legend.innerHTML = `<p class="donut-empty-text">Enter income sources on the left to see income composition.</p>`;
        return;
    }

    // Circumference for r = 70: 2 * PI * 70 = 439.823
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulatedLength = 0;
    let svgSegments = "";

    activeSlices.forEach(slice => {
        const fraction = slice.amount / totalGross;
        const dashLength = fraction * circumference;
        const dashGap = circumference - dashLength;
        const pct = (fraction * 100).toFixed(1);

        svgSegments += `
            <circle cx="100" cy="100" r="${radius}"
                    fill="none"
                    stroke="${slice.color}"
                    stroke-width="24"
                    stroke-dasharray="${dashLength.toFixed(2)} ${dashGap.toFixed(2)}"
                    stroke-dashoffset="-${accumulatedLength.toFixed(2)}"
                    transform="rotate(-90 100 100)"
                    class="donut-segment">
                <title>${escapeHtml(slice.name)}: ₹${slice.amount.toLocaleString("en-IN")} (${pct}%)</title>
            </circle>
        `;
        accumulatedLength += dashLength;
    });

    container.innerHTML = `
        <svg viewBox="0 0 200 200" class="donut-svg" width="190" height="190">
            <!-- Background track ring -->
            <circle cx="100" cy="100" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="24"></circle>
            <!-- Slices -->
            ${svgSegments}
            <!-- Center Total Gross Text -->
            <g class="donut-center-group">
                <text x="100" y="94" text-anchor="middle" font-size="16" font-weight="800" fill="#0f172a" class="donut-center-amount">${formatCompactRupees(totalGross)}</text>
                <text x="100" y="112" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b" class="donut-center-label">Gross Income</text>
            </g>
        </svg>
    `;

    // Responsive Legend Pills
    let legendHtml = `<div class="donut-legend-grid">`;
    activeSlices.forEach(s => {
        const pct = ((s.amount / totalGross) * 100).toFixed(1);
        legendHtml += `
            <div class="donut-legend-pill" title="${escapeHtml(s.name)}: ₹${s.amount.toLocaleString("en-IN")}">
                <span class="legend-swatch" style="background-color: ${s.color};"></span>
                <span class="legend-name">${escapeHtml(s.name)}:</span>
                <span class="legend-val">₹${s.amount.toLocaleString("en-IN")} <span class="legend-pct">(${pct}%)</span></span>
            </div>
        `;
    });
    legendHtml += `</div>`;
    legend.innerHTML = legendHtml;
}

/**
 * Renders Grouped Horizontal Bars for Regime Tax Comparison.
 */
function renderRegimeComparisonChart(data) {
    const container = document.getElementById("regimeComparisonChart");
    const legend = document.getElementById("regimeLegend");

    if (!data.comparison || (!data.comparison.newRegime && !data.comparison.optionA)) {
        container.innerHTML = `
            <div class="comparison-not-applicable">
                <div class="not-app-icon">ℹ</div>
                <div class="not-app-text">
                    <strong>Direct Comparison Not Applicable</strong>
                    <p>Statutory tax comparison applies when choices exist (e.g. Individual/HUF Old vs New, or Domestic Company Section 115BAA vs Normal). Active taxpayer is assessed under <strong>${escapeHtml(data.regimeLabel)}</strong>.</p>
                </div>
            </div>
        `;
        legend.innerHTML = "";
        return;
    }

    const comp = data.comparison;
    const resNew = comp.newRegime || comp.optionB;
    const resOld = comp.oldRegime || comp.optionA;

    const newTax = resNew ? resNew.totalTax : 0;
    const oldTax = resOld ? resOld.totalTax : 0;
    const maxTax = Math.max(newTax, oldTax, 1000);

    const newPct = Math.round((newTax / maxTax) * 100);
    const oldPct = Math.round((oldTax / maxTax) * 100);

    const diff = Math.abs(newTax - oldTax);
    const lowerRegime = comp.lowerRegime;

    let bannerClass = "comp-banner-equal";
    let bannerText = "⚖ Both regimes yield the exact same estimated tax liability.";

    if (lowerRegime === "new" || lowerRegime === "sec_115baa_22") {
        bannerClass = "comp-banner-new";
        bannerText = `★ ${resNew.regimeLabel} saves ₹${diff.toLocaleString("en-IN")} (Lower Tax)`;
    } else if (lowerRegime === "old" || lowerRegime === "standard_30") {
        bannerClass = "comp-banner-old";
        bannerText = `★ ${resOld.regimeLabel} saves ₹${diff.toLocaleString("en-IN")} (Lower Tax)`;
    }

    container.innerHTML = `
        <div class="regime-bars-container">
            <!-- New Regime Bar -->
            <div class="regime-bar-item ${lowerRegime === 'new' ? 'item-recommended' : ''}">
                <div class="regime-bar-header">
                    <span class="regime-bar-title">${escapeHtml(resNew.regimeLabel)}</span>
                    <span class="regime-bar-amount ${newTax === 0 ? 'text-green' : ''}">₹${newTax.toLocaleString("en-IN")}</span>
                </div>
                <div class="regime-bar-track">
                    <div class="regime-bar-fill fill-new" style="width: ${Math.max(newTax > 0 ? 3 : 0, newPct)}%;"></div>
                </div>
                <div class="regime-bar-meta">
                    <span>Taxable Income: ₹${resNew.taxableIncome.toLocaleString("en-IN")}</span>
                    <span>Effective Rate: ${resNew.effectiveTaxRate}%</span>
                </div>
            </div>

            <!-- Old Regime Bar -->
            <div class="regime-bar-item ${lowerRegime === 'old' ? 'item-recommended' : ''}">
                <div class="regime-bar-header">
                    <span class="regime-bar-title">${escapeHtml(resOld.regimeLabel)}</span>
                    <span class="regime-bar-amount ${oldTax === 0 ? 'text-green' : ''}">₹${oldTax.toLocaleString("en-IN")}</span>
                </div>
                <div class="regime-bar-track">
                    <div class="regime-bar-fill fill-old" style="width: ${Math.max(oldTax > 0 ? 3 : 0, oldPct)}%;"></div>
                </div>
                <div class="regime-bar-meta">
                    <span>Taxable Income: ₹${resOld.taxableIncome.toLocaleString("en-IN")}</span>
                    <span>Effective Rate: ${resOld.effectiveTaxRate}%</span>
                </div>
            </div>

            <!-- Recommendation Callout Banner -->
            <div class="regime-diff-banner ${bannerClass}">
                <span class="diff-banner-text">${bannerText}</span>
            </div>
        </div>
    `;

    legend.innerHTML = "";
}

/**
 * Renders Progressive Tax Slab Visualization & Table.
 */
function renderSlabChart(data) {
    const container = document.getElementById("slabBreakdownChart");
    if (!Array.isArray(data.slabBreakdown) || data.slabBreakdown.length === 0) {
        container.innerHTML = `<div class="chart-empty">Flat rate tax applies to this entity type (No progressive slabs).</div>`;
        return;
    }

    const slabs = data.slabBreakdown;
    const maxPortion = Math.max(...slabs.map(s => s.taxableInSlab), 1);

    let html = `
        <div class="slab-visual-table">
            <div class="slab-visual-header">
                <span class="sv-col-range">Slab Bracket Range</span>
                <span class="sv-col-rate">Rate</span>
                <span class="sv-col-taxed">Portion Taxed</span>
                <span class="sv-col-tax">Tax for Bracket</span>
            </div>
            <div class="slab-visual-body">
    `;

    slabs.forEach(s => {
        const pct = s.taxableInSlab > 0 ? Math.round((s.taxableInSlab / maxPortion) * 100) : 0;
        const isActive = s.taxableInSlab > 0;
        html += `
            <div class="slab-visual-row ${isActive ? 'row-active' : 'row-idle'}">
                <div class="sv-col-range">
                    <span class="slab-range-text">${escapeHtml(s.slabLabel)}</span>
                </div>
                <div class="sv-col-rate">
                    <span class="slab-rate-badge ${s.ratePercent === 0 ? 'rate-zero' : ''}">${s.ratePercent}%</span>
                </div>
                <div class="sv-col-taxed">
                    <div class="slab-portion-bar">
                        <div class="portion-bar-fill" style="width: ${pct}%;"></div>
                        <span class="portion-bar-text">₹${s.taxableInSlab.toLocaleString("en-IN")}</span>
                    </div>
                </div>
                <div class="sv-col-tax">
                    <span class="slab-tax-amount ${s.taxForSlab > 0 ? 'text-purple' : 'text-muted'}">₹${s.taxForSlab.toLocaleString("en-IN")}</span>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

/**
 * Renders calculation assumptions and provisions list.
 */
function renderAssumptionsList(data) {
    const list = document.getElementById("assumptionsList");
    list.innerHTML = `
        <li>Calculations are based on <strong>${escapeHtml(data.financialYear)}</strong> (Assessment Year ${escapeHtml(data.assessmentYear || '')}) pursuant to official Indian Finance Acts.</li>
        <li>Section 87A rebate applies exclusively to resident individuals: up to ₹60,000 rebate up to ₹12 Lakh taxable income under New Regime (FY 2026-27), with statutory marginal relief.</li>
        <li>Health &amp; Education Cess of 4% is computed on total Income Tax plus applicable Surcharge.</li>
        <li>Surcharge on special-rate capital gains (Section 111A, 112A, 112) is statutorily capped at 15%.</li>
        <li>Standard deduction on salary is ₹75,000 under New Regime (FY 24-25 onwards) and ₹50,000 under Old Regime.</li>
        <li>Sections 288A &amp; 288B: Taxable income and total tax payable are legally rounded off to the nearest multiple of ten rupees.</li>
    `;
}

/**
 * Pre-fills representative sample taxpayer profiles for testing.
 */
function loadPreset(presetKey) {
    togglePresetsModal();
    resetForm();

    if (presetKey === "salaried12L") {
        document.getElementById("taxpayerType").value = "individual";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Aarav Sharma";
        document.getElementById("age").value = "28";
        document.getElementById("salaryIncome").value = "1275000";
        handleRegimeChoiceChange("compare");
    } else if (presetKey === "salariedMarginal") {
        document.getElementById("taxpayerType").value = "individual";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Deepak Verma";
        document.getElementById("age").value = "34";
        document.getElementById("salaryIncome").value = "1285000";
        handleRegimeChoiceChange("compare");
    } else if (presetKey === "individualInvestments") {
        document.getElementById("taxpayerType").value = "individual";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Priya Mehta";
        document.getElementById("age").value = "38";
        document.getElementById("salaryIncome").value = "1600000";
        document.getElementById("sec80C").value = "150000";
        document.getElementById("sec80CCD1B").value = "50000";
        document.getElementById("sec80D").value = "50000";
        document.getElementById("sec24b").value = "200000";
        handleRegimeChoiceChange("compare");
    } else if (presetKey === "capitalGainsEarner") {
        document.getElementById("taxpayerType").value = "individual";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Neha Gupta";
        document.getElementById("age").value = "31";
        document.getElementById("salaryIncome").value = "1500000";
        document.getElementById("stcg111A").value = "200000";
        document.getElementById("ltcg112A").value = "300000";
        handleRegimeChoiceChange("compare");
    } else if (presetKey === "hufBusiness") {
        document.getElementById("taxpayerType").value = "huf";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Sharma HUF";
        document.getElementById("businessIncome").value = "1000000";
        handleRegimeChoiceChange("compare");
    } else if (presetKey === "domesticCompany") {
        document.getElementById("taxpayerType").value = "domestic_company";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Apex Tech Pvt Ltd";
        document.getElementById("companyOption").value = "sec_115baa_22";
        document.getElementById("businessIncome").value = "10000000";
    } else if (presetKey === "firmLLP") {
        document.getElementById("taxpayerType").value = "firm_llp";
        handleTaxpayerTypeChange();
        document.getElementById("name").value = "Vanguard Partners LLP";
        document.getElementById("businessIncome").value = "15000000";
    }

    updateGrossIncomeDisplay();
    calculateTax();
}

/**
 * Toggles sample scenarios modal.
 */
function togglePresetsModal() {
    const modal = document.getElementById("presetsModal");
    modal.style.display = (modal.style.display === "none") ? "flex" : "none";
}

function handleModalBackdropClick(e) {
    if (e.target.id === "presetsModal") {
        togglePresetsModal();
    }
}

/**
 * Resets the entire form and clears calculations.
 */
function resetForm() {
    document.getElementById("taxForm").reset();
    document.getElementById("financialYear").value = "2026-2027";
    document.getElementById("taxpayerType").value = "individual";
    document.getElementById("age").value = "30";
    document.getElementById("regime").value = "compare";

    handleYearChange();
    handleTaxpayerTypeChange();
    handleAgeChange();
    handleRegimeChoiceChange("compare");
    updateGrossIncomeDisplay();
    clearError();

    document.getElementById("emptyState").style.display = "block";
    document.getElementById("activeResults").style.display = "none";
    lastCalculationResult = null;
    lastInputPayload = null;
}

/**
 * Prints the professional tax report.
 */
function printTaxReport() {
    if (!lastCalculationResult) return;
    window.print();
}

/**
 * Downloads a text/JSON summary of the calculation.
 */
function downloadTaxReport() {
    if (!lastCalculationResult) return;
    const reportData = {
        generatedAt: new Date().toISOString(),
        financialYear: lastCalculationResult.financialYear,
        assessmentYear: lastCalculationResult.assessmentYear,
        taxpayerType: lastCalculationResult.taxpayerType,
        regime: lastCalculationResult.regimeLabel,
        grossIncome: lastCalculationResult.grossIncome,
        taxableIncome: lastCalculationResult.taxableIncome,
        totalTax: lastCalculationResult.totalTax,
        effectiveTaxRate: lastCalculationResult.effectiveTaxRate + "%",
        disclaimer: "TaxWise estimation based on official Indian Income-tax laws."
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-${lastCalculationResult.financialYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function showError(msg) {
    const box = document.getElementById("formErrorAlert");
    const msgEl = document.getElementById("formErrorMessage");
    box.style.display = "flex";
    msgEl.textContent = msg;
}

function clearError() {
    const box = document.getElementById("formErrorAlert");
    box.style.display = "none";
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}