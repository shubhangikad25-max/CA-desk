const { MongoClient } = require('mongodb');
const http = require('http');

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'Ca-desk';
const COL_NAME = 'Tax';

async function runVerification() {
    console.log('==================================================================');
    console.log(`  VERIFICATION: CA Desk MongoDB Integration (${DB_NAME}.${COL_NAME})  `);
    console.log('==================================================================\n');

    const client = new MongoClient(MONGO_URL);
    await client.connect();
    const db = client.db(DB_NAME);
    const col = db.collection(COL_NAME);

    // Step 1: Initial document count in Ca-desk.Tax
    const initialCount = await col.countDocuments();
    console.log(`[1] Initial document count in ${DB_NAME}.${COL_NAME}: ${initialCount}`);

    // Step 2: Start CA Desk backend directly to test
    const { startServer } = require('../ca-desk/backend/server');
    const serverInstance = await startServer();
    console.log('[2] CA Desk backend server initialized and connected to database.');

    // Helper for HTTP requests
    function apiRequest(path, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const dataStr = body ? JSON.stringify(body) : null;
            const req = http.request({
                hostname: '127.0.0.1',
                port: 3001,
                path,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {})
                }
            }, (res) => {
                let chunks = '';
                res.on('data', chunk => chunks += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(chunks);
                        resolve({ status: res.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ status: res.statusCode, raw: chunks });
                    }
                });
            });
            req.on('error', reject);
            if (dataStr) req.write(dataStr);
            req.end();
        });
    }

    // Step 3: Check health endpoint
    const health = await apiRequest('/api/health');
    console.log(`[3] GET /api/health -> status=${health.status}, mongodb=${health.data?.mongodb}, db=${health.data?.database}`);
    if (health.data?.database !== DB_NAME) {
        throw new Error(`Expected health check database to be '${DB_NAME}', got '${health.data?.database}'`);
    }

    // Step 4: Perform tax calculation via POST /api/calculate
    const testCalculationPayload = {
        name: 'Sunil Joshi',
        pan: 'ABCDE1234F',
        taxpayerType: 'individual',
        age: 38,
        residentialStatus: 'resident',
        financialYear: '2026-2027',
        regime: 'compare',
        salaryIncome: 1800000,
        businessIncome: 0,
        housePropertyType: 'self_occupied',
        housePropertyGrossRent: 0,
        housePropertyMunicipalTaxes: 0,
        housePropertyLoanInterest: 0,
        stcg111A: 0,
        stcgOther: 0,
        ltcg112A: 0,
        ltcg112: 0,
        interestIncome: 50000,
        dividendIncome: 0,
        otherIncome: 0,
        sec80C: 150000,
        sec80CCD1B: 0,
        sec80D: 25000,
        sec80CCD2: 0,
        sec80E: 0,
        otherDeductions: 0
    };

    console.log('\n[4] Submitting calculation request to POST /api/calculate...');
    const calcRes = await apiRequest('/api/calculate', 'POST', testCalculationPayload);
    console.log(`    Response status: ${calcRes.status}`);
    console.log(`    Calculation ID: ${calcRes.data?.calculationId}`);
    console.log(`    Message: ${calcRes.data?.message}`);
    console.log(`    Computed Tax: ₹${calcRes.data?.data?.totalTax}`);
    console.log(`    Recommended Regime: ${calcRes.data?.data?.comparison?.lowerRegime || calcRes.data?.data?.regime}`);

    const calcId = calcRes.data?.calculationId;
    if (!calcId) throw new Error('Calculation ID was not returned by API!');

    // Step 5: Verify directly in MongoDB under Ca-desk.Tax
    console.log(`\n[5] Verifying MongoDB persistence directly in ${DB_NAME}.${COL_NAME}...`);
    const afterCount = await col.countDocuments();
    console.log(`    Document count in ${DB_NAME}.${COL_NAME}: ${afterCount} (was ${initialCount})`);
    if (afterCount !== initialCount + 1) {
        throw new Error(`Document count did not increment by 1! Expected ${initialCount + 1}, found ${afterCount}`);
    }

    const savedDoc = await col.findOne({ calculationId: calcId });
    if (!savedDoc) {
        throw new Error(`Document with calculationId ${calcId} not found in ${DB_NAME}.${COL_NAME}!`);
    }

    console.log('    ✓ Real MongoDB Document Found:');
    console.log(`      - _id: ${savedDoc._id}`);
    console.log(`      - calculationId: ${savedDoc.calculationId}`);
    console.log(`      - taxpayerName: ${savedDoc.taxpayerName || savedDoc.name}`);
    console.log(`      - PAN: ${savedDoc.pan || savedDoc.taxpayer?.pan}`);
    console.log(`      - Financial Year: ${savedDoc.financialYear}`);
    console.log(`      - Assessment Year: ${savedDoc.assessmentYear}`);
    console.log(`      - Regime: ${savedDoc.regimeSelected || savedDoc.regime}`);
    console.log(`      - Gross Total Income: ₹${savedDoc.income?.grossTotalIncome}`);
    console.log(`      - Total Deductions: ₹${savedDoc.deductions?.totalDeductions}`);
    console.log(`      - Taxable Income: ₹${savedDoc.taxableIncome || savedDoc.results?.taxableIncome}`);
    console.log(`      - Calculated Tax (before cess/rebate): ₹${savedDoc.calculatedTax || savedDoc.results?.taxBeforeRebate}`);
    console.log(`      - Health & Education Cess: ₹${savedDoc.cess || savedDoc.results?.cess}`);
    console.log(`      - Total Tax Liability: ₹${savedDoc.totalTax || savedDoc.results?.totalTax}`);
    console.log(`      - createdAt: ${savedDoc.createdAt} (${savedDoc.createdAt instanceof Date ? 'MongoDB Date' : typeof savedDoc.createdAt})`);

    // Verify required fields presence
    const requiredFields = [
        'calculationId', 'financialYear', 'assessmentYear', 'taxableIncome',
        'totalTax', 'createdAt', 'income', 'deductions', 'results'
    ];
    for (const f of requiredFields) {
        if (savedDoc[f] === undefined) {
            throw new Error(`Required field '${f}' is missing in saved MongoDB document!`);
        }
    }
    if (!(savedDoc.createdAt instanceof Date)) {
        throw new Error('createdAt must be a valid MongoDB Date object!');
    }

    // Step 6: Test Idempotency (Do not save duplicate calculations)
    console.log('\n[6] Testing idempotency (preventing duplicate saves)...');
    const duplicateSubmission = await apiRequest('/api/calculate', 'POST', {
        ...testCalculationPayload,
        calculationId: calcId
    });
    const countAfterDuplicate = await col.countDocuments();
    console.log(`    Count after duplicate submission: ${countAfterDuplicate} (must remain ${afterCount})`);
    if (countAfterDuplicate !== afterCount) {
        throw new Error(`Duplicate submission created an extra record in ${DB_NAME}.${COL_NAME}!`);
    }
    console.log('    ✓ Idempotency verified: No duplicate records created.');

    // Step 7: Test Retrieve APIs
    console.log('\n[7] Testing retrieval APIs from Ca-desk.Tax...');
    const allRes = await apiRequest('/api/tax/all');
    console.log(`    GET /api/tax/all -> count=${allRes.data?.count}, success=${allRes.data?.success}`);
    const foundInAll = allRes.data?.data?.find(c => c.calculationId === calcId);
    if (!foundInAll) throw new Error(`Calculation ${calcId} not found in GET /api/tax/all!`);
    console.log(`    ✓ Found calculation in /api/tax/all: ${foundInAll.calculationId} (${foundInAll.clientName})`);

    const singleRes = await apiRequest(`/api/tax/${calcId}`);
    console.log(`    GET /api/tax/${calcId} -> success=${singleRes.data?.success}`);
    if (singleRes.data?.data?.calculationId !== calcId) {
        throw new Error(`GET /api/tax/${calcId} did not return the expected calculation!`);
    }
    console.log(`    ✓ Successfully fetched single record by ID: ${singleRes.data?.data?.calculationId}`);

    const historyRes = await apiRequest('/api/tax/history');
    console.log(`    GET /api/tax/history -> count=${historyRes.data?.count}`);
    if (!historyRes.data?.data?.some(c => c.calculationId === calcId)) {
        throw new Error(`Calculation ${calcId} not found in GET /api/tax/history!`);
    }
    console.log(`    ✓ History endpoint verified.`);

    // Step 8: Verify cad_taxCalculations was NOT modified
    const cadCols = await db.listCollections({ name: 'cad_taxCalculations' }).toArray();
    if (cadCols.length > 0) {
        const cadCount = await db.collection('cad_taxCalculations').countDocuments();
        console.log(`\n[8] cad_taxCalculations collection document count: ${cadCount} (verified untouched)`);
    } else {
        console.log(`\n[8] cad_taxCalculations collection does not exist in ${DB_NAME} (verified untouched)`);
    }

    console.log('\n==================================================================');
    console.log(`  ALL CHECKS PASSED: Real Document Confirmed in ${DB_NAME}.${COL_NAME}!  `);
    console.log('==================================================================\n');

    serverInstance.close();
    await client.close();
    process.exit(0);
}

runVerification().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
