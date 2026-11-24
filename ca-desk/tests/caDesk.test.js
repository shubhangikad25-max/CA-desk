const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app, startServer } = require('../backend/server');
const DataStore = require('../backend/models/dataStore');
const taxService = require('../../services/taxService');

let server;
let baseUrl;
let authToken = '';

function request(method, path, body = null, token = authToken) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(url, { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

test.before(async () => {
    // Initialize DataStore
    await DataStore.init();
    // Start temporary test server on random free port
    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            resolve();
        });
    });

    // Login as Admin to get token
    const loginRes = await request('POST', '/api/auth/login', {
        email: 'rajesh@sharmaca.in',
        password: 'admin123'
    }, null);

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.data.token);
    authToken = loginRes.data.token;
});

test.after(async () => {
    if (server) {
        await new Promise(resolve => server.close(resolve));
    }
});

test('CA Desk API: Health check endpoint returns status 200', async () => {
    const res = await request('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
});

test('CA Desk Auth: Role-based staff list & profile retrieval', async () => {
    const meRes = await request('GET', '/api/auth/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.role, 'admin');

    const staffRes = await request('GET', '/api/auth/staff');
    assert.equal(staffRes.status, 200);
    assert.ok(Array.isArray(staffRes.data.data));
    assert.ok(staffRes.data.data.length >= 4);
});

test('CA Desk Clients: List, create, and search clients', async () => {
    // 1. List clients
    const listRes = await request('GET', '/api/clients');
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.data));
    const initialCount = listRes.data.data.length;

    // 2. Create new client
    const newClientPayload = {
        name: 'Test Client Enterprises',
        pan: 'ABCDE9999Z',
        taxpayerType: 'domestic_company',
        email: 'test@enterprises.com',
        phone: '+91 99999 88888',
        address: 'Nariman Point, Mumbai',
        notes: 'Automated test client account'
    };
    const createRes = await request('POST', '/api/clients', newClientPayload);
    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.data.id);
    const createdId = createRes.data.data.id;

    // 3. Get client by ID (with aggregated stats)
    const getRes = await request('GET', `/api/clients/${createdId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.data.name, 'Test Client Enterprises');
    assert.ok(getRes.data.data.stats);

    // 4. Search clients
    const searchRes = await request('GET', '/api/clients?search=Test Client');
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.data.data.some(c => c.id === createdId));
});

test('CA Desk TaxWise Integration: Runs calculation via taxService for a client', async () => {
    const calcPayload = {
        clientId: 'CLI-1001',
        name: 'Vikram Malhotra',
        taxpayerType: 'individual',
        financialYear: '2026-2027',
        age: 38,
        residentialStatus: 'resident',
        salaryIncome: 2500000,
        housePropertyLoanInterest: 200000,
        stcg111A: 50000,
        ltcg112A: 180000,
        interestIncome: 45000,
        sec80C: 150000,
        sec80D: 25000,
        sec80CCD2: 120000,
        regime: 'compare'
    };

    const calcRes = await request('POST', '/api/tax/calculate', calcPayload);
    assert.equal(calcRes.status, 200);
    assert.equal(calcRes.data.success, true);
    assert.ok(calcRes.data.data.grossIncome > 0);
    assert.ok(calcRes.data.data.comparison);
    assert.equal(calcRes.data.data.comparison.lowerRegime, 'new');
    assert.ok(Array.isArray(calcRes.data.data.recommendations));
});

test('CA Desk TaxWise Simulator: Interactive tax simulation computes accurate savings', async () => {
    const simPayload = {
        baseInput: {
            taxpayerType: 'individual',
            financialYear: '2026-2027',
            age: 35,
            residentialStatus: 'resident',
            salaryIncome: 2000000,
            regime: 'new'
        },
        proposedSection: 'sec80CCD2',
        proposedAmount: 50000
    };

    const simRes = await request('POST', '/api/tax/simulate', simPayload);
    assert.equal(simRes.status, 200);
    assert.equal(simRes.data.success, true);
    assert.ok(simRes.data.data.taxSaved > 0);
    assert.equal(simRes.data.data.isRegimeEligible, true);
});

test('CA Desk Tax Calculation Persistence: Saves versioned calculation against client', async () => {
    const savePayload = {
        clientId: 'CLI-1001',
        financialYear: '2026-2027',
        taxpayerType: 'individual',
        inputs: { salaryIncome: 2500000, regime: 'compare' },
        results: { grossIncome: 2500000, totalTax: 319800, effectiveTaxRate: 12.79 },
        regimeSelected: 'new',
        status: 'Under Review',
        notes: 'Automated test saved calculation'
    };

    const saveRes = await request('POST', '/api/tax/save', savePayload);
    assert.equal(saveRes.status, 201);
    assert.ok(saveRes.data.data.id);
    assert.ok(saveRes.data.data.version >= 1);
    const calcId = saveRes.data.data.id;

    // Retrieve client calculations
    const clientCalcsRes = await request('GET', '/api/tax/client/CLI-1001');
    assert.equal(clientCalcsRes.status, 200);
    assert.ok(clientCalcsRes.data.data.some(c => c.id === calcId));

    // Update status to Approved
    const updateStatusRes = await request('PATCH', `/api/tax/${calcId}/status`, {
        status: 'Approved',
        notes: 'Verified by Partner'
    });
    assert.equal(updateStatusRes.status, 200);
    assert.equal(updateStatusRes.data.data.status, 'Approved');

    // Generate Tax Report
    const reportRes = await request('GET', `/api/tax/${calcId}/report`);
    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.data.data.client.id, 'CLI-1001');
    assert.ok(reportRes.data.data.firm);
    assert.ok(reportRes.data.data.disclaimer);
});

test('CA Desk Tasks: Task creation, assignment, and status update', async () => {
    const taskPayload = {
        title: 'Review ITR-6 for NovaTech Solutions',
        clientId: 'CLI-1004',
        priority: 'High',
        dueDate: '2026-05-15',
        category: 'Filing'
    };

    const createRes = await request('POST', '/api/tasks', taskPayload);
    assert.equal(createRes.status, 201);
    const taskId = createRes.data.data.id;

    const updateRes = await request('PUT', `/api/tasks/${taskId}`, { status: 'Completed' });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.data.status, 'Completed');
});

test('CA Desk Billing: Invoice creation with 18% GST and partial payment', async () => {
    const invPayload = {
        clientId: 'CLI-1001',
        items: [
            { description: 'Annual Tax Planning Advisory', amount: 20000, hsnSac: '998231', taxRate: 18 }
        ]
    };

    const invRes = await request('POST', '/api/billing/invoices', invPayload);
    assert.equal(invRes.status, 201);
    assert.equal(invRes.data.data.subtotal, 20000);
    assert.equal(invRes.data.data.totalAmount, 23600); // 20000 + 18% GST (3600)
    assert.equal(invRes.data.data.balanceDue, 23600);
    const invId = invRes.data.data.id;

    // Record partial payment
    const payRes = await request('POST', `/api/billing/invoices/${invId}/payment`, {
        amount: 10000,
        mode: 'NEFT',
        referenceNo: 'TEST-PAY-001'
    });
    assert.equal(payRes.status, 200);
    assert.equal(payRes.data.data.paidAmount, 10000);
    assert.equal(payRes.data.data.balanceDue, 13600);
    assert.equal(payRes.data.data.status, 'Partially Paid');
});

test('CA Desk Dashboard: Aggregates real metrics across database', async () => {
    const dashRes = await request('GET', '/api/dashboard/metrics');
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.data.totalClients > 0);
    assert.ok(dashRes.data.data.openTasks >= 0);
    assert.ok(dashRes.data.data.taxCalculationsCompleted > 0);
});

test('CA Desk TaxWise: Category isolation & Domestic Company (30% vs Section 115BAA 22%) without age requirement', async () => {
    // Domestic Company with Section 115BAA (22% flat + 10% statutory surcharge + 4% cess = 25.168% effective rate)
    // Note: No age or residential status passed; business income only
    const coPayload = {
        name: 'Apex Infotech Pvt Ltd',
        taxpayerType: 'domestic_company',
        financialYear: '2026-2027',
        companyOption: 'sec_115baa_22',
        businessIncome: 10000000 // 1 Crore
    };

    const res = await request('POST', '/api/tax/calculate', coPayload);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    const data = res.data.data;
    assert.equal(data.taxpayerType, 'domestic_company');
    assert.equal(data.taxableIncome, 10000000);
    // Base tax: 22% of 1 Cr = 22,00,000
    assert.equal(data.taxBeforeRebate, 2200000);
    // Mandatory 10% surcharge under Sec 115BAA = 2,20,000
    assert.equal(data.surcharge.finalSurcharge, 220000);
    // Cess: 4% of (22,00,000 + 2,20,000 = 24,20,000) = 96,800
    assert.equal(data.cess, 96800);
    // Total Tax: 25,16,800
    assert.equal(data.totalTax, 2516800);
    // Age must not be displayed or used in slabs
    assert.ok(!data.age);
});

test('CA Desk TaxWise: Category isolation & Foreign Company flat 35% calculation and surcharge', async () => {
    // Foreign Company has statutory rate 35% under Finance (No. 2) Act 2024
    // Income: 2 Crore -> 2% surcharge (income between 1Cr and 10Cr)
    const fCoPayload = {
        name: 'Global Cloud Services Inc.',
        taxpayerType: 'foreign_company',
        financialYear: '2026-2027',
        businessIncome: 20000000 // 2 Crore
    };

    const res = await request('POST', '/api/tax/calculate', fCoPayload);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    const data = res.data.data;
    assert.equal(data.taxpayerType, 'foreign_company');
    // Base tax: 35% of 2 Cr = 70,00,000
    assert.equal(data.taxBeforeRebate, 7000000);
    // Surcharge for Foreign Co: 2% of 70,00,000 = 1,40,000
    assert.equal(data.surcharge.finalSurcharge, 140000);
    // Cess: 4% of (70,00,000 + 1,40,000 = 71,40,000) = 2,85,600
    assert.equal(data.cess, 285600);
    // Total Tax: 74,25,600
    assert.equal(data.totalTax, 7425600);
});

test('CA Desk TaxWise: Category isolation & Firm / LLP flat 30% calculation and 12% surcharge over 1 Crore', async () => {
    const firmPayload = {
        name: 'Verma & Sons LLP',
        taxpayerType: 'firm_llp',
        financialYear: '2026-2027',
        businessIncome: 15000000 // 1.5 Crore
    };

    const res = await request('POST', '/api/tax/calculate', firmPayload);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    const data = res.data.data;
    assert.equal(data.taxpayerType, 'firm_llp');
    // Base tax: 30% of 1.5 Cr = 45,00,000
    assert.equal(data.taxBeforeRebate, 4500000);
    // Surcharge: 12% of 45,00,000 = 5,40,000
    assert.equal(data.surcharge.finalSurcharge, 540000);
    // Cess: 4% of 50,40,000 = 2,01,600
    assert.equal(data.cess, 201600);
    assert.equal(data.totalTax, 5241600);
});

test('CA Desk TaxWise: Category isolation & HUF progressive slabs without Section 87A rebate', async () => {
    // HUF with 10 Lakh income under New Regime
    // Under Individual New Regime: up to 12L has full 87A rebate (tax = 0)
    // Under HUF: 87A rebate is legally DISALLOWED, so tax MUST be calculated per slab
    const hufPayload = {
        name: 'Sharma Family HUF',
        taxpayerType: 'huf',
        financialYear: '2026-2027',
        businessIncome: 1000000,
        regime: 'new'
    };

    const res = await request('POST', '/api/tax/calculate', hufPayload);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    const data = res.data.data;
    assert.equal(data.taxpayerType, 'huf');
    assert.equal(data.taxableIncome, 1000000);
    // Slabs: 0-4L: 0; 4-8L: 5% of 4L = 20,000; 8-10L: 10% of 2L = 20,000 -> Tax = 40,000
    assert.equal(data.taxBeforeRebate, 40000);
    // HUF rebate MUST be 0
    assert.equal(data.rebate87A.amount, 0);
    // Cess: 4% of 40,000 = 1,600
    assert.equal(data.cess, 1600);
    assert.equal(data.totalTax, 41600);
});

test('CA Desk TaxWise: Category isolation & Cooperative Society regular slabs vs Section 115BAD 22%', async () => {
    const coopPayload = {
        name: 'Kisan Vikas Sahakari Sanstha',
        taxpayerType: 'cooperative_society',
        financialYear: '2026-2027',
        cooperativeOption: 'sec_115bad_22',
        businessIncome: 5000000 // 50 Lakh
    };

    const res = await request('POST', '/api/tax/calculate', coopPayload);
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    const data = res.data.data;
    assert.equal(data.taxpayerType, 'cooperative_society');
    // Sec 115BAD: 22% base tax = 11,00,000; statutory 10% surcharge = 1,10,000; 4% cess = 48,400 -> 12,58,400
    assert.equal(data.taxBeforeRebate, 1100000);
    assert.equal(data.surcharge.finalSurcharge, 110000);
    assert.equal(data.cess, 48400);
    assert.equal(data.totalTax, 1258400);
});

test('CA Desk TaxWise: Consistency between CA Desk API and standalone TaxWise taxService engine', async () => {
    // Run identical calculation through standalone service and through CA Desk API
    const testInput = {
        taxpayerType: 'individual',
        financialYear: '2026-2027',
        age: 42,
        residentialStatus: 'resident',
        salaryIncome: 1800000,
        businessIncome: 350000,
        sec24b: 150000,
        stcg111A: 60000,
        ltcg112A: 200000,
        interestIncome: 40000,
        sec80C: 150000,
        sec80D: 35000,
        sec80CCD2: 85000,
        regime: 'compare'
    };

    const apiRes = await request('POST', '/api/tax/calculate', testInput);
    assert.equal(apiRes.status, 200);
    const apiResult = apiRes.data.data;

    // Run directly through root taxService
    const directResult = taxService.calculateTax(testInput);

    // Assert strict consistency between integrated CA Desk and standalone engine
    assert.equal(apiResult.grossIncome, directResult.grossIncome);
    assert.equal(apiResult.taxableIncome, directResult.taxableIncome);
    assert.equal(apiResult.totalTax, directResult.totalTax);
    assert.equal(apiResult.cess, directResult.cess);
    assert.equal(apiResult.comparison.lowerRegime, directResult.comparison.lowerRegime);
    assert.equal(apiResult.comparison.taxDifference, directResult.comparison.taxDifference);
    assert.equal(apiResult.comparison.newRegime.totalTax, directResult.comparison.newRegime.totalTax);
    assert.equal(apiResult.comparison.oldRegime.totalTax, directResult.comparison.oldRegime.totalTax);
});

test('CA Desk TaxWise: Endpoint aliases /api/calculate and /api/simulate work identically', async () => {
    const payload = {
        taxpayerType: 'individual',
        financialYear: '2026-2027',
        age: 30,
        residentialStatus: 'resident',
        salaryIncome: 1500000,
        regime: 'new'
    };

    // 1. Check /api/calculate alias
    const aliasRes = await request('POST', '/api/calculate', payload);
    assert.equal(aliasRes.status, 200);
    assert.equal(aliasRes.data.success, true);
    assert.ok(aliasRes.data.data.totalTax >= 0);

    // 2. Check /api/simulate alias
    const simRes = await request('POST', '/api/simulate', {
        baseInput: payload,
        proposedSection: 'sec80CCD2',
        proposedAmount: 50000
    });
    assert.equal(simRes.status, 200);
    assert.equal(simRes.data.success, true);
    assert.ok(simRes.data.data.taxSaved >= 0);
});

test('CA Desk TaxWise: Category-tailored recommendations prevent individual deductions for corporate assessees', async () => {
    // Domestic company calculation
    const coRes = await request('POST', '/api/tax/calculate', {
        taxpayerType: 'domestic_company',
        financialYear: '2026-2027',
        businessIncome: 5000000
    });
    assert.equal(coRes.status, 200);
    const coRecs = coRes.data.data.recommendations || [];
    // Corporate recommendations must NOT contain individual deductions like 80C, 80D, 80CCD
    assert.ok(coRecs.every(r => !['Section 80C', 'Section 80D', 'Section 80CCD(1B)'].includes(r.title)));
    assert.ok(coRecs.some(r => r.category === 'Corporate' || r.title.includes('115BAA') || r.title.includes('CSR') || r.title.includes('Corporate')));
});
