const { execSync } = require('child_process');
const path = require('path');

try {
  execSync('node_modules\\.bin\\ts-node --compiler-options "{\\\"module\\\":\\\"commonjs\\\",\\\"moduleResolution\\\":\\\"node\\\"}\" ../../src/lib/test-g44b-validation.ts', {
    cwd: path.join(__dirname, '../infrastructure/render-gcp'),
    stdio: 'inherit'
  });
} catch (err) {
  process.exit(1);
}
