import * as fs from 'fs';
import * as path from 'path';
import { generateCacheKey, runNeuralUpscale } from './aiUpscaler';
import { MaxQualitySettings } from './aiUpscaler';

const inputVideo = path.join(__dirname, '..', '..', 'test_qsv.mp4');
const tempDir = path.join(__dirname, 'tmp');
const mockOutput = path.join(tempDir, 'mock-upscaled.mp4');

// Ensure directories exist
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Create a small placeholder input file if it does not exist
if (!fs.existsSync(inputVideo)) {
  console.log(`Creating dummy input video at ${inputVideo}`);
  fs.writeFileSync(inputVideo, 'placeholder content for video testing');
}

async function runTests() {
  console.log('=== STARTING G5.2A AI UPSCALER TESTS ===');

  const settings1: MaxQualitySettings = {
    stabilization: false,
    denoise: false,
    sharpen: false,
    colorRecovery: false,
    upscaleFactor: '2x',
    resolution: '1080p',
    neuralUpscale: true,
    aiUpscaleFactor: '2x'
  };

  const key1 = generateCacheKey(inputVideo, settings1);

  // Resolve target renders directory exactly like uploadToGcs
  const rendersDir = path.join(process.cwd(), 'public', 'renders');
  const targetRendersDir = (!fs.existsSync(rendersDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'renders')))
    ? path.join(process.cwd(), '..', '..', 'public', 'renders')
    : rendersDir;
  
  const mockCachePath = path.join(targetRendersDir, `${key1}.mp4`);

  // Clean up any stale cache from previous test runs first
  if (fs.existsSync(mockCachePath)) {
    console.log(`Cleaning up stale cache file: ${mockCachePath}`);
    fs.unlinkSync(mockCachePath);
  }

  // Test Case 1: Hashing & Cache Key Stability
  console.log('\n[Test 1] Verifying SHA-256 Cache Key generation...');
  const key2 = generateCacheKey(inputVideo, settings1);
  if (key1 !== key2) {
    throw new Error('FAIL: Hashing is non-deterministic!');
  }
  console.log(`SUCCESS: Deterministic hash created: ${key1}`);

  const settingsDiff: MaxQualitySettings = {
    ...settings1,
    aiUpscaleFactor: '4x'
  };
  const keyDiff = generateCacheKey(inputVideo, settingsDiff);
  if (key1 === keyDiff) {
    throw new Error('FAIL: Changing settings did not alter the cache key!');
  }
  console.log(`SUCCESS: Altered settings changed cache key correctly: ${keyDiff}`);

  // Test Case 2: Missing Token Fallback
  console.log('\n[Test 2] Verifying fallback behavior when token is missing...');
  const originalToken = process.env.REPLICATE_API_TOKEN;
  delete process.env.REPLICATE_API_TOKEN;

  const res2 = await runNeuralUpscale(
    inputVideo,
    mockOutput,
    settings1,
    'gs://cineforge-media-bucket/rendered/test.mp4',
    tempDir,
    '10s',
    'test-job-id'
  );

  if (res2.success || !res2.fallbackReason?.toLowerCase().includes('missing')) {
    throw new Error(`FAIL: Missing token test should have failed and triggered fallback. Result: ${JSON.stringify(res2)}`);
  }
  console.log('SUCCESS: Fallback triggered correctly. Reason:', res2.fallbackReason);

  // Test Case 3: Invalid Token Fallback
  console.log('\n[Test 3] Verifying fallback behavior when token is invalid...');
  process.env.REPLICATE_API_TOKEN = 'invalid-token';

  const res3 = await runNeuralUpscale(
    inputVideo,
    mockOutput,
    settings1,
    'gs://cineforge-media-bucket/rendered/test.mp4',
    tempDir,
    '10s',
    'test-job-id'
  );

  if (res3.success || !res3.fallbackReason?.toLowerCase().includes('invalid')) {
    throw new Error(`FAIL: Invalid token test should have failed and triggered fallback. Result: ${JSON.stringify(res3)}`);
  }
  console.log('SUCCESS: Fallback triggered correctly. Reason:', res3.fallbackReason);

  // Test Case 4: Cache Hit Flow (using mock-token)
  console.log('\n[Test 4] Verifying cache hit behavior with mock-token...');
  process.env.REPLICATE_API_TOKEN = 'mock-token';

  // Run 1: Should be a cache miss
  console.log('Running first upscale request (expected cache miss)...');
  const res4a = await runNeuralUpscale(
    inputVideo,
    mockOutput,
    settings1,
    'gs://cineforge-media-bucket/rendered/test.mp4',
    tempDir,
    '10s',
    'test-job-id'
  );

  if (!res4a.success || res4a.cacheHit) {
    throw new Error(`FAIL: First run should succeed as a cache miss. Result: ${JSON.stringify(res4a)}`);
  }
  console.log('SUCCESS: First run completed. Cache Hit: false. Provider:', res4a.provider);

  // Run 2: Should be a cache hit
  console.log('Running second upscale request (expected cache hit)...');
  const res4b = await runNeuralUpscale(
    inputVideo,
    mockOutput,
    settings1,
    'gs://cineforge-media-bucket/rendered/test.mp4',
    tempDir,
    '10s',
    'test-job-id'
  );

  if (!res4b.success || !res4b.cacheHit) {
    throw new Error(`FAIL: Second run should hit the cache. Result: ${JSON.stringify(res4b)}`);
  }
  console.log('SUCCESS: Second run completed. Cache Hit: true. Provider:', res4b.provider);

  // Test Case 5: Budget Cap Fallback Test
  console.log('\n[Test 5] Verifying budget cap enforcement...');
  // Force high duration (15s) which leads to estimated cost > $1.00
  const res5 = await runNeuralUpscale(
    inputVideo,
    mockOutput,
    settings1,
    'gs://cineforge-media-bucket/rendered/test.mp4',
    tempDir,
    '15s',
    'test-job-id'
  );

  if (res5.success || !res5.fallbackReason?.toLowerCase().includes('limit exceeded')) {
    throw new Error(`FAIL: Budget cap / duration limit test should have failed and triggered fallback. Result: ${JSON.stringify(res5)}`);
  }
  console.log('SUCCESS: Budget cap block triggered correctly. Reason:', res5.fallbackReason);

  // Restoring token
  if (originalToken) {
    process.env.REPLICATE_API_TOKEN = originalToken;
  } else {
    delete process.env.REPLICATE_API_TOKEN;
  }

  // Cleanup local mock cache file
  if (fs.existsSync(mockCachePath)) {
    fs.unlinkSync(mockCachePath);
  }
  if (fs.existsSync(mockOutput)) {
    fs.unlinkSync(mockOutput);
  }

  console.log('\n=== ALL G5.2A AI UPSCALER TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((e) => {
  console.error('\nTests failed with error:', e);
  process.exit(1);
});
