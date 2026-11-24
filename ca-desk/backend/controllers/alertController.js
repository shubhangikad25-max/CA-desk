const DataStore = require('../models/dataStore');

async function getAlerts(req, res) {
    try {
        const alerts = DataStore.alerts.list();
        return res.json({
            success: true,
            count: alerts.length,
            unreadCount: alerts.filter(a => !a.isRead).length,
            data: alerts
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
    }
}

async function markAlertRead(req, res) {
    try {
        const { id } = req.params;
        const alert = DataStore.alerts.markRead(id);
        if (!alert) {
            return res.status(404).json({ success: false, message: 'Alert not found' });
        }
        return res.json({ success: true, data: alert });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update alert' });
    }
}

async function markAllAlertsRead(req, res) {
    try {
        DataStore.alerts.markAllRead();
        return res.json({ success: true, message: 'All alerts marked as read' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to mark alerts as read' });
    }
}

module.exports = {
    getAlerts,
    markAlertRead,
    markAllAlertsRead
};
