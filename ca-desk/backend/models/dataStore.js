const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDB, hasMongoDB } = require('../config/db');
const taxRepository = require('./taxRepository');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Initial seed data with explicit isDemo flag
function getInitialSeedData() {
    const adminPasswordHash = hashPassword('admin123');
    const reviewerPasswordHash = hashPassword('reviewer123');
    const preparerPasswordHash = hashPassword('preparer123');
    const readonlyPasswordHash = hashPassword('readonly123');

    const users = [
        {
            id: 'USR-001',
            name: 'CA Rajesh Sharma',
            email: 'rajesh@sharmaca.in',
            passwordHash: adminPasswordHash,
            role: 'admin',
            title: 'Managing Partner (FCA)',
            membershipNo: 'FCA 104829',
            firmName: 'Sharma & Associates, Chartered Accountants',
            createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
            id: 'USR-002',
            name: 'CA Pooja Verma',
            email: 'pooja@sharmaca.in',
            passwordHash: reviewerPasswordHash,
            role: 'reviewer',
            title: 'Senior Tax Manager (ACA)',
            membershipNo: 'ACA 529143',
            firmName: 'Sharma & Associates, Chartered Accountants',
            createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
            id: 'USR-003',
            name: 'Amit Patel',
            email: 'amit@sharmaca.in',
            passwordHash: preparerPasswordHash,
            role: 'preparer',
            title: 'Senior Article Assistant',
            firmName: 'Sharma & Associates, Chartered Accountants',
            createdAt: '2026-01-01T00:00:00.000Z'
        },
        {
            id: 'USR-004',
            name: 'Sneha Rao',
            email: 'sneha@sharmaca.in',
            passwordHash: readonlyPasswordHash,
            role: 'readonly',
            title: 'Audit & Compliance Trainee',
            firmName: 'Sharma & Associates, Chartered Accountants',
            createdAt: '2026-01-01T00:00:00.000Z'
        }
    ];

    const clients = [
        {
            id: 'CLI-1001',
            name: 'Vikram Malhotra',
            pan: 'AAAPM1234F',
            taxpayerType: 'individual',
            age: 38,
            residentialStatus: 'resident',
            email: 'vikram.malhotra@techcorp.com',
            phone: '+91 98201 44552',
            address: 'Flat 902, Sky High Towers, Powai, Mumbai - 400076',
            status: 'active',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            notes: 'Salaried tech executive with stock options and home loan',
            isDemo: true,
            createdAt: '2026-02-10T09:30:00.000Z',
            updatedAt: '2026-04-12T11:20:00.000Z'
        },
        {
            id: 'CLI-1002',
            name: 'Dr. Sunita Kulkarni',
            pan: 'AABPK5678G',
            taxpayerType: 'individual',
            age: 52,
            residentialStatus: 'resident',
            email: 'dr.sunita@medicareclinic.org',
            phone: '+91 94220 18765',
            address: 'Clinic No 4, Shivaji Nagar, Pune - 411005',
            status: 'active',
            assignedStaffId: 'USR-003',
            assignedStaffName: 'Amit Patel',
            notes: 'Consultant cardiologist, professional clinic receipts & medical equipment depreciation',
            isDemo: true,
            createdAt: '2026-02-15T14:15:00.000Z',
            updatedAt: '2026-04-10T16:40:00.000Z'
        },
        {
            id: 'CLI-1003',
            name: 'Mehta & Sons HUF',
            pan: 'AACHM9012H',
            taxpayerType: 'huf',
            age: 45,
            residentialStatus: 'resident',
            email: 'karta.mehta@hufgroup.in',
            phone: '+91 98210 99887',
            address: '42, Silk Bazar, Kalbadevi, Mumbai - 400002',
            status: 'active',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            notes: 'Ancestral commercial property rental income and mutual fund capital gains',
            isDemo: true,
            createdAt: '2026-02-20T10:00:00.000Z',
            updatedAt: '2026-04-05T12:00:00.000Z'
        },
        {
            id: 'CLI-1004',
            name: 'NovaTech Solutions Pvt Ltd',
            pan: 'AABCN3456K',
            taxpayerType: 'domestic_company',
            residentialStatus: 'resident',
            email: 'finance@novatech-solutions.com',
            phone: '+91 22 6677 8899',
            address: 'Unit 501, Mindspace IT Park, Airoli, Navi Mumbai - 400708',
            status: 'active',
            assignedStaffId: 'USR-001',
            assignedStaffName: 'CA Rajesh Sharma',
            notes: 'SaaS product development firm, opt-in for Section 115BAA concessional 22% rate',
            isDemo: true,
            createdAt: '2026-01-18T11:00:00.000Z',
            updatedAt: '2026-04-14T15:30:00.000Z'
        },
        {
            id: 'CLI-1005',
            name: 'Apex Advisory LLP',
            pan: 'AAFFA7890L',
            taxpayerType: 'firm_llp',
            residentialStatus: 'resident',
            email: 'partners@apexadvisory.in',
            phone: '+91 20 2567 4321',
            address: 'Level 3, Platinum Square, Viman Nagar, Pune - 411014',
            status: 'active',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            notes: 'Management consulting LLP with 3 designated partners',
            isDemo: true,
            createdAt: '2026-03-01T10:30:00.000Z',
            updatedAt: '2026-04-11T09:45:00.000Z'
        }
    ];

    const taxCalculations = [
        {
            id: 'CALC-2026-001',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            financialYear: '2026-2027',
            taxpayerType: 'individual',
            version: 1,
            status: 'Under Review',
            regimeSelected: 'new',
            inputs: {
                taxpayerType: 'individual',
                name: 'Vikram Malhotra',
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
            },
            results: {
                grossIncome: 2775000,
                totalTax: 319800,
                effectiveTaxRate: 11.52,
                recommendedRegime: 'new',
                taxSavingVsOld: 213720
            },
            preparedBy: 'Amit Patel',
            reviewedBy: 'CA Pooja Verma',
            notes: 'New Regime significantly more beneficial by ₹2,13,720 due to revised slab rates and standard deduction of ₹75,000.',
            isDemo: true,
            createdAt: '2026-04-10T14:30:00.000Z',
            updatedAt: '2026-04-10T15:00:00.000Z'
        },
        {
            id: 'CALC-2026-002',
            clientId: 'CLI-1002',
            clientName: 'Dr. Sunita Kulkarni',
            financialYear: '2026-2027',
            taxpayerType: 'individual',
            version: 1,
            status: 'Approved',
            regimeSelected: 'new',
            inputs: {
                taxpayerType: 'individual',
                name: 'Dr. Sunita Kulkarni',
                financialYear: '2026-2027',
                age: 52,
                residentialStatus: 'resident',
                businessIncome: 3600000,
                interestIncome: 80000,
                sec80C: 150000,
                sec80D: 50000,
                regime: 'compare'
            },
            results: {
                grossIncome: 3680000,
                totalTax: 624000,
                effectiveTaxRate: 16.96,
                recommendedRegime: 'new',
                taxSavingVsOld: 145600
            },
            preparedBy: 'Amit Patel',
            reviewedBy: 'CA Pooja Verma',
            notes: 'Advance tax calculation completed. Advised to remit 4th installment by March 15th.',
            isDemo: true,
            createdAt: '2026-04-08T11:00:00.000Z',
            updatedAt: '2026-04-09T17:15:00.000Z'
        }
    ];

    const tasks = [
        {
            id: 'TSK-101',
            title: 'Verify Form 16 and Mutual Fund Statements for Vikram Malhotra',
            description: 'Cross-check salary TDS with AIS/TIS and capital gain statements from CAMS.',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            assignedStaffId: 'USR-003',
            assignedStaffName: 'Amit Patel',
            priority: 'High',
            dueDate: '2026-04-25',
            status: 'In Progress',
            category: 'Tax Computation',
            isDemo: true,
            createdAt: '2026-04-11T10:00:00.000Z',
            updatedAt: '2026-04-12T11:00:00.000Z'
        },
        {
            id: 'TSK-102',
            title: 'Prepare Tax Audit Working Papers - Dr. Sunita Kulkarni',
            description: 'Compile clinic gross receipts, 44AB applicability, depreciation schedules on diagnostic equipment.',
            clientId: 'CLI-1002',
            clientName: 'Dr. Sunita Kulkarni',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            priority: 'Urgent',
            dueDate: '2026-04-20',
            status: 'Under Review',
            category: 'Audit',
            isDemo: true,
            createdAt: '2026-04-09T14:00:00.000Z',
            updatedAt: '2026-04-11T16:30:00.000Z'
        },
        {
            id: 'TSK-103',
            title: 'Q4 TDS Reconciliation - NovaTech Solutions',
            description: 'Match vendor invoices with 194C and 194J deductions prior to filing Form 26Q.',
            clientId: 'CLI-1004',
            clientName: 'NovaTech Solutions Pvt Ltd',
            assignedStaffId: 'USR-003',
            assignedStaffName: 'Amit Patel',
            priority: 'High',
            dueDate: '2026-04-28',
            status: 'To Do',
            category: 'Compliance',
            isDemo: true,
            createdAt: '2026-04-12T09:00:00.000Z',
            updatedAt: '2026-04-12T09:00:00.000Z'
        },
        {
            id: 'TSK-104',
            title: 'Collect Partnership Deed & Remuneration Proofs - Apex Advisory LLP',
            description: 'Request signed partner resolution for FY 26-27 profit sharing and remuneration limits.',
            clientId: 'CLI-1005',
            clientName: 'Apex Advisory LLP',
            assignedStaffId: 'USR-004',
            assignedStaffName: 'Sneha Rao',
            priority: 'Medium',
            dueDate: '2026-04-30',
            status: 'Waiting for Client',
            category: 'Document Collection',
            isDemo: true,
            createdAt: '2026-04-10T15:00:00.000Z',
            updatedAt: '2026-04-10T15:00:00.000Z'
        }
    ];

    const documents = [
        {
            id: 'DOC-501',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            taxYear: '2026-2027',
            category: 'Salary statements',
            originalName: 'Form16_PartA_PartB_Vikram.pdf',
            fileName: 'form16_vikram_2627.pdf',
            fileSize: 485200,
            mimeType: 'application/pdf',
            reviewStatus: 'Verified',
            verifiedBy: 'CA Pooja Verma',
            notes: 'TDS of ₹2,85,000 matches 26AS records perfectly',
            isDemo: true,
            uploadedAt: '2026-04-08T10:15:00.000Z'
        },
        {
            id: 'DOC-502',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            taxYear: '2026-2027',
            category: 'Loan interest certificates',
            originalName: 'HomeLoan_Interest_HDFC_2627.pdf',
            fileName: 'hdfc_homeloan_vikram.pdf',
            fileSize: 215400,
            mimeType: 'application/pdf',
            reviewStatus: 'Verified',
            verifiedBy: 'Amit Patel',
            notes: 'Interest ₹1,85,400 and Principal ₹72,000',
            isDemo: true,
            uploadedAt: '2026-04-09T14:45:00.000Z'
        },
        {
            id: 'DOC-503',
            clientId: 'CLI-1002',
            clientName: 'Dr. Sunita Kulkarni',
            taxYear: '2026-2027',
            category: 'Financial statements',
            originalName: 'Clinic_PnL_BalanceSheet_Draft.xlsx',
            fileName: 'clinic_pnl_draft.xlsx',
            fileSize: 842100,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            reviewStatus: 'Needs Clarification',
            verifiedBy: 'CA Pooja Verma',
            notes: 'Clarification required regarding depreciation claim on newly acquired ultrasound probe',
            isDemo: true,
            uploadedAt: '2026-04-07T16:20:00.000Z'
        }
    ];

    const compliance = [
        {
            id: 'CMP-201',
            title: 'Q4 TDS Return Filing (Form 24Q / 26Q)',
            complianceType: 'TDS',
            clientId: 'CLI-1004',
            clientName: 'NovaTech Solutions Pvt Ltd',
            taxYear: '2026-2027',
            dueDate: '2026-05-31',
            assignedStaffId: 'USR-003',
            assignedStaffName: 'Amit Patel',
            status: 'Upcoming',
            notes: 'Quarterly salary and non-salary TDS return for Q4.',
            isDemo: true
        },
        {
            id: 'CMP-202',
            title: 'Advance Tax - 1st Installment (15%)',
            complianceType: 'Income Tax',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            taxYear: '2026-2027',
            dueDate: '2026-06-15',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            status: 'Upcoming',
            notes: 'Mandatory if net tax liability after TDS exceeds ₹10,000.',
            isDemo: true
        },
        {
            id: 'CMP-203',
            title: 'ITR Filing - Non-Audit Cases (Individuals & HUF)',
            complianceType: 'Income Tax',
            clientId: 'CLI-1003',
            clientName: 'Mehta & Sons HUF',
            taxYear: '2026-2027',
            dueDate: '2026-07-31',
            assignedStaffId: 'USR-002',
            assignedStaffName: 'CA Pooja Verma',
            status: 'Upcoming',
            notes: 'Statutory due date under Section 139(1) of the Income-tax Act, 1961.',
            isDemo: true
        },
        {
            id: 'CMP-204',
            title: 'Tax Audit Report Filing (Form 3CA / 3CD)',
            complianceType: 'Income Tax',
            clientId: 'CLI-1002',
            clientName: 'Dr. Sunita Kulkarni',
            taxYear: '2026-2027',
            dueDate: '2026-09-30',
            assignedStaffId: 'USR-001',
            assignedStaffName: 'CA Rajesh Sharma',
            status: 'Upcoming',
            notes: 'Audit report under Section 44AB for professionals exceeding gross receipts threshold.',
            isDemo: true
        },
        {
            id: 'CMP-205',
            title: 'Corporate ITR Filing (Form ITR-6)',
            complianceType: 'Corporate',
            clientId: 'CLI-1004',
            clientName: 'NovaTech Solutions Pvt Ltd',
            taxYear: '2026-2027',
            dueDate: '2026-10-31',
            assignedStaffId: 'USR-001',
            assignedStaffName: 'CA Rajesh Sharma',
            status: 'Upcoming',
            notes: 'Statutory corporate tax return for domestic company under Section 139(1).',
            isDemo: true
        }
    ];

    const invoices = [
        {
            id: 'INV-2026-001',
            invoiceNumber: 'CAD/26-27/012',
            clientId: 'CLI-1001',
            clientName: 'Vikram Malhotra',
            issueDate: '2026-04-10',
            dueDate: '2026-04-24',
            items: [
                { description: 'Comprehensive Income Tax Advisory & Regime Optimization FY 26-27', hsnSac: '998231', amount: 12000, taxRate: 18, taxAmount: 2160, total: 14160 },
                { description: 'Capital Gains & ESOP Computation Statement', hsnSac: '998231', amount: 5000, taxRate: 18, taxAmount: 900, total: 5900 }
            ],
            subtotal: 17000,
            cgst: 1530,
            sgst: 1530,
            igst: 0,
            totalAmount: 20060,
            paidAmount: 20060,
            balanceDue: 0,
            status: 'Paid',
            payments: [
                {
                    paymentId: 'PAY-8821',
                    date: '2026-04-11',
                    amount: 20060,
                    mode: 'UPI / NetBanking',
                    referenceNo: 'UPI/610294819284',
                    recordedBy: 'CA Pooja Verma'
                }
            ],
            isDemo: true,
            createdAt: '2026-04-10T11:00:00.000Z'
        },
        {
            id: 'INV-2026-002',
            invoiceNumber: 'CAD/26-27/015',
            clientId: 'CLI-1002',
            clientName: 'Dr. Sunita Kulkarni',
            issueDate: '2026-04-09',
            dueDate: '2026-04-23',
            items: [
                { description: 'Professional Tax Audit & Clinic Accounts Review under Section 44AB', hsnSac: '998222', amount: 35000, taxRate: 18, taxAmount: 6300, total: 41300 }
            ],
            subtotal: 35000,
            cgst: 3150,
            sgst: 3150,
            igst: 0,
            totalAmount: 41300,
            paidAmount: 20000,
            balanceDue: 21300,
            status: 'Partially Paid',
            payments: [
                {
                    paymentId: 'PAY-8835',
                    date: '2026-04-10',
                    amount: 20000,
                    mode: 'Cheque / NEFT',
                    referenceNo: 'NEFT/HDFC0029103',
                    recordedBy: 'CA Rajesh Sharma'
                }
            ],
            isDemo: true,
            createdAt: '2026-04-09T10:00:00.000Z'
        },
        {
            id: 'INV-2026-003',
            invoiceNumber: 'CAD/26-27/018',
            clientId: 'CLI-1004',
            clientName: 'NovaTech Solutions Pvt Ltd',
            issueDate: '2026-04-05',
            dueDate: '2026-04-19',
            items: [
                { description: 'Quarterly Corporate Tax Retainer & TDS Filings (Q4)', hsnSac: '998231', amount: 50000, taxRate: 18, taxAmount: 9000, total: 59000 }
            ],
            subtotal: 50000,
            cgst: 4500,
            sgst: 4500,
            igst: 0,
            totalAmount: 59000,
            paidAmount: 0,
            balanceDue: 59000,
            status: 'Sent',
            payments: [],
            isDemo: true,
            createdAt: '2026-04-05T12:00:00.000Z'
        }
    ];

    const alerts = [
        {
            id: 'ALT-101',
            type: 'compliance',
            severity: 'warning',
            title: 'Q4 TDS Filing Deadline Approaching',
            message: 'NovaTech Solutions Pvt Ltd Q4 TDS return is due within 45 days. Complete reconciliation of Form 26Q.',
            clientId: 'CLI-1004',
            link: '/compliance',
            isRead: false,
            createdAt: '2026-04-12T08:00:00.000Z'
        },
        {
            id: 'ALT-102',
            type: 'document',
            severity: 'warning',
            title: 'Document Clarification Required',
            message: 'Clarification required on clinic depreciation schedule for Dr. Sunita Kulkarni.',
            clientId: 'CLI-1002',
            link: '/documents',
            isRead: false,
            createdAt: '2026-04-11T14:30:00.000Z'
        },
        {
            id: 'ALT-103',
            type: 'calculation',
            severity: 'info',
            title: 'Tax Calculation Ready for CA Approval',
            message: 'Calculation CALC-2026-001 for Vikram Malhotra is awaiting final review by CA Pooja Verma.',
            clientId: 'CLI-1001',
            link: '/taxwise',
            isRead: false,
            createdAt: '2026-04-10T17:00:00.000Z'
        },
        {
            id: 'ALT-104',
            type: 'billing',
            severity: 'info',
            title: 'Invoice Sent to NovaTech Solutions',
            message: 'Invoice CAD/26-27/018 for ₹59,000 is outstanding. Due date: April 19, 2026.',
            clientId: 'CLI-1004',
            link: '/billing',
            isRead: true,
            createdAt: '2026-04-05T12:30:00.000Z'
        }
    ];

    const auditLogs = [
        {
            id: 'AUD-001',
            userId: 'USR-001',
            userName: 'CA Rajesh Sharma',
            action: 'LOGIN',
            entityType: 'User',
            entityId: 'USR-001',
            details: { ip: '127.0.0.1', userAgent: 'CA Desk Desktop Workspace' },
            timestamp: '2026-04-12T09:00:00.000Z'
        },
        {
            id: 'AUD-002',
            userId: 'USR-003',
            userName: 'Amit Patel',
            action: 'CALCULATION_SAVED',
            entityType: 'TaxCalculation',
            entityId: 'CALC-2026-001',
            details: { clientId: 'CLI-1001', version: 1, regime: 'new' },
            timestamp: '2026-04-10T14:30:00.000Z'
        }
    ];

    return {
        users,
        clients,
        taxCalculations,
        tasks,
        documents,
        compliance,
        invoices,
        alerts,
        auditLogs
    };
}

