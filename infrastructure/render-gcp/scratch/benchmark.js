const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const inputVideo = 'c:\\Users\\colds\\Documents\\GitHub\\CineForge\\public\\uploads\\get_in_1780037481.mp4';
const soundtrack = 'c:\\Users\\colds\\Documents\\GitHub\\CineForge\\infrastructure\\render-gcp\\assets\\audio\\fashion_track.mp3';
const outputDir = 'c:\\Users\\colds\\Documents\\GitHub\\CineForge\\infrastructure\\render-gcp\\tmp';
const fontPath = 'c:\\Users\\colds\\Documents\\GitHub\\CineForge\\infrastructure\\render-gcp\\assets\\Roboto-Bold.ttf';

if (!fs.existsSync(inputVideo)) {
  console.error('Input video not found at:', inputVideo);
  process.exit(1);
}
if (!fs.existsSync(soundtrack)) {
  console.error('Soundtrack not found at:', soundtrack);
  process.exit(1);
}
if (!fs.existsSync(fontPath)) {
  console.error('Font not found at:', fontPath);
  process.exit(1);
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const escapedFont = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

function getFilterComplexOptimized() {
  const intensity = 1.5;
  const parts = [
    // Segment 0
    `[0:v]trim=start=0.000:end=3.000,setpts=(PTS-STARTPTS)*(1/1.000)[vtrim_0]`,
    `[vtrim_0]eq=brightness=0.120:saturation=1.450,colorbalance=rm=0.180:gm=0.075:bm=-0.075,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2.250[vgrade_0]`,
    `[vgrade_0]scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[vconf_0]`,
    `[vconf_0]drawtext=text='INTRO NARRATIVE HOOK':fontfile='${escapedFont}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.333),t/0.333,if(lt(t,2.667),1,(3.000-t)/0.333))':borderw=2:bordercolor=black[vfinal_0]`,
    `[0:a]atrim=start=0.000:end=3.000,asetpts=PTS-STARTPTS[afinal_0]`,

    // Segment 1
    `[0:v]trim=start=3.000:end=9.000,setpts=(PTS-STARTPTS)*(1/0.500)[vtrim_1]`,
    `[vtrim_1]eq=brightness=0.120:saturation=1.450,colorbalance=rm=0.180:gm=0.075:bm=-0.075,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2.250[vgrade_1]`,
    `[vgrade_1]scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[vconf_1]`,
    `[vconf_1]drawtext=text='DETAIL SEQUENCE':fontfile='${escapedFont}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.333),t/0.333,if(lt(t,11.667),1,(12.000-t)/0.333))':borderw=2:bordercolor=black[vfinal_1]`,
    `[0:a]atrim=start=3.000:end=9.000,asetpts=PTS-STARTPTS,atempo=0.500[afinal_1]`,

    // Segment 2
    `[0:v]trim=start=9.000:end=16.000,setpts=(PTS-STARTPTS)*(1/1.500)[vtrim_2]`,
    `[vtrim_2]eq=brightness=0.120:saturation=1.450,colorbalance=rm=0.180:gm=0.075:bm=-0.075,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2.250[vgrade_2]`,
    `[vgrade_2]scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[vconf_2]`,
    `[vconf_2]drawtext=text='ENERGY BUILD & RISE':fontfile='${escapedFont}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.333),t/0.333,if(lt(t,4.333),1,(4.667-t)/0.333))':borderw=2:bordercolor=black[vfinal_2]`,
    `[0:a]atrim=start=9.000:end=16.000,asetpts=PTS-STARTPTS,atempo=1.500[afinal_2]`,

    // Segment 3
    `[0:v]trim=start=16.000:end=25.000,setpts=(PTS-STARTPTS)*(1/0.500)[vtrim_3]`,
    `[vtrim_3]eq=brightness=0.120:saturation=1.450,colorbalance=rm=0.180:gm=0.075:bm=-0.075,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2.250[vgrade_3]`,
    `[vgrade_3]scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[vconf_3]`,
    `[vconf_3]drawtext=text='THEMATIC DROP CLIMAX':fontfile='${escapedFont}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.333),t/0.333,if(lt(t,17.667),1,(18.000-t)/0.333))':borderw=2:bordercolor=black[vfinal_3]`,
    `[0:a]atrim=start=16.000:end=25.000,asetpts=PTS-STARTPTS,atempo=0.500[afinal_3]`,

    // Segment 4
    `[0:v]trim=start=25.000:end=25.167,setpts=(PTS-STARTPTS)*(1/1.500)[vtrim_4]`,
    `[vtrim_4]eq=brightness=0.120:saturation=1.450,colorbalance=rm=0.180:gm=0.075:bm=-0.075,unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=2.250[vgrade_4]`,
    `[vgrade_4]scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2[vconf_4]`,
    `[vconf_4]drawtext=text='VISUAL CTA / SEAMLESS LOOP':fontfile='${escapedFont}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.111),t/0.111,1)':borderw=2:bordercolor=black[vfinal_4]`,
    `[0:a]atrim=start=25.000:end=25.167,asetpts=PTS-STARTPTS,atempo=1.500[afinal_4]`,

    // Concat & Soundtrack Mixing
    `[vfinal_0][afinal_0][vfinal_1][afinal_1][vfinal_2][afinal_2][vfinal_3][afinal_3][vfinal_4][afinal_4]concat=n=5:v=1:a=1[vout][a_primary_concat]`,
    `[1:a]volume='if(between(t,0,3)+between(t,3,15)+between(t,15,19.667)+between(t,19.667,37.667)+between(t,37.667,37.778),0.25,1.0)':eval=frame[ducked_music_raw]`,
    `[a_primary_concat]aresample=44100[a_primary_resampled]`,
    `[ducked_music_raw]aresample=44100[ducked_music_resampled]`,
    `[a_primary_resampled][ducked_music_resampled]amix=inputs=2:normalize=0[aout]`
  ];
  return parts.join('; ');
}

const tests = [
  {
    name: '5. QSV + Filter Order Optimization (Pre-scale filters + fast_bilinear, 60 FPS)',
    args: (out) => [
      '-y', '-i', inputVideo, '-i', soundtrack,
      '-filter_complex', getFilterComplexOptimized(),
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'h264_qsv',
      '-preset', 'veryfast',
      '-r', '60',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-t', '37.778',
      out
    ]
  },
  {
    name: '6. QSV + Filter Order Optimization + 30 FPS target (if matching original source)',
    args: (out) => [
      '-y', '-i', inputVideo, '-i', soundtrack,
      '-filter_complex', getFilterComplexOptimized(),
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'h264_qsv',
      '-preset', 'veryfast',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-t', '37.778',
      out
    ]
  },
  {
    name: '7. Software optimized (libx264, veryfast) + Filter Order Optimization + 30 FPS target',
    args: (out) => [
      '-y', '-i', inputVideo, '-i', soundtrack,
      '-filter_complex', getFilterComplexOptimized(),
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-t', '37.778',
      out
    ]
  }
];

async function runBenchmark() {
  console.log('Starting CineForge Optimized Render Engine Benchmark on Host...');
  console.log('Source Video:', inputVideo);
  console.log('Target duration of output:', 37.778, 'seconds');
  console.log('--------------------------------------------------\n');

  let failedTests = 0;
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const outPath = path.join(outputDir, `benchmark-opt-out-${i}.mp4`);
    
    if (fs.existsSync(outPath)) {
      fs.unlinkSync(outPath);
    }
    
    console.log(`Running Test ${test.name}...`);
    const startTime = Date.now();
    
    const args = test.args(outPath);
    const runResult = spawnSync('ffmpeg', args);
    
    if (runResult.status === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const sizeBytes = fs.statSync(outPath).size;
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      const speedMultiplier = (37.778 / elapsed).toFixed(2);
      console.log(`✅ Success! Time: ${elapsed.toFixed(2)}s | Speed: ${speedMultiplier}x real-time | Size: ${sizeMb} MB`);
    } else {
      console.error(`❌ Failed with exit code ${runResult.status}`);
      console.error(`Error logs:\n${runResult.stderr ? runResult.stderr.toString().slice(-1000) : 'None'}`);
      failedTests++;
    }
    console.log('--------------------------------------------------\n');
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBenchmark();
