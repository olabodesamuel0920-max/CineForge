import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, spawnSync } from 'child_process';
import { z } from 'zod';
import { downloadFromGcs, uploadToGcs, generateGcsSignedUrl } from './gcs';
import { buildFilterComplex } from './ffmpeg';
import { updateProgress, getProgress } from './firestore';
import { extractAudioTransients } from './audioAnalysis';

if (process.env.RENDER_MODE !== 'cloud') {
  process.env.RENDER_MODE = 'local';
}

// Global flag to track Quick Sync Video (QSV) hardware acceleration support
let isQsvSupported = false;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const DEFAULT_TRACKS: Record<string, string> = {
  'luxury-demon-reveal': 'luxury_track.mp3',
  'stadium-god-mode': 'stadium_track.mp3',
  'sugar-storm-3d': 'sugar_track.mp3',
  'fashion-drop-impact': 'fashion_track.mp3',
  'boss-entrance': 'boss_track.mp3',
  'cinematic-brand-trailer': 'brand_track.mp3',
  'street-pulse-edit': 'street_track.mp3',
  'product-awakening': 'product_track.mp3'
};

function ensureDefaultAudioTracks() {
  const audioDir = path.join(process.cwd(), 'public', 'audio');
  const workerAudioDir = path.join(__dirname, 'assets', 'audio');

  [audioDir, workerAudioDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const trackFiles = [
    'luxury_track.mp3',
    'stadium_track.mp3',
    'sugar_track.mp3',
    'fashion_track.mp3',
    'boss_track.mp3',
    'brand_track.mp3',
    'street_track.mp3',
    'product_track.mp3'
  ];

  const ffmpegCmd = getFfmpegCommand();

  trackFiles.forEach(file => {
    const targetPath = path.join(audioDir, file);
    const workerTargetPath = path.join(workerAudioDir, file);

    // Generate in public/audio if missing
    if (!fs.existsSync(targetPath)) {
      try {
        console.log(`[Startup] Generating default track: ${targetPath}`);
        execSync(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 60 -c:a libmp3lame "${targetPath}"`, { stdio: 'ignore' });
      } catch (err) {
        console.warn(`Failed to generate default track at ${targetPath}:`, err);
      }
    }

    // Generate in worker assets/audio if missing
    if (!fs.existsSync(workerTargetPath)) {
      try {
        if (fs.existsSync(targetPath)) {
          fs.copyFileSync(targetPath, workerTargetPath);
        } else {
          console.log(`[Startup] Generating default worker track: ${workerTargetPath}`);
          execSync(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 60 -c:a libmp3lame "${workerTargetPath}"`, { stdio: 'ignore' });
        }
      } catch (err) {
        console.warn(`Failed to generate default worker track at ${workerTargetPath}:`, err);
      }
    }
  });
}

// --- Request Validation Schemas ---
const timelineBlockSchema = z.object({
  start: z.number().nonnegative('Start timestamp must be non-negative'),
  end: z.number().positive('End timestamp must be positive'),
  type: z.string().optional(),
  speed: z.number().positive('Speed modifier must be positive'),
  vfx: z.array(z.string()).optional(),
  text: z.string().optional(),
  fracture: z.boolean().optional(),
  speedRamp: z.string().optional()
});

const blueprintSchema = z.object({
  timeline: z.array(timelineBlockSchema).nonempty('Timeline blocks cannot be empty'),
  audio: z.object({
    bpm: z.number().optional(),
    drop_at: z.number().optional()
  }).optional(),
  color_grade: z.object({
    warmth: z.number().optional(),
    contrast: z.number().optional(),
    saturation: z.number().optional()
  }).optional(),
  export: z.object({
    resolution: z.tuple([z.number(), z.number()]).optional(),
    fps: z.number().optional(),
    codec: z.string().optional()
  }).optional(),
  selected_mode: z.string().optional(),
  viewer_emotion: z.string().optional(),
  hook_intensity: z.number().optional()
});

const isLocalMode = () => process.env.RENDER_MODE === 'local';

const renderRequestSchema = z.object({
  sourceVideoGcsUrl: z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
    message: 'sourceVideoGcsUrl must start with gs:// in cloud mode'
  }),
  soundtrackGcsUrl: z.string().optional(),
  blueprint: blueprintSchema,
  taskId: z.string().optional(),
  outputGcsUrl: z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
    message: 'outputGcsUrl must start with gs:// in cloud mode'
  }),
  previewStart: z.number().optional(),
  previewDuration: z.number().optional()
});

