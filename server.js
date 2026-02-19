const createApp = require('./server/app');
const fs = require('fs');
const path = require('path');

// Initialize database (via route requires inside createApp)
const app = createApp();

const PORT = process.env.PORT || 3000;
const dbDir = fs.existsSync('/app/data') ? '/app/data' : __dirname;
const dbPath = path.join(dbDir, 'gass.db');

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  console.log('\n=== GASS Server Started ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Port: ${PORT}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('\nAccess URLs:');
  console.log(`  Local:   http://localhost:${PORT}`);

  Object.keys(interfaces).forEach(ifname => {
    interfaces[ifname].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Network: http://${iface.address}:${PORT}`);
      }
    });
  });

  console.log('\nPress Ctrl+C to stop\n');
});