// In-memory state synchronized with JSON file and MongoDB
let memoryStore = null;

function loadStore() {
    if (memoryStore) return memoryStore;

    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            memoryStore = JSON.parse(raw);
            return memoryStore;
        } catch (e) {
            console.error('[CA Desk] Error reading data file, re-initializing seed data:', e);
        }
    }

    memoryStore = getInitialSeedData();
    saveStore();
    return memoryStore;
}

function saveStore() {
    if (!memoryStore) return;
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
    } catch (e) {
        console.error('[CA Desk] Error saving data store file:', e);
    }
}

// Live sync helper for MongoDB collections
async function syncEntityToMongo(colName, action, item, id) {
    if (!hasMongoDB()) return;
    try {
        const db = getDB();
        if (!db) return;
        const col = db.collection(`cad_${colName}`);
        if (action === 'upsert' || action === 'create') {
            if (item && item.id) {
                const { _id, ...cleanItem } = item;
                await col.updateOne(
                    { id: cleanItem.id },
                    { $set: cleanItem },
                    { upsert: true }
                );
            }
        } else if (action === 'delete') {
            if (id) {
                await col.deleteOne({ id });
            }
        }
    } catch (e) {
        console.warn(`[CA Desk MongoDB] Live sync error on cad_${colName}:`, e.message);
    }
}

