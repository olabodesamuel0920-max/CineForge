import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { downloadFromGcs, uploadToGcs, generateGcsSignedUrl, parseGcsUri } from './gcs';

export interface MaxQualitySettings {
  stabilization: boolean;
  denoise: boolean;
  sharpen: boolean;
  colorRecovery: boolean;
  upscaleFactor: 'none' | '2x' | '4x';
  resolution: '720p' | '1080p' | '4K' | '8K' | '16K';
  neuralUpscale?: boolean;
  aiUpscaleFactor?: 'none' | '2x' | '4x';
  aiBudgetCap?: number;
  faceRestoration?: boolean;
  faceProvider?: string;
  faceFidelity?: number;
  faceBudgetCap?: number;
  faceCacheTtlDays?: number;
  identityPreservationMode?: string;
}

const MODEL_IDENTIFIER = 'lucataco/real-esrgan-video:c23768236472c41b7a121ee735c8073e29080c01b32907740cfada61bff75320';
const MODEL_VERSION = 'c23768236472c41b7a121ee735c8073e29080c01b32907740cfada61bff75320';

export interface AIUpscaleResult {
  success: boolean;
  cacheHit: boolean;
  provider: string;
  cost: number;
  duration: number;
  outputPath: string;
  fallbackReason?: string;
  error?: string;
}

/**
 * Computes a unique SHA-256 cache key based on the raw file content hash + AI settings + model version.
 */