type RenderRequest = z.infer<typeof renderRequestSchema>;

/**
 * Cross-platform helper to resolve the path of the ffmpeg binary.
 */
function getFfmpegCommand(): string {
  if (process.platform === 'linux') {
    return 'ffmpeg';
  }
  try {
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

/**
 * Cross-platform helper to resolve the path of the ffprobe binary.
 */
function getFfprobeCommand(): string {
  if (process.platform === 'linux') {
    return 'ffprobe';
  }
  try {
    execSync('ffprobe -version', { stdio: 'ignore' });
    return 'ffprobe';
  } catch {
    const lambdaBinPath = path.join(__dirname, '..', 'render-lambda', 'bin', 'ffprobe.exe');
    if (fs.existsSync(lambdaBinPath)) {
      return lambdaBinPath;
    }
    const gcpBinPath = path.join(__dirname, 'bin', 'ffprobe.exe');
    if (fs.existsSync(gcpBinPath)) {
      return gcpBinPath;
    }
    return 'ffprobe';
  }
}

interface InputVideoMetadata {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

/**
 * Pre-flight video metadata extraction helper.
 * Queries resolution, native frame rate, and stream/format duration.
 */
function parseVideoMetadata(filePath: string): InputVideoMetadata {
  try {
    const ffprobeCmd = getFfprobeCommand();
    const ffprobeOutput = execSync(
      `"${ffprobeCmd}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration -of json=c=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    const metadata = JSON.parse(ffprobeOutput);
    const stream = metadata.streams?.[0];
    const format = metadata.format;

    if (!stream || !stream.width || !stream.height) {
      throw new Error('Video stream dimensions are missing from ffprobe output');
    }

    const width = stream.width;
    const height = stream.height;

    // Parse FPS fraction (e.g. 30/1 -> 30)
    let fps = 30;
    if (stream.r_frame_rate) {
      const parts = stream.r_frame_rate.split('/');
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den > 0) {
        fps = num / den;
      }
    }

    // Parse Duration (prioritize stream duration, fallback to format duration)
    let duration = 0;
    if (stream.duration) {
      duration = parseFloat(stream.duration);
    } else if (format && format.duration) {
      duration = parseFloat(format.duration);
    }

    return { width, height, fps, duration };
  } catch (error) {
    throw new Error(`Pre-flight video metadata parsing failed: ${(error as Error).message}`);
  }
}

/**
 * Checks if the video stream contains audio tracks.
 */
function checkAudioPresence(filePath: string): boolean {
  try {
    const ffprobeCmd = getFfprobeCommand();
    const ffprobeOutput = execSync(
      `"${ffprobeCmd}" -v error -select_streams a -show_entries stream=index -of json=c=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    const metadata = JSON.parse(ffprobeOutput);
    return Array.isArray(metadata.streams) && metadata.streams.length > 0;
  } catch (error) {
    console.warn('Audio check failed, falling back to assuming no audio stream:', error);
    return false;
  }
}

/**
 * Parses timecode string (HH:MM:SS.ms) into seconds.
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length !== 3) return 0;
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Snap a time value to the nearest transient in the transients array if it falls within the threshold.
 */
function snapToNearestTransient(timeVal: number, transients: number[], threshold = 0.25): number {
  if (transients.length === 0) return timeVal;
  const closest = transients.reduce((prev, curr) => 
    Math.abs(curr - timeVal) < Math.abs(prev - timeVal) ? curr : prev
  );
  return Math.abs(closest - timeVal) <= threshold ? closest : timeVal;
}

/**
 * Deterministic string hashing utility.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Subprocess wrapper to run FFmpeg while reporting progress updates.
 */
async function runFfmpegWithProgress(
  args: string[],
  totalDuration: number,
  taskId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = getFfmpegCommand();
    const ffmpegProcess = spawn(ffmpegCmd, args);
    let errorLog = '';

    ffmpegProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorLog += chunk;

      // Extract time=HH:MM:SS.ms to calculate progress percent
      const timeMatch = chunk.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
      if (timeMatch) {
        const elapsed = parseTimeToSeconds(timeMatch[1]);
        // Map render progress to 5% - 95% range
        const percent = Math.min(95, Math.round((elapsed / totalDuration) * 90) + 5);
        updateProgress(taskId, percent, 'RENDERING').catch(console.error);
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg processing failed with exit code ${code}.\nLogs snippet:\n${errorLog.slice(-1000)}`));
      }
    });

    ffmpegProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// HTTP POST /render route handler
app.post('/render', async (req: Request, res: Response) => {
  const taskId = req.body.taskId || `task-${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[TaskId: ${taskId}] Starting render job request.`);

  // Temporary files workspace paths in /tmp (or local workspace if testing)
  const isLocalWindows = process.platform === 'win32';
  const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const localInputPath = path.join(tmpDir, `input-${taskId}.mp4`);
  const localOutputPath = path.join(tmpDir, `output-${taskId}.mp4`);
  const fontPath = path.join(tmpDir, `font-${taskId}.ttf`);
  let localSoundtrackPath = '';

  // 1. Validate Payload
  const validationResult = renderRequestSchema.safeParse(req.body);
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({ status: 'FAILED', error: `Validation Error: ${errors}` });
  }

  const payload: RenderRequest = validationResult.data;

  // Set initial status and send accepted response immediately to prevent HTTP timeouts
  await updateProgress(taskId, 2, 'DOWNLOADING');
  res.status(202).json({
    status: 'ACCEPTED',
    taskId
  });

  // Execute processing asynchronously in the background
  (async () => {
    try {
      // 2. Setup font asset
      let localFontBundlePath = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');
      if (!fs.existsSync(localFontBundlePath)) {
        // Fallback relative directory check
        localFontBundlePath = path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
      }
      
      if (fs.existsSync(localFontBundlePath)) {
        fs.writeFileSync(fontPath, fs.readFileSync(localFontBundlePath));
      } else {
        console.warn(`Font file not found at ${localFontBundlePath}. Falling back to default system font configuration.`);
      }

      // 3. Download Source Video from GCS
      console.log(`[TaskId: ${taskId}] Downloading source video from ${payload.sourceVideoGcsUrl}`);
      await downloadFromGcs(payload.sourceVideoGcsUrl, localInputPath);
      await updateProgress(taskId, 5, 'ANALYZING');

      // Download or resolve soundtrack path
      if (payload.soundtrackGcsUrl) {
        if (payload.soundtrackGcsUrl.startsWith('gs://')) {
          localSoundtrackPath = path.join(tmpDir, `soundtrack-${taskId}${path.extname(payload.soundtrackGcsUrl) || '.mp3'}`);
          console.log(`[TaskId: ${taskId}] Downloading soundtrack from ${payload.soundtrackGcsUrl}`);
          await downloadFromGcs(payload.soundtrackGcsUrl, localSoundtrackPath);
        } else {
          // Local path
          localSoundtrackPath = payload.soundtrackGcsUrl;
        }
      } else {
        // Map based on selected_mode
        const mode = payload.blueprint.selected_mode || 'luxury-demon-reveal';
        const fileName = DEFAULT_TRACKS[mode] || 'luxury_track.mp3';
        
        // Try to find the local file
        const possiblePaths = [
          path.join(__dirname, 'assets', 'audio', fileName),
          path.join(__dirname, '..', 'assets', 'audio', fileName),
          path.join(process.cwd(), 'public', 'audio', fileName),
          path.join(process.cwd(), '..', '..', 'public', 'audio', fileName),
        ];

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            localSoundtrackPath = p;
            break;
          }
        }

        if (!localSoundtrackPath) {
          // Absolute fallback to first possible path
          localSoundtrackPath = possiblePaths[0];
        }
        console.log(`[TaskId: ${taskId}] Mapping default mode track for mode ${mode} -> ${localSoundtrackPath}`);
      }

      // 4. Pre-flight Video Resolution & Audio Checks
      console.log(`[TaskId: ${taskId}] Running pre-flight video resolution verification.`);
      const videoMetadata = parseVideoMetadata(localInputPath);
      if (videoMetadata.width > 1920 || videoMetadata.height > 1920) {
        throw new Error(`Video resolution (${videoMetadata.width}x${videoMetadata.height}) exceeds the supported 1080p limit (max 1920px on any side).`);
      }
      const hasAudio = checkAudioPresence(localInputPath);
      console.log(`[TaskId: ${taskId}] Pre-flight verification successful. Native FPS: ${videoMetadata.fps.toFixed(2)} | Duration: ${videoMetadata.duration.toFixed(3)}s | Has audio: ${hasAudio}`);

      // Extract transients for safety snapping
      let transients: number[] = [];
      try {
        if (localSoundtrackPath && fs.existsSync(localSoundtrackPath)) {
          console.log(`[TaskId: ${taskId}] Spawning transient analysis for safety snapping on: ${localSoundtrackPath}`);
          const analysis = await extractAudioTransients(localSoundtrackPath);
          transients = analysis.transients;
          console.log(`[TaskId: ${taskId}] Safety snapping active. BPM: ${analysis.bpm} | Transients: ${transients.length} peaks`);
        }
      } catch (analysisError) {
        console.warn(`[TaskId: ${taskId}] Audio transient safety snapping analysis failed:`, analysisError);
      }

      // 5. Durational Sync Clamping and Transient Beat-Snapping on Timeline Blocks
      let currentStart = 0.0;
      const initialTimeline = [];

      for (let i = 0; i < payload.blueprint.timeline.length; i++) {
        const block = payload.blueprint.timeline[i];
        let start = currentStart;
        let end = Math.min(block.end, videoMetadata.duration);

        // Only snap intermediate boundaries; lock start=0.0 and final end=duration
        if (i < payload.blueprint.timeline.length - 1) {
          const snappedEnd = snapToNearestTransient(end, transients, 0.25);
          if (snappedEnd > start) {
            end = snappedEnd;
          }
        } else {
          end = videoMetadata.duration;
        }

        if (start < end) {
          initialTimeline.push({
            ...block,
            start,
            end
          });
          currentStart = end;
        }
      }

      // Fracture Engine Execution (Director-driven fracturing based on LLM blueprint flags)
      let conformedTimeline: any[] = [];
      let microClipIndex = 0;

      for (const block of initialTimeline) {
        const blockStart = block.start;
        const blockEnd = block.end;
        const blockDuration = blockEnd - blockStart;

        // Find transients falling inside the block boundaries (excluding small edge tolerances)
        const blockTransients = transients.filter(t => t > blockStart + 0.15 && t < blockEnd - 0.15);

        if (block.fracture && blockTransients.length > 0) {
          const cuts = [blockStart, ...blockTransients, blockEnd];
          const N = cuts.length - 1;

          for (let k = 0; k < N; k++) {
            const subStart = cuts[k];
            const subEnd = cuts[k + 1];
            const subDuration = subEnd - subStart;

            // Dynamically vary velocity ramping speeds per sub-segment based on LLM planned speedRamp
            let subSpeed = block.speed;
            const speedRampLower = (block.speedRamp || '').toLowerCase();
            if (speedRampLower.includes('fast -> slow') || speedRampLower.includes('fast-in / slow-out') || speedRampLower.includes('down')) {
              // Ramp speed down from 3.0 to 0.5 (or 0.25)
              subSpeed = N > 1 ? 3.0 - (k / (N - 1)) * 2.5 : block.speed;
            } else if (speedRampLower.includes('slow -> fast') || speedRampLower.includes('up')) {
              // Ramp speed up from 0.5 to 3.0
              subSpeed = N > 1 ? 0.5 + (k / (N - 1)) * 2.5 : block.speed;
            } else if (speedRampLower.includes('hyper') || speedRampLower.includes('climax') || speedRampLower.includes('drop')) {
              // Alternate hyper-fast cuts and slow-mo drops
              subSpeed = k % 2 === 0 ? 4.0 : 0.25;
            }

            const sourceSliceDuration = subDuration * subSpeed;
            const maxPossibleStart = Math.max(0, videoMetadata.duration - sourceSliceDuration);
            let sourceStart = subStart;
            let sourceEnd = subEnd;

            if (maxPossibleStart > 0) {
              // Build deterministic seed using block.text (which is cleaned title) + microClipIndex
              const seedStr = `${block.text || 'cf-clip'}-${microClipIndex}`;
              const hashVal = hashString(seedStr);
              sourceStart = (hashVal * maxPossibleStart) % maxPossibleStart;
              sourceStart = Math.max(0, Math.min(sourceStart, maxPossibleStart));
              sourceEnd = sourceStart + sourceSliceDuration;
            } else {
              // Clamp/fallback to linear trim
              sourceStart = subStart % videoMetadata.duration;
              sourceEnd = Math.min(sourceStart + sourceSliceDuration, videoMetadata.duration);
            }

            conformedTimeline.push({
              ...block,
              start: subStart,
              end: subEnd,
              speed: subSpeed,
              sourceStart,
              sourceEnd
            });
            microClipIndex++;
          }
        } else {
          // Linear playback fallback for structural segments
          conformedTimeline.push({
            ...block,
            sourceStart: block.start,
            sourceEnd: block.end
          });
        }
      }

      // If all blocks are out of bounds or empty, create a fallback block covering the full duration
      if (conformedTimeline.length === 0 && videoMetadata.duration > 0) {
        conformedTimeline = [
          {
            start: 0,
            end: videoMetadata.duration,
            speed: 1.0,
            text: 'CineForge Clip',
            sourceStart: 0,
            sourceEnd: videoMetadata.duration
          }
        ];
      }

      // Calculate conformed output duration
      const totalDuration = conformedTimeline.reduce(
        (acc, block) => acc + (block.end - block.start) / block.speed,
        0
      );

      const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = buildFilterComplex(
        conformedTimeline,
        payload.blueprint.color_grade,
        fontPath,
        hasAudio,
        payload.blueprint.selected_mode,
        payload.blueprint.viewer_emotion,
        payload.blueprint.hook_intensity
      );

      // Compile FFmpeg command line arguments
      const ffmpegArgs = [
        '-y',
        '-i', localInputPath,
        '-i', localSoundtrackPath,
        '-filter_complex', filterComplex,
        '-map', `[${videoMap}]`
      ];

      if (outputHasAudio) {
        ffmpegArgs.push('-map', `[${audioMap}]`);
      }

      // Export codecs & config options
      const requestedFps = payload.blueprint.export?.fps || 60;
      // Clamp output FPS to the input video's native FPS if the input is lower (saves CPU)
      const fps = Math.min(requestedFps, Math.ceil(videoMetadata.fps));

      let codec = payload.blueprint.export?.codec === 'hevc' ? 'libx265' : 'libx264';
      if (process.env.RENDER_MODE === 'local') {
        codec = isQsvSupported ? 'h264_qsv' : 'libx264';
      }

      ffmpegArgs.push(
        '-c:v', codec,
        '-preset', 'veryfast',
        '-r', fps.toString(),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      );

      if (outputHasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
      }

      // Enforce absolute duration truncation before final output path
      ffmpegArgs.push('-t', totalDuration.toFixed(3), localOutputPath);

      // 6. Execute FFmpeg Rendering
      console.log(`[TaskId: ${taskId}] Starting render rendering cycle.`);
      await updateProgress(taskId, 10, 'RENDERING');
      await runFfmpegWithProgress(ffmpegArgs, totalDuration, taskId);

      // 7. Upload final output to GCS
      console.log(`[TaskId: ${taskId}] Uploading rendered output video to ${payload.outputGcsUrl}`);
      await updateProgress(taskId, 95, 'UPLOADING');
      await uploadToGcs(localOutputPath, payload.outputGcsUrl);

      // 8. Generate GCS Signed URL
      const presignedUrl = await generateGcsSignedUrl(payload.outputGcsUrl);
      console.log(`[TaskId: ${taskId}] Render complete. Presigned URL compiled.`);
      await updateProgress(taskId, 100, 'COMPLETED');

    } catch (error) {
      console.error(`[TaskId: ${taskId}] Render job crashed:`, error);
      await updateProgress(taskId, 100, 'FAILED', (error as Error).message);

    } finally {
      // 9. Hardened Workspace Cleanup
      console.log(`[TaskId: ${taskId}] Cleaning up temporary workspace files.`);
      const filesToUnlink = [localInputPath, localOutputPath, fontPath];
      if (localSoundtrackPath && localSoundtrackPath.startsWith(tmpDir)) {
        filesToUnlink.push(localSoundtrackPath);
      }
      for (const filePath of filesToUnlink) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[TaskId: ${taskId}] Successfully cleaned up ${filePath}`);
          }
        } catch (cleanupError) {
          console.warn(`[TaskId: ${taskId}] Failed to clean up ${filePath}:`, cleanupError);
        }
      }
    }
  })();
});

