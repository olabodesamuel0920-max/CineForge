import { TimelineBlock, ColorGrade } from './types/blueprint';

/**
 * Builds a chain of atempo filters for audio speed ramping.
 * FFmpeg's atempo filter only supports values between 0.5 and 2.0.
 * For values outside this range, we must stack multiple atempo filters.
 */
export function buildAudioSpeedRampFilter(speed: number): string {
  const setptsFilter = 'asetpts=PTS-STARTPTS';
  if (speed === 1.0) {
    return setptsFilter;
  }

  const filters: string[] = [setptsFilter];
  let remaining = speed;

  if (speed > 2.0) {
    while (remaining > 2.0) {
      filters.push('atempo=2.0');
      remaining /= 2.0;
    }
  } else if (speed < 0.5) {
    while (remaining < 0.5) {
      filters.push('atempo=0.5');
      remaining /= 0.5;
    }
  }

  filters.push(`atempo=${remaining.toFixed(3)}`);
  return filters.join(',');
}

/**
 * Builds color grading filter chain using eq and colorbalance.
 * Clamps input values to safe ranges to prevent FFmpeg failures or corrupt renders.
 */
export function buildColorGradeFilter(grade?: ColorGrade): string {
  if (!grade) return '';

  const filters: string[] = [];
  const rawContrast = grade.contrast !== undefined ? grade.contrast : 1.0;
  const rawSaturation = grade.saturation !== undefined ? grade.saturation : 1.0;

  // Clamp contrast to [0.0, 2.0] and saturation to [0.0, 3.0]
  const contrast = Math.max(0.0, Math.min(2.0, rawContrast));
  const saturation = Math.max(0.0, Math.min(3.0, rawSaturation));

  // eq filter for contrast and saturation
  filters.push(`eq=contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);

  // colorbalance filter for warmth (clamped between 0.5 and 2.0)
  if (grade.warmth !== undefined && grade.warmth !== 1.0) {
    const warmth = Math.max(0.5, Math.min(2.0, grade.warmth));
    const redShift = (warmth - 1.0) * 0.15;
    const blueShift = (1.0 - warmth) * 0.15;
    filters.push(`colorbalance=rm=${redShift.toFixed(3)}:bm=${blueShift.toFixed(3)}`);
  }

  return filters.join(',');
}

/**
 * Builds the drawtext filter with linear fade-in and fade-out alpha expressions.
 * The fade velocity (speed of fading in/out) scales linearly with intensity.
 */
export function buildTextOverlayFilter(
  text: string,
  fontPath: string,
  segmentDuration: number,
  vfx?: string[],
  intensity: number = 1.0
): string {
  // Escape special characters for FFmpeg drawtext: backslashes, single quotes, and colons
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:');

  // Higher intensity reduces fadeTime, causing a faster fade velocity
  const baseFade = 0.5;
  const fadeTime = Math.min(baseFade / Math.max(0.1, intensity), segmentDuration / 2);
  const alphaExpr = `if(lt(t,${fadeTime.toFixed(3)}),t/${fadeTime.toFixed(3)},if(lt(t,${(segmentDuration - fadeTime).toFixed(3)}),1,(${segmentDuration.toFixed(3)}-t)/${fadeTime.toFixed(3)}))`;

  // Escape absolute font paths for Windows drive colons (e.g. C: -> C\:)
  const escapedFontPath = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  let drawtextOptions = `drawtext=text='${escapedText}':fontfile='${escapedFontPath}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='${alphaExpr}'`;

  // Check if glow_text VFX is requested (adds cyan border glow style)
  if (vfx && vfx.includes('glow_text')) {
    drawtextOptions += ':borderw=4:bordercolor=0x00F3FF@0.6';
  } else {
    // Standard black outline fallback for high-readability contrast
    drawtextOptions += ':borderw=2:bordercolor=black';
  }

  return drawtextOptions;
}

export interface FilterComplexResult {
  filterComplex: string;
  videoMap: string;
  audioMap: string;
  hasAudio: boolean;
}

/**
 * Compiles the entire timeline blueprint into an FFmpeg -filter_complex argument.
 * Implements style-specific video crop zooms and dynamic subtitle audio ducking.
 */
export function buildFilterComplex(
  timeline: TimelineBlock[],
  colorGrade: ColorGrade | undefined,
  fontPath: string,
  inputHasAudio: boolean,
  selectedMode?: string,
  viewerEmotion?: string,
  hookIntensity?: number
): FilterComplexResult {
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  // Parse and clamp hook intensity (defaulting to 1.0 if not specified)
  const intensity = hookIntensity !== undefined ? Math.max(0.0, Math.min(2.0, hookIntensity)) : 1.0;

  // 1. Calculate total duration and build subtitle active interval checks for audio ducking
  let totalDuration = 0;
  let currentOutputTime = 0.0;
  const duckingIntervals: string[] = [];

  timeline.forEach((block) => {
    const segmentDuration = (block.end - block.start) / block.speed;
    totalDuration += segmentDuration;

    if (block.text && block.text.trim()) {
      duckingIntervals.push(`between(t,${currentOutputTime.toFixed(3)},${(currentOutputTime + segmentDuration).toFixed(3)})`);
    }
    currentOutputTime += segmentDuration;
  });

  const conditionStr = duckingIntervals.length > 0 ? duckingIntervals.join('+') : '';

  // 2. Process each segment's video and audio tracks
  timeline.forEach((block, index) => {
    const vTrimLabel = `vtrim_${index}`;
    const vConformedLabel = `vconf_${index}`;
    const vGradeLabel = `vgrade_${index}`;
    const vFinalLabel = `vfinal_${index}`;
    const aFinalLabel = `afinal_${index}`;

    const segmentDuration = (block.end - block.start) / block.speed;

    // Slice and Speed Ramp video
    const videoSetpts = `(PTS-STARTPTS)*(1/${block.speed.toFixed(3)})`;
    filterParts.push(`[0:v]trim=start=${block.start.toFixed(3)}:end=${block.end.toFixed(3)},setpts=${videoSetpts}[${vTrimLabel}]`);

    // Apply Style-Specific Crop Zoom matrices or Passthrough Conformer
    if (selectedMode === 'luxury-demon-reveal') {
      // Luxury Demon Reveal crop zoom: scales down width/height over time based on intensity
      filterParts.push(`[${vTrimLabel}]crop=w='iw-(t*40*${intensity.toFixed(3)})':h='ih-(t*71*${intensity.toFixed(3)})',scale=1080:1920[${vConformedLabel}]`);
    } else if (selectedMode === 'stadium-god-mode') {
      // Stadium God Mode horizontal pan crop: horizontal shifting using a sine wave
      filterParts.push(`[${vTrimLabel}]crop=w=iw-100:h=ih:x='(iw-ow)/2 + sin(t*2)*50',scale=1080:1920[${vConformedLabel}]`);
    } else {
      // Fallback center-crop to 9:16 portrait
      const conformer = `scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)',crop=1080:1920:(iw-1080)/2:(ih-1920)/2`;
      filterParts.push(`[${vTrimLabel}]${conformer}[${vConformedLabel}]`);
    }

    // Apply Style-Specific Color Grade Filters
    const gradeFilters: string[] = [];
    if (selectedMode === 'luxury-demon-reveal') {
      gradeFilters.push(`vignette=b='0.3*${intensity.toFixed(3)}'`);
      gradeFilters.push(`eq=contrast=0.95:brightness=-0.05`);
      gradeFilters.push(`colorbalance=rm=0.15:gm=-0.05:bm=-0.05`);
    } else if (selectedMode === 'stadium-god-mode') {
      gradeFilters.push(`colorbalance=bm=0.2:rm=-0.1`);
      gradeFilters.push(`eq=contrast=1.15:saturation=1.3`);
    } else if (selectedMode === 'sugar-storm-3d' || selectedMode === 'fashion-drop-impact') {
      gradeFilters.push(`eq=brightness=${(0.08 * intensity).toFixed(3)}:saturation=${(1.0 + 0.3 * intensity).toFixed(3)}`);
      gradeFilters.push(`colorbalance=rm=${(0.12 * intensity).toFixed(3)}:gm=${(0.05 * intensity).toFixed(3)}:bm=-${(0.05 * intensity).toFixed(3)}`);
      gradeFilters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${(1.5 * intensity).toFixed(3)}`);
    } else {
      // Standard color grade fallback
      const defaultColorFilter = buildColorGradeFilter(colorGrade);
      if (defaultColorFilter) {
        gradeFilters.push(defaultColorFilter);
      }
    }

    if (gradeFilters.length > 0) {
      filterParts.push(`[${vConformedLabel}]${gradeFilters.join(',')}[${vGradeLabel}]`);
    } else {
      filterParts.push(`[${vConformedLabel}]null[${vGradeLabel}]`);
    }

    // Text Overlay Layer
    if (block.text && block.text.trim()) {
      const textFilter = buildTextOverlayFilter(block.text, fontPath, segmentDuration, block.vfx, intensity);
      filterParts.push(`[${vGradeLabel}]${textFilter}[${vFinalLabel}]`);
    } else {
      filterParts.push(`[${vGradeLabel}]null[${vFinalLabel}]`);
    }

    // Process Segment Audio (with silent fallback if source has no audio track)
    if (inputHasAudio) {
      const audioSpeedFilter = buildAudioSpeedRampFilter(block.speed);
      filterParts.push(`[0:a]atrim=start=${block.start.toFixed(3)}:end=${block.end.toFixed(3)},${audioSpeedFilter}[${aFinalLabel}]`);
    } else {
      filterParts.push(`anullsrc=r=44100:cl=stereo,atrim=end=${segmentDuration.toFixed(3)},asetpts=PTS-STARTPTS[${aFinalLabel}]`);
    }

    concatInputs.push(`[${vFinalLabel}][${aFinalLabel}]`);
  });

  // Concat video segments and primary audio tracks
  const videoMap = 'vout';
  const audioMap = 'aout';
  const aConcatLabel = 'a_primary_concat';
  filterParts.push(`${concatInputs.join('')}concat=n=${timeline.length}:v=1:a=1[${videoMap}][${aConcatLabel}]`);

  // 3. Audio Ducking Mix Framework
  const bgVolumeExpr = `if(${conditionStr || '0'},0.25,1.0)`;
  filterParts.push(`sine=frequency=220:sample_rate=44100:duration=${totalDuration.toFixed(3)}[bg_raw]`);
  filterParts.push(`[bg_raw]volume='${bgVolumeExpr}':eval=frame[bg_ducked]`);
  filterParts.push(`[${aConcatLabel}][bg_ducked]amix=inputs=2:normalize=0[${audioMap}]`);

  return {
    filterComplex: filterParts.join('; '),
    videoMap,
    audioMap,
    hasAudio: true
  };
}