export function generateCacheKey(localInputPath: string, settings: MaxQualitySettings, rawFileHash?: string): string {
  let fileHash = rawFileHash;
  if (!fileHash) {
    if (!fs.existsSync(localInputPath)) {
      throw new Error(`Input file not found for hashing: ${localInputPath}`);
    }
    const fileBuffer = fs.readFileSync(localInputPath);
    fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
  
  const configString = [
    fileHash,
    settings.aiUpscaleFactor || '2x',
    settings.resolution || '1080p',
    settings.stabilization ? 'stabilized' : 'raw',
    MODEL_IDENTIFIER
  ].join('|');
  
  return crypto.createHash('sha256').update(configString).digest('hex');
}

/**
 * Runs the AI upscaling process with cache lookups, token validation, polling, and classical fallbacks.
 */
export async function runNeuralUpscale(
  localInputPath: string,
  localOutputPath: string,
  settings: MaxQualitySettings,
  outputGcsUrl: string,
  tmpDir: string,
  projectDuration: string,
  jobId: string,
  rawFileHash?: string
): Promise<AIUpscaleResult> {
  const startTime = Date.now();
  const upscaleFactor = settings.aiUpscaleFactor || '2x';
  const targetResolution = settings.resolution || '1080p';

  // 1. Enforce hard duration guardrail (Max 10 seconds)
  const isDurationBlocked = projectDuration === '15s' || projectDuration === '30s';
  if (isDurationBlocked) {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: `Duration limit exceeded (${projectDuration}). restricted to <10s clips.`
    };
  }

  // 2. Enforce hard budget cap of $1.00
  // Estimated cost rate: $0.05/sec for 2x, $0.07/sec for 4x
  const durationSec = projectDuration === '5s' ? 5 : 10;
  const rate = upscaleFactor === '2x' ? 0.05 : 0.07;
  const estimatedCost = durationSec * rate;
  if (estimatedCost > 1.00) {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds $1.00 budget cap.`
    };
  }

  // 3. Generate SHA-256 Cache Key
  let cacheKey: string;
  try {
    cacheKey = generateCacheKey(localInputPath, settings, rawFileHash);
    console.log(`[AI Upscaler] Generated cache key: ${cacheKey}`);
  } catch (err) {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: `Cache key generation failed: ${(err as Error).message}`
    };
  }

  // 4. Resolve GCS Cache path
  let bucket = 'cineforge-media-bucket';
  if (outputGcsUrl.startsWith('gs://')) {
    try {
      const parsed = parseGcsUri(outputGcsUrl);
      bucket = parsed.bucket;
    } catch {}
  }
  const gcsCacheUri = `gs://${bucket}/cache/ai/${cacheKey}.mp4`;
  console.log(`[AI Upscaler] Checking GCS cache: ${gcsCacheUri}`);

  // 5. Check GCS Cache Hit
  try {
    await downloadFromGcs(gcsCacheUri, localOutputPath);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[AI Upscaler] Cache hit! Downloaded cached upscale to ${localOutputPath} in ${duration.toFixed(1)}s`);
    return {
      success: true,
      cacheHit: true,
      provider: 'GCS Cache',
      cost: 0,
      duration,
      outputPath: localOutputPath
    };
  } catch (cacheErr) {
    console.log(`[AI Upscaler] Cache miss. Proceeding to Replicate API pipeline...`);
  }

  // 6. Check for Replicate Token
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.warn(`[AI Upscaler] REPLICATE_API_TOKEN is missing in the environment.`);
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: 'Missing REPLICATE_API_TOKEN in environment.'
    };
  }

  // 7. Mock / Testing validation
  if (token === 'invalid-token') {
    console.warn(`[AI Upscaler] Simulated invalid token fallback triggered.`);
    return {
      success: false,
      cacheHit: false,
      provider: 'Replicate (Simulated)',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: 'Invalid Replicate API token (Simulated 401 Unauthorized).'
    };
  }

  if (token === 'mock-token') {
    console.log(`[AI Upscaler] Simulated mock token execution active.`);
    // Simulate a successful API call with a 1.5 second delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Copy input to output as mock output
    fs.copyFileSync(localInputPath, localOutputPath);
    
    // Save mock output to GCS cache
    try {
      await uploadToGcs(localOutputPath, gcsCacheUri);
      console.log(`[AI Upscaler] Mock output saved to GCS cache: ${gcsCacheUri}`);
    } catch (uploadErr) {
      console.warn(`[AI Upscaler] Failed to upload mock to GCS cache:`, uploadErr);
    }

    const duration = (Date.now() - startTime) / 1000;
    return {
      success: true,
      cacheHit: false,
      provider: 'Replicate (Mock)',
      cost: 0.15,
      duration,
      outputPath: localOutputPath
    };
  }

  // 8. Live Replicate API Execution
  let tempGcsInputUri = `gs://${bucket}/tmp/ai-input-${jobId}.mp4`;
  let signedInputUrl = '';
  
  try {
    console.log(`[AI Upscaler] Uploading local input file to temporary GCS path: ${tempGcsInputUri}`);
    await uploadToGcs(localInputPath, tempGcsInputUri);
    signedInputUrl = await generateGcsSignedUrl(tempGcsInputUri, 900); // 15 mins expiry
  } catch (gcsErr) {
    console.error(`[AI Upscaler] Failed to prepare input URL for Replicate:`, gcsErr);
    await cleanupGcs(tempGcsInputUri);
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      fallbackReason: `GCS input prep failed: ${(gcsErr as Error).message}`
    };
  }

  try {
    console.log(`[AI Upscaler] Submitting prediction to Replicate...`);
    const resolutionArg = upscaleFactor === '4x' ? '4k' : 'FHD';
    
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          video_path: signedInputUrl,
          model: 'RealESRGAN_x4plus',
          resolution: resolutionArg
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Replicate API returned status ${response.status}: ${errText}`);
    }

    const prediction = await response.json();
    const predictionId = prediction.id;
    console.log(`[AI Upscaler] Prediction created successfully. ID: ${predictionId}`);

    // Poll Replicate API status with 180s timeout
    const pollTimeoutMs = 180000;
    const pollIntervalMs = 3000;
    const pollStart = Date.now();
    let providerOutputUrl = '';
    let finalPredictTime = 0;

    while (Date.now() - pollStart < pollTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${token}`
        }
      });

      if (!pollResponse.ok) {
        console.warn(`[AI Upscaler] Polling request failed with status ${pollResponse.status}. Retrying...`);
        continue;
      }

      const pollData = await pollResponse.json();
      const status = pollData.status;
      console.log(`[AI Upscaler] Prediction ID ${predictionId} status: ${status}`);

      if (status === 'succeeded') {
        providerOutputUrl = pollData.output;
        if (pollData.metrics?.predict_time) {
          finalPredictTime = pollData.metrics.predict_time;
        }
        break;
      } else if (status === 'failed' || status === 'canceled') {
        throw new Error(`Replicate prediction failed or was canceled: ${pollData.error || 'Unknown error'}`);
      }
    }

    if (!providerOutputUrl) {
      throw new Error(`Replicate prediction timed out after ${pollTimeoutMs / 1000}s`);
    }

    // Enforce cost control check based on predict time
    // A100 GPU costs approximately $0.0014 per second. 
    const actualCost = finalPredictTime * 0.0014;
    console.log(`[AI Upscaler] Prediction completed. Predict time: ${finalPredictTime}s. Est Cost: $${actualCost.toFixed(4)}`);

    if (actualCost > 1.00) {
      throw new Error(`Actual GPU processing cost ($${actualCost.toFixed(2)}) exceeded the $1.00 budget cap.`);
    }

    // Download provider output locally
    console.log(`[AI Upscaler] Downloading output from provider URL...`);
    const providerResp = await fetch(providerOutputUrl);
    if (!providerResp.ok) {
      throw new Error(`Failed to fetch video from provider output URL: status ${providerResp.status}`);
    }

    const arrayBuffer = await providerResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate output file
    if (buffer.length === 0) {
      throw new Error(`Downloaded provider output file is empty (0 bytes).`);
    }

    fs.writeFileSync(localOutputPath, buffer);
    console.log(`[AI Upscaler] Successfully downloaded and validated output file size: ${buffer.length} bytes`);

    // Upload output to GCS cache
    try {
      console.log(`[AI Upscaler] Uploading output to GCS cache: ${gcsCacheUri}`);
      await uploadToGcs(localOutputPath, gcsCacheUri);
    } catch (uploadErr) {
      console.warn(`[AI Upscaler] GCS Cache upload failed (will continue without caching):`, uploadErr);
    }

    // Clean up temporary GCS input
    await cleanupGcs(tempGcsInputUri);

    const duration = (Date.now() - startTime) / 1000;
    return {
      success: true,
      cacheHit: false,
      provider: 'Replicate (Real-ESRGAN)',
      cost: actualCost,
      duration,
      outputPath: localOutputPath
    };

  } catch (apiErr) {
    console.error(`[AI Upscaler] Live Replicate pipeline failed:`, apiErr);
    await cleanupGcs(tempGcsInputUri);
    return {
      success: false,
      cacheHit: false,
      provider: 'Replicate (Real-ESRGAN)',
      cost: 0,
      duration: (Date.now() - startTime) / 1000,
      outputPath: localInputPath,
      fallbackReason: (apiErr as Error).message || 'Replicate processing error'
    };
  }
}

