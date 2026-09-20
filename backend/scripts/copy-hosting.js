const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../web-preregistration');
const dest = path.resolve(__dirname, '../public');

try {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[predeploy] Successfully synced web-preregistration to backend/public`);
} catch (err) {
  console.error('[predeploy] Error copying hosting files:', err);
  process.exit(1);
}
