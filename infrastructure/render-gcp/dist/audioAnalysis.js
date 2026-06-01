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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAudioTransients = extractAudioTransients;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
 * Pipes raw 32-bit floating point PCM mono data at 1000Hz from FFmpeg,
 * runs transient peak onset detection, and estimates the dominant BPM.
 */
async function extractAudioTransients(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`Audio source file not found at path: ${filePath}`));
        }
        const ffmpegCmd = getFfmpegCommand();
        const args = [
            '-v', 'error',
            '-i', filePath,
            '-f', 'f32le',
            '-ac', '1',
            '-ar', '1000',
            '-'
        ];
        const ffmpegProcess = (0, child_process_1.spawn)(ffmpegCmd, args);
        const chunks = [];
        let errorLog = '';
        ffmpegProcess.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });
        ffmpegProcess.stderr.on('data', (data) => {
            errorLog += data.toString();
        });
        ffmpegProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`FFmpeg audio decoding failed with exit code ${code}. Error: ${errorLog}`));
            }
            try {
                const totalBuffer = Buffer.concat(chunks);
                const floatCount = Math.floor(totalBuffer.byteLength / 4);
                // Wrap buffer in Float32Array
                const samples = new Float32Array(totalBuffer.buffer, totalBuffer.byteOffset, floatCount);
                // 1. Calculate absolute values
                const absSamples = new Float32Array(samples.length);
                for (let i = 0; i < samples.length; i++) {
                    absSamples[i] = Math.abs(samples[i]);
                }
                // 2. Compute sliding-window moving average (window size: 400ms)
                const movingAverages = new Float32Array(samples.length);
                let currentSum = 0;
                const halfWin = 200; // 200ms before, 200ms after
                const winSize = halfWin * 2 + 1;
                for (let i = 0; i < Math.min(winSize, absSamples.length); i++) {
                    currentSum += absSamples[i];
                }
                for (let i = 0; i < absSamples.length; i++) {
                    const leftBound = i - halfWin;
                    const rightBound = i + halfWin;
                    if (i > 0) {
                        if (rightBound < absSamples.length) {
                            currentSum += absSamples[rightBound];
                        }
                        if (leftBound - 1 >= 0) {
                            currentSum -= absSamples[leftBound - 1];
                        }
                    }
                    const count = Math.min(rightBound, absSamples.length - 1) - Math.max(0, leftBound) + 1;
                    movingAverages[i] = currentSum / count;
                }
                // 3. Peak Onset Detection (150ms local maximum window, 1.8x threshold)
                const transients = [];
                const threshold = 1.8;
                const localWindow = 150; // 150ms neighborhood boundary (prevents double-triggering)
                for (let i = 0; i < absSamples.length; i++) {
                    const val = absSamples[i];
                    if (val < 0.01)
                        continue; // Ignore dead silence peaks
                    if (val > movingAverages[i] * threshold) {
                        // Check if this sample is a local maximum in its neighborhood
                        let isLocalMax = true;
                        const start = Math.max(0, i - localWindow);
                        const end = Math.min(absSamples.length - 1, i + localWindow);
                        for (let j = start; j <= end; j++) {
                            if (absSamples[j] > val) {
                                isLocalMax = false;
                                break;
                            }
                        }
                        if (isLocalMax) {
                            transients.push(i / 1000); // 1000Hz sample rate => index is ms, /1000 is seconds
                            i += localWindow; // Advance past the neighborhood boundary to avoid duplicates
                        }
                    }
                }
                // 4. Estimate BPM via dominant transient interval mode clustering
                let bpm = 120;
                let beatInterval = 0.50;
                if (transients.length >= 3) {
                    const diffs = [];
                    for (let j = 0; j < transients.length - 1; j++) {
                        const diff = transients[j + 1] - transients[j];
                        if (diff >= 0.25 && diff <= 1.5) { // Limit intervals to reasonable BPM ranges (40 to 240 BPM)
                            diffs.push(diff);
                        }
                    }
                    if (diffs.length > 0) {
                        const sorted = [...diffs].sort((a, b) => a - b);
                        const mid = Math.floor(sorted.length / 2);
                        const medianInterval = sorted.length % 2 !== 0
                            ? sorted[mid]
                            : (sorted[mid - 1] + sorted[mid]) / 2;
                        bpm = Math.round(60 / medianInterval);
                        beatInterval = medianInterval;
                    }
                }
                resolve({
                    bpm,
                    beatInterval: parseFloat(beatInterval.toFixed(3)),
                    transients: transients.map((t) => parseFloat(t.toFixed(3)))
                });
            }
            catch (err) {
                reject(new Error(`Failed to parse PCM audio buffer: ${err.message}`));
            }
        });
        ffmpegProcess.on('error', (err) => {
            reject(err);
        });
    });
}
