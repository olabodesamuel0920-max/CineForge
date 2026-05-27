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
 */
export function buildTextOverlayFilter(
  text: string,
  fontPath: string,
  segmentDuration: number,
  vfx?: string[]
): string {
  // Escape special characters for FFmpeg drawtext: backslashes, single quotes, and colons
  const escapedText = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:');

  const fadeTime = Math.min(0.5, segmentDuration / 2);
  const alphaExpr = `if(lt(t,${fadeTime}),t/${fadeTime},if(lt(t,${(segmentDuration - fadeTime).toFixed(3)}),1,(${segmentDuration.toFixed(3)}-t)/${fadeTime}))`;

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
 */
export function buildFilterComplex(
  timeline: TimelineBlock[],
  colorGrade: ColorGrade | undefined,
  fontPath: string,
  inputHasAudio: boolean
): FilterComplexResult {
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  timeline.forEach((block, index) => {
    const vTrimLabel = `vtrim_${index}`;
    const vScaleLabel = `vscale_${index}`;
    const vGradeLabel = `vgrade_${index}`;
    const vFinalLabel = `vfinal_${index}`;
    const aFinalLabel = `afinal_${index}`;

    // --- 1. Video Processing ---
    // Slice and Speed Ramp
    const videoSetpts = `(PTS-STARTPTS)*(1/${block.speed.toFixed(3)})`;
    filterParts.push(`[0:v]trim=start=${block.start.toFixed(3)}:end=${block.end.toFixed(3)},setpts=${videoSetpts}[${vTrimLabel}]`);

    // Scale and Crop to 1080x1920 (Vertical Portrait)
    const conformer = `scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)',crop=1080:1920:(iw-1080)/2:(ih-1920)/2`;
    filterParts.push(`[${vTrimLabel}]${conformer}[${vScaleLabel}]`);

    // Global Color Grade
    const colorFilter = buildColorGradeFilter(colorGrade);
    if (colorFilter) {
      filterParts.push(`[${vScaleLabel}]${colorFilter}[${vGradeLabel}]`);
    } else {
      // Pass-through
      filterParts.push(`[${vScaleLabel}]null[${vGradeLabel}]`);
    }

    // Text & VFX Overlay
    const segmentDuration = (block.end - block.start) / block.speed;
    if (block.text && block.text.trim()) {
      const textFilter = buildTextOverlayFilter(block.text, fontPath, segmentDuration, block.vfx);
      filterParts.push(`[${vGradeLabel}]${textFilter}[${vFinalLabel}]`);
    } else {
      // Pass-through
      filterParts.push(`[${vGradeLabel}]null[${vFinalLabel}]`);
    }

    // --- 2. Audio Processing (with silent fallback if input has no audio) ---
    if (inputHasAudio) {
      const audioSpeedFilter = buildAudioSpeedRampFilter(block.speed);
      filterParts.push(`[0:a]atrim=start=${block.start.toFixed(3)}:end=${block.end.toFixed(3)},${audioSpeedFilter}[${aFinalLabel}]`);
    } else {
      // Null audio fallback: generate silent stream of exact segment duration
      filterParts.push(`anullsrc=r=44100:cl=stereo,atrim=end=${segmentDuration.toFixed(3)},asetpts=PTS-STARTPTS[${aFinalLabel}]`);
    }
    
    concatInputs.push(`[${vFinalLabel}][${aFinalLabel}]`);
  });

  // --- 3. Concatenation ---
  const videoMap = 'vout';
  const audioMap = 'aout';

  // We always produce stereo audio output (either source-derived or generated silence)
  filterParts.push(`${concatInputs.join('')}concat=n=${timeline.length}:v=1:a=1[${videoMap}][${audioMap}]`);

  return {
    filterComplex: filterParts.join('; '),
    videoMap,
    audioMap,
    hasAudio: true
  };
}
