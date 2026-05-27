import { Context } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import { z } from 'zod';
import { downloadFromS3, uploadToS3, generatePresignedUrl } from './s3';
import { buildFilterComplex } from './ffmpeg';
import { updateProgress } from './progress';

// --- Input Schemas ---
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
  }).optional()
});

const renderEventSchema = z.object({
  sourceVideoS3Url: z.string().url().refine(val => val.startsWith('s3://'), {
    message: 'sourceVideoS3Url must start with s3://'
  }),
  blueprint: blueprintSchema,
  taskId: z.string().optional(),
  outputS3Url: z.string().url().refine(val => val.startsWith('s3://'), {
    message: 'outputS3Url must start with s3://'
  })
});

type RenderEvent = z.infer<typeof renderEventSchema>;

/**
 * Pre-flight metadata resolution check.
 * Rejects video if width or height exceeds 1920px (1080p threshold limits) to protect memory registers.
 */
function validateInputResolution(filePath: string): void {
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json=c=1 "${filePath}"`,
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
    const ffprobeOutput = execSync(
      `ffprobe -v error -select_streams a -show_entries stream=index -of json=c=1 "${filePath}"`,
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
    const ffmpegProcess = spawn('ffmpeg', args);
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

export async function handler(event: any, context: Context) {
  const taskId = event.taskId || context.awsRequestId;
  console.log(`[TaskId: ${taskId}] Starting render job invocation.`);

  // Temporary file path registers
  const localInputPath = `/tmp/input-${taskId}.mp4`;
  const localOutputPath = `/tmp/output-${taskId}.mp4`;
  const fontPath = `/tmp/font-${taskId}.ttf`;

  try {
    // 1. Validate Input Payload
    console.log(`[TaskId: ${taskId}] Validating input payload parameters.`);
    const validationResult = renderEventSchema.safeParse(event);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation Error: ${errors}`);
    }

    const payload: RenderEvent = validationResult.data;
    await updateProgress(taskId, 2, 'DOWNLOADING');

    // 2. Setup font file to unique path
    let localFontBundlePath = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');
    if (!fs.existsSync(localFontBundlePath)) {
      localFontBundlePath = path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
    }
    if (fs.existsSync(localFontBundlePath)) {
      fs.writeFileSync(fontPath, fs.readFileSync(localFontBundlePath));
    } else {
      console.warn(`Font file not found at ${localFontBundlePath}. Falling back to default system font.`);
    }

    // 3. Download Source Video from S3
    console.log(`[TaskId: ${taskId}] Downloading source video from ${payload.sourceVideoS3Url}`);
    await downloadFromS3(payload.sourceVideoS3Url, localInputPath);
    await updateProgress(taskId, 5, 'ANALYZING');

    // 4. Pre-flight Video Checks
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
      hasAudio
    );

    // Compile FFmpeg arguments
    const ffmpegArgs = [
      '-y',
      '-i', localInputPath,
      '-filter_complex', filterComplex,
      '-map', `[${videoMap}]`
    ];

    if (outputHasAudio) {
      ffmpegArgs.push('-map', `[${audioMap}]`);
    }

    // Export codecs & configs
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

    // 6. Execute FFmpeg Rendering Subprocess
    console.log(`[TaskId: ${taskId}] Starting render rendering cycle.`);
    await updateProgress(taskId, 10, 'RENDERING');
    await runFfmpegWithProgress(ffmpegArgs, totalDuration, taskId);

    // 7. Upload final output to S3
    console.log(`[TaskId: ${taskId}] Uploading rendered output video to ${payload.outputS3Url}`);
    await updateProgress(taskId, 95, 'UPLOADING');
    await uploadToS3(localOutputPath, payload.outputS3Url);

    // 8. Generate Presigned URL
    const presignedUrl = await generatePresignedUrl(payload.outputS3Url);
    console.log(`[TaskId: ${taskId}] Render complete. Presigned URL compiled.`);
    await updateProgress(taskId, 100, 'COMPLETED');

    return {
      statusCode: 200,
      taskId,
      status: 'COMPLETED',
      outputUrl: presignedUrl
    };

  } catch (error) {
    console.error(`[TaskId: ${taskId}] Render job crashed:`, error);
    await updateProgress(taskId, 100, 'FAILED', (error as Error).message);
    
    return {
      statusCode: 500,
      taskId,
      status: 'FAILED',
      error: (error as Error).message
    };

  } finally {
    // 9. Mandatory `/tmp` Workspace Cleanup
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
}
