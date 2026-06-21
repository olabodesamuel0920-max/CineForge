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
const soundDesignCompiler_1 = require("./soundDesignCompiler");
const qualityAnalyzer_1 = require("./qualityAnalyzer");
const aiUpscaler_1 = require("./aiUpscaler");
if (process.env.RENDER_MODE !== 'cloud') {
    process.env.RENDER_MODE = 'local';
}
// Global flags to track Quick Sync Video (QSV) hardware acceleration support
let isH264QsvSupported = false;
let isHevcQsvSupported = false;
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
    const ffmpegCmd = getFfmpegCommand();
    soundDesignCompiler_1.AUDIO_ASSETS.forEach(asset => {
        const file = asset.fileName;
        const targetPath = path.join(audioDir, file);
        const workerTargetPath = path.join(workerAudioDir, file);
        const isMusic = asset.category === 'music';
        const duration = isMusic ? 60 : asset.duration;
        // Generate in public/audio if missing
        if (!fs.existsSync(targetPath)) {
            try {
                console.log(`[Startup] Generating default track: ${targetPath}`);
                if (isMusic || asset.category === 'ambience') {
                    (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame "${targetPath}"`, { stdio: 'ignore' });
                }
                else {
                    (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i "sine=frequency=800:duration=${duration}" -c:a libmp3lame "${targetPath}"`, { stdio: 'ignore' });
                }
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
                    if (isMusic || asset.category === 'ambience') {
                        (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i anullsrc=r=44100:cl=stereo -t ${duration} -c:a libmp3lame "${workerTargetPath}"`, { stdio: 'ignore' });
                    }
                    else {
                        (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i "sine=frequency=800:duration=${duration}" -c:a libmp3lame "${workerTargetPath}"`, { stdio: 'ignore' });
                    }
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
const soundEventSchema = zod_1.z.object({
    type: zod_1.z.enum(['music bed', 'whoosh', 'riser', 'bass impact', 'soft impact', 'ambience', 'contextual Foley', 'outro sting']),
    assetId: zod_1.z.string(),
    startTime: zod_1.z.number().nonnegative(),
    duration: zod_1.z.number().positive(),
    volume: zod_1.z.number().nonnegative(),
    pan: zod_1.z.number().min(-1.0).max(1.0).optional(),
    pitch: zod_1.z.number().min(-12).max(12).optional(),
    fadeIn: zod_1.z.number().nonnegative().optional(),
    fadeOut: zod_1.z.number().nonnegative().optional(),
    duckingAmount: zod_1.z.number().min(0.0).max(1.0).optional(),
    relatedBlockId: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional()
});
const soundDesignSettingsSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    intensity: zod_1.z.enum(['subtle', 'balanced', 'aggressive']),
    preserveOriginal: zod_1.z.enum(['auto', 'yes', 'no']),
    musicMood: zod_1.z.string(),
    foleyEnabled: zod_1.z.boolean()
});
const audioConfigSchema = zod_1.z.object({
    bpm: zod_1.z.number().optional(),
    drop_at: zod_1.z.number().optional(),
    settings: soundDesignSettingsSchema.optional(),
    events: zod_1.z.array(soundEventSchema).optional()
});
const maxQualitySettingsSchema = zod_1.z.object({
    stabilization: zod_1.z.boolean(),
    denoise: zod_1.z.boolean(),
    sharpen: zod_1.z.boolean(),
    colorRecovery: zod_1.z.boolean(),
    upscaleFactor: zod_1.z.enum(['none', '2x', '4x']),
    resolution: zod_1.z.enum(['720p', '1080p', '4K']),
    neuralUpscale: zod_1.z.boolean().optional(),
    aiUpscaleFactor: zod_1.z.enum(['none', '2x', '4x']).optional(),
    aiBudgetCap: zod_1.z.number().optional(),
    faceRestoration: zod_1.z.boolean().optional()
});
const blueprintSchema = zod_1.z.object({
    timeline: zod_1.z.array(timelineBlockSchema).nonempty('Timeline blocks cannot be empty'),
    audio: audioConfigSchema.optional(),
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
    hook_intensity: zod_1.z.number().optional(),
    max_quality_settings: maxQualitySettingsSchema.optional()
});
const isLocalMode = () => process.env.RENDER_MODE === 'local';
const renderRequestSchema = zod_1.z.object({
    sourceVideoGcsUrl: zod_1.z.string().refine(val => isLocalMode() || val.startsWith('gs://'), {
        message: 'sourceVideoGcsUrl must start with gs:// in cloud mode'
    }),
    soundtrackGcsUrl: zod_1.z.string().optional(),
    blueprint: blueprintSchema,
    taskId: zod_1.z.string().optional(),
    projectDuration: zod_1.z.string().optional(),
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
 * Executes a subprocess command asynchronously to avoid event loop blocking.
 */
async function runCommandAsync(command, args, job) {
    return new Promise((resolve, reject) => {
        console.log('[Spawn Command]', command, args.map(arg => arg.includes(' ') || arg.includes(';') ? `"${arg}"` : arg).join(' '));
        const child = (0, child_process_1.spawn)(command, args);
        if (job) {
            job.process = child;
        }
        let errorLog = '';
        child.stderr?.on('data', (data) => {
            errorLog += data.toString();
        });
        child.on('close', (code) => {
            if (job) {
                job.process = undefined;
            }
            if (code === 0) {
                resolve();
            }
            else {
                if (job?.cancelled) {
                    reject(new Error('Job cancelled'));
                }
                else {
                    reject(new Error(`Command failed with exit code ${code}.\nstderr:\n${errorLog.slice(-1000)}`));
                }
            }
        });
        child.on('error', (err) => {
            if (job) {
                job.process = undefined;
            }
            reject(err);
        });
    });
}
/**
 * Subprocess wrapper to run FFmpeg while reporting progress updates.
 */
async function runFfmpegWithProgress(args, totalDuration, job) {
    return new Promise((resolve, reject) => {
        const ffmpegCmd = getFfmpegCommand();
        console.log('[FFmpeg Command]', ffmpegCmd, args.map(arg => arg.includes(' ') || arg.includes(';') ? `"${arg}"` : arg).join(' '));
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
async function resolveSoundDesignAssets(events, tmpDir, job) {
    const resolvedPaths = {};
    const isProd = process.env.RENDER_MODE === 'cloud';
    for (const event of events) {
        const assetId = event.assetId;
        if (resolvedPaths[assetId])
            continue;
        const asset = soundDesignCompiler_1.AUDIO_ASSETS.find(a => a.id === assetId);
        if (!asset) {
            console.warn(`[Sound Design] Asset ID ${assetId} not found in master manifest.`);
            continue;
        }
        // 1. Check local assets/audio cache
        const possiblePaths = [
            path.join(__dirname, 'assets', 'audio', asset.fileName),
            path.join(__dirname, '..', 'assets', 'audio', asset.fileName),
            path.join(process.cwd(), 'public', 'audio', asset.fileName),
        ];
        let localPath = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                localPath = p;
                break;
            }
        }
        if (localPath) {
            resolvedPaths[assetId] = localPath;
            continue;
        }
        // 2. Not found locally, download from GCS
        const targetDownloadPath = path.join(tmpDir, `asset-${assetId}.mp3`);
        try {
            console.log(`[Sound Design] Downloading asset ${assetId} from GCS ${asset.gcsPath}`);
            await (0, gcs_1.downloadFromGcs)(asset.gcsPath, targetDownloadPath);
            const cacheDir = path.join(__dirname, 'assets', 'audio');
            if (fs.existsSync(cacheDir)) {
                const cachedFilePath = path.join(cacheDir, asset.fileName);
                fs.copyFileSync(targetDownloadPath, cachedFilePath);
                resolvedPaths[assetId] = cachedFilePath;
                try {
                    fs.unlinkSync(targetDownloadPath);
                }
                catch { }
            }
            else {
                job.activeFiles.push(targetDownloadPath);
                resolvedPaths[assetId] = targetDownloadPath;
            }
        }
        catch (err) {
            console.error(`[Sound Design] Failed to download asset ${assetId} from GCS:`, err);
            if (!isProd) {
                try {
                    const ffmpegCmd = getFfmpegCommand();
                    const duration = asset.category === 'music' ? 60 : asset.duration;
                    (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i "sine=frequency=800:duration=${duration}" -c:a libmp3lame "${targetDownloadPath}"`, { stdio: 'ignore' });
                    job.activeFiles.push(targetDownloadPath);
                    resolvedPaths[assetId] = targetDownloadPath;
                }
                catch (e) {
                    console.error(`[Sound Design] Failed to generate local fallback for ${assetId}:`, e);
                }
            }
        }
    }
    return resolvedPaths;
}
// Initialize Queue Manager runners
queue_1.renderQueueManager.executeRenderRunner = async (job) => {
    const isLocalWindows = process.platform === 'win32';
    const tmpDir = isLocalWindows ? path.join(__dirname, 'tmp') : '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    let localInputPath = path.join(tmpDir, `input-${job.jobId}.mp4`);
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
        // Run input quality analyzer pre-flights
        console.log(`[AutoDirector Worker] Running qualityAnalyzer on input clip: ${localInputPath}`);
        const beforeMetrics = (0, qualityAnalyzer_1.analyzeVideoQuality)(localInputPath, tmpDir);
        console.log(`[AutoDirector Worker] Input Quality Metrics:`, beforeMetrics);
        // Compute raw file content hash to guarantee stable AI cache keys
        let rawFileHash = '';
        try {
            const crypto = require('crypto');
            const fileBuffer = fs.readFileSync(localInputPath);
            rawFileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            console.log(`[AutoDirector Worker] Computed raw file content hash: ${rawFileHash}`);
        }
        catch (hashErr) {
            console.error('[AutoDirector Worker] Failed to compute raw file hash:', hashErr);
        }
        // Apply pre-stabilization if requested
        const mqSettings = payload.blueprint.max_quality_settings;
        const enhancementsApplied = [];
        const aiDiagnostics = {
            aiEnabled: false,
            cacheHit: false,
            provider: 'none',
            fallbackReason: undefined,
            aiDuration: 0,
            estimatedCost: 0,
            actualCost: 0,
            finalResolution: ''
        };
        if (mqSettings?.stabilization) {
            console.log(`[AutoDirector Worker] Stabilization is enabled. Running pre-stabilization...`);
            const stabilizedPath = path.join(tmpDir, `input-stabilized-${job.jobId}.mp4`);
            // Probe if vidstab is compiled
            let hasVidstab = false;
            try {
                const filtersOutput = (0, child_process_1.execSync)(`"${getFfmpegCommand()}" -filters`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
                hasVidstab = filtersOutput.includes('vidstabdetect') && filtersOutput.includes('vidstabtransform');
            }
            catch { }
            if (hasVidstab) {
                console.log(`[AutoDirector Worker] Using vidstab for stabilization.`);
                const trfPath = path.join(tmpDir, `transforms-${job.jobId}.trf`);
                const trfPathRelative = path.relative(process.cwd(), trfPath).replace(/\\/g, '/');
                try {
                    await runCommandAsync(getFfmpegCommand(), ['-y', '-i', localInputPath, '-vf', `vidstabdetect=shakiness=5:accuracy=10:result=${trfPathRelative}`, '-f', 'null', '-'], job);
                    await runCommandAsync(getFfmpegCommand(), ['-y', '-i', localInputPath, '-vf', `vidstabtransform=input=${trfPathRelative}:smoothing=15:interpol=linear`, '-c:v', 'libx264', '-crf', '17', '-preset', 'superfast', stabilizedPath], job);
                    if (fs.existsSync(trfPath))
                        fs.unlinkSync(trfPath);
                    localInputPath = stabilizedPath;
                    job.activeFiles.push(stabilizedPath);
                    enhancementsApplied.push('VidStab Stabilization');
                }
                catch (err) {
                    console.error('[AutoDirector Worker] vidstab stabilization failed, falling back to deshake:', err);
                    if (fs.existsSync(trfPath))
                        fs.unlinkSync(trfPath);
                }
            }
            if (localInputPath !== stabilizedPath) {
                // Fallback to deshake if vidstab wasn't compiled or failed
                console.log(`[AutoDirector Worker] Falling back to deshake filter.`);
                try {
                    await runCommandAsync(getFfmpegCommand(), ['-y', '-i', localInputPath, '-vf', 'deshake', '-c:v', 'libx264', '-crf', '17', '-preset', 'superfast', stabilizedPath], job);
                    localInputPath = stabilizedPath;
                    job.activeFiles.push(stabilizedPath);
                    enhancementsApplied.push('Deshake Stabilization');
                }
                catch (err) {
                    console.error('[AutoDirector Worker] Deshake fallback stabilization failed:', err);
                }
            }
        }
        // Apply G5.2A AI Super-Resolution (Neural Upscaling) if requested
        if (mqSettings?.neuralUpscale) {
            console.log(`[AutoDirector Worker] AI Neural Upscaling is requested (${mqSettings.aiUpscaleFactor || '2x'}).`);
            aiDiagnostics.aiEnabled = true;
            const aiUpscaledPath = path.join(tmpDir, `input-ai-upscaled-${job.jobId}.mp4`);
            const projectDuration = payload.projectDuration || '10s';
            const result = await (0, aiUpscaler_1.runNeuralUpscale)(localInputPath, aiUpscaledPath, mqSettings, payload.outputGcsUrl, tmpDir, projectDuration, job.jobId, rawFileHash);
            aiDiagnostics.cacheHit = result.cacheHit;
            aiDiagnostics.provider = result.provider;
            aiDiagnostics.aiDuration = result.duration;
            aiDiagnostics.actualCost = result.cost;
            // Calculate estimated cost for diagnostics
            const estDurationSec = projectDuration === '5s' ? 5 : 10;
            const estRate = (mqSettings.aiUpscaleFactor || '2x') === '2x' ? 0.05 : 0.07;
            aiDiagnostics.estimatedCost = estDurationSec * estRate;
            if (result.success && fs.existsSync(aiUpscaledPath)) {
                console.log(`[AutoDirector Worker] AI Upscaling succeeded. Using upscaled clip as input.`);
                localInputPath = aiUpscaledPath;
                job.activeFiles.push(aiUpscaledPath);
                enhancementsApplied.push(`AI Super-Resolution (${mqSettings.aiUpscaleFactor || '2x'})`);
                // Resolve final resolution for diagnostics
                try {
                    const meta = parseVideoMetadata(aiUpscaledPath);
                    aiDiagnostics.finalResolution = `${meta.width}x${meta.height}`;
                }
                catch {
                    aiDiagnostics.finalResolution = mqSettings.aiUpscaleFactor === '4x' ? '3840x2160' : '1920x1080';
                }
            }
            else {
                console.warn(`[AutoDirector Worker] AI Upscaling fell back to classical. Reason: ${result.fallbackReason || result.error}`);
                aiDiagnostics.fallbackReason = result.fallbackReason || result.error || 'Unknown error';
                // Perform classical fallback to Lanczos / Unsharp
                const classicalUpscaledPath = path.join(tmpDir, `input-classical-upscaled-${job.jobId}.mp4`);
                console.log(`[AutoDirector Worker] Executing classical Lanczos fallback upscale to ${classicalUpscaledPath}`);
                try {
                    const isVert = videoMetadata.height > videoMetadata.width;
                    const targetW = (mqSettings.aiUpscaleFactor || '2x') === '4x' ? (isVert ? 2160 : 3840) : (isVert ? 1080 : 1920);
                    const targetH = (mqSettings.aiUpscaleFactor || '2x') === '4x' ? (isVert ? 3840 : 2160) : (isVert ? 1920 : 1080);
                    await runCommandAsync(getFfmpegCommand(), [
                        '-y',
                        '-i', localInputPath,
                        '-vf', `scale=w=${targetW}:h=${targetH}:flags=lanczos,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=0.6`,
                        '-c:v', 'libx264',
                        '-crf', '17',
                        '-preset', 'superfast',
                        classicalUpscaledPath
                    ], job);
                    localInputPath = classicalUpscaledPath;
                    job.activeFiles.push(classicalUpscaledPath);
                    enhancementsApplied.push('Classical Lanczos Upscaling (Fallback)');
                    aiDiagnostics.finalResolution = `${targetW}x${targetH}`;
                }
                catch (fallbackErr) {
                    console.error(`[AutoDirector Worker] Classical fallback upscale failed:`, fallbackErr);
                }
            }
        }
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
        // Resolve sound design config
        let soundEvents = payload.blueprint.audio?.events || [];
        let soundSettings = payload.blueprint.audio?.settings || {
            enabled: true,
            intensity: 'balanced',
            preserveOriginal: 'auto',
            musicMood: '',
            foleyEnabled: true
        };
        // Fallback compiler if enabled and events not present
        if (soundSettings.enabled && soundEvents.length === 0) {
            const presetName = payload.blueprint.selected_mode || 'luxury-demon-reveal';
            const fakePreset = { id: presetName, name: presetName, niche: 'general', audioProfile: '' };
            soundEvents = (0, soundDesignCompiler_1.compileSoundDesignPlan)(conformedTimeline, null, fakePreset, soundSettings);
        }
        const resolvedSFXPaths = await resolveSoundDesignAssets(soundEvents, tmpDir, job);
        const assetIdToInputIndex = {};
        let nextInputIndex = 1; // Input 0 is the video
        const ffmpegArgs = [
            '-y',
            '-i', localInputPath
        ];
        // Check if we have a music bed event to map it to input 1 (localSoundtrackPath)
        const musicBedEvent = soundEvents.find(e => e.type === 'music bed');
        if (musicBedEvent) {
            ffmpegArgs.push('-stream_loop', '-1', '-i', localSoundtrackPath);
            assetIdToInputIndex[musicBedEvent.assetId] = 1;
            nextInputIndex = 2;
        }
        else {
            ffmpegArgs.push('-i', localSoundtrackPath);
            nextInputIndex = 2;
        }
        // Map other unique assets
        const uniqueAssetIds = Object.keys(resolvedSFXPaths).filter(id => assetIdToInputIndex[id] === undefined);
        uniqueAssetIds.forEach(id => {
            ffmpegArgs.push('-i', resolvedSFXPaths[id]);
            assetIdToInputIndex[id] = nextInputIndex;
            nextInputIndex++;
        });
        const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = (0, ffmpeg_1.buildFilterComplex)(conformedTimeline, payload.blueprint.color_grade, fontPath, hasAudio, payload.blueprint.selected_mode, payload.blueprint.viewer_emotion, payload.blueprint.hook_intensity, undefined, undefined, soundEvents, soundSettings, assetIdToInputIndex);
        ffmpegArgs.push('-filter_complex', filterComplex, '-map', `[${videoMap}]`);
        if (outputHasAudio) {
            ffmpegArgs.push('-map', `[${audioMap}]`);
        }
        const requestedFps = payload.blueprint.export?.fps || 60;
        const fps = Math.min(requestedFps, Math.ceil(videoMetadata.fps));
        let codec = 'libx264';
        let bitrateArgs = [];
        if (payload.blueprint.export?.codec === 'hevc') {
            codec = isHevcQsvSupported ? 'hevc_qsv' : 'libx265';
            bitrateArgs = ['-b:v', '5M', '-maxrate', '7M', '-bufsize', '10M'];
        }
        else {
            codec = isH264QsvSupported ? 'h264_qsv' : 'libx264';
            bitrateArgs = ['-b:v', '7M', '-maxrate', '9M', '-bufsize', '14M'];
        }
        ffmpegArgs.push('-c:v', codec, ...bitrateArgs, '-preset', 'veryfast', '-r', fps.toString(), '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
        if (outputHasAudio) {
            ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
        }
        const localRawOutputPath = path.join(tmpDir, `raw-output-${job.jobId}.mp4`);
        job.activeFiles.push(localRawOutputPath);
        ffmpegArgs.push('-t', totalDuration.toFixed(3), localRawOutputPath);
        const analysisDuration = (Date.now() - analysisStart) / 1000;
        // Stage 3: Render
        const renderStart = Date.now();
        await queue_1.renderQueueManager.notifyProgress(job, 10, 'RENDERING');
        await runFfmpegWithProgress(ffmpegArgs, totalDuration, job);
        const renderDuration = (Date.now() - renderStart) / 1000;
        // Stage 3.5: MaxQuality Enhancement Post-Processing Pass
        console.log(`[AutoDirector Worker] Running final enhancement pass...`);
        const enhancementStart = Date.now();
        const isPortrait = payload.blueprint.export?.resolution ? payload.blueprint.export.resolution[1] > payload.blueprint.export.resolution[0] : true;
        let targetW = isPortrait ? 1080 : 1920;
        let targetH = isPortrait ? 1920 : 1080;
        const targetRes = mqSettings?.resolution || '1080p';
        if (targetRes === '720p') {
            targetW = isPortrait ? 720 : 1280;
            targetH = isPortrait ? 1280 : 720;
        }
        else if (targetRes === '4K') {
            targetW = isPortrait ? 2160 : 3840;
            targetH = isPortrait ? 3840 : 2160;
        }
        const filterParts = [];
        if (mqSettings?.denoise) {
            filterParts.push('hqdn3d=luma_spatial=4:chroma_spatial=3');
            enhancementsApplied.push('Denoise (hqdn3d)');
        }
        if (mqSettings?.sharpen) {
            filterParts.push('unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=0.6:chroma_msize_x=5:chroma_msize_y=5:chroma_amount=0.0');
            enhancementsApplied.push('Sharpen (unsharp)');
        }
        if (mqSettings?.colorRecovery) {
            filterParts.push('eq=contrast=1.05:saturation=1.1');
            enhancementsApplied.push('Color Recovery (eq)');
        }
        // Always scale with Lanczos to conform resolution exactly
        filterParts.push(`scale=w=${targetW}:h=${targetH}:flags=lanczos`);
        if (targetRes === '4K') {
            enhancementsApplied.push('Lanczos Upscale to 4K');
        }
        else if (targetRes === '720p') {
            enhancementsApplied.push('Downscale to 720p');
        }
        else {
            if (filterParts.length > 1) {
                enhancementsApplied.push('Conformed to 1080p');
            }
        }
        // Adjust bitrates for 4K exports to guarantee visual excellence
        let activeCodec = codec;
        let activeBitrateArgs = [...bitrateArgs];
        if (targetRes === '4K') {
            if (payload.blueprint.export?.codec === 'hevc') {
                activeBitrateArgs = ['-b:v', '15M', '-maxrate', '20M', '-bufsize', '35M'];
            }
            else {
                activeBitrateArgs = ['-b:v', '25M', '-maxrate', '30M', '-bufsize', '50M'];
            }
        }
        const hasEnhancements = mqSettings && (mqSettings.denoise || mqSettings.sharpen || mqSettings.colorRecovery || targetRes !== '1080p');
        if (hasEnhancements && fs.existsSync(localRawOutputPath)) {
            console.log(`[AutoDirector Worker] Enhancements found. Building enhancement pass command with filters: ${filterParts.join(',')}`);
            const enhanceArgs = [
                '-y',
                '-i', localRawOutputPath,
                '-vf', filterParts.join(','),
                '-c:v', activeCodec,
                ...activeBitrateArgs,
                '-preset', 'veryfast',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                '-c:a', 'copy',
                localOutputPath
            ];
            // Run FFmpeg enhancement asynchronously
            await runCommandAsync(getFfmpegCommand(), enhanceArgs, job);
        }
        else {
            console.log(`[AutoDirector Worker] No enhancements selected or default 1080p target. Moving conformed file directly.`);
            if (fs.existsSync(localRawOutputPath)) {
                fs.copyFileSync(localRawOutputPath, localOutputPath);
            }
        }
        const enhancementDuration = (Date.now() - enhancementStart) / 1000;
        console.log(`[AutoDirector Worker] Enhancement pass completed in ${enhancementDuration.toFixed(1)}s.`);
        // Run output quality analyzer post-flights
        console.log(`[AutoDirector Worker] Running qualityAnalyzer on output clip: ${localOutputPath}`);
        const afterMetrics = (0, qualityAnalyzer_1.analyzeVideoQuality)(localOutputPath, tmpDir);
        console.log(`[AutoDirector Worker] Output Quality Metrics:`, afterMetrics);
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
            analysisDuration: analysisDuration + enhancementDuration,
            renderDuration,
            uploadDuration,
            totalDuration: totalJobDuration,
            outputSize,
            workerNode: `${require('os').hostname()}:${process.pid}`,
            videoDuration: totalDuration,
            resolution: [targetW, targetH],
            codec: activeCodec,
            qualityDiagnostics: {
                before: beforeMetrics,
                after: afterMetrics,
                enhancementsApplied,
                aiDiagnostics: {
                    enabled: aiDiagnostics.aiEnabled,
                    cacheHit: aiDiagnostics.cacheHit,
                    provider: aiDiagnostics.provider,
                    fallbackReason: aiDiagnostics.fallbackReason,
                    estimatedCost: aiDiagnostics.estimatedCost,
                    actualCost: aiDiagnostics.actualCost,
                    duration: aiDiagnostics.aiDuration,
                    finalResolution: aiDiagnostics.finalResolution
                }
            }
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
        // Resolve sound design config for preview
        let soundEvents = payload.blueprint.audio?.events || [];
        let soundSettings = payload.blueprint.audio?.settings || {
            enabled: true,
            intensity: 'balanced',
            preserveOriginal: 'auto',
            musicMood: '',
            foleyEnabled: true
        };
        // Fallback compiler if enabled and events not present
        if (soundSettings.enabled && soundEvents.length === 0) {
            const presetName = payload.blueprint.selected_mode || 'luxury-demon-reveal';
            const fakePreset = { id: presetName, name: presetName, niche: 'general', audioProfile: '' };
            soundEvents = (0, soundDesignCompiler_1.compileSoundDesignPlan)(conformedTimeline, null, fakePreset, soundSettings);
        }
        const previewStartVal = previewStart !== undefined ? previewStart : 0;
        const previewDurationVal = previewDuration !== undefined ? previewDuration : videoMetadata.duration;
        const previewEndVal = previewStartVal + previewDurationVal;
        const overlappingEvents = soundEvents.filter(e => {
            return e.startTime < previewEndVal && (e.startTime + e.duration) > previewStartVal;
        });
        const resolvedSFXPaths = await resolveSoundDesignAssets(overlappingEvents, tmpDir, job);
        const assetIdToInputIndex = {};
        let nextInputIndex = 1; // Input 0 is video
        const ffmpegArgs = [
            '-y',
            '-ss', previewStart.toString(),
            '-t', previewDuration.toString(),
            '-i', localInputPath
        ];
        // Check if we have a music bed event that overlaps
        const musicBedEvent = overlappingEvents.find(e => e.type === 'music bed');
        if (musicBedEvent) {
            ffmpegArgs.push('-ss', previewStart.toString(), '-t', previewDuration.toString(), '-stream_loop', '-1', '-i', localSoundtrackPath);
            assetIdToInputIndex[musicBedEvent.assetId] = 1;
            nextInputIndex = 2;
        }
        else {
            ffmpegArgs.push('-ss', previewStart.toString(), '-t', previewDuration.toString(), '-i', localSoundtrackPath);
            nextInputIndex = 2;
        }
        // Map other unique assets
        const uniqueAssetIds = Object.keys(resolvedSFXPaths).filter(id => assetIdToInputIndex[id] === undefined);
        uniqueAssetIds.forEach(id => {
            ffmpegArgs.push('-i', resolvedSFXPaths[id]);
            assetIdToInputIndex[id] = nextInputIndex;
            nextInputIndex++;
        });
        const { filterComplex, videoMap, audioMap, hasAudio: outputHasAudio } = (0, ffmpeg_1.buildFilterComplex)(conformedTimeline, payload.blueprint.color_grade, fontPath, hasAudio, payload.blueprint.selected_mode, payload.blueprint.viewer_emotion, payload.blueprint.hook_intensity, previewStart, previewDuration, soundEvents, soundSettings, assetIdToInputIndex);
        ffmpegArgs.push('-filter_complex', filterComplex, '-map', `[${videoMap}]`);
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
// --- Security Hardening Middleware & Public Health Check ---
const RENDER_WORKER_SECRET = process.env.RENDER_WORKER_SECRET;
const authMiddleware = (req, res, next) => {
    if (RENDER_WORKER_SECRET) {
        const reqSecret = req.headers['x-cineforge-worker-secret'];
        if (reqSecret !== RENDER_WORKER_SECRET) {
            console.warn(`[Security] Unauthorized access attempt to ${req.path} from IP ${req.ip}`);
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid x-cineforge-worker-secret header.' });
        }
    }
    next();
};
// Harmless public health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'CineForge GCP Render Node is active and healthy.' });
});
// HTTP POST /render route handler - Queue Enqueueing Flow
app.post('/render', authMiddleware, async (req, res) => {
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
app.post('/render/preview', authMiddleware, async (req, res) => {
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
app.get('/queue/stats', authMiddleware, (req, res) => {
    return res.status(200).json(queue_1.renderQueueManager.getStats());
});
// HTTP POST /cleanup route handler (for manual trigger and stress testing)
app.post('/cleanup', authMiddleware, (req, res) => {
    console.log('[Cleanup] Manual trigger received.');
    cleanupExpiredAssets();
    return res.status(200).json({ status: 'SUCCESS' });
});
// HTTP POST /cancel/:id route handler
app.post('/cancel/:id', authMiddleware, (req, res) => {
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
app.get('/status/:taskId', authMiddleware, async (req, res) => {
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
app.get('/analyze-audio', authMiddleware, async (req, res) => {
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
// HTTP POST /autodirector/inspect route handler
app.post('/autodirector/inspect', authMiddleware, async (req, res) => {
    const { projectId, assetPath, selectedNiche, selectedPreset, maxAnalyzeSeconds } = req.body;
    if (!projectId || !assetPath) {
        return res.status(400).json({ error: 'Missing projectId or assetPath parameters.' });
    }
    const limitSeconds = maxAnalyzeSeconds || 60;
    const niche = selectedNiche || 'cars';
    // Create unique temp directories
    const tempDir = path.join(__dirname, 'tmp', `inspect-${projectId}-${Date.now()}`);
    const localInputPath = path.join(tempDir, `input-${projectId}.mp4`);
    try {
        fs.mkdirSync(tempDir, { recursive: true });
        // 1. Download/access the raw clip
        console.log(`[AutoDirector Worker] Accessing/downloading source video: ${assetPath}`);
        await (0, gcs_1.downloadFromGcs)(assetPath, localInputPath);
        if (!fs.existsSync(localInputPath)) {
            throw new Error(`Failed to access input file at: ${localInputPath}`);
        }
        // 2. Run ffprobe analysis
        console.log(`[AutoDirector Worker] Running ffprobe inspection on: ${localInputPath}`);
        const ffprobeCmd = getFfprobeCommand();
        const ffprobeOutput = (0, child_process_1.execSync)(`"${ffprobeCmd}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -show_entries format=duration -of json=c=1 "${localInputPath}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const metadata = JSON.parse(ffprobeOutput);
        const stream = metadata.streams?.[0];
        const duration = parseFloat(metadata.format?.duration || stream?.duration || '15');
        const width = parseInt(stream?.width || '1920');
        const height = parseInt(stream?.height || '1080');
        const fpsRaw = stream?.r_frame_rate || '30/1';
        const fpsParts = fpsRaw.split('/');
        const fps = fpsParts.length === 2 ? parseFloat(fpsParts[0]) / parseFloat(fpsParts[1]) : 30;
        // 3. Extract downscaled proxy frames (limit to first 60 seconds, low FPS)
        const frameDir = path.join(tempDir, 'frames');
        fs.mkdirSync(frameDir, { recursive: true });
        const analyzeDur = Math.min(duration, limitSeconds);
        const ffmpegCmd = getFfmpegCommand();
        console.log(`[AutoDirector Worker] Extracting low-res proxy frames (limit: ${analyzeDur}s)`);
        // Extract 1 frame every 4 seconds, downscaled to 160 width
        (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -ss 0.0 -t ${analyzeDur} -i "${localInputPath}" -vf "fps=1/4,scale=160:-2" -q:v 5 "${path.join(frameDir, 'frame_%03d.jpg')}"`, { stdio: 'ignore' });
        // List extracted frames
        const extractedFrames = fs.existsSync(frameDir) ? fs.readdirSync(frameDir) : [];
        console.log(`[AutoDirector Worker] Extracted ${extractedFrames.length} proxy frames for inspection.`);
        // 4. Compute basic shot / quality heuristics (simulated for v1)
        const fileStats = fs.statSync(localInputPath);
        const fileSizeMB = fileStats.size / (1024 * 1024);
        // Dynamic composition segmentation based on conformed duration
        const segmentsCount = 3;
        const segmentDuration = duration / segmentsCount;
        const compositionSequence = [];
        const shotTypes = ['wide_establishing', 'medium_action', 'close_up'];
        const motionTypes = ['slow_drift', 'rapid_pan', 'static'];
        for (let i = 0; i < segmentsCount; i++) {
            compositionSequence.push({
                startTime: parseFloat((i * segmentDuration).toFixed(2)),
                endTime: parseFloat(((i + 1) * segmentDuration).toFixed(2)),
                shotType: shotTypes[i % shotTypes.length],
                subjectDescription: `Conformed ${niche} scene block ${i + 1} (${width}x${height} at ${fps.toFixed(1)} FPS)`,
                motionIntensity: motionTypes[i % motionTypes.length],
                usableScore: parseFloat((8.5 + Math.random() * 1.5).toFixed(1))
            });
        }
        // Determine recommended preset
        let recommendedPreset = 'bmw-commercial';
        if (niche.includes('food'))
            recommendedPreset = 'food-crave';
        else if (niche.includes('salon'))
            recommendedPreset = 'salon-transform';
        else if (niche.includes('real'))
            recommendedPreset = 'real-estate-showcase';
        else if (niche.includes('sport') || niche.includes('foot'))
            recommendedPreset = 'sports-stadium';
        else if (niche.includes('product'))
            recommendedPreset = 'product-reveal';
        else if (niche.includes('head') || niche.includes('talking'))
            recommendedPreset = 'talking-head';
        else if (niche.includes('fashion'))
            recommendedPreset = 'luxury-fashion';
        // Output formatted analysis
        const analysis = {
            detectedNiche: niche,
            dominantColorPalette: ['#0d0e15', '#1a2238', '#2a4494'],
            usableDuration: parseFloat(duration.toFixed(2)),
            unusableClips: fileSizeMB > 150 ? [{ start: limitSeconds, end: duration, reason: 'File exceeds duration analysis budget limit' }] : [],
            compositionSequence
        };
        return res.status(200).json({
            success: true,
            projectId,
            assetPath,
            recommendedPreset,
            duration: parseFloat(duration.toFixed(2)),
            sampleCount: extractedFrames.length,
            qualityFlags: {
                blurry: false,
                shaky: false,
                dark: false,
                duplicate: false,
                unusable: false
            },
            analysis
        });
    }
    catch (err) {
        console.error('[AutoDirector Worker] Inspection failed:', err);
        return res.status(500).json({ error: `Inspection pipeline failed: ${err.message}` });
    }
});
// HTTP POST /referencedna/inspect route handler
app.post('/referencedna/inspect', authMiddleware, async (req, res) => {
    const { title, assetPath, maxAnalyzeSeconds } = req.body;
    if (!assetPath) {
        return res.status(400).json({ error: 'Missing assetPath parameter.' });
    }
    const limitSeconds = maxAnalyzeSeconds || 60;
    const tempDir = path.join(__dirname, 'tmp', `refdna-${Date.now()}`);
    const localInputPath = path.join(tempDir, `input_ref.mp4`);
    try {
        fs.mkdirSync(tempDir, { recursive: true });
        // 1. Download/access the reference clip
        console.log(`[ReferenceDNA Worker] Accessing/downloading reference video: ${assetPath}`);
        await (0, gcs_1.downloadFromGcs)(assetPath, localInputPath);
        if (!fs.existsSync(localInputPath)) {
            throw new Error(`Failed to access input file at: ${localInputPath}`);
        }
        // 2. Run ffprobe analysis
        console.log(`[ReferenceDNA Worker] Running ffprobe inspection on: ${localInputPath}`);
        const ffprobeCmd = getFfprobeCommand();
        const ffprobeOutput = (0, child_process_1.execSync)(`"${ffprobeCmd}" -v error -show_entries format=duration -of json=c=1 "${localInputPath}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const metadata = JSON.parse(ffprobeOutput);
        const duration = parseFloat(metadata.format?.duration || '15');
        const cappedDuration = Math.min(duration, limitSeconds);
        // 3. Run scene change detection using FFmpeg select showinfo
        console.log(`[ReferenceDNA Worker] Running scene change detection (limit: ${cappedDuration}s)`);
        const ffmpegCmd = getFfmpegCommand();
        // We run FFmpeg capturing stderr (where showinfo prints logs)
        const result = (0, child_process_1.spawnSync)(ffmpegCmd, [
            '-t', cappedDuration.toFixed(3),
            '-i', localInputPath,
            '-vf', "select='gt(scene,0.4)',showinfo",
            '-f', 'null',
            '-'
        ], { encoding: 'utf8' });
        const cutTimestamps = [0];
        if (result.stderr) {
            const lines = result.stderr.split('\n');
            lines.forEach(line => {
                if (line.includes('showinfo') && line.includes('pts_time:')) {
                    const match = line.match(/pts_time:([\d\.]+)/);
                    if (match) {
                        const ts = parseFloat(match[1]);
                        if (ts > 0 && ts < cappedDuration) {
                            cutTimestamps.push(ts);
                        }
                    }
                }
            });
        }
        // Remove duplicates and sort
        const uniqueCuts = Array.from(new Set(cutTimestamps)).sort((a, b) => a - b);
        uniqueCuts.push(cappedDuration);
        // Compute pacing rhythm and average shot duration
        const pacingRhythm = [];
        for (let i = 0; i < uniqueCuts.length - 1; i++) {
            const diff = uniqueCuts[i + 1] - uniqueCuts[i];
            pacingRhythm.push(`${diff.toFixed(1)}s`);
        }
        const averageShotDuration = pacingRhythm.length > 0
            ? cappedDuration / pacingRhythm.length
            : cappedDuration;
        // 4. Heuristic color mood analysis
        console.log(`[ReferenceDNA Worker] Running RGB color balance heuristics`);
        let dominantColorGrade = 'Neutral Balanced';
        try {
            const samplePoints = [cappedDuration * 0.25, cappedDuration * 0.5, cappedDuration * 0.75];
            let totalR = 0, totalG = 0, totalB = 0;
            let validSamples = 0;
            for (const t of samplePoints) {
                const colorResult = (0, child_process_1.spawnSync)(ffmpegCmd, [
                    '-ss', t.toFixed(3),
                    '-i', localInputPath,
                    '-vf', 'scale=1:1',
                    '-f', 'rawvideo',
                    '-pix_fmt', 'rgb24',
                    '-vframes', '1',
                    '-'
                ]);
                if (colorResult.status === 0 && colorResult.stdout.length >= 3) {
                    totalR += colorResult.stdout[0];
                    totalG += colorResult.stdout[1];
                    totalB += colorResult.stdout[2];
                    validSamples++;
                }
            }
            if (validSamples > 0) {
                const r = totalR / validSamples;
                const g = totalG / validSamples;
                const b = totalB / validSamples;
                console.log(`[ReferenceDNA Worker] Average RGB: R=${r.toFixed(1)}, G=${g.toFixed(1)}, B=${b.toFixed(1)}`);
                if (r > b + 15 && r > g + 5) {
                    dominantColorGrade = 'Warm Cinematic';
                }
                else if (b > r + 15) {
                    dominantColorGrade = 'Cool Cyberpunk';
                }
                else if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12) {
                    dominantColorGrade = 'Sleek Monochrome';
                }
                else {
                    dominantColorGrade = 'Neutral Balanced';
                }
            }
        }
        catch (colorErr) {
            console.warn('[ReferenceDNA Worker] Color analysis failed, using fallback:', colorErr);
        }
        const transitionStyles = averageShotDuration < 2.2 ? ['cut'] : ['cut', 'fade'];
        return res.status(200).json({
            success: true,
            title: title || 'Unnamed Reference Style',
            sourceFilename: path.basename(assetPath),
            pacingRhythm,
            averageShotDuration: parseFloat(averageShotDuration.toFixed(2)),
            dominantColorGrade,
            captionPlacement: averageShotDuration < 2.0 ? 'center_pulsing' : 'bottom_subtitle',
            transitionStyles
        });
    }
    catch (err) {
        console.error('[ReferenceDNA Worker] Style inspection failed:', err);
        return res.status(500).json({ error: `Style inspection pipeline failed: ${err.message}` });
    }
    finally {
        // Delete temp folder
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log(`[ReferenceDNA Worker] Cleaned up temp workspace: ${tempDir}`);
            }
        }
        catch (e) {
            console.warn('[ReferenceDNA Worker] Temp folder cleanup failed:', e);
        }
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
        if (encoders.includes('h264_qsv')) {
            try {
                (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i testsrc=duration=0.03:size=160x120:rate=30 -c:v h264_qsv -f null -`, { stdio: 'ignore' });
                isH264QsvSupported = true;
            }
            catch (e) {
                console.warn('[Startup] h264_qsv encoder failed dry-run verification.');
            }
        }
        if (encoders.includes('hevc_qsv')) {
            try {
                (0, child_process_1.execSync)(`"${ffmpegCmd}" -y -f lavfi -i testsrc=duration=0.03:size=160x120:rate=30 -c:v hevc_qsv -f null -`, { stdio: 'ignore' });
                isHevcQsvSupported = true;
            }
            catch (e) {
                console.warn('[Startup] hevc_qsv encoder failed dry-run verification.');
            }
        }
        console.log(`[Startup] QSV support verification - h264_qsv: ${isH264QsvSupported}, hevc_qsv: ${isHevcQsvSupported}`);
    }
    catch (e) {
        console.warn('[Startup] Failed to check for Intel QSV support:', e);
    }
}
// Start Express Listener
app.listen(PORT, () => {
    console.log(`CineForge GCP Render Node listening on port ${PORT}`);
});
