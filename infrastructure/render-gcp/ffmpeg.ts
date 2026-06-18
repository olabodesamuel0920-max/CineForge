import { TimelineBlock, ColorGrade } from './types/blueprint';

/**
 * Builds a chain of atempo filters for audio speed ramping.
 * FFmpeg's atempo filter only supports values between 0.5 and 2.0.
 * For values outside this range, we must stack multiple atempo filters.
 */
export function buildAudioSpeedRampFilter(speed: number): string {
  const setptsFilter = 'asetpts=PTS-STARTPTS';
  // Clamp audio speed to [0.5, 2.0] to prevent pitch collapse or FFmpeg crashes.
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  
  if (clampedSpeed === 1.0) {
    return setptsFilter;
  }
  
  return `${setptsFilter},atempo=${clampedSpeed.toFixed(3)}`;
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
  hookIntensity?: number,
  previewStart?: number,
  previewDuration?: number
): FilterComplexResult {
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  // Parse and clamp hook intensity (defaulting to 1.0 if not specified)
  const intensity = hookIntensity !== undefined ? Math.max(0.0, Math.min(2.0, hookIntensity)) : 1.0;

  let conformedTimeline = timeline;

  if (previewStart !== undefined && previewDuration !== undefined) {
    const previewEnd = previewStart + previewDuration;
    
    // Filter and map timeline blocks to only those within the preview window
    conformedTimeline = timeline
      .filter((block) => {
        return block.start < previewEnd && block.end > previewStart;
      })
      .map((block) => {
        // Adjust start and end relative to previewStart
        const start = Math.max(0, block.start - previewStart);
        const end = Math.min(previewDuration, block.end - previewStart);
        return {
          ...block,
          start,
          end
        };
      });

    // If no blocks overlapped, compile a default fallback block matching the preview duration
    if (conformedTimeline.length === 0) {
      conformedTimeline = [
        {
          start: 0,
          end: previewDuration,
          speed: 1.0,
          text: 'CineForge Preview'
        }
      ];
    }
  }

  // 1. Calculate total duration and build subtitle active interval checks for audio ducking
  let totalDuration = 0;
  let currentOutputTime = 0.0;
  const duckingIntervals: string[] = [];

  conformedTimeline.forEach((block) => {
    const segmentDuration = (block.end - block.start) / block.speed;
    totalDuration += segmentDuration;

    if (block.text && block.text.trim()) {
      duckingIntervals.push(`between(t,${currentOutputTime.toFixed(3)},${(currentOutputTime + segmentDuration).toFixed(3)})`);
    }
    currentOutputTime += segmentDuration;
  });

  const conditionStr = duckingIntervals.length > 0 ? duckingIntervals.join('+') : '';

  // 2. Process each segment's video and audio tracks
  conformedTimeline.forEach((block, index) => {
    const vTrimLabel = `vtrim_${index}`;
    const vConformedLabel = `vconf_${index}`;
    const vGradeLabel = `vgrade_${index}`;
    const vFinalLabel = `vfinal_${index}`;
    const aFinalLabel = `afinal_${index}`;

    const segmentDuration = (block.end - block.start) / block.speed;
    const trimStart = block.sourceStart !== undefined ? block.sourceStart : block.start;
    const trimEnd = block.sourceEnd !== undefined ? block.sourceEnd : block.end;

    // Slice and Speed Ramp video
    const videoSetpts = `(PTS-STARTPTS)*(1/${block.speed.toFixed(3)})`;
    filterParts.push(`[0:v]trim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)},setpts=${videoSetpts}[${vTrimLabel}]`);

    // 1. Apply Style-Specific Color Grade Filters (Pre-Scale on lower resolution)
    const preScaleFilters: string[] = [];
    if (selectedMode === 'luxury-demon-reveal') {
      // Teal shadows and warm highlights split-tone dark aesthetic grade
      preScaleFilters.push(`eq=contrast=1.35:brightness=-0.07:saturation=1.25`);
      preScaleFilters.push(`colorbalance=rm=0.08:gm=-0.04:bm=0.12:rh=0.05:gh=-0.02:bh=-0.08`);
    } else if (selectedMode === 'stadium-god-mode') {
      preScaleFilters.push(`colorbalance=bm=0.2:rm=-0.1`);
      preScaleFilters.push(`eq=contrast=1.30:brightness=-0.05:saturation=1.2`);
    } else if (selectedMode === 'sugar-storm-3d' || selectedMode === 'fashion-drop-impact') {
      preScaleFilters.push(`eq=brightness=${(0.08 * intensity).toFixed(3)}:saturation=${(1.0 + 0.3 * intensity).toFixed(3)}`);
      preScaleFilters.push(`colorbalance=rm=${(0.12 * intensity).toFixed(3)}:gm=${(0.05 * intensity).toFixed(3)}:bm=-${(0.05 * intensity).toFixed(3)}`);
      preScaleFilters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${(1.5 * intensity).toFixed(3)}`);
    } else {
      const defaultColorFilter = buildColorGradeFilter(colorGrade);
      if (defaultColorFilter) {
        preScaleFilters.push(defaultColorFilter);
      }
    }

    if (preScaleFilters.length > 0) {
      filterParts.push(`[${vTrimLabel}]${preScaleFilters.join(',')}[${vGradeLabel}]`);
    } else {
      filterParts.push(`[${vTrimLabel}]null[${vGradeLabel}]`);
    }

    // 2. Apply Style-Specific Crop Zoom matrices or Passthrough Conformer (with fast bilinear scale flags)
    if (selectedMode === 'luxury-demon-reveal') {
      // Luxury Reveal crop pan: slow cinematic drift over time with tight cropping clamped to bounds
      filterParts.push(`[${vGradeLabel}]crop=w=iw-120:h=ih-213:x='(iw-ow)/2':y='clip((ih-oh)/2 - (t*12*${intensity.toFixed(3)}),0,max(0,ih-oh))',scale=1080:1920:flags=fast_bilinear,setsar=1[${vConformedLabel}]`);
    } else if (selectedMode === 'stadium-god-mode') {
      // Stadium God Mode horizontal shifting pan crop
      filterParts.push(`[${vGradeLabel}]crop=w=iw-100:h=ih:x='(iw-ow)/2 + sin(t*2)*50',scale=1080:1920:flags=fast_bilinear,setsar=1[${vConformedLabel}]`);
    } else {
      // Fallback center-crop to 9:16 portrait
      const conformer = `scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1`;
      filterParts.push(`[${vGradeLabel}]${conformer}[${vConformedLabel}]`);
    }

    // 3. Apply Style-Specific Post-Scale Filters (e.g. Vignette which requires final 9:16 borders)
    const postScaleFilters: string[] = [];
    if (selectedMode === 'luxury-demon-reveal') {
      // PI/(3 + intensity) is perfect to avoid over-darkening mobile portrait edges while maintaining style
      postScaleFilters.push(`vignette=angle='PI/(3 + ${intensity.toFixed(3)})'`);
    }

    const vPostLabel = `vpost_${index}`;
    if (postScaleFilters.length > 0) {
      filterParts.push(`[${vConformedLabel}]${postScaleFilters.join(',')}[${vPostLabel}]`);
    } else {
      filterParts.push(`[${vConformedLabel}]null[${vPostLabel}]`);
    }

    // 4. Text Overlay Layer
    if (block.text && block.text.trim()) {
      const textFilter = buildTextOverlayFilter(block.text, fontPath, segmentDuration, block.vfx, intensity);
      filterParts.push(`[${vPostLabel}]${textFilter}[${vFinalLabel}]`);
    } else {
      filterParts.push(`[${vPostLabel}]null[${vFinalLabel}]`);
    }

    // Process Segment Audio (with silent fallback if source has no audio track)
    if (inputHasAudio) {
      const audioSpeedFilter = buildAudioSpeedRampFilter(block.speed);
      filterParts.push(`[0:a]atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)},${audioSpeedFilter}[${aFinalLabel}]`);
    } else {
      filterParts.push(`anullsrc=r=44100:cl=stereo,atrim=end=${segmentDuration.toFixed(3)},asetpts=PTS-STARTPTS[${aFinalLabel}]`);
    }

    concatInputs.push(`[${vFinalLabel}][${aFinalLabel}]`);
  });

  // Concat video segments and primary audio tracks
  const videoMap = 'vout';
  const audioMap = 'aout';
  const aConcatLabel = 'a_primary_concat';
  filterParts.push(`${concatInputs.join('')}concat=n=${conformedTimeline.length}:v=1:a=1[${videoMap}][${aConcatLabel}]`);

  // 3. Audio Ducking Mix Framework
  // Extract condition and apply timeline-aware volume attenuation to soundtrack input stream [1:a]
  const bgVolumeExpr = `if(${conditionStr || '0'},0.25,1.0)`;
  filterParts.push(`[1:a]volume='${bgVolumeExpr}':eval=frame[ducked_music_raw]`);

  // Force both audio channels through explicit sample rate conversion to 44100Hz preceding the mix graph
  filterParts.push(`[${aConcatLabel}]aresample=44100[a_primary_resampled]`);
  filterParts.push(`[ducked_music_raw]aresample=44100[ducked_music_resampled]`);

  // Combine conformed primary audio and resampled, ducked soundtrack
  filterParts.push(`[a_primary_resampled][ducked_music_resampled]amix=inputs=2:normalize=0[${audioMap}]`);

  return {
    filterComplex: filterParts.join('; '),
    videoMap,
    audioMap,
    hasAudio: true
  };
}
