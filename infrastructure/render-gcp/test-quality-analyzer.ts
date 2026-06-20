import { analyzeVideoQuality } from './qualityAnalyzer';
import * as path from 'path';
import * as fs from 'fs';

const inputVideo = path.join(__dirname, '..', '..', 'test_qsv.mp4');
const tempDir = path.join(__dirname, 'tmp');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('Testing quality analyzer on:', inputVideo);
try {
  const metrics = analyzeVideoQuality(inputVideo, tempDir);
  console.log('Successfully analyzed video! Results:');
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
} catch (e) {
  console.error('Analyzer test failed:', e);
  process.exit(1);
}
