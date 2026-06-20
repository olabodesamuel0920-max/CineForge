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
exports.analyzeVideoQuality = analyzeVideoQuality;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Probes a video file using ffprobe and raw pixel extraction to calculate
 * input resolution, frame rate, bitrate, and quality characteristics (blur, noise, shakiness).
 */
function analyzeVideoQuality(filePath, tempDir) {
    const defaultMetrics = {
        resolution: '1920x1080',
        fps: 30,
        bitrateKbps: 5000,
        noiseScore: 3.0,
        shakeScore: 2.0,
        blurScore: 1.5
    };
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }
        // 1. Run ffprobe for metadata extraction
        const ffprobeOutput = (0, child_process_1.execSync)(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,bit_rate,duration -show_entries format=bit_rate,duration -of json=c=1 "${filePath}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        const metadata = JSON.parse(ffprobeOutput);
        const stream = metadata.streams?.[0];
        const format = metadata.format;
        if (!stream) {
            throw new Error('No video stream metadata resolved from ffprobe.');
        }
        const width = parseInt(stream.width || '1920');
        const height = parseInt(stream.height || '1080');
        const resolution = `${width}x${height}`;
        const fpsRaw = stream.r_frame_rate || '30/1';
        const fpsParts = fpsRaw.split('/');
        const fps = fpsParts.length === 2 ? Math.round(parseFloat(fpsParts[0]) / parseFloat(fpsParts[1])) : 30;
        const duration = parseFloat(format?.duration || stream.duration || '15');
        const fileStats = fs.statSync(filePath);
        const calculatedBitrate = Math.round((fileStats.size * 8) / duration / 1000); // kbps
        const bitrateKbps = calculatedBitrate > 0 ? calculatedBitrate : Math.round(parseInt(stream.bit_rate || format?.bit_rate || '5000000') / 1000);
        // 2. Compute Noise Score (bitrate per pixel metric)
        const pixelPerSec = width * height * fps;
        const bpp = (bitrateKbps * 1000) / pixelPerSec;
        let noiseScore = 3.5;
        if (bpp > 0) {
            // Mapping bits-per-pixel: bpp <= 0.02 -> ~9.0 noise, bpp >= 0.2 -> ~0.5 noise
            noiseScore = Math.max(0.5, Math.min(9.5, parseFloat((10.0 - (bpp * 45)).toFixed(1))));
        }
        // 3. Compute Blur Score using Laplacian gradient variance on a low-res raw frame
        let blurScore = 2.5;
        const rawFramePath = path.join(tempDir, `raw_frame_${Math.random().toString(36).substring(7)}.bin`);
        try {
            // Extract a frame from the middle of the clip to avoid potential black intro frames
            const sampleTime = Math.min(2.0, duration / 2).toFixed(1);
            (0, child_process_1.execSync)(`ffmpeg -y -ss ${sampleTime} -i "${filePath}" -vframes 1 -f rawvideo -pix_fmt gray -s 160x120 "${rawFramePath}"`, { stdio: 'ignore' });
            if (fs.existsSync(rawFramePath)) {
                const pixels = fs.readFileSync(rawFramePath);
                const w = 160;
                const h = 120;
                let totalGrad = 0;
                let count = 0;
                for (let y = 1; y < h - 1; y++) {
                    for (let x = 1; x < w - 1; x++) {
                        const idx = y * w + x;
                        // Sobel operators
                        const gx = (-1 * pixels[idx - w - 1] + 1 * pixels[idx - w + 1] +
                            -2 * pixels[idx - 1] + 2 * pixels[idx + 1] +
                            -1 * pixels[idx + w - 1] + 1 * pixels[idx + w + 1]);
                        const gy = (-1 * pixels[idx - w - 1] - 2 * pixels[idx - w] - 1 * pixels[idx - w + 1] +
                            1 * pixels[idx + w - 1] + 2 * pixels[idx + w] + 1 * pixels[idx + w + 1]);
                        totalGrad += Math.sqrt(gx * gx + gy * gy);
                        count++;
                    }
                }
                const avgGrad = totalGrad / count;
                // Low gradients -> blurry, high gradients -> sharp
                blurScore = Math.max(0.5, Math.min(9.5, parseFloat((10.0 - (avgGrad / 6)).toFixed(1))));
                fs.unlinkSync(rawFramePath);
            }
        }
        catch (e) {
            console.warn('[QualityAnalyzer] Failed to calculate blur score:', e);
            if (fs.existsSync(rawFramePath))
                fs.unlinkSync(rawFramePath);
        }
        // 4. Compute Shake Score using standard deviation of non-keyframe packet sizes from ffprobe
        let shakeScore = 2.0;
        try {
            const packetsOutput = (0, child_process_1.execSync)(`ffprobe -v error -show_entries packet=size,flags -select_streams v:0 -of json "${filePath}"`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
            const pkts = JSON.parse(packetsOutput).packets || [];
            let pSizeSum = 0;
            let pCount = 0;
            const sizes = [];
            for (const p of pkts) {
                if (p.flags && p.flags.includes('K'))
                    continue; // Skip keyframes
                const size = parseInt(p.size);
                if (size > 0) {
                    pSizeSum += size;
                    sizes.push(size);
                    pCount++;
                }
            }
            if (pCount > 5) {
                const mean = pSizeSum / pCount;
                let varianceSum = 0;
                for (const s of sizes) {
                    varianceSum += Math.pow(s - mean, 2);
                }
                const stdDev = Math.sqrt(varianceSum / pCount);
                const coeffVar = stdDev / mean;
                // High variation in temporal diff packet sizes indicates high motion/shakiness
                shakeScore = Math.max(1.0, Math.min(9.0, parseFloat((coeffVar * 6).toFixed(1))));
            }
        }
        catch (e) {
            console.warn('[QualityAnalyzer] Shake calculation failed:', e);
        }
        return {
            resolution,
            fps,
            bitrateKbps,
            noiseScore,
            shakeScore,
            blurScore
        };
    }
    catch (err) {
        console.error('[QualityAnalyzer] General failure in video quality analysis:', err);
        return defaultMetrics;
    }
}