/**
 * Silent helper to delete temporary files from GCS bucket.
 */
async function cleanupGcs(gcsUri: string): Promise<void> {
  if (process.env.RENDER_MODE !== 'cloud') return;
  try {
    const { bucket, key } = parseGcsUri(gcsUri);
    const { Storage } = require('@google-cloud/storage');
    const storage = new Storage();
    await storage.bucket(bucket).file(key).delete({ ignoreNotFound: true });
    console.log(`[AI Upscaler] Cleaned up temporary GCS asset: ${gcsUri}`);
  } catch (err) {
    console.warn(`[AI Upscaler] Failed to delete temp GCS asset ${gcsUri}:`, err);
  }
}

export interface FaceRestorationResult {
  success: boolean;
  cacheHit: boolean;
  provider: string;
  modelVersion: string;
  cost: number;
  duration: number;
  outputPath: string;
  facesDetected: number;
  framesProcessed: number;
  fallbackReason?: string;
  fidelitySetting: number;
  privacyCacheTtlDays: number;
}

function getFfmpegCommand(): string {
  if (process.platform === 'linux') {
    return 'ffmpeg';
  }
  try {
    const { execSync } = require('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    const lambdaBinPath = path.join(__dirname, '..', 'render-lambda', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(lambdaBinPath)) {
      return lambdaBinPath;
    }
    const gcpBinPath = path.join(__dirname, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(gcpBinPath)) {
      return gcpBinPath;
    }
    return 'ffmpeg';
  }
}

function cropRgbaImage(
  rgbaData: Buffer,
  frameWidth: number,
  frameHeight: number,
  xMin: number,
  yMin: number,
  cropWidth: number,
  cropHeight: number
): Buffer {
  const croppedData = Buffer.alloc(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++) {
    const srcRow = yMin + y;
    const srcOffset = (srcRow * frameWidth + xMin) * 4;
    const destOffset = y * cropWidth * 4;
    rgbaData.copy(croppedData, destOffset, srcOffset, srcOffset + cropWidth * 4);
  }
  return croppedData;
}

