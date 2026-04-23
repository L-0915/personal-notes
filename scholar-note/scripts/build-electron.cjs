const { execSync } = require('child_process');

execSync('npx tsc -p tsconfig.electron.json', { stdio: 'inherit' });
console.log('Electron build complete.');
