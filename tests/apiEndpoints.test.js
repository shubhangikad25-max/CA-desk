process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const taxRoutes = require('../routes/taxRoutes');
const { closeDB } = require('../services/mongo');

// Helper to set up test express app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api', taxRoutes);
    return app;
}

test.after(async () => {
    await closeDB();
});

test('API: GET /api/health returns success and timestamp', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.timestamp);
    } finally {
        server.close();
    }
});

test('API: GET /api/years returns supported financial years including FY 2026-27', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/years`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(Array.isArray(data.years));
        const fy2627 = data.years.find(y => y.id === '2026-2027');
        assert.ok(fy2627, 'FY 2026-27 should be supported');
    } finally {
        server.close();
    }
});

test('API: POST /api/calculate returns 400 on negative income', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ income: -100 })
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
    } finally {
        server.close();
    }
});

test('API: POST /api/calculate calculates tax and compares regimes', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Rahul Sharma',
                salaryIncome: 1200000,
                regime: 'new',
                financialYear: '2026-2027'
            })
        });
        assert.equal(res.status, 200);
        const result = await res.json();
        assert.equal(result.success, true);
        assert.equal(result.data.name, 'Rahul Sharma');
        assert.ok(result.data.comparison, 'Comparison object should be present');
        assert.equal(result.data.financialYear, '2026-2027');
    } finally {
        server.close();
    }
});

test('API: GET /api/slabs returns slabs for requested financial year', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/slabs?financialYear=2026-2027`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(data.data.newRegime);
        assert.ok(data.data.oldRegime);
        assert.equal(data.data.newRegime.standardDeduction, 75000);
    } finally {
        server.close();
    }
});

test('API: POST /api/calculate with nested deductions and residentialStatus', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Priya Patel',
                age: 32,
                residentialStatus: 'resident',
                salaryIncome: 1400000,
                otherIncome: 100000,
                financialYear: '2026-2027',
                regime: 'old',
                deductions: {
                    sec80C: 150000,
                    sec80D: 25000,
                    sec24b: 150000
                }
            })
        });
        assert.equal(res.status, 200);
        const result = await res.json();
        assert.equal(result.success, true);
        assert.equal(result.data.grossIncome, 1500000);
        // Std ded (50k) + 80C (1.5L) + 80D (25k) + 24b (1.5L) = 3.75L
        assert.equal(result.data.totalEligibleDeductions, 375000);
        assert.equal(result.data.taxableIncome, 1125000);
    } finally {
        server.close();
    }
});

test('API: POST /api/calculate rejects invalid age and negative deduction', async () => {
    const app = createTestApp();
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                income: 500000,
                age: -10,
                deduction: -5000
            })
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.ok(data.errors.length >= 2);
    } finally {
        server.close();
    }
});

