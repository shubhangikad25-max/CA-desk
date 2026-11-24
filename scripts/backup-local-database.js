const { MongoClient, BSON } = require('mongodb');
const fs = require('fs');
const path = require('path');

const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'Ca-desk';

async function backupLocalDatabase() {
    console.log('==================================================================');
    console.log(`  BACKUP: Starting complete backup of local database '${DB_NAME}'  `);
    console.log('==================================================================\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `cadesk-backup-${timestamp}`);
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const client = new MongoClient(LOCAL_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const collections = await db.listCollections().toArray();
    const meta = {
        database: DB_NAME,
        createdAt: new Date().toISOString(),
        collections: []
    };

    let totalDocs = 0;

    for (const colInfo of collections) {
        const colName = colInfo.name;
        const col = db.collection(colName);
        const docs = await col.find({}).toArray();
        const count = docs.length;
        totalDocs += count;

        // Use Canonical Extended JSON (EJSON) to preserve exact BSON types:
        // ObjectIds ($oid), Dates ($date), Int32/Int64 ($numberLong), etc.
        const ejsonData = BSON.EJSON.stringify(docs, { relaxed: false }, 2);
        const filePath = path.join(backupDir, `${colName}.json`);
        fs.writeFileSync(filePath, ejsonData, 'utf-8');

        console.log(`  ✓ Saved collection '${colName}': ${count} documents -> ${filePath}`);
        meta.collections.push({
            name: colName,
            count,
            file: `${colName}.json`
        });
    }

    meta.totalCollections = collections.length;
    meta.totalDocuments = totalDocs;

    const metaPath = path.join(backupDir, 'backup-metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    console.log(`\n  ✓ Backup Metadata saved to: ${metaPath}`);
    console.log(`  ✓ Total Collections backed up: ${collections.length}`);
    console.log(`  ✓ Total Documents backed up: ${totalDocs}`);
    console.log(`  ✓ Backup Directory: ${backupDir}\n`);

    await client.close();
    return { backupDir, meta };
}

backupLocalDatabase().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
});
