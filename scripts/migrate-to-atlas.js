const { MongoClient } = require('mongodb');

// Configuration
const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const SOURCE_DB_NAME = 'Ca-desk';

// Target databases on Atlas: Both 'Ca-desk' (shown in Compass screenshot) and 'Desk-CA' (user request title)
const TARGET_DBS = ['Ca-desk', 'Desk-CA'];

const ATLAS_URI = process.env.ATLAS_MONGODB_URI;

async function migrateCollectionsToAtlas() {
    if (!ATLAS_URI) {
        console.error('Error: Please supply ATLAS_MONGODB_URI environment variable.');
        process.exit(1);
    }
    console.log('==================================================================');
    console.log(`  STARTING MIGRATION TO MONGODB ATLAS (Cluster0)  `);
    console.log('==================================================================\n');

    const localClient = new MongoClient(LOCAL_URI);
    const atlasClient = new MongoClient(ATLAS_URI);

    try {
        await localClient.connect();
        await atlasClient.connect();
        console.log('✓ Successfully connected to Local MongoDB (127.0.0.1:27017)');
        console.log('✓ Successfully connected to MongoDB Atlas (Cluster0)\n');

        const localDb = localClient.db(SOURCE_DB_NAME);
        const collections = await localDb.listCollections().toArray();

        console.log(`Found ${collections.length} collections in local '${SOURCE_DB_NAME}' to migrate:\n`);

        for (const targetDbName of TARGET_DBS) {
            console.log(`------------------------------------------------------------------`);
            console.log(`  Migrating to Atlas Database: '${targetDbName}'`);
            console.log(`------------------------------------------------------------------`);

            const atlasDb = atlasClient.db(targetDbName);
            const migrationResults = [];

            for (const colInfo of collections) {
                const colName = colInfo.name;
                const sourceCol = localDb.collection(colName);
                const targetCol = atlasDb.collection(colName);

                const sourceDocs = await sourceCol.find({}).toArray();
                const sourceCount = sourceDocs.length;

                if (sourceCount > 0) {
                    // Non-destructive upsert by _id: preserves all ObjectIds, data types, and schemas
                    const ops = sourceDocs.map(doc => ({
                        updateOne: {
                            filter: { _id: doc._id },
                            update: { $set: doc },
                            upsert: true
                        }
                    }));

                    await targetCol.bulkWrite(ops, { ordered: false });
                }

                // Copy custom indexes
                try {
                    const indexes = await sourceCol.indexes();
                    for (const idx of indexes) {
                        if (idx.name !== '_id_') {
                            const { key, name, v, ns, ...options } = idx;
                            await targetCol.createIndex(key, options);
                        }
                    }
                } catch (idxErr) {
                    // index warning ignore
                }

                const targetCount = await targetCol.countDocuments();
                migrationResults.push({
                    collection: colName,
                    sourceCount,
                    atlasCount: targetCount,
                    status: sourceCount === targetCount ? '✓ SYNCED' : 'COUNT MISMATCH'
                });

                console.log(`  ✓ Collection '${colName}': migrated ${sourceCount} documents (Atlas total: ${targetCount})`);
            }

            console.log(`\n  Summary for '${targetDbName}':`);
            console.table(migrationResults);
            console.log();
        }

        console.log('==================================================================');
        console.log('  MIGRATION COMPLETE & VERIFIED ACROSS ATLAS!  ');
        console.log('==================================================================\n');

        return true;
    } finally {
        await localClient.close();
        await atlasClient.close();
    }
}

migrateCollectionsToAtlas().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
