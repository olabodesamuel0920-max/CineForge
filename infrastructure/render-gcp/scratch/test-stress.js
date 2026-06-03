const http = require('http');
const fs = require('fs');
const path = require('path');

function postJson(urlPath, body, retries = 3) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < retries; i++) {
      try {
        const data = JSON.stringify(body);
        const res = await new Promise((resReq, rejReq) => {
          const req = http.request({
            hostname: 'localhost',
            port: 8080,
            path: urlPath,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            }
          }, (response) => {
            let responseBody = '';
            response.on('data', (chunk) => responseBody += chunk);
            response.on('end', () => {
              try {
                resReq({ status: response.statusCode, body: JSON.parse(responseBody) });
              } catch (e) {
                resReq({ status: response.statusCode, rawBody: responseBody });
              }
            });
          });
          req.on('error', rejReq);
          req.write(data);
          req.end();
        });
        return resolve(res);
      } catch (err) {
        if (i === retries - 1) {
          console.warn(`[Network Warning] POST ${urlPath} failed after ${retries} attempts: ${err.message}`);
          return resolve({ status: 500, error: err.message });
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  });
}

function getJson(urlPath, retries = 3) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await new Promise((resReq, rejReq) => {
          http.get(`http://localhost:8080${urlPath}`, (response) => {
            let responseBody = '';
            response.on('data', (chunk) => responseBody += chunk);
            response.on('end', () => {
              try {
                resReq({ status: response.statusCode, body: JSON.parse(responseBody) });
              } catch (e) {
                resReq({ status: response.statusCode, rawBody: responseBody });
              }
            });
          }).on('error', rejReq);
        });
        return resolve(res);
      } catch (err) {
        if (i === retries - 1) {
          console.warn(`[Network Warning] GET ${urlPath} failed after ${retries} attempts: ${err.message}`);
          return resolve({ status: 500, error: err.message });
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  });
}

