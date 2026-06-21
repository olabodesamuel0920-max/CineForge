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
  resolution: '720p' | '1080p' | '4K';
  neuralUpscale?: boolean;
  aiUpscaleFactor?: 'none' | '2x' | '4x';
  aiBudgetCap?: number;
  faceRestoration?: boolean;
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
