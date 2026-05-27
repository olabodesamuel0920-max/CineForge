import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn, spawnSync } from 'child_process';
import { z } from 'zod';
import { downloadFromGcs, uploadToGcs, generateGcsSignedUrl } from './gcs';
import { buildFilterComplex } from './ffmpeg';
import { updateProgress, getProgress } from './firestore';

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
  text: z.string().optional()
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

/**
 * Pre-flight metadata resolution check.
 * Rejects video if width or height exceeds 1920px (1080p threshold limits) to protect memory.
 */
function validateInputResolution(filePath: string): void {
  try {
    const ffprobeCmd = getFfprobeCommand();
    const ffprobeOutput = execSync(
      `"${ffprobeCmd}" -v error -select_streams v:0 -show_entries stream=width,height -of json=c=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    const metadata = JSON.parse(ffprobeOutput);
    const stream = metadata.streams?.[0];

    if (!stream || !stream.width || !stream.height) {
      throw new Error('Video stream dimensions are missing from ffprobe output');
    }

    const { width, height } = stream;
    if (width > 1920 || height > 1920) {
      throw new Error(`Video resolution (${width}x${height}) exceeds the supported 1080p limit (max 1920px on any side).`);
    }
  } catch (error) {
    throw new Error(`Pre-flight resolution verification failed: ${(error as Error).message}`);
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

  try {
    // 1. Validate Payload
    const validationResult = renderRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ status: 'FAILED', error: `Validation Error: ${errors}` });
    }

    const payload: RenderRequest = validationResult.data;
    await updateProgress(taskId, 2, 'DOWNLOADING');

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
    validateInputResolution(localInputPath);
    const hasAudio = checkAudioPresence(localInputPath);
    console.log(`[TaskId: ${taskId}] Pre-flight verification successful. Has audio: ${hasAudio}`);

    // 5. Compile FFmpeg Filter Complex
    const totalDuration = payload.blueprint.timeline.reduce(
      (acc, block) => acc + (block.end - block.start) / block.speed,
      0
    );

    const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = buildFilterComplex(
      payload.blueprint.timeline,
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
    const fps = payload.blueprint.export?.fps || 60;
    const codec = payload.blueprint.export?.codec === 'hevc' ? 'libx265' : 'libx264';

    ffmpegArgs.push(
      '-c:v', codec,
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

    return res.status(200).json({
      status: 'COMPLETED',
      taskId,
      outputUrl: presignedUrl
    });

  } catch (error) {
    console.error(`[TaskId: ${taskId}] Render job crashed:`, error);
    await updateProgress(taskId, 100, 'FAILED', (error as Error).message);
    
    return res.status(500).json({
      status: 'FAILED',
      taskId,
      error: (error as Error).message
    });

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
    validateInputResolution(localInputPath);
    const hasAudio = checkAudioPresence(localInputPath);

    // 5. Compile FFmpeg Filter Complex with preview offsets
    const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = buildFilterComplex(
      payload.blueprint.timeline,
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

    // Force libx264 and ultrafast preset to maximize completion velocity
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-r', '30',
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

// Start Express Listener
app.listen(PORT, () => {
  console.log(`CineForge GCP Render Node listening on port ${PORT}`);
});