async function runStressTest() {
  console.log('=== STARTING CINEFORGE PIPELINE STRESS TEST ===\n');

  const renderPayloadTemplate = {
    "sourceVideoGcsUrl": "gs://local-uploads/promo.mp4",
    "blueprint": {
      "timeline": [
        { "start": 0, "end": 1.5, "speed": 1.0, "text": "STRESS TEST MASTER" }
      ],
      "selected_mode": "luxury-demon-reveal"
    },
    "outputGcsUrl": "gs://local-renders/output-stress.mp4"
  };

  const previewPayloadTemplate = {
    "sourceVideoGcsUrl": "gs://local-uploads/promo.mp4",
    "blueprint": {
      "timeline": [
        { "start": 0, "end": 1.0, "speed": 1.0, "text": "STRESS TEST PREVIEW" }
      ],
      "selected_mode": "luxury-demon-reveal"
    },
    "outputGcsUrl": "gs://local-renders/output-stress-preview.mp4",
    "previewStart": 0.0,
    "previewDuration": 1.0
  };

  // 1. Dispatch 10 master renders
  console.log('Dispatching 10 parallel master renders (concurrency limit = 2)...');
  const masterPromises = [];
  for (let i = 1; i <= 10; i++) {
    const p = postJson('/render', {
      ...renderPayloadTemplate,
      taskId: `stress-render-${i}`,
      outputGcsUrl: `gs://local-renders/output-stress-${i}.mp4`
    });
    masterPromises.push(p);
  }
  const masterDispatches = await Promise.all(masterPromises);
  console.log(`Dispatched 10 master renders. ACCEPTED responses: ${masterDispatches.filter(d => d.status === 202).length}`);

  // 2. Dispatch 20 preview renders (concurrency limit = 3)
  console.log('\nDispatching 20 parallel previews (concurrency limit = 3)...');
  const previewPromises = [];
  for (let i = 1; i <= 20; i++) {
    // Previews are synchronous, so we trigger them in the background (and catch socket resets)
    const p = postJson('/render/preview', {
      ...previewPayloadTemplate,
      taskId: `stress-preview-${i}`,
      outputGcsUrl: `gs://local-renders/output-stress-preview-${i}.mp4`
    });
    previewPromises.push(p);
  }

  // Small delay for queues to register jobs
  await new Promise(r => setTimeout(r, 1000));

  // Check stats en-route
  let stats = await getJson('/queue/stats');
  console.log('\nInitial Concurrency Stats:', JSON.stringify(stats.body, null, 2));

  // 3. Perform Multiple Cancellations
  console.log('\n--- PERFORMING MULTIPLE CANCELLATIONS ---');
  
  // Cancel two queued master renders (stress-render-5 and stress-render-6)
  console.log('Cancelling queued master render job 5...');
  const cancelRender5 = await postJson('/cancel/stress-render-5', {});
  console.log('Cancel Job 5 Response:', cancelRender5.body);

  console.log('Cancelling queued master render job 6...');
  const cancelRender6 = await postJson('/cancel/stress-render-6', {});
  console.log('Cancel Job 6 Response:', cancelRender6.body);

  // Cancel one active master render (stress-render-2 should be active along with 1)
  console.log('Cancelling active master render job 2...');
  const cancelRender2 = await postJson('/cancel/stress-render-2', {});
  console.log('Cancel Job 2 Response:', cancelRender2.body);

  // Cancel a preview job (stress-preview-10)
  console.log('Cancelling preview job 10...');
  const cancelPreview10 = await postJson('/cancel/stress-preview-10', {});
  console.log('Cancel Preview 10 Response:', cancelPreview10.body);

  // Check stats after cancellations
  stats = await getJson('/queue/stats');
  console.log('\nStats After Cancellations:', JSON.stringify(stats.body, null, 2));

  // 4. Test Disk Cleanup Safety Lock during Active Rendering
  console.log('\n--- SIMULATING DISK CLEANUP SWEEP DURING ACTIVE RENDERING ---');
  const tmpDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const expiredFilePath = path.join(tmpDir, 'expired-dummy-file.mp4');
  fs.writeFileSync(expiredFilePath, 'expired test data');
  
  // Backdate the file to be 40 minutes old (expiration is 30 mins)
  const pastTime = (Date.now() - 40 * 60 * 1000) / 1000;
  fs.utimesSync(expiredFilePath, pastTime, pastTime);
  console.log(`Created expired file: ${expiredFilePath}`);

  // Query active file safety locks from the Express server logs
  console.log('Executing manual cleanup trigger `/cleanup`...');
  const cleanupRes = await postJson('/cleanup', {});
  console.log('Cleanup result:', cleanupRes.body);

  // Verify expired file is deleted
  const expiredExists = fs.existsSync(expiredFilePath);
  console.log(`Did the expired mock file get deleted? ${!expiredExists ? 'YES (Correct!)' : 'NO (FAILED!)'}`);

  // 5. Monitor queues until completion
  console.log('\nWaiting for all active render and preview operations to drain...');
  const startTime = Date.now();

  while (true) {
    stats = await getJson('/queue/stats');
    if (!stats.body) {
      console.log('Transient stats retrieval failure, waiting...');
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }
    const running = stats.body.runningRenders + stats.body.runningPreviews;
    const queued = stats.body.queuedRenders + stats.body.queuedPreviews;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log(`[${elapsed}s] Running: ${running} | Queued: ${queued} | Completed Today: ${stats.body.completedToday} | Cancelled Today: ${stats.body.cancelledToday}`);

    if (running === 0 && queued === 0) {
      console.log('\nAll queues successfully drained!');
      break;
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  // Final diagnostics check
  console.log('\nChecking final queue statistics...');
  stats = await getJson('/queue/stats');
  console.log('Final Queue Stats:', JSON.stringify(stats.body, null, 2));
  console.log('\nStress test complete.');
}

runStressTest().catch(console.error);
