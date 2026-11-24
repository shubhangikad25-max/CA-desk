const DataStore = require('../models/dataStore');

async function getDashboardData(req, res) {
    try {
        const metrics = await DataStore.getDashboardMetrics();
        return res.json({
            success: true,
            data: metrics
        });
    } catch (err) {
        console.error('getDashboardData error:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
    }
}

module.exports = {
    getDashboardData
};
