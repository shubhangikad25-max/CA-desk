# CA Desk & TaxWise — Enterprise Chartered Accountant Office Suite

An integrated, enterprise-grade office management platform and computational tax engine engineered for Indian Chartered Accountant (CA) firms, taxpayers, and financial advisors.

---

## 🏛️ System Architecture

The project consists of two complementary layers:

```
form-aiml/
├── controllers/            # TaxWise API controllers (health, slabs, calculation, simulation)
│   └── taxController.js
├── routes/                 # TaxWise API endpoints (/api/calculate, /api/slabs, /api/years)
│   └── taxRoutes.js
├── services/               # Core shared calculation engine & database connectors
│   ├── taxService.js       # Official Indian Income Tax progressive computation engine
│   └── mongo.js            # MongoDB connection manager
├── data/                   # Statutory tax rates, slabs, surcharge brackets & deductions
│   └── tax-data.json
├── public/                 # TaxWise Standalone Web Application (Port 3000)
│   ├── index.html
│   ├── script.js
│   └── style.css
├── scripts/                # Database utilities and maintenance scripts
│   └── testMongo.js        # MongoDB connection verification utility
├── tests/                  # TaxWise standalone test suite (40 automated tests)
│   ├── apiEndpoints.test.js
│   ├── comprehensiveEnhancements.test.js
│   ├── multiTaxpayerAndPlanning.test.js
│   └── taxService.test.js
│
├── ca-desk/                # CA Desk Enterprise Office Platform (Port 3001)
│   ├── backend/            # Express REST API, 4-tier RBAC, Multer document uploads
│   │   ├── config/         # Resilient DB connector (MongoDB + JSON fallback)
│   │   ├── controllers/    # Clients, Tasks, Compliance, Documents, Invoicing
│   │   ├── middleware/     # JWT authentication and role enforcement
│   │   ├── models/         # Multi-entity repository & audit logger
│   │   └── server.js
│   ├── frontend/           # Modern Single-Page Application (SPA) with live hash router
│   │   ├── css/            # Enterprise design system
│   │   ├── js/             # API client, SPA controller, and embedded TaxWise hub
│   │   └── index.html
│   └── tests/              # CA Desk end-to-end integration test suite (17 tests)
│
└── playground/             # Standalone sandbox & prototype exercises
    └── todo-app/           # Practice todo application (isolated from core suite)
```

---

## 🚀 Running the Services

### Start Everything (Unified Launcher)
```bash
npm run start:all
```
* **TaxWise Standalone:** [http://localhost:3000](http://localhost:3000)
* **CA Desk Enterprise:** [http://localhost:3001](http://localhost:3001)

### Start Individual Services
```bash
# Run TaxWise Standalone only (Port 3000)
npm start

# Run CA Desk Platform only (Port 3001)
npm run start:cadesk
```

---

## 🧪 Automated Testing

Both suites can be executed independently or together:

```bash
# Run all tests across both applications (57 total tests)
npm run test:all

# Run TaxWise tests only (40 tests)
npm test

# Run CA Desk tests only (17 tests)
npm run test:cadesk
```

---

## 🔑 Default Staff Credentials (CA Desk)

| Role | Staff Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | CA Rajesh Sharma | `rajesh@sharmaca.in` | `admin123` |
| **Reviewer** | CA Pooja Verma | `pooja@sharmaca.in` | `reviewer123` |
| **Preparer** | Amit Patel | `amit@sharmaca.in` | `preparer123` |
| **Read-Only** | Sneha Rao | `sneha@sharmaca.in` | `readonly123` |
