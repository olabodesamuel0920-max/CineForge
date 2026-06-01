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
const audioAnalysis_1 = require("../audioAnalysis");
const fs = __importStar(require("fs"));
async function test() {
    try {
        // Look for actual uploaded video file
        const audioPath = 'C:\\Users\\colds\\Downloads\\beep_beat.mp3';
        if (!fs.existsSync(audioPath)) {
            console.error(`Error: Sample track not found at ${audioPath}.`);
            process.exit(1);
        }
        console.log(`Running audio transient extraction on: ${audioPath}`);
        const start = Date.now();
        const result = await (0, audioAnalysis_1.extractAudioTransients)(audioPath);
        const duration = Date.now() - start;
        console.log('\n--- Extraction Completed ---');
        console.log(`Time taken: ${duration}ms`);
        console.log(`Estimated BPM: ${result.bpm}`);
        console.log(`Beat Interval: ${result.beatInterval}s`);
        console.log(`Total Transients Detected: ${result.transients.length}`);
        console.log('First 25 transients (seconds):', result.transients.slice(0, 25));
        console.log('----------------------------');
        // Output as JSON to easily verify
        console.log(JSON.stringify(result, null, 2));
    }
    catch (err) {
        console.error('Test execution failed:', err);
        process.exit(1);
    }
}
test();