// Bi-directional full sync with MongoDB collections on startup
async function syncWithMongo() {
    if (!hasMongoDB()) return;
    try {
        const db = getDB();
        if (!db) return;
        const store = loadStore();

        // Exclude taxCalculations so cad_taxCalculations is kept strictly as legacy read-only per Section 6
        const collections = ['users', 'clients', 'tasks', 'documents', 'compliance', 'invoices', 'alerts', 'auditLogs'];
        for (const colName of collections) {
            const col = db.collection(`cad_${colName}`);
            const localItems = store[colName] || [];

            // 1. Sync every local item from store.json into MongoDB cad_<colName> safely ignoring _id
            for (const item of localItems) {
                if (item && item.id) {
                    const { _id, ...cleanItem } = item;
                    await col.updateOne(
                        { id: cleanItem.id },
                        { $set: cleanItem },
                        { upsert: true }
                    );
                }
            }

            // 2. Import any MongoDB items not present in local store
            const mongoItems = await col.find({}).toArray();
            let addedFromMongo = false;
            for (const mItem of mongoItems) {
                const { _id, ...cleanItem } = mItem;
                if (!store[colName].some(local => local.id === cleanItem.id)) {
                    store[colName].push(cleanItem);
                    addedFromMongo = true;
                }
            }
            if (addedFromMongo) {
                saveStore();
            }
        }
        console.log(`[CA Desk] Fully synchronized all entities with MongoDB database: Desk-CA`);
    } catch (err) {
        console.warn('[CA Desk] MongoDB sync warning:', err.message);
    }
}

