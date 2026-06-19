import { compileAutoDirectorAnalysis } from '../../src/lib/autodirectorCompiler';
import { ReferenceDna } from '../../src/types/autodirector';

const mockTimelineBlocks = [
  { id: 'b1', timestamp: '0.0s - 1.5s', start: 0, end: 1.5, speed: 3.0, speedRamp: 'Fast -> Slow' as const, caption: 'INTRO', text: 'Intro', vfx: [] },
  { id: 'b2', timestamp: '1.5s - 5.0s', start: 1.5, end: 5.0, speed: 1.0, speedRamp: 'Normal' as const, caption: 'DETAILS', text: 'Details', vfx: [] },
  { id: 'b3', timestamp: '5.0s - 8.0s', start: 5.0, end: 8.0, speed: 2.0, speedRamp: 'Climax' as const, caption: 'THE CLIMAX', text: 'Climax', vfx: [] },
  { id: 'b4', timestamp: '8.0s - 10.0s', start: 8.0, end: 10.0, speed: 0.5, speedRamp: 'Slow' as const, caption: 'OUTRO', text: 'Outro', vfx: [] }
];

const mockAnalysis = {
  detectedNiche: 'cars',
  usableDuration: 10,
  score: 85,
  hasAudio: true,
  audioIntensity: 'moderate' as const,
  speechConfidence: 0.1,
  visualTempo: 'fast' as const,
  compositionSequence: [
    { startTime: 0, endTime: 2.0, shotType: 'wide_establishing' as const, subjectDescription: 'establishing', motionIntensity: 'static' as const, usableScore: 8.5 },
    { startTime: 2.0, endTime: 6.0, shotType: 'medium_action' as const, subjectDescription: 'action', motionIntensity: 'slow_drift' as const, usableScore: 9.0 },
    { startTime: 6.0, endTime: 10.0, shotType: 'close_up' as const, subjectDescription: 'climax detail', motionIntensity: 'rapid_pan' as const, usableScore: 9.5 }
  ],
  unusableClips: []
};

const mockReferenceDna = {
  id: 'ref-style-1',
  title: 'Mock Fast Action Style',
  sourceFilename: 'ref_action.mp4',
  pacingRhythm: ['1.0s', '2.0s', '1.5s'], // Sum is 4.5s
  averageShotDuration: 1.5,
  dominantColorGrade: 'Cool Cyberpunk',
  captionPlacement: 'center_pulsing',
  createdAt: new Date().toISOString()
};

function runCompilerTest() {
  console.log('--- CineForge G4.4A ReferenceDNA Compiler Verification ---');
  
  // We compile with a desiredDuration of '10s'.
  // The ReferenceDNA sum is 4.5s. It should scale up to fit 10s:
  // 1.0s * (10/4.5) = 2.22s
  // 2.0s * (10/4.5) = 4.44s
  // 1.5s * (10/4.5) = 3.33s
  // Sum is 10.0s.
  const blueprint = compileAutoDirectorAnalysis(
    'test-project-id',
    mockAnalysis,
    'bmw-commercial',
    'YouTube',
    '10s',
    false, // maxQualityMode
    mockReferenceDna
  );

  console.log('Compiled blueprint title:', blueprint.editTitle);
  console.log('Color Grade:', blueprint.colorGrade);
  console.log('Caption Style:', blueprint.captionStyle);
  console.log('Number of blocks generated:', blueprint.timelineBlocks.length);
  
  // Verify block count matches ReferenceDNA pacing segments
  if (blueprint.timelineBlocks.length !== mockReferenceDna.pacingRhythm.length) {
    console.error('❌ FAILURE: Block count does not match pacing rhythm segments count!');
    process.exit(1);
  }

  // Verify timestamps are continuous (no gaps, no overlaps)
  let lastEnd = 0;
  blueprint.timelineBlocks.forEach((block: any, idx: number) => {
    console.log(`Block ${idx + 1}: ${block.timestamp} | speedRamp: ${block.speedRamp} | caption: ${block.caption}`);
    const match = block.timestamp.match(/([\d\.]+)s - ([\d\.]+)s/);
    if (!match) {
      console.error(`❌ FAILURE: Block ${idx + 1} has invalid timestamp format: ${block.timestamp}`);
      process.exit(1);
    }
    
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    
    if (Math.abs(start - lastEnd) > 0.05) {
      console.error(`❌ FAILURE: Timeline gap detected before block ${idx + 1}! Last end: ${lastEnd}s, current start: ${start}s`);
      process.exit(1);
    }
    
    if (end <= start) {
      console.error(`❌ FAILURE: Block ${idx + 1} has negative or zero duration!`);
      process.exit(1);
    }
    
    lastEnd = end;
  });

  // Verify snaps to target duration (10s)
  if (Math.abs(lastEnd - 10.0) > 0.1) {
    console.error(`❌ FAILURE: Timeline does not snap to target duration of 10s! Final timestamp: ${lastEnd}s`);
    process.exit(1);
  }

  // Verify overrides applied
  if (blueprint.colorGrade !== 'Cool Cyberpunk') {
    console.error(`❌ FAILURE: Dominant color grade not applied! Got: ${blueprint.colorGrade}`);
    process.exit(1);
  }

  if (!blueprint.captionStyle.includes('center_pulsing')) {
    console.error(`❌ FAILURE: Caption placement style not applied! Got: ${blueprint.captionStyle}`);
    process.exit(1);
  }

  console.log('✅ Success: ReferenceDNA timeline compiler tests passed successfully! No gaps, no overlaps, correct duration scaling.');
}

runCompilerTest();