function resizeRgbaImage(
  srcData: Buffer,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number
): Buffer {
  const destData = Buffer.alloc(destW * destH * 4);
  const xRatio = srcW / destW;
  const yRatio = srcH / destH;
  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const px = Math.floor(x * xRatio);
      const py = Math.floor(y * yRatio);
      const srcIdx = (py * srcW + px) * 4;
      const destIdx = (y * destW + x) * 4;
      destData[destIdx] = srcData[srcIdx];
      destData[destIdx + 1] = srcData[srcIdx + 1];
      destData[destIdx + 2] = srcData[srcIdx + 2];
      destData[destIdx + 3] = srcData[srcIdx + 3];
    }
  }
  return destData;
}

async function callReplicateGFPGAN(dataUri: string, token: string): Promise<{ outputUrl: string; predictTime: number }> {
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: '0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c',
      input: {
        img: dataUri,
        scale: 1,
        version: 'v1.4'
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Replicate GFPGAN API returned status ${response.status}: ${errText}`);
  }

  const prediction = await response.json();
  const predictionId = prediction.id;

  const pollTimeoutMs = 90000;
  const pollIntervalMs = 1500;
  const pollStart = Date.now();
  let providerOutputUrl = '';
  let predictTime = 1.5;

  while (Date.now() - pollStart < pollTimeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${token}`
      }
    });

    if (!pollResponse.ok) {
      continue;
    }

    const pollData = await pollResponse.json();
    const status = pollData.status;

    if (status === 'succeeded') {
      providerOutputUrl = pollData.output;
      if (pollData.metrics?.predict_time) {
        predictTime = pollData.metrics.predict_time;
      }
      break;
    } else if (status === 'failed' || status === 'canceled') {
      throw new Error(`Replicate prediction failed or was canceled: ${pollData.error || 'Unknown error'}`);
    }
  }

  if (!providerOutputUrl) {
    throw new Error(`Replicate prediction timed out after ${pollTimeoutMs / 1000}s`);
  }

  return { outputUrl: providerOutputUrl, predictTime };
}

async function runPool(taskFns: Array<() => Promise<void>>, limit: number) {
  let index = 0;
  async function worker() {
    while (index < taskFns.length) {
      const currentIdx = index++;
      await taskFns[currentIdx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, taskFns.length) }, worker);
  await Promise.all(workers);
}

async function reassembleVideo(framesDir: string, originalVideoPath: string, outputVideoPath: string): Promise<void> {
  const ffmpegCmd = getFfmpegCommand();
  const args = [
    '-y',
    '-f', 'image2',
    '-framerate', '15',
    '-i', path.join(framesDir, 'frame_%04d.jpg'),
    '-i', originalVideoPath,
    '-map', '0:v',
    '-map', '1:a?',
    '-c:v', 'libx264',
    '-crf', '17',
    '-preset', 'superfast',
    '-c:a', 'copy',
    outputVideoPath
  ];
  await runLocalCommand(ffmpegCmd, args);
}

