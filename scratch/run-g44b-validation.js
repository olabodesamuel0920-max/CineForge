const { execSync } = require('child_process');

try {
  execSync('node_modules\\.bin\\ts-node --compiler-options "{\\\"module\\\":\\\"commonjs\\\",\\\"moduleResolution\\\":\\\"node\\\"}\" ../../src/lib/test-g44b-validation.ts', {
    cwd: 'c:/Users/colds/Documents/GitHub/CineForge/infrastructure/render-gcp',
    stdio: 'inherit'
  });
} catch (err) {
  process.exit(1);
}
