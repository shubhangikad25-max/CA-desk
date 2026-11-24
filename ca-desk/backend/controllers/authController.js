const crypto = require('crypto');
const DataStore = require('../models/dataStore');
const { generateToken } = require('../middleware/auth');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const user = DataStore.users.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email address or password.'
            });
        }

        const hashed = hashPassword(password);
        if (user.passwordHash !== hashed) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email address or password.'
            });
        }

        const token = generateToken(user);
        const { passwordHash, ...safeUser } = user;

        DataStore.auditLogs.log(user.id, user.name, 'USER_LOGIN', 'User', user.id, {
            email: user.email,
            role: user.role
        });

        return res.json({
            success: true,
            message: `Welcome back, ${user.name}`,
            token,
            user: safeUser
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error during login' });
    }
}

async function getCurrentUser(req, res) {
    try {
        const { passwordHash, ...safeUser } = req.user;
        return res.json({
            success: true,
            user: safeUser
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error retrieving user profile' });
    }
}

async function getStaffList(req, res) {
    try {
        const staff = DataStore.users.list();
        return res.json({
            success: true,
            data: staff
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error fetching staff members' });
    }
}

// Quick staff switcher for demo / local testing
async function demoSwitchUser(req, res) {
    try {
        const { userId } = req.body;
        const user = DataStore.users.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }
        const token = generateToken(user);
        const { passwordHash, ...safeUser } = user;
        return res.json({
            success: true,
            token,
            user: safeUser
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to switch user' });
    }
}

module.exports = {
    login,
    getCurrentUser,
    getStaffList,
    demoSwitchUser
};
