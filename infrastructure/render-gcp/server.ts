import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { z } from 'zod';
import { downloadFromGcs, uploadToGcs, generateGcsSignedUrl } from './gcs';
import { buildFilterComplex } from './ffmpeg';
import { updateProgress, getProgress } from './firestore';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

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
  blueprint: blueprintSchema,
  taskId: z.string().optional(),
  outputGcsUrl: z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
    message: 'outputGcsUrl must start with gs:// in cloud mode'
  })
});

type RenderRequest = z.infer<typeof renderRequestSchema>;

/**
 * Cross-platform helper to resolve the path of the ffmpeg binary.
 */
function getFfmpegCommand(): string {
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

    ffmpegArgs.push(localOutputPath);

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

// Start Express Listener
app.listen(PORT, () => {
  console.log(`CineForge GCP Render Node listening on port ${PORT}`);
});