async function runLocalCommand(cmd: string, args: string[]): Promise<string> {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

export async function runFaceRestoration(
  localInputPath: string,
  localOutputPath: string,
  settings: MaxQualitySettings,
  outputGcsUrl: string,
  tmpDir: string,
  projectDuration: string,
  jobId: string,
  rawFileHash?: string
): Promise<FaceRestorationResult> {
  const startTime = Date.now();
  const fidelity = settings.faceFidelity ?? 0.6;
  const ttlDays = settings.faceCacheTtlDays ?? 7;
  
  // 1. Enforce hard duration validation (Max 10 seconds)
  const isDurationBlocked = projectDuration === '15s' || projectDuration === '30s';
  if (isDurationBlocked) {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: `Duration limit exceeded (${projectDuration}). Face Restoration is restricted to <10s clips.`,
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  }

  // 2. Block 16K + face restoration
  if (settings.resolution === '16K') {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: 'Face Restoration is blocked for 16K resolution.',
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  }

  // 3. Block CodeFormer
  if (settings.faceProvider?.toLowerCase() === 'codeformer') {
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      modelVersion: 'codeformer',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: 'CodeFormer is blocked in production. Please use approved commercial-safe providers.',
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  }

  // 4. Generate SHA-256 Cache Key
  let fileHash = rawFileHash;
  if (!fileHash) {
    if (!fs.existsSync(localInputPath)) {
      throw new Error(`Input file not found for hashing: ${localInputPath}`);
    }
    const fileBuffer = fs.readFileSync(localInputPath);
    fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }
  
  const configString = [
    fileHash,
    fidelity.toFixed(2),
    settings.identityPreservationMode || 'balanced',
    'gfpgan-v1.4'
  ].join('|');
  const cacheKey = crypto.createHash('sha256').update(configString).digest('hex');
  
  // 5. Resolve GCS Cache path
  let bucket = 'cineforge-media-bucket';
  if (outputGcsUrl.startsWith('gs://')) {
    try {
      const parsed = parseGcsUri(outputGcsUrl);
      bucket = parsed.bucket;
    } catch {}
  }
  const gcsCacheUri = `gs://${bucket}/cache/face/${cacheKey}.mp4`;
  console.log(`[Face Restoration] Checking GCS cache: ${gcsCacheUri}`);

  // 6. Check GCS Cache Hit
  try {
    await downloadFromGcs(gcsCacheUri, localOutputPath);
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Face Restoration] Cache hit! Downloaded cached face restoration to ${localOutputPath} in ${duration.toFixed(1)}s`);
    return {
      success: true,
      cacheHit: true,
      provider: 'GCS Cache',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration,
      outputPath: localOutputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  } catch (cacheErr) {
    console.log(`[Face Restoration] Cache miss. Proceeding to face detection...`);
  }

  // 7. Check for Replicate Token
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.warn(`[Face Restoration] REPLICATE_API_TOKEN is missing in the environment.`);
    return {
      success: false,
      cacheHit: false,
      provider: 'none',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: 'Missing REPLICATE_API_TOKEN in environment.',
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  }

  if (token === 'invalid-token') {
    return {
      success: false,
      cacheHit: false,
      provider: 'Replicate (Simulated)',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration: 0,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: 'Invalid Replicate API token (Simulated 401 Unauthorized).',
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  }

  // 8. Extract frames at 15 FPS
  const framesDir = path.join(tmpDir, `frames-face-${jobId}`);
  fs.mkdirSync(framesDir, { recursive: true });
  
  try {
    const ffmpegCmd = getFfmpegCommand();
    const extractArgs = [
      '-y',
      '-i', localInputPath,
      '-vf', 'fps=15',
      path.join(framesDir, 'frame_%04d.jpg')
    ];
    await runLocalCommand(ffmpegCmd, extractArgs);
    
    const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).sort();
    if (files.length === 0) {
      throw new Error('Frame extraction failed; no frame files found.');
    }
    
    // Load Pico Facefinder cascade buffer
    let cascadePath = path.join(__dirname, 'assets', 'facefinder');
    if (!fs.existsSync(cascadePath)) {
      const altPath = path.join(__dirname, '..', 'assets', 'facefinder');
      if (fs.existsSync(altPath)) {
        cascadePath = altPath;
      }
    }
    if (!fs.existsSync(cascadePath)) {
      throw new Error(`Pico facefinder cascade not found at ${cascadePath}`);
    }
    const cascadeBuffer = fs.readFileSync(cascadePath);
    const bytes = new Int8Array(cascadeBuffer);
    const pico = require('picojs');
    const jpeg = require('jpeg-js');
    const facefinder_classify_region = pico.unpack_cascade(bytes);
    
    const rawDetections: Array<{ r: number; c: number; s: number; q: number } | null> = [];
    let totalFacesFound = 0;
    
    // Detect faces on extracted frames
    for (const file of files) {
      const framePath = path.join(framesDir, file);
      const jpegBuffer = fs.readFileSync(framePath);
      const rawImageData = jpeg.decode(jpegBuffer);
      const { width, height, data } = rawImageData;
      
      const gray = new Uint8Array(width * height);
      for (let j = 0; j < width * height; j++) {
        gray[j] = Math.round(0.299 * data[j * 4] + 0.587 * data[j * 4 + 1] + 0.114 * data[j * 4 + 2]);
      }
      
      const imageObj = {
        pixels: gray,
        nrows: height,
        ncols: width,
        ldim: width
      };
      
      let dets = pico.run_cascade(imageObj, facefinder_classify_region, {
        shiftfactor: 0.1,
        minsize: 20,
        maxsize: Math.min(width, height),
        scalefactor: 1.1
      });
      dets = pico.cluster_detections(dets, 0.2);
      
      let primaryFace = null;
      let maxS = -1;
      for (const det of dets) {
        const [r, c, s, q] = det;
        if (q >= 50.0) {
          if (s > maxS) {
            maxS = s;
            primaryFace = { r, c, s, q };
          }
        }
      }
      
      if (primaryFace) {
        totalFacesFound++;
        rawDetections.push(primaryFace);
      } else {
        rawDetections.push(null);
      }
    }
    
    if (totalFacesFound === 0) {
      return {
        success: false,
        cacheHit: false,
        provider: 'none',
        modelVersion: 'gfpgan-v1.4',
        cost: 0,
        duration: (Date.now() - startTime) / 1000,
        outputPath: localInputPath,
        facesDetected: 0,
        framesProcessed: files.length,
        fallbackReason: 'No clear face detected; face restoration skipped.',
        fidelitySetting: fidelity,
        privacyCacheTtlDays: ttlDays
      };
    }
    
    // Apply local coordinate smoothing and interpolation
    const smoothedDetections: Array<{ r: number; c: number; s: number; q: number } | null> = [];
    for (let i = 0; i < rawDetections.length; i++) {
      let sumR = 0, sumC = 0, sumS = 0, count = 0, maxQ = 0;
      const startWin = Math.max(0, i - 2);
      const endWin = Math.min(rawDetections.length - 1, i + 2);
      for (let j = startWin; j <= endWin; j++) {
        const det = rawDetections[j];
        if (det) {
          sumR += det.r;
          sumC += det.c;
          sumS += det.s;
          count++;
          if (det.q > maxQ) maxQ = det.q;
        }
      }
      if (count > 0) {
        smoothedDetections.push({
          r: sumR / count,
          c: sumC / count,
          s: sumS / count,
          q: maxQ
        });
      } else {
        smoothedDetections.push(null);
      }
    }
    
    // Budget limit check
    const numFacesToProcess = smoothedDetections.filter(d => d !== null).length;
    const estimatedCost = numFacesToProcess * 0.006;
    if (estimatedCost > 0.50) {
      return {
        success: false,
        cacheHit: false,
        provider: 'none',
        modelVersion: 'gfpgan-v1.4',
        cost: 0,
        duration: (Date.now() - startTime) / 1000,
        outputPath: localInputPath,
        facesDetected: totalFacesFound,
        framesProcessed: files.length,
        fallbackReason: `Estimated cost ($${estimatedCost.toFixed(2)}) for ${numFacesToProcess} faces exceeds the $0.50 budget cap.`,
        fidelitySetting: fidelity,
        privacyCacheTtlDays: ttlDays
      };
    }
    
    // Mock token check
    if (token === 'mock-token') {
      console.log(`[Face Restoration] Mock token mode active. Simulating enhancement...`);
      await reassembleVideo(framesDir, localInputPath, localOutputPath);
      
      // Upload mock to cache
      try {
        await uploadToGcs(localOutputPath, gcsCacheUri, 'video/mp4', {
          ttlDays: String(ttlDays),
          expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (uploadErr) {
        console.warn(`[Face Restoration] Failed to upload mock to GCS cache:`, uploadErr);
      }
      
      return {
        success: true,
        cacheHit: false,
        provider: 'Replicate (Mock)',
        modelVersion: 'gfpgan-v1.4',
        cost: 0.05,
        duration: (Date.now() - startTime) / 1000,
        outputPath: localOutputPath,
        facesDetected: totalFacesFound,
        framesProcessed: files.length,
        fidelitySetting: fidelity,
        privacyCacheTtlDays: ttlDays
      };
    }
    
    // Live Replicate Loop
    let actualCostAccumulated = 0;
    
    const tasks = files.map((file, i) => async () => {
      const det = smoothedDetections[i];
      if (!det) return;
      
      const framePath = path.join(framesDir, file);
      const jpegBuffer = fs.readFileSync(framePath);
      const rawImageData = jpeg.decode(jpegBuffer);
      const { width, height, data } = rawImageData;
      
      const s = det.s;
      const xMin = Math.max(0, Math.round(det.c - s * 0.7));
      const yMin = Math.max(0, Math.round(det.r - s * 0.7));
      const xMax = Math.min(width - 1, Math.round(det.c + s * 0.7));
      const yMax = Math.min(height - 1, Math.round(det.r + s * 0.7));
      const cropWidth = xMax - xMin;
      const cropHeight = yMax - yMin;
      
      if (cropWidth <= 0 || cropHeight <= 0) return;
      
      // Crop
      const croppedRgba = cropRgbaImage(data, width, height, xMin, yMin, cropWidth, cropHeight);
      
      // Encode crop as JPEG
      const croppedJpeg = jpeg.encode({
        width: cropWidth,
        height: cropHeight,
        data: croppedRgba
      }, 90);
      
      const base64Data = croppedJpeg.data.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64Data}`;
      
      // Call Replicate & Poll
      const { outputUrl, predictTime } = await callReplicateGFPGAN(dataUri, token);
      
      const currentTaskCost = predictTime * 0.000576;
      actualCostAccumulated += currentTaskCost;
      
      if (actualCostAccumulated > 0.50) {
        throw new Error(`Actual GPU processing cost ($${actualCostAccumulated.toFixed(4)}) exceeded the $0.50 budget cap.`);
      }
      
      // Fetch restored crop
      const resp = await fetch(outputUrl);
      if (!resp.ok) {
        throw new Error(`Failed to download restored face crop: ${resp.statusText}`);
      }
      const restoredBuffer = Buffer.from(await resp.arrayBuffer());
      const restoredDecoded = jpeg.decode(restoredBuffer);
      let restoredRgba = restoredDecoded.data;
      
      // Resize if dimensions differ
      if (restoredDecoded.width !== cropWidth || restoredDecoded.height !== cropHeight) {
        restoredRgba = resizeRgbaImage(restoredRgba, restoredDecoded.width, restoredDecoded.height, cropWidth, cropHeight);
      }
      
      // Blend back
      const feather = Math.min(15, Math.floor(cropWidth / 4), Math.floor(cropHeight / 4));
      for (let y = 0; y < cropHeight; y++) {
        const frameY = yMin + y;
        for (let x = 0; x < cropWidth; x++) {
          const frameX = xMin + x;
          const dx = Math.min(x, cropWidth - 1 - x);
          const dy = Math.min(y, cropHeight - 1 - y);
          const distToEdge = Math.min(dx, dy);
          
          const maskAlpha = feather > 0 ? Math.min(1, distToEdge / feather) : 1;
          const cropAlpha = (1 - fidelity) * maskAlpha;
          
          const frameIdx = (frameY * width + frameX) * 4;
          const cropIdx = (y * cropWidth + x) * 4;
          
          data[frameIdx] = Math.round(data[frameIdx] * (1 - cropAlpha) + restoredRgba[cropIdx] * cropAlpha);
          data[frameIdx + 1] = Math.round(data[frameIdx + 1] * (1 - cropAlpha) + restoredRgba[cropIdx + 1] * cropAlpha);
          data[frameIdx + 2] = Math.round(data[frameIdx + 2] * (1 - cropAlpha) + restoredRgba[cropIdx + 2] * cropAlpha);
        }
      }
      
      // Write blended frame back
      const outputJpeg = jpeg.encode({ width, height, data }, 95);
      fs.writeFileSync(framePath, outputJpeg.data);
    });
    
    // Execute parallel tasks with concurrency limit of 5
    await runPool(tasks, 5);
    
    // Reassemble video
    await reassembleVideo(framesDir, localInputPath, localOutputPath);
    
    // Upload assembled video to GCS cache
    try {
      await uploadToGcs(localOutputPath, gcsCacheUri, 'video/mp4', {
        ttlDays: String(ttlDays),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (uploadErr) {
      console.warn(`[Face Restoration] GCS Cache upload failed (will continue without caching):`, uploadErr);
    }
    
    return {
      success: true,
      cacheHit: false,
      provider: 'Replicate (GFPGAN)',
      modelVersion: 'gfpgan-v1.4',
      cost: actualCostAccumulated,
      duration: (Date.now() - startTime) / 1000,
      outputPath: localOutputPath,
      facesDetected: totalFacesFound,
      framesProcessed: files.length,
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
    
  } catch (err) {
    console.error(`[Face Restoration] Process failed:`, err);
    return {
      success: false,
      cacheHit: false,
      provider: 'Replicate (GFPGAN)',
      modelVersion: 'gfpgan-v1.4',
      cost: 0,
      duration: (Date.now() - startTime) / 1000,
      outputPath: localInputPath,
      facesDetected: 0,
      framesProcessed: 0,
      fallbackReason: (err as Error).message || 'Processing error',
      fidelitySetting: fidelity,
      privacyCacheTtlDays: ttlDays
    };
  } finally {
    try {
      if (fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
