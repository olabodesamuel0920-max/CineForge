import * as fs from 'fs';
import * as path from 'path';
import { compileAutoDirectorAnalysis } from './autodirectorCompiler';

const FRONTEND_URL = 'http://localhost:3000';
const WORKSPACE_DIR = 'c:/Users/colds/Documents/GitHub/CineForge';

async function run() {
  console.log('================================================');
  console.log('STARTING REFERENCEDNA E2E FLOW AND RENDER TEST');
  console.log('================================================\n');

  const projectId = 'refdna-e2e-' + Math.random().toString(36).substring(2, 9);
  
  // Step 1: Analyze Reference Clip to extract style DNA
  console.log('[Step 1] Analyzing reference video style via Next.js API...');
  const analyzeResponse = await fetch(`${FRONTEND_URL}/api/referencedna/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Action Rhythms Demo',
      assetPath: 'gs://cineforge/promo.mp4',
      projectId
    })
  });

  if (!analyzeResponse.ok) {
    const errText = await analyzeResponse.text();
    throw new Error(`ReferenceDNA analyze failed (${analyzeResponse.status}): ${errText}`);
  }

  const analyzeData = await analyzeResponse.json();
  if (!analyzeData.success || !analyzeData.referenceDna) {
    throw new Error(`ReferenceDNA response invalid: ${JSON.stringify(analyzeData)}`);
  }

  const refDna = analyzeData.referenceDna;
  console.log('[Step 1 Success] ReferenceDNA style profile generated.');
  console.log(`  Title: ${refDna.title}`);
  console.log(`  Pacing Rhythm: ${refDna.pacingRhythm.join(', ')}`);
  console.log(`  Average Shot Duration: ${refDna.averageShotDuration}s`);
  console.log(`  Dominant Color Grade: ${refDna.dominantColorGrade}`);
  console.log(`  Caption Placement Style: ${refDna.captionPlacement}`);

  // Step 2: Run AutoDirector inspection for raw footage
  console.log('\n[Step 2] Inspecting raw video via AutoDirector API...');
  const inspectResponse = await fetch(`${FRONTEND_URL}/api/autodirector/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      assetPath: 'gs://cineforge/promo.mp4',
      selectedNiche: 'cars',
      selectedPreset: 'bmw-commercial',
      maxAnalyzeSeconds: 60
    })
  });

  if (!inspectResponse.ok) {
    const errText = await inspectResponse.text();
    throw new Error(`Footage inspection failed (${inspectResponse.status}): ${errText}`);
  }

  const inspectData = await inspectResponse.json();
  console.log('[Step 2 Success] Footage analysis retrieved.');

  // Step 3: Compile EditDNA blueprint using ReferenceDNA
  console.log('\n[Step 3] Compiling EditDNA blueprint with ReferenceDNA pacing overrides...');
  const blueprint = compileAutoDirectorAnalysis(
    projectId,
    inspectData.analysis,
    inspectData.recommendedPreset,
    'YouTube', // platform
    '15s',     // desiredDuration
    true,      // maxQualityMode
    refDna     // referenceDna style overrides
  );

  console.log('[Step 3 Success] EditDNA conformed with ReferenceDNA pacing.');
  console.log(`  Title: ${blueprint.editTitle}`);
  console.log(`  Color Grade Applied: ${blueprint.colorGrade}`);
  console.log(`  Caption Placement Style Applied: ${blueprint.captionStyle}`);
  console.log(`  Timeline Blocks generated: ${blueprint.timelineBlocks.length}`);

  // Step 4: Dispatch Render job
  console.log('\n[Step 4] Dispatching render job for conformed ReferenceDNA timeline...');
  const renderPayload = {
    project: {
      id: projectId,
      title: 'ReferenceDNA E2E Render',
      selectedMode: inspectData.recommendedPreset,
      maxQualityMode: true,
      mediaFilename: 'promo.mp4',
      mediaSize: '242 KB',
      duration: '15s',
      platform: 'YouTube',
      status: {
        blueprintEngine: 'Active',
        maxQualityPlanning: 'Active',
        mediaAnalysis: 'Active',
        renderEngine: 'Provider Connection Pending'
      },
      createdAt: new Date().toISOString(),
      sourceType: 'demo',
      sourceUrl: '/uploads/promo.mp4',
      blueprint: blueprint
    }
  };

  const renderResponse = await fetch(`${FRONTEND_URL}/api/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(renderPayload)
  });

  if (!renderResponse.ok) {
    const errText = await renderResponse.text();
    throw new Error(`Render dispatch failed (${renderResponse.status}): ${errText}`);
  }

  const renderData = await renderResponse.json();
  console.log('[Step 4 Success] Render job enqueued:', JSON.stringify(renderData));

  // Step 5: Poll progress
  console.log('\n[Step 5] Polling render progress...');
  let completed = false;
  let attempts = 0;
  const maxAttempts = 200;

  while (!completed && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const statusResponse = await fetch(`${FRONTEND_URL}/api/render/status/${projectId}`);
      if (!statusResponse.ok) {
        console.warn(`[Warning] Status query failed (${statusResponse.status}). Retrying...`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`[Status Tick #${attempts}] Progress: ${statusData.progress}% | State: ${statusData.status}`);

      if (statusData.status === 'completed') {
        completed = true;
        console.log('[Step 5 Success] ReferenceDNA rendering finished successfully!');
      } else if (statusData.status === 'failed') {
        throw new Error(`Render pipeline failed: ${statusData.error}`);
      }
    } catch (e) {
      console.warn(`[Warning] Status query fetch exception: ${(e as any).message || e}. Retrying...`);
    }
  }

  if (!completed) {
    throw new Error('Render job timed out.');
  }

  // Step 6: Verify rendered output exists on disk
  console.log('\n[Step 6] Verifying output file on disk...');
  const outputPath = path.join(WORKSPACE_DIR, 'public', 'renders', `output-${projectId}.mp4`);
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Expected output file at: ${outputPath} does not exist.`);
  }

  const stats = fs.statSync(outputPath);
  console.log(`[Step 6 Success] Rendered ReferenceDNA conformed video verified at: ${outputPath}`);
  console.log(`[File Metric] Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

  console.log('\n================================================');
  console.log('🎉 REFERENCEDNA E2E RENDER TEST SUCCESSFUL!');
  console.log('================================================');
}

run().catch(err => {
  console.error('\n❌ REFERENCEDNA E2E TEST FAILED:', err.message);
  process.exit(1);
});
