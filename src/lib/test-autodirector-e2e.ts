import fs from 'fs';
import path from 'path';
import { compileAutoDirectorAnalysis } from './autodirectorCompiler';

const FRONTEND_URL = 'http://localhost:3000';
const WORKSPACE_DIR = path.join(__dirname, '../..');

async function runAutoDirectorE2ETest() {
  console.log('================================================');
  console.log('STARTING AUTODIRECTOR E2E FLOW TEST');
  console.log('================================================\n');

  const projectId = 'autodirector-e2e-' + Math.random().toString(36).substring(2, 9);
  
  // Step 1: Inspect raw video asset
  console.log('[Step 1] Inspecting raw video via Vercel Next.js API...');
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
  if (!inspectData.success || !inspectData.analysis) {
    throw new Error(`Footage inspection response invalid: ${JSON.stringify(inspectData)}`);
  }

  console.log('[Step 1 Success] Analysis retrieved.');
  console.log(`  Niche: ${inspectData.analysis.detectedNiche}`);
  console.log(`  Usable Duration: ${inspectData.analysis.usableDuration}s`);
  console.log(`  Composition Blocks: ${inspectData.analysis.compositionSequence.length}`);

  // Step 2: Compile the EditDNA timeline blocks
  console.log('\n[Step 2] Compiling EditDNA from analysis result...');
  const blueprint = compileAutoDirectorAnalysis(
    projectId,
    inspectData.analysis,
    inspectData.recommendedPreset,
    'YouTube', // platform
    '15s',     // desiredDuration
    true       // maxQualityMode
  );

  console.log('[Step 2 Success] EditDNA compiled.');
  console.log(`  Title: ${blueprint.editTitle}`);
  console.log(`  Total Blocks: ${blueprint.timelineBlocks.length}`);

  // Step 3: Enqueue and dispatch the render job
  console.log('\n[Step 3] Dispatching render job with compiled EditDNA...');
  const renderPayload = {
    project: {
      id: projectId,
      title: 'AutoDirector E2E Test',
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
  console.log('[Step 3 Success] Render job enqueued:', JSON.stringify(renderData));

  // Step 4: Poll progress
  console.log('\n[Step 4] Polling render progress...');
  let completed = false;
  let attempts = 0;
  const maxAttempts = 400;

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
        console.log('[Step 4 Success] Render job finished successfully!');
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

  // Step 5: Verify rendered file
  console.log('\n[Step 5] Verifying rendered file on disk...');
  const outputPath = path.join(WORKSPACE_DIR, 'public', 'renders', `output-${projectId}.mp4`);
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Expected output file at: ${outputPath} does not exist.`);
  }

  const stats = fs.statSync(outputPath);
  console.log(`[Step 5 Success] Rendered file verified at: ${outputPath}`);
  console.log(`[File Metric] Size: ${(stats.size / 1024).toFixed(2)} KB`);

  console.log('\n================================================');
  console.log('🎉 AUTODIRECTOR E2E FLOW TEST COMPLETED SUCCESSFULLY!');
  console.log('================================================');
}

runAutoDirectorE2ETest().catch(err => {
  console.error('\n❌ E2E FLOW TEST FAILED:', err.message);
  process.exit(1);
});
