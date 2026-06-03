"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const zod_1 = require("zod");
const gcs_1 = require("./gcs");
const ffmpeg_1 = require("./ffmpeg");
const firestore_1 = require("./firestore");
const audioAnalysis_1 = require("./audioAnalysis");
const queue_1 = require("./queue");
if (process.env.RENDER_MODE !== 'cloud') {
    process.env.RENDER_MODE = 'local';
}
// Global flag to track Quick Sync Video (QSV) hardware acceleration support
let isQsvSupported = false;
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 8080;
const DEFAULT_TRACKS = {
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
                (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 60 -c:a libmp3lame "${targetPath}"`, { stdio: 'ignore' });
            }
            catch (err) {
                console.warn(`Failed to generate default track at ${targetPath}:`, err);
            }
        }
        // Generate in worker assets/audio if missing
        if (!fs.existsSync(workerTargetPath)) {
            try {
                if (fs.existsSync(targetPath)) {
                    fs.copyFileSync(targetPath, workerTargetPath);
                }
                else {
                    console.log(`[Startup] Generating default worker track: ${workerTargetPath}`);
                    (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 60 -c:a libmp3lame "${workerTargetPath}"`, { stdio: 'ignore' });
                }
            }
            catch (err) {
                console.warn(`Failed to generate default worker track at ${workerTargetPath}:`, err);
            }
        }
    });
}
// --- Request Validation Schemas ---
const timelineBlockSchema = zod_1.z.object({
    start: zod_1.z.number().nonnegative('Start timestamp must be non-negative'),
    end: zod_1.z.number().positive('End timestamp must be positive'),
    type: zod_1.z.string().optional(),
    speed: zod_1.z.number().positive('Speed modifier must be positive'),
    vfx: zod_1.z.array(zod_1.z.string()).optional(),
    text: zod_1.z.string().optional(),
    fracture: zod_1.z.boolean().optional(),
    speedRamp: zod_1.z.string().optional()
});
const blueprintSchema = zod_1.z.object({
    timeline: zod_1.z.array(timelineBlockSchema).nonempty('Timeline blocks cannot be empty'),
    audio: zod_1.z.object({
        bpm: zod_1.z.number().optional(),
        drop_at: zod_1.z.number().optional()
    }).optional(),
    color_grade: zod_1.z.object({
        warmth: zod_1.z.number().optional(),
        contrast: zod_1.z.number().optional(),
        saturation: zod_1.z.number().optional()
    }).optional(),
    export: zod_1.z.object({
        resolution: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]).optional(),
        fps: zod_1.z.number().optional(),
        codec: zod_1.z.string().optional()
    }).optional(),
    selected_mode: zod_1.z.string().optional(),
    viewer_emotion: zod_1.z.string().optional(),
    hook_intensity: zod_1.z.number().optional()
});
const isLocalMode = () => process.env.RENDER_MODE === 'local';
const renderRequestSchema = zod_1.z.object({
    sourceVideoGcsUrl: zod_1.z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
        message: 'sourceVideoGcsUrl must start with gs:// in cloud mode'
    }),
    soundtrackGcsUrl: zod_1.z.string().optional(),
    blueprint: blueprintSchema,
    taskId: zod_1.z.string().optional(),
    outputGcsUrl: zod_1.z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
        message: 'outputGcsUrl must start with gs:// in cloud mode'
    }),
    previewStart: zod_1.z.number().optional(),
    previewDuration: zod_1.z.number().optional()
});
/**
 * Cross-platform helper to resolve the path of the ffmpeg binary.
 */
