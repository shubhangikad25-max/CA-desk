const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Auto-load .env if available
try {
    const rootEnv = path.join(__dirname, '../../../.env');
    const localEnv = path.join(__dirname, '../.env');
    if (fs.existsSync(rootEnv) && process.loadEnvFile) process.loadEnvFile(rootEnv);
    else if (fs.existsSync(localEnv) && process.loadEnvFile) process.loadEnvFile(localEnv);
    else if (process.loadEnvFile) process.loadEnvFile();
} catch (e) {}

const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'Desk-CA';

let client;
let db = null;
let isConnected = false;

async function initDB() {
    if (db) return db;
    try {
        client = new MongoClient(url, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        await client.connect();
        db = client.db(DB_NAME);
        isConnected = true;
        console.log(`[CA Desk] Connected to MongoDB database: ${DB_NAME}`);
        await ensureTaxIndexes(db);
        return db;
    } catch (err) {
        console.warn(`[CA Desk] MongoDB connection failed: ${err.message}. Operating in resilient JSON file persistence mode.`);
        isConnected = false;
        return null;
    }
}

async function ensureTaxIndexes(dbInstance) {
    if (!dbInstance) return;
    try {
        const col = dbInstance.collection('Tax');
        await col.createIndex({ calculationId: 1 }, { unique: true, sparse: true });
        await col.createIndex({ clientId: 1 }, { sparse: true });
        await col.createIndex({ financialYear: 1 });
        await col.createIndex({ createdAt: -1 });
        await col.createIndex({ status: 1 });
    } catch (e) {
        console.warn('[CA Desk] Note on Tax collection indexes:', e.message);
    }
}

function getDB() {
    return db;
}

function hasMongoDB() {
    return isConnected && db !== null;
}

module.exports = {
    initDB,
    getDB,
    hasMongoDB
};
