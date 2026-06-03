const http = require('http');

const payload1 = {
  "sourceVideoGcsUrl": "gs://local-uploads/promo.mp4",
  "blueprint": {
    "timeline": [
      { "start": 0, "end": 2, "speed": 1.0, "text": "TEST CONCURRENCY 1" }
    ],
    "selected_mode": "luxury-demon-reveal"
  },
  "outputGcsUrl": "gs://local-renders/output-concurrency-1.mp4",
  "taskId": "task-test-concurrency-1"
};

const payload2 = {
  ...payload1,
  "outputGcsUrl": "gs://local-renders/output-concurrency-2.mp4",
  "taskId": "task-test-concurrency-2"
};

const payload3 = {
  ...payload1,
  "outputGcsUrl": "gs://local-renders/output-concurrency-3.mp4",
  "taskId": "task-test-concurrency-3"
};

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:8080${path}`, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: responseBody });
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('--- CineForge Queue Manager & Diagnostics Test Suite ---\n');

  // 1. Check initial stats
  console.log('Checking initial stats...');
  let stats = await getJson('/queue/stats');
  console.log('Stats:', JSON.stringify(stats.body, null, 2));

  // 2. Dispatch 3 parallel jobs
  console.log('\nDispatching Job 1 (task-test-concurrency-1)...');
  const res1 = await postJson('/render', payload1);
  console.log('Job 1 response:', res1.body);

  console.log('Dispatching Job 2 (task-test-concurrency-2)...');
  const res2 = await postJson('/render', payload2);
  console.log('Job 2 response:', res2.body);

  console.log('Dispatching Job 3 (task-test-concurrency-3)...');
  const res3 = await postJson('/render', payload3);
  console.log('Job 3 response:', res3.body);

  // Allow a small delay for enqueueing
  await new Promise(r => setTimeout(r, 500));

  // 3. Verify Concurrency limits and queue positioning
  console.log('\nVerifying concurrency metrics...');
  stats = await getJson('/queue/stats');
  console.log('Current Queue Stats:', JSON.stringify(stats.body, null, 2));

  console.log('\nVerifying Job 3 queue status and position...');
  const status3 = await getJson('/status/task-test-concurrency-3');
  console.log('Job 3 Status payload:', JSON.stringify(status3.body, null, 2));

  // 4. Test Cancellation architecture on the queued job
  console.log('\nCancelling Job 3 (queued job)...');
  const cancel3 = await postJson(`/cancel/task-test-concurrency-3`, {});
  console.log('Cancel Job 3 response:', cancel3.body);

  await new Promise(r => setTimeout(r, 500));

  console.log('\nChecking stats after Job 3 cancellation...');
  stats = await getJson('/queue/stats');
  console.log('Queue Stats:', JSON.stringify(stats.body, null, 2));

  const status3After = await getJson('/status/task-test-concurrency-3');
  console.log('Job 3 Status after cancel:', JSON.stringify(status3After.body, null, 2));

  // 5. Test Cancellation architecture on a running job (Job 2)
  console.log('\nCancelling Job 2 (running job)...');
  const cancel2 = await postJson(`/cancel/task-test-concurrency-2`, {});
  console.log('Cancel Job 2 response:', cancel2.body);

  await new Promise(r => setTimeout(r, 500));

  console.log('\nChecking stats after Job 2 cancellation...');
  stats = await getJson('/queue/stats');
  console.log('Queue Stats:', JSON.stringify(stats.body, null, 2));

  const status2After = await getJson('/status/task-test-concurrency-2');
  console.log('Job 2 Status after cancel:', JSON.stringify(status2After.body, null, 2));

  // 6. Monitor Job 1 to completion and extract diagnostics
  console.log('\nMonitoring Job 1 until completed/failed...');
  const startTime = Date.now();
  while (true) {
    const status1 = await getJson('/status/task-test-concurrency-1');
    const status = status1.body.status;
    const percent = status1.body.percent;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[${elapsed}s] Job 1 status: ${status} (${percent}%)`);

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'UNKNOWN') {
      console.log('\nJob 1 ended!');
      console.log('Final Job 1 Status payload:', JSON.stringify(status1.body, null, 2));
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 7. Check final stats
  console.log('\nFinal stats check...');
  stats = await getJson('/queue/stats');
  console.log('Final Queue Stats:', JSON.stringify(stats.body, null, 2));
  console.log('\nVerification suite run complete.');
}

runTest().catch(console.error);