function getFfmpegCommand() {
    if (process.platform === 'linux') {
        return 'ffmpeg';
    }
    try {
        (0, child_process_1.execSync)('ffmpeg -version', { stdio: 'ignore' });
        return 'ffmpeg';
    }
    catch {
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
function getFfprobeCommand() {
    if (process.platform === 'linux') {
        return 'ffprobe';
    }
    try {
        (0, child_process_1.execSync)('ffprobe -version', { stdio: 'ignore' });
        return 'ffprobe';
    }
    catch {
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
 * Pre-flight video metadata extraction helper.
 * Queries resolution, native frame rate, and stream/format duration.
 */
function parseVideoMetadata(filePath) {
    try {
        const ffprobeCmd = getFfprobeCommand();
        const ffprobeOutput = (0, child_process_1.execSync)(`"${ffprobeCmd}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration -of json=c=1 "${filePath}"`, { encoding: 'utf-8' });
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
        }
        else if (format && format.duration) {
            duration = parseFloat(format.duration);
        }
        return { width, height, fps, duration };
    }
    catch (error) {
        throw new Error(`Pre-flight video metadata parsing failed: ${error.message}`);
    }
}
/**
 * Checks if the video stream contains audio tracks.
 */
function checkAudioPresence(filePath) {
    try {
        const ffprobeCmd = getFfprobeCommand();
        const ffprobeOutput = (0, child_process_1.execSync)(`"${ffprobeCmd}" -v error -select_streams a -show_entries stream=index -of json=c=1 "${filePath}"`, { encoding: 'utf-8' });
        const metadata = JSON.parse(ffprobeOutput);
        return Array.isArray(metadata.streams) && metadata.streams.length > 0;
    }
    catch (error) {
        console.warn('Audio check failed, falling back to assuming no audio stream:', error);
        return false;
    }
}
/**
 * Parses timecode string (HH:MM:SS.ms) into seconds.
 */
function parseTimeToSeconds(timeStr) {
    const parts = timeStr.trim().split(':');
    if (parts.length !== 3)
        return 0;
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
}
/**
 * Snap a time value to the nearest transient in the transients array if it falls within the threshold.
 */
function snapToNearestTransient(timeVal, transients, threshold = 0.25) {
    if (transients.length === 0)
        return timeVal;
    const closest = transients.reduce((prev, curr) => Math.abs(curr - timeVal) < Math.abs(prev - timeVal) ? curr : prev);
    return Math.abs(closest - timeVal) <= threshold ? closest : timeVal;
}
/**
 * Deterministic string hashing utility.
 */
function hashString(str) {
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
async function runFfmpegWithProgress(args, totalDuration, job) {
    return new Promise((resolve, reject) => {
        const ffmpegCmd = getFfmpegCommand();
        const ffmpegProcess = (0, child_process_1.spawn)(ffmpegCmd, args);
        job.process = ffmpegProcess;
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
                queue_1.renderQueueManager.notifyProgress(job, percent, 'RENDERING').catch(console.error);
            }
        });
        ffmpegProcess.on('close', (code) => {
            job.process = undefined; // Clear process handle
            if (code === 0) {
                resolve();
            }
            else {
                if (job.cancelled) {
                    reject(new Error('Job cancelled'));
                }
                else {
                    reject(new Error(`FFmpeg processing failed with exit code ${code}.\nLogs snippet:\n${errorLog.slice(-1000)}`));
                }
            }
        });
        ffmpegProcess.on('error', (err) => {
            job.process = undefined;
            reject(err);
        });
    });
}
// Emergency Disk Space Protection Check
function checkFreeDiskSpace() {
    try {
        if (process.platform === 'win32') {
            const driveLetter = process.cwd()[0];
            const output = (0, child_process_1.execSync)(`powershell -Command "(Get-PSDrive ${driveLetter}).Free"`, { encoding: 'utf8' }).trim();
            const bytes = parseInt(output, 10);
            if (!isNaN(bytes)) {
                return { freeBytes: bytes };
            }
        }
        else {
            const output = (0, child_process_1.execSync)(`df -B1 .`, { encoding: 'utf8' });
            const lines = output.trim().split('\n');
            if (lines.length > 1) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 4) {
                    return { freeBytes: parseInt(parts[3], 10) };
                }
            }
        }
    }
    catch (e) {
        return { freeBytes: Infinity, error: e.message };
    }
    return { freeBytes: Infinity };
}
// Background Asset Cleanup Logic
function cleanupExpiredAssets() {
    console.log('[Cleanup] Starting automated background asset cleanup.');
    const isLocalWindows = process.platform === 'win32';
    const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
    const activePaths = queue_1.renderQueueManager.getActiveFilePaths();
    const now = Date.now();
    const TMP_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes
    const PREVIEW_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
    // 1. Clean tmp folder
    if (fs.existsSync(tmpDir)) {
        try {
            fs.readdirSync(tmpDir).forEach(file => {
                const filePath = path.join(tmpDir, file);
                const resolvedPath = path.resolve(filePath);
                if (activePaths.has(resolvedPath)) {
                    console.log(`[Cleanup] Skipping active temporary file: ${file}`);
                    return;
                }
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile() && (now - stat.mtimeMs > TMP_EXPIRATION_MS)) {
                        fs.unlinkSync(filePath);
                        console.log(`[Cleanup] Deleted expired temporary file: ${file}`);
                    }
                }
                catch (err) {
                    console.warn(`[Cleanup] Failed to process/delete tmp file ${file}:`, err);
                }
            });
        }
        catch (err) {
            console.error('[Cleanup] Failed to read tmp directory:', err);
        }
    }
    // 2. Clean local previews in public/renders (only in local mode)
    if (process.env.RENDER_MODE === 'local') {
        const rendersDir = path.join(process.cwd(), 'public', 'renders');
        const targetRenders = (!fs.existsSync(rendersDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'renders')))
            ? path.join(process.cwd(), '..', '..', 'public', 'renders')
            : rendersDir;
        if (fs.existsSync(targetRenders)) {
            try {
                fs.readdirSync(targetRenders).forEach(file => {
                    if (!file.startsWith('preview-') || !file.endsWith('.mp4')) {
                        return;
                    }
                    const filePath = path.join(targetRenders, file);
                    const resolvedPath = path.resolve(filePath);
                    if (activePaths.has(resolvedPath)) {
                        console.log(`[Cleanup] Skipping active preview file: ${file}`);
                        return;
                    }
                    try {
                        const stat = fs.statSync(filePath);
                        if (stat.isFile() && (now - stat.mtimeMs > PREVIEW_EXPIRATION_MS)) {
                            fs.unlinkSync(filePath);
                            console.log(`[Cleanup] Deleted expired preview file: ${file}`);
                        }
                    }
                    catch (err) {
                        console.warn(`[Cleanup] Failed to process/delete preview file ${file}:`, err);
                    }
                });
            }
            catch (err) {
                console.error('[Cleanup] Failed to read public renders directory:', err);
            }
        }
    }
}
// Start automated background asset cleanup loop (every 15 minutes)
setInterval(cleanupExpiredAssets, 15 * 60 * 1000);
// Initialize Queue Manager runners
queue_1.renderQueueManager.executeRenderRunner = async (job) => {
    const isLocalWindows = process.platform === 'win32';
    const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const localInputPath = path.join(tmpDir, `input-${job.jobId}.mp4`);
    const localOutputPath = path.join(tmpDir, `output-${job.jobId}.mp4`);
    const fontPath = path.join(tmpDir, `font-${job.jobId}.ttf`);
    let localSoundtrackPath = '';
    // Register active file safety locks
    job.activeFiles = [localInputPath, localOutputPath, fontPath];
    try {
        // 1. Emergency Disk Protection
        const diskInfo = checkFreeDiskSpace();
        const MIN_DISK_SPACE_BYTES = Number(process.env.MIN_DISK_SPACE_BYTES ?? 500 * 1024 * 1024); // Default 500MB
        if (diskInfo.freeBytes < MIN_DISK_SPACE_BYTES) {
            throw new Error(`Worker storage limit reached. Free space: ${(diskInfo.freeBytes / 1024 / 1024).toFixed(1)}MB, required: ${(MIN_DISK_SPACE_BYTES / 1024 / 1024).toFixed(1)}MB.`);
        }
        const payload = renderRequestSchema.parse(job.reqBody);
        // Setup Font
        let localFontBundlePath = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');
        if (!fs.existsSync(localFontBundlePath)) {
            localFontBundlePath = path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
        }
        if (fs.existsSync(localFontBundlePath)) {
            fs.writeFileSync(fontPath, fs.readFileSync(localFontBundlePath));
        }
        // Stage 1: Download
        const downloadStart = Date.now();
        await queue_1.renderQueueManager.notifyProgress(job, 3, 'DOWNLOADING');
        await (0, gcs_1.downloadFromGcs)(payload.sourceVideoGcsUrl, localInputPath);
        if (payload.soundtrackGcsUrl) {
            if (payload.soundtrackGcsUrl.startsWith('gs://')) {
                localSoundtrackPath = path.join(tmpDir, `soundtrack-${job.jobId}${path.extname(payload.soundtrackGcsUrl) || '.mp3'}`);
                job.activeFiles.push(localSoundtrackPath);
                await (0, gcs_1.downloadFromGcs)(payload.soundtrackGcsUrl, localSoundtrackPath);
            }
            else {
                localSoundtrackPath = payload.soundtrackGcsUrl;
                job.activeFiles.push(localSoundtrackPath);
            }
        }
        else {
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
            job.activeFiles.push(localSoundtrackPath);
        }
        const downloadDuration = (Date.now() - downloadStart) / 1000;
        // Stage 2: Analysis
        const analysisStart = Date.now();
        await queue_1.renderQueueManager.notifyProgress(job, 5, 'ANALYZING');
        const videoMetadata = parseVideoMetadata(localInputPath);
        if (videoMetadata.width > 1920 || videoMetadata.height > 1920) {
            throw new Error(`Video resolution (${videoMetadata.width}x${videoMetadata.height}) exceeds the supported 1080p limit.`);
        }
        const hasAudio = checkAudioPresence(localInputPath);
        let transients = [];
        if (localSoundtrackPath && fs.existsSync(localSoundtrackPath)) {
            const analysis = await (0, audioAnalysis_1.extractAudioTransients)(localSoundtrackPath);
            transients = analysis.transients;
        }
        let currentStart = 0.0;
        const initialTimeline = [];
        for (let i = 0; i < payload.blueprint.timeline.length; i++) {
            const block = payload.blueprint.timeline[i];
            let start = currentStart;
            let end = Math.min(block.end, videoMetadata.duration);
            if (i < payload.blueprint.timeline.length - 1) {
                const snappedEnd = snapToNearestTransient(end, transients, 0.25);
                if (snappedEnd > start) {
                    end = snappedEnd;
                }
            }
            else {
                end = videoMetadata.duration;
            }
            if (start < end) {
                initialTimeline.push({ ...block, start, end });
                currentStart = end;
            }
        }
        let conformedTimeline = [];
        let microClipIndex = 0;
        for (const block of initialTimeline) {
            const blockStart = block.start;
            const blockEnd = block.end;
            const blockTransients = transients.filter(t => t > blockStart + 0.15 && t < blockEnd - 0.15);
            if (block.fracture && blockTransients.length > 0) {
                const cuts = [blockStart, ...blockTransients, blockEnd];
                const N = cuts.length - 1;
                for (let k = 0; k < N; k++) {
                    const subStart = cuts[k];
                    const subEnd = cuts[k + 1];
                    const subDuration = subEnd - subStart;
                    let subSpeed = block.speed;
                    const speedRampLower = (block.speedRamp || '').toLowerCase();
                    if (speedRampLower.includes('fast -> slow') || speedRampLower.includes('fast-in / slow-out') || speedRampLower.includes('down')) {
                        subSpeed = N > 1 ? 3.0 - (k / (N - 1)) * 2.5 : block.speed;
                    }
                    else if (speedRampLower.includes('slow -> fast') || speedRampLower.includes('up')) {
                        subSpeed = N > 1 ? 0.5 + (k / (N - 1)) * 2.5 : block.speed;
                    }
                    else if (speedRampLower.includes('hyper') || speedRampLower.includes('climax') || speedRampLower.includes('drop')) {
                        subSpeed = k % 2 === 0 ? 4.0 : 0.25;
                    }
                    const sourceSliceDuration = subDuration * subSpeed;
                    const maxPossibleStart = Math.max(0, videoMetadata.duration - sourceSliceDuration);
                    let sourceStart = subStart;
                    let sourceEnd = subEnd;
                    if (maxPossibleStart > 0) {
                        const seedStr = `${block.text || 'cf-clip'}-${microClipIndex}`;
                        const hashVal = hashString(seedStr);
                        sourceStart = (hashVal * maxPossibleStart) % maxPossibleStart;
                        sourceStart = Math.max(0, Math.min(sourceStart, maxPossibleStart));
                        sourceEnd = sourceStart + sourceSliceDuration;
                    }
                    else {
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
            }
            else {
                conformedTimeline.push({
                    ...block,
                    sourceStart: block.start,
                    sourceEnd: block.end
                });
            }
        }
        if (conformedTimeline.length === 0 && videoMetadata.duration > 0) {
            conformedTimeline = [{
                    start: 0,
                    end: videoMetadata.duration,
                    speed: 1.0,
                    text: 'CineForge Clip',
                    sourceStart: 0,
                    sourceEnd: videoMetadata.duration
                }];
        }
        const totalDuration = conformedTimeline.reduce((acc, b) => acc + (b.end - b.start) / b.speed, 0);
        const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = (0, ffmpeg_1.buildFilterComplex)(conformedTimeline, payload.blueprint.color_grade, fontPath, hasAudio, payload.blueprint.selected_mode, payload.blueprint.viewer_emotion, payload.blueprint.hook_intensity);
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
        const requestedFps = payload.blueprint.export?.fps || 60;
        const fps = Math.min(requestedFps, Math.ceil(videoMetadata.fps));
        let codec = payload.blueprint.export?.codec === 'hevc' ? 'libx265' : 'libx264';
        ffmpegArgs.push('-c:v', codec, '-preset', 'veryfast', '-r', fps.toString(), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
        if (outputHasAudio) {
            ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        }
        ffmpegArgs.push('-t', totalDuration.toFixed(3), localOutputPath);
        const analysisDuration = (Date.now() - analysisStart) / 1000;
        // Stage 3: Render
        const renderStart = Date.now();
        await queue_1.renderQueueManager.notifyProgress(job, 10, 'RENDERING');
        await runFfmpegWithProgress(ffmpegArgs, totalDuration, job);
        const renderDuration = (Date.now() - renderStart) / 1000;
        // Stage 4: Upload
        const uploadStart = Date.now();
        await queue_1.renderQueueManager.notifyProgress(job, 95, 'UPLOADING');
        let outputSize = 0;
        try {
            outputSize = fs.statSync(localOutputPath).size;
        }
        catch { }
        await (0, gcs_1.uploadToGcs)(localOutputPath, payload.outputGcsUrl);
        const presignedUrl = await (0, gcs_1.generateGcsSignedUrl)(payload.outputGcsUrl);
        const uploadDuration = (Date.now() - uploadStart) / 1000;
        // Compile Telemetry Diagnostics
        const totalJobDuration = (Date.now() - (job.startedAt ?? job.addedAt)) / 1000;
        job.diagnostics = {
            renderProfile: payload.blueprint.selected_mode,
            downloadDuration,
            analysisDuration,
            renderDuration,
            uploadDuration,
            totalDuration: totalJobDuration,
            outputSize,
            workerNode: `${require('os').hostname()}:${process.pid}`
        };
        console.log(`[Queue] Render Job ${job.jobId} completed successfully in ${totalJobDuration.toFixed(1)}s.`);
        await queue_1.renderQueueManager.notifyProgress(job, 100, 'COMPLETED');
        if (job.resolve)
            job.resolve({ jobId: job.jobId, taskId: job.taskId, outputUrl: presignedUrl });
    }
    catch (error) {
        if (job.cancelled) {
            console.log(`[Queue] Render Job ${job.jobId} was cancelled mid-process.`);
            return;
        }
        const errorMsg = error.message;
        console.error(`[Queue] Render Job ${job.jobId} failed:`, errorMsg);
        const endedAt = Date.now();
        job.diagnostics = {
            ...job.diagnostics,
            totalDuration: (endedAt - (job.startedAt ?? job.addedAt)) / 1000,
            error: errorMsg
        };
        await queue_1.renderQueueManager.notifyProgress(job, 100, 'FAILED', errorMsg);
        if (job.reject)
            job.reject(error);
    }
    finally {
        // Clear locked file safety paths
        job.activeFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath) && !filePath.startsWith(path.join(__dirname, 'assets')) && !filePath.startsWith(path.join(process.cwd(), 'public', 'audio'))) {
                    fs.unlinkSync(filePath);
                }
            }
            catch { }
        });
        job.activeFiles = [];
    }
};
queue_1.renderQueueManager.executePreviewRunner = async (job) => {
    const isLocalWindows = process.platform === 'win32';
    const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const localInputPath = path.join(tmpDir, `input-preview-${job.jobId}.mp4`);
    const localOutputPath = path.join(tmpDir, `preview-${job.jobId}.mp4`);
    const fontPath = path.join(tmpDir, `font-preview-${job.jobId}.ttf`);
    let localSoundtrackPath = '';
    job.activeFiles = [localInputPath, localOutputPath, fontPath];
    try {
        // 1. Emergency Disk Protection
        const diskInfo = checkFreeDiskSpace();
        const MIN_DISK_SPACE_BYTES = Number(process.env.MIN_DISK_SPACE_BYTES ?? 500 * 1024 * 1024);
        if (diskInfo.freeBytes < MIN_DISK_SPACE_BYTES) {
            throw new Error(`Worker storage limit reached.`);
        }
        const payload = renderRequestSchema.parse(job.reqBody);
        const previewStart = payload.previewStart ?? 0.0;
        const previewDuration = payload.previewDuration ?? 2.0;
        // Setup Font
        let localFontBundlePath = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');
        if (!fs.existsSync(localFontBundlePath)) {
            localFontBundlePath = path.join(__dirname, '..', 'assets', 'Roboto-Bold.ttf');
        }
        if (fs.existsSync(localFontBundlePath)) {
            fs.writeFileSync(fontPath, fs.readFileSync(localFontBundlePath));
        }
        // Stage 1: Download
        const downloadStart = Date.now();
        await (0, gcs_1.downloadFromGcs)(payload.sourceVideoGcsUrl, localInputPath);
        if (payload.soundtrackGcsUrl) {
            if (payload.soundtrackGcsUrl.startsWith('gs://')) {
                localSoundtrackPath = path.join(tmpDir, `soundtrack-preview-${job.jobId}${path.extname(payload.soundtrackGcsUrl) || '.mp3'}`);
                job.activeFiles.push(localSoundtrackPath);
                await (0, gcs_1.downloadFromGcs)(payload.soundtrackGcsUrl, localSoundtrackPath);
            }
            else {
                localSoundtrackPath = payload.soundtrackGcsUrl;
                job.activeFiles.push(localSoundtrackPath);
            }
        }
        else {
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
            job.activeFiles.push(localSoundtrackPath);
        }
        const downloadDuration = (Date.now() - downloadStart) / 1000;
        // Stage 2: Analysis
        const analysisStart = Date.now();
        const videoMetadata = parseVideoMetadata(localInputPath);
        if (videoMetadata.width > 1920 || videoMetadata.height > 1920) {
            throw new Error(`Video resolution (${videoMetadata.width}x${videoMetadata.height}) exceeds the supported 1080p limit.`);
        }
        const hasAudio = checkAudioPresence(localInputPath);
        let transients = [];
        if (localSoundtrackPath && fs.existsSync(localSoundtrackPath)) {
            const analysis = await (0, audioAnalysis_1.extractAudioTransients)(localSoundtrackPath);
            transients = analysis.transients;
        }
        let currentStart = 0.0;
        const initialTimeline = [];
        for (let i = 0; i < payload.blueprint.timeline.length; i++) {
            const block = payload.blueprint.timeline[i];
            let start = currentStart;
            let end = Math.min(block.end, videoMetadata.duration);
            if (i < payload.blueprint.timeline.length - 1) {
                const snappedEnd = snapToNearestTransient(end, transients, 0.25);
                if (snappedEnd > start) {
                    end = snappedEnd;
                }
            }
            else {
                end = videoMetadata.duration;
            }
            if (start < end) {
                initialTimeline.push({ ...block, start, end });
                currentStart = end;
            }
        }
        let conformedTimeline = [];
        let microClipIndex = 0;
        for (const block of initialTimeline) {
            const blockStart = block.start;
            const blockEnd = block.end;
            const blockTransients = transients.filter(t => t > blockStart + 0.15 && t < blockEnd - 0.15);
            if (block.fracture && blockTransients.length > 0) {
                const cuts = [blockStart, ...blockTransients, blockEnd];
                const N = cuts.length - 1;
                for (let k = 0; k < N; k++) {
                    const subStart = cuts[k];
                    const subEnd = cuts[k + 1];
                    const subDuration = subEnd - subStart;
                    let subSpeed = block.speed;
                    const speedRampLower = (block.speedRamp || '').toLowerCase();
                    if (speedRampLower.includes('fast -> slow') || speedRampLower.includes('fast-in / slow-out') || speedRampLower.includes('down')) {
                        subSpeed = N > 1 ? 3.0 - (k / (N - 1)) * 2.5 : block.speed;
                    }
                    else if (speedRampLower.includes('slow -> fast') || speedRampLower.includes('up')) {
                        subSpeed = N > 1 ? 0.5 + (k / (N - 1)) * 2.5 : block.speed;
                    }
                    else if (speedRampLower.includes('hyper') || speedRampLower.includes('climax') || speedRampLower.includes('drop')) {
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
                    }
                    else {
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
            }
            else {
                conformedTimeline.push({
                    ...block,
                    sourceStart: block.start,
                    sourceEnd: block.end
                });
            }
        }
        if (conformedTimeline.length === 0 && videoMetadata.duration > 0) {
            conformedTimeline = [{
                    start: 0,
                    end: videoMetadata.duration,
                    speed: 1.0,
                    text: 'CineForge Preview',
                    sourceStart: 0,
                    sourceEnd: videoMetadata.duration
                }];
        }
        const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = (0, ffmpeg_1.buildFilterComplex)(conformedTimeline, payload.blueprint.color_grade, fontPath, hasAudio, payload.blueprint.selected_mode, payload.blueprint.viewer_emotion, payload.blueprint.hook_intensity, previewStart, previewDuration);
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
        const previewCodec = 'libx264';
        ffmpegArgs.push('-c:v', previewCodec);
        ffmpegArgs.push('-preset', 'ultrafast');
        const fps = Math.min(30, Math.ceil(videoMetadata.fps));
        ffmpegArgs.push('-r', fps.toString(), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
        if (outputHasAudio) {
            ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
        }
        ffmpegArgs.push('-t', previewDuration.toString(), localOutputPath);
        const analysisDuration = (Date.now() - analysisStart) / 1000;
        // Stage 3: Render
        const renderStart = Date.now();
        const ffmpegCmd = getFfmpegCommand();
        const runResult = await new Promise((resClose, rejClose) => {
            const process = (0, child_process_1.spawn)(ffmpegCmd, ffmpegArgs);
            job.process = process;
            process.on('close', (code) => {
                job.process = undefined;
                resClose(code ?? 0);
            });
            process.on('error', (err) => {
                job.process = undefined;
                rejClose(err);
            });
        });
        if (runResult !== 0) {
            if (job.cancelled) {
                throw new Error('Preview job cancelled');
            }
            throw new Error(`FFmpeg preview generation failed with exit code ${runResult}.`);
        }
        const renderDuration = (Date.now() - renderStart) / 1000;
        // Stage 4: Upload
        const uploadStart = Date.now();
        const previewGcsUrl = payload.outputGcsUrl.replace(/output-[^/]+\.mp4$/, `preview-${job.jobId}.mp4`);
        let outputSize = 0;
        try {
            outputSize = fs.statSync(localOutputPath).size;
        }
        catch { }
        await (0, gcs_1.uploadToGcs)(localOutputPath, previewGcsUrl);
        const presignedUrl = await (0, gcs_1.generateGcsSignedUrl)(previewGcsUrl);
        const uploadDuration = (Date.now() - uploadStart) / 1000;
        const totalJobDuration = (Date.now() - (job.startedAt ?? job.addedAt)) / 1000;
        job.diagnostics = {
            renderProfile: payload.blueprint.selected_mode,
            downloadDuration,
            analysisDuration,
            renderDuration,
            uploadDuration,
            totalDuration: totalJobDuration,
            outputSize,
            workerNode: `${require('os').hostname()}:${process.pid}`
        };
        console.log(`[Queue] Preview Job ${job.jobId} completed successfully.`);
        if (job.resolve) {
            job.resolve({
                status: 'COMPLETED',
                taskId: job.taskId,
                jobId: job.jobId,
                outputUrl: presignedUrl,
                diagnostics: job.diagnostics
            });
        }
    }
    catch (error) {
        if (job.cancelled) {
            console.log(`[Queue] Preview Job ${job.jobId} was cancelled mid-process.`);
            return;
        }
        const errorMsg = error.message;
        console.error(`[Queue] Preview Job ${job.jobId} failed:`, errorMsg);
        if (job.reject)
            job.reject(error);
    }
    finally {
        // Clear locked file safety paths
        job.activeFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath) && !filePath.startsWith(path.join(__dirname, 'assets')) && !filePath.startsWith(path.join(process.cwd(), 'public', 'audio'))) {
                    fs.unlinkSync(filePath);
                }
            }
            catch { }
        });
        job.activeFiles = [];
    }
};
// HTTP POST /render route handler - Queue Enqueueing Flow
app.post('/render', async (req, res) => {
    const taskId = req.body.taskId || `task-${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[TaskId: ${taskId}] Ingestion request for master render.`);
    // 1. Validate Request Payload
    const validationResult = renderRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ status: 'FAILED', error: `Validation Error: ${errors}` });
    }
    // Enqueue job with Queue Manager
    const job = queue_1.renderQueueManager.enqueue(taskId, 'render', req.body);
    return res.status(202).json({
        status: 'ACCEPTED',
        taskId,
        jobId: job.jobId
    });
});
// HTTP POST /render/preview route handler - Awaiting Queue Execution Flow
app.post('/render/preview', async (req, res) => {
    const taskId = req.body.taskId || `preview-${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[TaskId: ${taskId}] Ingestion request for timeline seek preview.`);
    // 1. Validate Request Payload
    const validationResult = renderRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ status: 'FAILED', error: `Validation Error: ${errors}` });
    }
    // Enqueue preview and await the execution resolution
    const jobPromise = new Promise((resolve, reject) => {
        queue_1.renderQueueManager.enqueue(taskId, 'preview', req.body, resolve, reject);
    });
    try {
        const result = await jobPromise;
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({
            status: 'FAILED',
            taskId,
            error: error.message
        });
    }
});
// HTTP GET /queue/stats route handler
app.get('/queue/stats', (req, res) => {
    return res.status(200).json(queue_1.renderQueueManager.getStats());
});
// HTTP POST /cleanup route handler (for manual trigger and stress testing)
app.post('/cleanup', (req, res) => {
    console.log('[Cleanup] Manual trigger received.');
    cleanupExpiredAssets();
    return res.status(200).json({ status: 'SUCCESS' });
});
// HTTP POST /cancel/:id route handler
app.post('/cancel/:id', (req, res) => {
    const { id } = req.params;
    console.log(`[Cancel Request] Ingestion cancellation check for: ${id}`);
    let success = queue_1.renderQueueManager.cancelJob(id);
    if (!success) {
        // Attempt treating id as taskId
        const job = queue_1.renderQueueManager.getJobByTaskId(id);
        if (job) {
            success = queue_1.renderQueueManager.cancelJob(job.jobId);
        }
    }
    if (success) {
        return res.status(200).json({ status: 'CANCELLED', id });
    }
    return res.status(404).json({ error: `Job or project task ${id} not found, or is not in an active/queued execution state.` });
});
// HTTP GET /status/:taskId route handler
app.get('/status/:taskId', async (req, res) => {
    const { taskId } = req.params;
    if (!taskId) {
        return res.status(400).json({ error: 'Missing taskId parameter' });
    }
    const progress = await (0, firestore_1.getProgress)(taskId);
    if (!progress) {
        return res.status(404).json({ error: `No render task found for ID ${taskId}` });
    }
    return res.status(200).json(progress);
});
// HTTP GET /analyze-audio route handler
app.get('/analyze-audio', async (req, res) => {
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
        const result = await (0, audioAnalysis_1.extractAudioTransients)(filePath);
        return res.status(200).json(result);
    }
    catch (err) {
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
        const encoders = (0, child_process_1.execSync)(`"${ffmpegCmd}" -encoders`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        isQsvSupported = encoders.includes('h264_qsv');
        console.log(`[Startup] FFmpeg Intel QSV Hardware Acceleration support detected: ${isQsvSupported}`);
    }
    catch (e) {
        console.warn('[Startup] Failed to check for Intel QSV support:', e);
    }
}
// Start Express Listener
app.listen(PORT, () => {
    console.log(`CineForge GCP Render Node listening on port ${PORT}`);
});
