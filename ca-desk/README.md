# CA Desk — Chartered Accountant Office Management Platform with Integrated TaxWise Engine

CA Desk is a comprehensive office management and tax computation platform engineered for Indian Chartered Accountant (CA) firms, with the **TaxWise Indian Income Tax Calculator & Planning Engine** fully integrated as a first-class internal module.

---

## 1. Architectural Overview & System Design

CA Desk and TaxWise operate on a clean architectural responsibility split:

### CA Desk Ownership:
- **Authentication & Security:** Role-based access control with staff accounts (`admin` Managing Partner / CA Owner, `reviewer` Senior CA, `preparer` Article/Staff, and `readonly` Trainee) and JWT session handling.
- **Client Management:** Multi-category client directory supporting all Indian taxpayer categories (`Individual`, `HUF`, `Domestic Company`, `Foreign Company`, `Partnership Firm / LLP`, `Cooperative Society`, `Local Authority`, and `AOP / BOI / AJP`).
- **Dedicated Client Workspaces:** 8 tabs per client:
  1. **Overview:** High-level executive summary, assigned CA, latest tax calculation, balance receivable.
  2. **TaxWise Calculator:** Directly embedded TaxWise interface pre-populated with client parameters (name, age, residency, taxpayer category, prior year figures).
  3. **Tax History:** Client-linked versioned calculation records (`v1`, `v2`, `v3`...) with audit trail, review status (`Draft`, `Under Review`, `Approved`, `Finalized`, `Superseded`), and reopening capability.
  4. **Documents:** Central document repository with verification workflow (`Pending Verification`, `Verified`, `Needs Clarification`, `Rejected`) and secure downloads.
  5. **Tasks & Review:** Office task tracker linked to clients with priority badges and due dates.
  6. **Compliance Calendar:** Statutory compliance tracker for Advance Tax, quarterly TDS returns (Form 24Q / 26Q), non-audit ITRs (July 31), tax audits (Form 3CA / 3CD), and corporate returns (ITR-6).
  7. **Billing & Invoices:** GST-compliant professional fee invoicing (SAC 998231 @ 18% GST), payment recording, and balance tracking.
  8. **Audit Trail:** Complete log of actions performed on client accounts.
- **Global TaxWise Hub:** Standalone calculation workspace with client switcher and walk-in client support.
- **Executive Reports & Analytics:** Firm-wide tax liability breakdown by assessment year and regime, review queues, and printable Computation Memorandums.

### TaxWise Ownership:
- Reused directly from `services/taxService.js` without formula duplication.
- Official progressive tax slabs for FY 2026-27 (enacted Budget 2025/2026 slabs up to ₹24L+), FY 2025-26, and FY 2024-25.
- Rebate Section 87A with Marginal Relief under New Regime (₹12L threshold in FY 2026-27 & FY 2025-26).
- Special tax rates on capital gains: STCG u/s 111A (20%), LTCG u/s 112A (12.5% with ₹1.25L statutory exemption).
- Surcharge brackets and Section 89 surcharge marginal relief.
- Side-by-side Regime Comparison (New vs Old).
- Category-specific tax planning recommendations and interactive tax-saving simulator.

---

## 2. Directory Structure

```text
form-aiml/
├── controllers/
│   └── taxController.js            # Existing TaxWise root controller
├── data/
│   └── tax-data.json               # Tax slabs, cess, surcharge & rates
├── public/                         # Existing TaxWise frontend (port 3000)
├── routes/
│   └── taxRoutes.js                # Existing TaxWise API routes
├── services/
│   ├── mongo.js                    # MongoDB connector
│   └── taxService.js               # Core Indian Income Tax computation engine
├── tests/                          # Root test suite (40 tests passing)
├── server.js                       # Root TaxWise server (port 3000)
├── todo-app/                       # Unmodified existing directory
│
└── ca-desk/                        # Complete CA Desk Enterprise Application
    ├── backend/
    │   ├── config/
    │   │   └── db.js               # MongoDB + JSON persistence store
    │   ├── controllers/
    │   │   ├── alertController.js
    │   │   ├── authController.js
    │   │   ├── billingController.js
    │   │   ├── clientController.js
    │   │   ├── complianceController.js
    │   │   ├── dashboardController.js
    │   │   ├── documentController.js
    │   │   ├── reportController.js
    │   │   ├── taskController.js
    │   │   └── taxCalculationController.js   # Directly invokes ../../../services/taxService.js
    │   ├── middleware/
    │   │   ├── auth.js             # JWT & role-based middleware
    │   │   └── upload.js           # Multer document upload handler
    │   ├── models/
    │   │   └── dataStore.js        # Multi-entity repository with seed demo records
    │   ├── routes/
    │   │   └── api.js              # Complete CA Desk REST API
    │   └── server.js               # Express application on port 3001
    ├── frontend/
    │   ├── css/
    │   │   └── style.css           # Modern CA Desk design system (Dark navy, Plus Jakarta Sans)
    │   ├── js/
    │   │   ├── api.js              # Frontend REST API client
    │   │   └── app.js              # Single-page application router & components
    │   └── index.html              # Responsive desktop & tablet application layout
    ├── tests/
    │   └── caDesk.test.js          # Automated end-to-end test suite
    ├── package.json
    └── README.md
```

---

## 3. Port Assignments & Running the Applications

Both applications can run concurrently without port conflicts:

| Application | Port | URL | Description |
| :--- | :--- | :--- | :--- |
| **TaxWise (Standalone)** | `3000` | `http://localhost:3000` | Original standalone calculator for development & unit testing |
| **CA Desk Platform** | `3001` | `http://localhost:3001` | Complete CA office management platform with integrated TaxWise |

### Startup Commands:

#### To start CA Desk (Port 3001):
```bash
cd form-aiml/ca-desk
npm start
```
Then open `http://localhost:3001` in your browser.

#### To run CA Desk Test Suite:
```bash
cd form-aiml/ca-desk
npm test
```

#### To run existing root TaxWise Test Suite:
```bash
cd form-aiml
npm test
```

---

## 4. Default Demo Accounts

CA Desk comes pre-seeded with sample CA office records (clearly flagged with `isDemo: true`):

| Staff Name | Email | Password | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **CA Rajesh Sharma** | `rajesh@sharmaca.in` | `admin123` | `admin` | Managing Partner (FCA 104829) |
| **CA Pooja Verma** | `pooja@sharmaca.in` | `reviewer123` | `reviewer` | Senior Tax Manager (ACA 529143) |
| **Amit Patel** | `amit@sharmaca.in` | `preparer123` | `preparer` | Senior Article Assistant |
| **Sneha Rao** | `sneha@sharmaca.in` | `readonly123` | `readonly` | Audit & Compliance Trainee |

*Note: You can switch between active staff sessions instantly using the "ACTIVE STAFF" dropdown in the top navigation bar.*

---

## 5. Sample Pre-Seeded Clients

1. **Vikram Malhotra (CLI-1001)** — *Individual* | Salaried Tech Executive (₹25,00,000 salary + ESOPs + Home loan)
2. **Dr. Sunita Kulkarni (CLI-1002)** — *Individual* | Medical Consultant (₹36,00,000 business & profession)
3. **Mehta & Sons HUF (CLI-1003)** — *HUF* | Ancestral commercial property rent & mutual funds
4. **NovaTech Solutions Pvt Ltd (CLI-1004)** — *Domestic Company* | SaaS product development firm (Section 115BAA 22%)
5. **Apex Advisory LLP (CLI-1005)** — *Firm / LLP* | Management consulting LLP (30% flat rate)
