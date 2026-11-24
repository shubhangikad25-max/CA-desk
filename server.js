const express = require('express');
const path = require('path');
const taxRoutes = require('./routes/taxRoutes');
const { connectDB } = require('./services/mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON request parsing
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes mounted at /, /api, and /api/tax for total compatibility
app.use('/api', taxRoutes);
app.use('/api/tax', taxRoutes);
app.use('/', taxRoutes);

// Test route
app.get('/test', (req, res) => {
    res.send('Server is working!');
});

// Handle unknown routes
app.use((req, res) => {
    console.log(`Route not found: ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        success: false,
        message: 'Route not found',
        requestedRoute: req.originalUrl
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);

    res.status(500).json({
        success: false,
        message: 'Server error'
    });
});

app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    try {
        await connectDB();
    } catch (err) {
        console.warn('MongoDB connection note:', err.message);
    }
});