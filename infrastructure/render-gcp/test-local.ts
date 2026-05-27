import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { buildFilterComplex } from './ffmpeg';
import { Blueprint } from './types/blueprint';

const FONT_PATH = path.join(__dirname, 'assets', 'Roboto-Bold.ttf');

const MOCK_BLUEPRINT: Blueprint = {
  timeline: [
    {
      start: 0.0,
      end: 2.5,
      speed: 1.0,
      text: "CINEFORGE GCP ACTIVE: PROMO CUT",
      vfx: ["glow_text"]
    },
    {
      start: 2.5,
      end: 5.0,
      speed: 0.5,
      text: "STRETCHED TIME DYNAMICS"
    },
    {
      start: 5.0,
      end: 8.0,
      speed: 2.0,
      text: "FAST OUTROPayoff"
    }
  ],
  color_grade: {
    warmth: 1.25,
    contrast: 1.1,
    saturation: 0.85
  },
  export: {
    fps: 30,
    resolution: [1080, 1920],
    codec: 'h264'
  }
};

async function runLocalTest() {
  try {
    // 1. Ensure assets are ready
    if (!fs.existsSync(FONT_PATH)) {
      throw new Error(`Font asset not found at ${FONT_PATH}. Please make sure assets/Roboto-Bold.ttf exists.`);
    }

    // 2. Generate filter complex
    console.log('\nCompiling mock blueprint to FFmpeg filter complex...');
    const result = buildFilterComplex(
      MOCK_BLUEPRINT.timeline,
      MOCK_BLUEPRINT.color_grade,
      FONT_PATH,
      false // inputHasAudio (test null audio silent fallback)
    );

    console.log('\n--- Generated Filter Complex ---');
    console.log(result.filterComplex);
    console.log('--------------------------------');
    console.log(`Video Map Output: [${result.videoMap}]`);
    console.log(`Audio Map Output: [${result.audioMap}]`);

    // 3. Dry-run FFmpeg validation command
    console.log('\nVerifying FFmpeg syntax correctness...');
    
    let ffmpegCmd = 'ffmpeg';
    const lambdaBinPath = path.join(__dirname, '..', 'render-lambda', 'bin', 'ffmpeg.exe');
    const localBinPath = path.join(__dirname, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(lambdaBinPath)) {
      console.log(`Using lambda static FFmpeg binary at: ${lambdaBinPath}`);
      ffmpegCmd = lambdaBinPath;
    } else if (fs.existsSync(localBinPath)) {
      console.log(`Using local static FFmpeg binary at: ${localBinPath}`);
      ffmpegCmd = localBinPath;
    }

    const verifyArgs = [
      '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=10', // Simulated video only (input 0)
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo:d=10', // Simulated audio soundtrack (input 1)
      '-filter_complex', result.filterComplex,
      '-map', `[${result.videoMap}]`,
      '-map', `[${result.audioMap}]`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-f', 'null', '-' // Null output (validate syntax without writing file)
    ];

    console.log(`Executing validation using: ${ffmpegCmd}`);

    const runResult = spawnSync(ffmpegCmd, verifyArgs, { stdio: 'inherit' });
    if (runResult.status !== 0) {
      throw new Error(`FFmpeg validation process exited with code ${runResult.status}`);
    }
    console.log('✅ Validation complete! FFmpeg filters are 100% syntactically correct.');

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

runLocalTest();
