const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Auto-load .env if available
try {
    const rootEnv = path.join(__dirname, '../.env');
    if (fs.existsSync(rootEnv) && process.loadEnvFile) process.loadEnvFile(rootEnv);
    else if (process.loadEnvFile) process.loadEnvFile();
} catch (e) {}

const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';

let client = null;
let db = null;
let connectionPromise = null;

async function connectDB() {
    if (db) {
        return db;
    }

    if (!connectionPromise) {
        client = new MongoClient(url, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });
        connectionPromise = client.connect()
            .then(() => {
                const dbName = process.env.MONGODB_DB_NAME || 'Desk-CA';
                db = client.db(dbName);
                console.log(`MongoDB connected: ${dbName}`);
                return db;
            })
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    return connectionPromise;
}

async function closeDB() {
    try {
        if (client) {
            await client.close();
            client = null;
            db = null;
            connectionPromise = null;
        }
    } catch (err) {
        // ignore close error
    }
}

module.exports = { connectDB, closeDB };
