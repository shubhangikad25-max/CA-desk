const { spawn } = require('child_process');
const path = require('path');

console.log('==============================================================');
console.log('  Launching Whole Project: TaxWise (3000) & CA Desk (3001)     ');
console.log('==============================================================\n');

// 1. TaxWise standalone server (Port 3000)
const taxwise = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

// 2. CA Desk enterprise server (Port 3001)
const cadesk = spawn('node', ['backend/server.js'], {
    cwd: path.join(__dirname, 'ca-desk'),
    stdio: 'inherit'
});

function cleanup() {
    console.log('\nStopping servers...');
    try { if (taxwise && !taxwise.killed) taxwise.kill(); } catch (e) {}
    try { if (cadesk && !cadesk.killed) cadesk.kill(); } catch (e) {}
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