// Repository operations with audit logging
const DataStore = {
    init: async function() {
        loadStore();
        await syncWithMongo();
    },

    // Users
    users: {
        findByEmail: (email) => {
            const store = loadStore();
            return store.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
        },
        findById: (id) => {
            const store = loadStore();
            return store.users.find(u => u.id === id);
        },
        list: () => {
            const store = loadStore();
            return store.users.map(({ passwordHash, ...rest }) => rest);
        },
        create: (user) => {
            const store = loadStore();
            const newUser = {
                ...user,
                id: `USR-${String(store.users.length + 1).padStart(3, '0')}`,
                createdAt: new Date().toISOString()
            };
            store.users.push(newUser);
            saveStore();
            return newUser;
        }
    },

    // Clients
    clients: {
        list: ({ search, taxpayerType, status, staffId } = {}) => {
            const store = loadStore();
            let result = [...store.clients];

            if (search) {
                const s = search.toLowerCase();
                result = result.filter(c =>
                    c.name.toLowerCase().includes(s) ||
                    (c.pan && c.pan.toLowerCase().includes(s)) ||
                    (c.email && c.email.toLowerCase().includes(s)) ||
                    (c.id && c.id.toLowerCase().includes(s))
                );
            }

            if (taxpayerType && taxpayerType !== 'all') {
                result = result.filter(c => c.taxpayerType === taxpayerType);
            }

            if (status && status !== 'all') {
                result = result.filter(c => c.status === status);
            }

            if (staffId && staffId !== 'all') {
                result = result.filter(c => c.assignedStaffId === staffId);
            }

            return result;
        },
        getById: (id) => {
            const store = loadStore();
            return store.clients.find(c => c.id === id);
        },
        create: (clientData) => {
            const store = loadStore();
            const id = `CLI-${1000 + store.clients.length + 1}`;
            const newClient = {
                id,
                ...clientData,
                status: clientData.status || 'active',
                isDemo: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.clients.unshift(newClient);
            saveStore();
            syncEntityToMongo('clients', 'upsert', newClient);
            return newClient;
        },
        update: (id, updateData) => {
            const store = loadStore();
            const idx = store.clients.findIndex(c => c.id === id);
            if (idx === -1) return null;
            store.clients[idx] = {
                ...store.clients[idx],
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            saveStore();
            syncEntityToMongo('clients', 'upsert', store.clients[idx]);
            return store.clients[idx];
        },
        delete: (id) => {
            const store = loadStore();
            const idx = store.clients.findIndex(c => c.id === id);
            if (idx === -1) return false;
            store.clients.splice(idx, 1);
            saveStore();
            syncEntityToMongo('clients', 'delete', null, id);
            return true;
        }
    },

    // Tax Calculations (Uses MongoDB Tax collection as single primary source of truth)
    taxCalculations: {
        listByClient: async (clientId) => {
            return taxRepository.listCalculationsByClient(clientId);
        },
        listAll: async (filter = {}) => {
            return taxRepository.listAllCalculations(filter);
        },
        getById: async (id) => {
            return taxRepository.getCalculationById(id);
        },
        saveCalculation: async (calcData) => {
            const taxDoc = taxRepository.buildTaxCalculationDocument({
                clientId: calcData.clientId,
                clientName: calcData.clientName,
                calcInputs: calcData.inputs || calcData,
                results: calcData.results || {},
                user: { name: calcData.preparedBy }
            });
            if (calcData.status) taxDoc.status = calcData.status;
            if (calcData.notes) taxDoc.notes = calcData.notes;
            return taxRepository.insertCalculation(taxDoc);
        },
        updateStatus: async (id, status, reviewerName, notes) => {
            return taxRepository.updateCalculationStatus(id, status, reviewerName, notes);
        }
    },

    // Tasks
    tasks: {
        list: ({ clientId, status, assignedStaffId, priority } = {}) => {
            const store = loadStore();
            let result = [...store.tasks];
            if (clientId) result = result.filter(t => t.clientId === clientId);
            if (status && status !== 'all') result = result.filter(t => t.status === status);
            if (assignedStaffId && assignedStaffId !== 'all') result = result.filter(t => t.assignedStaffId === assignedStaffId);
            if (priority && priority !== 'all') result = result.filter(t => t.priority === priority);
            return result.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        },
        getById: (id) => {
            const store = loadStore();
            return store.tasks.find(t => t.id === id);
        },
        create: (taskData) => {
            const store = loadStore();
            const newTask = {
                id: `TSK-${100 + store.tasks.length + 1}`,
                ...taskData,
                status: taskData.status || 'To Do',
                isDemo: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.tasks.unshift(newTask);
            saveStore();
            syncEntityToMongo('tasks', 'upsert', newTask);
            return newTask;
        },
        update: (id, updates) => {
            const store = loadStore();
            const idx = store.tasks.findIndex(t => t.id === id);
            if (idx === -1) return null;
            store.tasks[idx] = {
                ...store.tasks[idx],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            saveStore();
            syncEntityToMongo('tasks', 'upsert', store.tasks[idx]);
            return store.tasks[idx];
        },
        delete: (id) => {
            const store = loadStore();
            const idx = store.tasks.findIndex(t => t.id === id);
            if (idx === -1) return false;
            store.tasks.splice(idx, 1);
            saveStore();
            syncEntityToMongo('tasks', 'delete', null, id);
            return true;
        }
    },

    // Documents
    documents: {
        list: ({ clientId, taxYear, category } = {}) => {
            const store = loadStore();
            let result = [...store.documents];
            if (clientId) result = result.filter(d => d.clientId === clientId);
            if (taxYear && taxYear !== 'all') result = result.filter(d => d.taxYear === taxYear);
            if (category && category !== 'all') result = result.filter(d => d.category === category);
            return result.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        },
        getById: (id) => {
            const store = loadStore();
            return store.documents.find(d => d.id === id);
        },
        create: (docData) => {
            const store = loadStore();
            const newDoc = {
                id: `DOC-${500 + store.documents.length + 1}`,
                ...docData,
                reviewStatus: docData.reviewStatus || 'Pending Verification',
                isDemo: false,
                uploadedAt: new Date().toISOString()
            };
            store.documents.unshift(newDoc);
            saveStore();
            syncEntityToMongo('documents', 'upsert', newDoc);
            return newDoc;
        },
        updateStatus: (id, reviewStatus, verifiedBy, notes) => {
            const store = loadStore();
            const doc = store.documents.find(d => d.id === id);
            if (!doc) return null;
            doc.reviewStatus = reviewStatus;
            if (verifiedBy) doc.verifiedBy = verifiedBy;
            if (notes) doc.notes = notes;
            saveStore();
            syncEntityToMongo('documents', 'upsert', doc);
            return doc;
        },
        delete: (id) => {
            const store = loadStore();
            const idx = store.documents.findIndex(d => d.id === id);
            if (idx === -1) return false;
            store.documents.splice(idx, 1);
            saveStore();
            syncEntityToMongo('documents', 'delete', null, id);
            return true;
        }
    },

    // Compliance
    compliance: {
        list: ({ clientId, complianceType, status } = {}) => {
            const store = loadStore();
            let result = [...store.compliance];
            if (clientId) result = result.filter(c => c.clientId === clientId);
            if (complianceType && complianceType !== 'all') result = result.filter(c => c.complianceType === complianceType);
            if (status && status !== 'all') result = result.filter(c => c.status === status);
            return result.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        },
        getById: (id) => {
            const store = loadStore();
            return store.compliance.find(c => c.id === id);
        },
        create: (item) => {
            const store = loadStore();
            const newItem = {
                id: `CMP-${200 + store.compliance.length + 1}`,
                ...item,
                status: item.status || 'Upcoming',
                isDemo: false,
                createdAt: new Date().toISOString()
            };
            store.compliance.push(newItem);
            saveStore();
            syncEntityToMongo('compliance', 'upsert', newItem);
            return newItem;
        },
        update: (id, updates) => {
            const store = loadStore();
            const item = store.compliance.find(c => c.id === id);
            if (!item) return null;
            Object.assign(item, updates);
            saveStore();
            syncEntityToMongo('compliance', 'upsert', item);
            return item;
        }
    },

    // Invoices & Billing
    invoices: {
        list: ({ clientId, status } = {}) => {
            const store = loadStore();
            let result = [...store.invoices];
            if (clientId) result = result.filter(i => i.clientId === clientId);
            if (status && status !== 'all') result = result.filter(i => i.status === status);
            return result.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
        },
        getById: (id) => {
            const store = loadStore();
            return store.invoices.find(i => i.id === id);
        },
        create: (invData) => {
            const store = loadStore();
            const count = store.invoices.length + 1;
            const newInv = {
                id: `INV-2026-${String(count).padStart(3, '0')}`,
                invoiceNumber: `CAD/26-27/${String(count + 20).padStart(3, '0')}`,
                ...invData,
                status: invData.status || 'Sent',
                payments: [],
                paidAmount: 0,
                balanceDue: invData.totalAmount || 0,
                isDemo: false,
                createdAt: new Date().toISOString()
            };
            store.invoices.unshift(newInv);
            saveStore();
            syncEntityToMongo('invoices', 'upsert', newInv);
            return newInv;
        },
        recordPayment: (id, payment) => {
            const store = loadStore();
            const inv = store.invoices.find(i => i.id === id);
            if (!inv) return null;

            const paymentRecord = {
                paymentId: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
                date: payment.date || new Date().toISOString().substring(0, 10),
                amount: Number(payment.amount),
                mode: payment.mode || 'Bank Transfer',
                referenceNo: payment.referenceNo || 'REF-' + Date.now(),
                recordedBy: payment.recordedBy || 'Authorized Staff'
            };

            inv.payments.push(paymentRecord);
            inv.paidAmount = (inv.paidAmount || 0) + paymentRecord.amount;
            inv.balanceDue = Math.max(0, inv.totalAmount - inv.paidAmount);

            if (inv.balanceDue === 0) {
                inv.status = 'Paid';
            } else if (inv.paidAmount > 0) {
                inv.status = 'Partially Paid';
            }

            saveStore();
            syncEntityToMongo('invoices', 'upsert', inv);
            return inv;
        }
    },

    // Alerts
    alerts: {
        list: () => {
            const store = loadStore();
            return [...store.alerts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        },
        markRead: (id) => {
            const store = loadStore();
            const alert = store.alerts.find(a => a.id === id);
            if (alert) {
                alert.isRead = true;
                saveStore();
                syncEntityToMongo('alerts', 'upsert', alert);
            }
            return alert;
        },
        markAllRead: () => {
            const store = loadStore();
            store.alerts.forEach(a => a.isRead = true);
            saveStore();
            return true;
        },
        create: (alertData) => {
            const store = loadStore();
            const newAlert = {
                id: `ALT-${100 + store.alerts.length + 1}`,
                ...alertData,
                isRead: false,
                createdAt: new Date().toISOString()
            };
            store.alerts.unshift(newAlert);
            saveStore();
            syncEntityToMongo('alerts', 'upsert', newAlert);
            return newAlert;
        }
    },

    // Audit Logs
    auditLogs: {
        log: (userId, userName, action, entityType, entityId, details = {}) => {
            const store = loadStore();
            const newLog = {
                id: `AUD-${String(store.auditLogs.length + 1).padStart(3, '0')}`,
                userId,
                userName,
                action,
                entityType,
                entityId,
                details,
                timestamp: new Date().toISOString()
            };
            store.auditLogs.unshift(newLog);
            if (store.auditLogs.length > 500) {
                store.auditLogs.pop();
            }
            saveStore();
            syncEntityToMongo('auditLogs', 'upsert', newLog);
            return newLog;
        },
        list: (limit = 100) => {
            const store = loadStore();
            return store.auditLogs.slice(0, limit);
        }
    },

    // Dashboard metrics aggregation
    getDashboardMetrics: async () => {
        const store = loadStore();
        const totalClients = store.clients.length;
        const activeClients = store.clients.filter(c => c.status === 'active').length;
        const openTasks = store.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;
        const today = new Date().toISOString().substring(0, 10);
        const overdueTasks = store.tasks.filter(t => t.dueDate < today && t.status !== 'Completed' && t.status !== 'Cancelled').length;

        const upcomingCompliance = store.compliance.filter(c => c.status !== 'Filed / Completed').length;

        // Fetch tax metrics directly from the MongoDB `Tax` collection
        let taxCalculationsCompleted = store.taxCalculations ? store.taxCalculations.length : 0;
        let calculationsAwaitingReview = 0;
        let recentCalculations = [];

        try {
            const taxMetrics = await taxRepository.getTaxMetrics();
            taxCalculationsCompleted = taxMetrics.totalCount;
            calculationsAwaitingReview = taxMetrics.pendingCount;
            recentCalculations = taxMetrics.recentCalculations;
        } catch (e) {
            console.warn('[CA Desk] Error fetching tax metrics from Tax collection:', e.message);
        }

        const outstandingInvoices = store.invoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled');
        const outstandingAmount = outstandingInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

        return {
            totalClients,
            activeClients,
            openTasks,
            overdueTasks,
            upcomingCompliance,
            taxCalculationsCompleted,
            calculationsAwaitingReview,
            outstandingInvoicesCount: outstandingInvoices.length,
            outstandingAmount,
            recentTasks: store.tasks.slice(0, 5),
            recentClients: store.clients.slice(0, 5),
            recentCalculations,
            upcomingComplianceList: store.compliance.slice(0, 5),
            recentAlerts: store.alerts.slice(0, 5),
            pendingDocuments: store.documents.filter(d => d.reviewStatus === 'Pending Verification' || d.reviewStatus === 'Needs Clarification').slice(0, 5)
        };
    }
};

module.exports = DataStore;