// HTTP POST /render/preview route handler for ultra-low-latency timeline seeks
app.post('/render/preview', async (req: Request, res: Response) => {
  const taskId = req.body.taskId || `preview-${Math.random().toString(36).substring(2, 11)}`;
  console.log(`[TaskId: ${taskId}] Starting preview render request.`);

  const isLocalWindows = process.platform === 'win32';
  const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const localInputPath = path.join(tmpDir, `input-preview-${taskId}.mp4`);
  const localOutputPath = path.join(tmpDir, `preview-${taskId}.mp4`);
  const fontPath = path.join(tmpDir, `font-preview-${taskId}.ttf`);
  let localSoundtrackPath = '';

  try {
    // 1. Validate Request Payload
    const validationResult = renderRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ status: 'FAILED', error: `Validation Error: ${errors}` });
    }

    const payload = validationResult.data;
    const previewStart = payload.previewStart ?? 0.0;
    const previewDuration = payload.previewDuration ?? 2.0;

    // 2. Setup font asset
    let localFontBundlePath = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');
    if (!fs.existsSync(localFontBundlePath)) {
      localFontBundlePath = path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
    }
    
    if (fs.existsSync(localFontBundlePath)) {
      fs.writeFileSync(fontPath, fs.readFileSync(localFontBundlePath));
    }

    // 3. Download Source Video from GCS
    await downloadFromGcs(payload.sourceVideoGcsUrl, localInputPath);

    // Download or resolve soundtrack path
    if (payload.soundtrackGcsUrl) {
      if (payload.soundtrackGcsUrl.startsWith('gs://')) {
        localSoundtrackPath = path.join(tmpDir, `soundtrack-preview-${taskId}${path.extname(payload.soundtrackGcsUrl) || '.mp3'}`);
        await downloadFromGcs(payload.soundtrackGcsUrl, localSoundtrackPath);
      } else {
        localSoundtrackPath = payload.soundtrackGcsUrl;
      }
    } else {
      const mode = payload.blueprint.selected_mode || 'luxury-demon-reveal';
      const fileName = DEFAULT_TRACKS[mode] || 'luxury_track.mp3';
      const possiblePaths = [
        path.join(__dirname, 'assets', 'audio', fileName),
        path.join(__dirname, '..', 'assets', 'audio', fileName),
        path.join(process.cwd(), 'public', 'audio', fileName),
        path.join(process.cwd(), '..', '..', 'public', 'audio', fileName),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          localSoundtrackPath = p;
          break;
        }
      }
      if (!localSoundtrackPath) {
        localSoundtrackPath = possiblePaths[0];
      }
    }

    // 4. Pre-flight Video Resolution & Audio Checks
    const videoMetadata = parseVideoMetadata(localInputPath);
    if (videoMetadata.width > 1920 || videoMetadata.height > 1920) {
      throw new Error(`Video resolution (${videoMetadata.width}x${videoMetadata.height}) exceeds the supported 1080p limit.`);
    }
    const hasAudio = checkAudioPresence(localInputPath);

    // Extract transients for preview safety snapping
    let transients: number[] = [];
    try {
      if (localSoundtrackPath && fs.existsSync(localSoundtrackPath)) {
        const analysis = await extractAudioTransients(localSoundtrackPath);
        transients = analysis.transients;
      }
    } catch (e) {
      console.warn(`[Preview Task] Transient analysis failed:`, e);
    }

    // Clamp timeline blocks in preview and snap boundaries to transient markers
    let currentStart = 0.0;
    const initialTimeline = [];

    for (let i = 0; i < payload.blueprint.timeline.length; i++) {
      const block = payload.blueprint.timeline[i];
      let start = currentStart;
      let end = Math.min(block.end, videoMetadata.duration);

      // Only snap intermediate boundaries; lock start=0.0 and final end=duration
      if (i < payload.blueprint.timeline.length - 1) {
        const snappedEnd = snapToNearestTransient(end, transients, 0.25);
        if (snappedEnd > start) {
          end = snappedEnd;
        }
      } else {
        end = videoMetadata.duration;
      }

      if (start < end) {
        initialTimeline.push({
          ...block,
          start,
          end
        });
        currentStart = end;
      }
    }

    // Fracture Engine Execution (Director-driven fracturing based on LLM blueprint flags)
    let conformedTimeline: any[] = [];
    let microClipIndex = 0;

    for (const block of initialTimeline) {
      const blockStart = block.start;
      const blockEnd = block.end;
      const blockDuration = blockEnd - blockStart;

      // Find transients falling inside the block boundaries (excluding small edge tolerances)
      const blockTransients = transients.filter(t => t > blockStart + 0.15 && t < blockEnd - 0.15);

      if (block.fracture && blockTransients.length > 0) {
        const cuts = [blockStart, ...blockTransients, blockEnd];
        const N = cuts.length - 1;

        for (let k = 0; k < N; k++) {
          const subStart = cuts[k];
          const subEnd = cuts[k + 1];
          const subDuration = subEnd - subStart;

          // Dynamically vary velocity ramping speeds per sub-segment based on LLM planned speedRamp
          let subSpeed = block.speed;
          const speedRampLower = (block.speedRamp || '').toLowerCase();
          if (speedRampLower.includes('fast -> slow') || speedRampLower.includes('fast-in / slow-out') || speedRampLower.includes('down')) {
            subSpeed = N > 1 ? 3.0 - (k / (N - 1)) * 2.5 : block.speed;
          } else if (speedRampLower.includes('slow -> fast') || speedRampLower.includes('up')) {
            subSpeed = N > 1 ? 0.5 + (k / (N - 1)) * 2.5 : block.speed;
          } else if (speedRampLower.includes('hyper') || speedRampLower.includes('climax') || speedRampLower.includes('drop')) {
            subSpeed = k % 2 === 0 ? 4.0 : 0.25;
          }

          const sourceSliceDuration = subDuration * subSpeed;
          const maxPossibleStart = Math.max(0, videoMetadata.duration - sourceSliceDuration);
          let sourceStart = subStart;
          let sourceEnd = subEnd;

          if (maxPossibleStart > 0) {
            const seedStr = `${block.text || 'cf-preview'}-${microClipIndex}`;
            const hashVal = hashString(seedStr);
            sourceStart = (hashVal * maxPossibleStart) % maxPossibleStart;
            sourceStart = Math.max(0, Math.min(sourceStart, maxPossibleStart));
            sourceEnd = sourceStart + sourceSliceDuration;
          } else {
            sourceStart = subStart % videoMetadata.duration;
            sourceEnd = Math.min(sourceStart + sourceSliceDuration, videoMetadata.duration);
          }

          conformedTimeline.push({
            ...block,
            start: subStart,
            end: subEnd,
            speed: subSpeed,
            sourceStart,
            sourceEnd
          });
          microClipIndex++;
        }
      } else {
        conformedTimeline.push({
          ...block,
          sourceStart: block.start,
          sourceEnd: block.end
        });
      }
    }

    if (conformedTimeline.length === 0 && videoMetadata.duration > 0) {
      conformedTimeline = [
        {
          start: 0,
          end: videoMetadata.duration,
          speed: 1.0,
          text: 'CineForge Preview',
          sourceStart: 0,
          sourceEnd: videoMetadata.duration
        }
      ];
    }

    // 5. Compile FFmpeg Filter Complex with preview offsets
    const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = buildFilterComplex(
      conformedTimeline,
      payload.blueprint.color_grade,
      fontPath,
      hasAudio,
      payload.blueprint.selected_mode,
      payload.blueprint.viewer_emotion,
      payload.blueprint.hook_intensity,
      previewStart,
      previewDuration
    );

    // Compile FFmpeg command line arguments (with fast seeking before inputs)
    const ffmpegArgs = [
      '-y',
      '-ss', previewStart.toString(),
      '-t', previewDuration.toString(),
      '-i', localInputPath,
      '-ss', previewStart.toString(),
      '-t', previewDuration.toString(),
      '-i', localSoundtrackPath,
      '-filter_complex', filterComplex,
      '-map', `[${videoMap}]`
    ];

    if (outputHasAudio) {
      ffmpegArgs.push('-map', `[${audioMap}]`);
    }

    // Force h264_qsv/libx264 veryfast/ultrafast preset to maximize completion velocity
    const previewCodec = isQsvSupported ? 'h264_qsv' : 'libx264';
    ffmpegArgs.push('-c:v', previewCodec);
    if (isQsvSupported) {
      ffmpegArgs.push('-preset', 'veryfast');
    } else {
      ffmpegArgs.push('-preset', 'ultrafast');
    }

    // Clamp preview output FPS to native FPS (capped at 30)
    const fps = Math.min(30, Math.ceil(videoMetadata.fps));

    ffmpegArgs.push(
      '-r', fps.toString(),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    );

    if (outputHasAudio) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
    }

    // Terminate exactly at preview duration and output to temp output path
    ffmpegArgs.push('-t', previewDuration.toString(), localOutputPath);

    // 6. Execute FFmpeg Rendering synchronously to enable immediate HTTP response return
    const ffmpegCmd = getFfmpegCommand();
    const runResult = spawnSync(ffmpegCmd, ffmpegArgs);
    if (runResult.status !== 0) {
      throw new Error(`FFmpeg preview generation failed with exit code ${runResult.status}. Stderr: ${runResult.stderr?.toString()}`);
    }

    // 7. Save output to distinct file track: preview-[projectId].mp4
    const previewGcsUrl = payload.outputGcsUrl.replace(/output-[^/]+\.mp4$/, `preview-${taskId}.mp4`);
    console.log(`[TaskId: ${taskId}] Uploading preview rendered output video to ${previewGcsUrl}`);
    await uploadToGcs(localOutputPath, previewGcsUrl);

    // 8. Generate Signed URL
    const presignedUrl = await generateGcsSignedUrl(previewGcsUrl);
    console.log(`[TaskId: ${taskId}] Preview complete. URL: ${presignedUrl}`);

    return res.status(200).json({
      status: 'COMPLETED',
      taskId,
      outputUrl: presignedUrl
    });

  } catch (error) {
    console.error(`[TaskId: ${taskId}] Preview render crashed:`, error);
    return res.status(500).json({
      status: 'FAILED',
      taskId,
      error: (error as Error).message
    });
  } finally {
    // 9. Cleanup
    const filesToUnlink = [localInputPath, localOutputPath, fontPath];
    if (localSoundtrackPath && localSoundtrackPath.startsWith(tmpDir)) {
      filesToUnlink.push(localSoundtrackPath);
    }
    for (const filePath of filesToUnlink) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn(`Failed to clean up ${filePath}:`, e);
      }
    }
  }
});

