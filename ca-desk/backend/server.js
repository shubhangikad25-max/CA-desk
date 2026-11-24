
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDB } = require('./config/db');
const DataStore = require('./models/dataStore');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static assets from ca-desk/frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
app.use('/api', apiRoutes);

// SPA fallback: any non-API route serves frontend/index.html
app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
        return next();
    }
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath);
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[CA Desk Server Error]:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
});

// Boot server
async function startServer() {
    try {
        await initDB();
        await DataStore.init();
        const server = app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`  CA Desk Enterprise Platform is live!                `);
            console.log(`  URL: http://localhost:${PORT}                       `);
            console.log(`  TaxWise Integration: Active (via taxService engine)  `);
            console.log(`=======================================================`);
        });
        return server;
    } catch (err) {
        console.error('Failed to start CA Desk server:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
