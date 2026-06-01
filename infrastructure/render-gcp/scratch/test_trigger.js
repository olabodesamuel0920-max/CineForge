const http = require('http');

const payload = {
  "sourceVideoGcsUrl": "gs://cineforge-media-bucket/raw/get_in_1780037481.mp4",
  "blueprint": {
    "timeline": [
      { "start": 0, "end": 3, "speed": 1, "text": "INTRO NARRATIVE HOOK" },
      { "start": 3, "end": 9, "speed": 0.5, "text": "DETAIL SEQUENCE" },
      { "start": 9, "end": 16, "speed": 1.5, "text": "ENERGY BUILD & RISE" },
      { "start": 16, "end": 25, "speed": 0.5, "text": "THEMATIC DROP CLIMAX" },
      { "start": 25, "end": 30, "speed": 1.5, "text": "VISUAL CTA / SEAMLESS LOOP" }
    ],
    "color_grade": {
      "warmth": 1.2,
      "contrast": 1,
      "saturation": 0.85
    },
    "export": {
      "resolution": [1080, 1920],
      "fps": 60,
      "codec": "hevc"
    },
    "selected_mode": "fashion-drop-impact",
    "viewer_emotion": "Sophisticated Hype",
    "hook_intensity": 1.5
  },
  "taskId": "qm7zgazre-test",
  "outputGcsUrl": "gs://cineforge-media-bucket/rendered/output-qm7zgazre-test.mp4"
};

const reqData = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/render',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(reqData)
  }
};

const startTime = Date.now();

console.log('Sending render request to localhost:8080...');
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Server response status:', res.statusCode);
    console.log('Server response body:', body);
    
    if (res.statusCode === 202) {
      console.log('Job accepted. Starting polling status loop...');
      pollStatus();
    } else {
      console.error('Job was not accepted.');
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
});

req.write(reqData);
req.end();

function pollStatus() {
  setTimeout(() => {
    http.get('http://localhost:8080/status/qm7zgazre-test', (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const statusObj = JSON.parse(body);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[${elapsed}s] Percent: ${statusObj.percent}% | Status: ${statusObj.status} ${statusObj.error ? '| Error: ' + statusObj.error : ''}`);
          
          if (statusObj.status === 'COMPLETED' || statusObj.status === 'FAILED') {
            console.log(`\nRendering finished in ${elapsed}s with status: ${statusObj.status}`);
            process.exit(statusObj.status === 'COMPLETED' ? 0 : 1);
          } else {
            pollStatus();
          }
        } catch (e) {
          console.error('Failed to parse status response:', e.message, body);
          pollStatus();
        }
      });
    }).on('error', (e) => {
      console.error('Status poll failed:', e.message);
      pollStatus();
    });
  }, 2000);
}