// HTTP GET /status/:taskId route handler
app.get('/status/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId parameter' });
  }

  const progress = await getProgress(taskId);
  if (!progress) {
    return res.status(404).json({ error: `No render task found for ID ${taskId}` });
  }

  return res.status(200).json(progress);
});

// HTTP GET /analyze-audio route handler
app.get('/analyze-audio', async (req: Request, res: Response) => {
  const { track } = req.query;
  if (!track || typeof track !== 'string') {
    return res.status(400).json({ error: 'Missing track query parameter' });
  }

  // Resolve audio track file path
  const possiblePaths = [
    path.join(__dirname, 'assets', 'audio', track),
    path.join(__dirname, '..', 'assets', 'audio', track),
    path.join(process.cwd(), 'public', 'audio', track),
    path.join(process.cwd(), '..', '..', 'public', 'audio', track)
  ];

  let filePath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.warn(`[AnalyzeAudio] Audio track file not found for: ${track}. Returning fallback template.`);
    return res.status(200).json({ bpm: 120, beatInterval: 0.50, transients: [] });
  }

  try {
    console.log(`[AnalyzeAudio] Analyzing audio transients for: ${filePath}`);
    const result = await extractAudioTransients(filePath);
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[AnalyzeAudio] DSP transient analysis crashed:`, err);
    return res.status(200).json({ bpm: 120, beatInterval: 0.50, transients: [] });
  }
});

// Ensure public uploads and renders directories exist in working directory on startup
if (process.env.RENDER_MODE === 'local') {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const rendersDir = path.join(process.cwd(), 'public', 'renders');
  
  // Fallback directory checks to support host workspace setups
  const targetUploads = (!fs.existsSync(uploadsDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'uploads')))
    ? path.join(process.cwd(), '..', '..', 'public', 'uploads')
    : uploadsDir;
  const targetRenders = (!fs.existsSync(rendersDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'renders')))
    ? path.join(process.cwd(), '..', '..', 'public', 'renders')
    : rendersDir;

  if (!fs.existsSync(targetUploads)) {
    fs.mkdirSync(targetUploads, { recursive: true });
    console.log(`[Startup] Created missing uploads directory: ${targetUploads}`);
  }
  if (!fs.existsSync(targetRenders)) {
    fs.mkdirSync(targetRenders, { recursive: true });
    console.log(`[Startup] Created missing renders directory: ${targetRenders}`);
  }
}

// Ensure default audio track files exist
ensureDefaultAudioTracks();

// Check for Intel QSV support at boot time
if (process.env.RENDER_MODE === 'local') {
  try {
    const ffmpegCmd = getFfmpegCommand();
    const encoders = execSync(`"${ffmpegCmd}" -encoders`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    isQsvSupported = encoders.includes('h264_qsv');
    console.log(`[Startup] FFmpeg Intel QSV Hardware Acceleration support detected: ${isQsvSupported}`);
  } catch (e) {
    console.warn('[Startup] Failed to check for Intel QSV support:', e);
  }
}

// Start Express Listener
app.listen(PORT, () => {
  console.log(`CineForge GCP Render Node listening on port ${PORT}`);
});
