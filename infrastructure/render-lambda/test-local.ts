import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync, spawnSync } from 'child_process';
import { buildFilterComplex } from './ffmpeg';
import { Blueprint } from './types/blueprint';

const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/master/apache/roboto/Roboto-Bold.ttf';
const FONT_DIR = path.join(__dirname, 'assets');
const FONT_PATH = path.join(FONT_DIR, 'Roboto-Bold.ttf');

const MOCK_BLUEPRINT: Blueprint = {
  timeline: [
    {
      start: 0.0,
      end: 2.5,
      speed: 1.0,
      text: "CINEFORGE ACTIVE: PROMO CUT",
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

/**
 * Downloads the Roboto-Bold font from GitHub if it does not already exist.
 */
function ensureFontExists(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(FONT_PATH)) {
      console.log('Roboto-Bold.ttf already exists locally.');
      return resolve();
    }

    console.log(`Downloading default font from ${FONT_URL}...`);
    fs.mkdirSync(FONT_DIR, { recursive: true });
    
    const file = fs.createWriteStream(FONT_PATH);
    https.get(FONT_URL, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download font. Status Code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Font downloaded successfully.');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(FONT_PATH, () => {}); // Clean up empty file
      reject(err);
    });
  });
}

/**
 * Validates generated FFmpeg syntax by compiling and verifying commands.
 */
async function runLocalTest() {
  try {
    // 1. Ensure assets are ready
    await ensureFontExists();

    // 2. Generate filter complex
    console.log('\nCompiling mock blueprint to FFmpeg filter complex...');
    const result = buildFilterComplex(
      MOCK_BLUEPRINT.timeline,
      MOCK_BLUEPRINT.color_grade,
      FONT_PATH.replace(/\\/g, '/'), // Conform path slashes for FFmpeg
      false // inputHasAudio (Tests the new silent audio track generator fallback)
    );

    console.log('\n--- Generated Filter Complex ---');
    console.log(result.filterComplex);
    console.log('--------------------------------');
    console.log(`Video Map Output: [${result.videoMap}]`);
    console.log(`Audio Map Output: [${result.audioMap}]`);

    // 3. Dry-run FFmpeg validation command
    console.log('\nVerifying FFmpeg syntax correctness...');
    
    let ffmpegCmd = 'ffmpeg';
    const localBinPath = path.join(__dirname, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localBinPath)) {
      console.log(`Using local static FFmpeg binary at: ${localBinPath}`);
      ffmpegCmd = localBinPath;
    }

    const verifyArgs = [
      '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:d=10', // Simulated video only (input 0)
      '-filter_complex', result.filterComplex,
      '-map', `[${result.videoMap}]`,
      '-map', `[${result.audioMap}]`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-f', 'null', '-' // Null output (validate syntax without writing file)
    ];

    console.log(`Executing validation using: ${ffmpegCmd}`);

    try {
      const runResult = spawnSync(ffmpegCmd, verifyArgs, { stdio: 'inherit' });
      if (runResult.status !== 0) {
        throw new Error(`FFmpeg validation process exited with code ${runResult.status}`);
      }
      console.log('✅ Validation complete! FFmpeg filters are 100% syntactically correct.');
    } catch (e) {
      console.error('❌ Validation command failed:', e);
      throw e;
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

runLocalTest();
