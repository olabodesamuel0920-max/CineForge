import { extractAudioTransients } from '../audioAnalysis';
import * as path from 'path';
import * as fs from 'fs';

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
    const result = await extractAudioTransients(audioPath);
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
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

test();
