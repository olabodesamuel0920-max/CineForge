"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAudioSpeedRampFilter = buildAudioSpeedRampFilter;
exports.buildColorGradeFilter = buildColorGradeFilter;
exports.buildTextOverlayFilter = buildTextOverlayFilter;
exports.buildFilterComplex = buildFilterComplex;
/**
 * Builds a chain of atempo filters for audio speed ramping.
 * FFmpeg's atempo filter only supports values between 0.5 and 2.0.
 * For values outside this range, we must stack multiple atempo filters.
 */
function buildAudioSpeedRampFilter(speed) {
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
function buildColorGradeFilter(grade) {
    if (!grade)
        return '';
    const filters = [];
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
function buildTextOverlayFilter(text, fontPath, segmentDuration, vfx, intensity = 1.0) {
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
    }
    else {
        // Standard black outline fallback for high-readability contrast
        drawtextOptions += ':borderw=2:bordercolor=black';
    }
    return drawtextOptions;
}
/**
 * Compiles the entire timeline blueprint into an FFmpeg -filter_complex argument.
 * Implements style-specific video crop zooms and dynamic subtitle audio ducking.
 */
function buildFilterComplex(timeline, colorGrade, fontPath, inputHasAudio, selectedMode, viewerEmotion, hookIntensity, previewStart, previewDuration, soundEvents, soundSettings, assetIdToInputIndex) {
    const filterParts = [];
    const concatInputs = [];
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
    const duckingIntervals = [];
    conformedTimeline.forEach((block) => {
        const segmentDuration = (block.end - block.start) / block.speed;
        totalDuration += segmentDuration;
        if (block.text && block.text.trim()) {
            duckingIntervals.push(`between(t,${currentOutputTime.toFixed(3)},${(currentOutputTime + segmentDuration).toFixed(3)})`);
        }
        currentOutputTime += segmentDuration;
    });
    const conditionStr = duckingIntervals.length > 0 ? duckingIntervals.join('+') : '';
    // Dialogue Protection logic
    const isSoundDesignActive = soundSettings ? soundSettings.enabled : true;
    const preserveOriginal = soundSettings ? soundSettings.preserveOriginal : 'auto';
    // Decide if we should keep raw video audio track at all
    const shouldKeepRawAudio = inputHasAudio && (isSoundDesignActive ? preserveOriginal !== 'no' : true);
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
        const preScaleFilters = [];
        if (selectedMode === 'luxury-demon-reveal') {
            // Teal shadows and warm highlights split-tone dark aesthetic grade
            preScaleFilters.push(`eq=contrast=1.35:brightness=-0.07:saturation=1.25`);
            preScaleFilters.push(`colorbalance=rm=0.08:gm=-0.04:bm=0.12:rh=0.05:gh=-0.02:bh=-0.08`);
        }
        else if (selectedMode === 'stadium-god-mode') {
            preScaleFilters.push(`colorbalance=bm=0.2:rm=-0.1`);
            preScaleFilters.push(`eq=contrast=1.30:brightness=-0.05:saturation=1.2`);
        }
        else if (selectedMode === 'sugar-storm-3d' || selectedMode === 'fashion-drop-impact') {
            preScaleFilters.push(`eq=brightness=${(0.08 * intensity).toFixed(3)}:saturation=${(1.0 + 0.3 * intensity).toFixed(3)}`);
            preScaleFilters.push(`colorbalance=rm=${(0.12 * intensity).toFixed(3)}:gm=${(0.05 * intensity).toFixed(3)}:bm=-${(0.05 * intensity).toFixed(3)}`);
            preScaleFilters.push(`unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${(1.5 * intensity).toFixed(3)}`);
        }
        else {
            const defaultColorFilter = buildColorGradeFilter(colorGrade);
            if (defaultColorFilter) {
                preScaleFilters.push(defaultColorFilter);
            }
        }
        if (preScaleFilters.length > 0) {
            filterParts.push(`[${vTrimLabel}]${preScaleFilters.join(',')}[${vGradeLabel}]`);
        }
        else {
            filterParts.push(`[${vTrimLabel}]null[${vGradeLabel}]`);
        }
        // 2. Apply Style-Specific Crop Zoom matrices or Passthrough Conformer (with fast bilinear scale flags)
        if (selectedMode === 'luxury-demon-reveal') {
            // Luxury Reveal crop pan: slow cinematic drift over time with tight cropping clamped to bounds
            filterParts.push(`[${vGradeLabel}]crop=w=iw-120:h=ih-213:x='(iw-ow)/2':y='clip((ih-oh)/2 - (t*12*${intensity.toFixed(3)}),0,max(0,ih-oh))',scale=1080:1920:flags=fast_bilinear,setsar=1[${vConformedLabel}]`);
        }
        else if (selectedMode === 'stadium-god-mode') {
            // Stadium God Mode horizontal shifting pan crop
            filterParts.push(`[${vGradeLabel}]crop=w=iw-100:h=ih:x='(iw-ow)/2 + sin(t*2)*50',scale=1080:1920:flags=fast_bilinear,setsar=1[${vConformedLabel}]`);
        }
        else {
            // Fallback center-crop to 9:16 portrait
            const conformer = `scale=w='if(gte(iw/ih,1080/1920),-1,1080)':h='if(gte(iw/ih,1080/1920),1920,-1)':flags=fast_bilinear,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,setsar=1`;
            filterParts.push(`[${vGradeLabel}]${conformer}[${vConformedLabel}]`);
        }
        // 3. Apply Style-Specific Post-Scale Filters (e.g. Vignette which requires final 9:16 borders)
        const postScaleFilters = [];
        if (selectedMode === 'luxury-demon-reveal') {
            postScaleFilters.push(`vignette=angle='PI/(3 + ${intensity.toFixed(3)})'`);
        }
        const vPostLabel = `vpost_${index}`;
        if (postScaleFilters.length > 0) {
            filterParts.push(`[${vConformedLabel}]${postScaleFilters.join(',')}[${vPostLabel}]`);
        }
        else {
            filterParts.push(`[${vConformedLabel}]null[${vPostLabel}]`);
        }
        // 4. Text Overlay Layer
        if (block.text && block.text.trim()) {
            const textFilter = buildTextOverlayFilter(block.text, fontPath, segmentDuration, block.vfx, intensity);
            filterParts.push(`[${vPostLabel}]${textFilter}[${vFinalLabel}]`);
        }
        else {
            filterParts.push(`[${vPostLabel}]null[${vFinalLabel}]`);
        }
        // Process Segment Audio (with silent fallback if source has no audio track or muted)
        if (shouldKeepRawAudio) {
            const audioSpeedFilter = buildAudioSpeedRampFilter(block.speed);
            filterParts.push(`[0:a]atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)},${audioSpeedFilter}[${aFinalLabel}]`);
        }
        else {
            filterParts.push(`anullsrc=r=44100:cl=stereo,atrim=end=${segmentDuration.toFixed(3)},asetpts=PTS-STARTPTS[${aFinalLabel}]`);
        }
        concatInputs.push(`[${vFinalLabel}][${aFinalLabel}]`);
    });
    // Concat video segments and primary audio tracks
    const videoMap = 'vout';
    const audioMap = 'aout';
    const aConcatLabel = 'a_primary_concat';
    filterParts.push(`${concatInputs.join('')}concat=n=${conformedTimeline.length}:v=1:a=1[${videoMap}][${aConcatLabel}]`);
    // Dialogue Protection volume adjustments for primary audio track
    let rawAudioVolume = 1.0;
    if (isSoundDesignActive) {
        if (preserveOriginal === 'no') {
            rawAudioVolume = 0.0;
        }
        else if (preserveOriginal === 'auto') {
            const mode = (selectedMode || '').toLowerCase();
            const isVisualNiche = mode.includes('luxury') || mode.includes('stadium') || mode.includes('sugar') || mode.includes('fashion') || mode.includes('street') || mode.includes('crave');
            rawAudioVolume = isVisualNiche ? 0.15 : 1.0; // Reduce in visuals, keep in dialogue niches
        }
    }
    // Determine active events to process (seeking and trimming if in preview mode)
    let activeEvents = soundEvents || [];
    let timelineDuration = totalDuration;
    if (previewStart !== undefined && previewDuration !== undefined) {
        const previewEnd = previewStart + previewDuration;
        activeEvents = (soundEvents || []).filter(e => {
            return e.startTime < previewEnd && (e.startTime + e.duration) > previewStart;
        }).map(e => {
            const start = Math.max(0, e.startTime - previewStart);
            const end = Math.min(e.duration, e.startTime + e.duration - previewStart);
            return {
                ...e,
                startTime: start,
                duration: end
            };
        });
        timelineDuration = previewDuration;
    }
    // 3. Audio Mixing Pipeline
    if (!isSoundDesignActive || activeEvents.length === 0 || !assetIdToInputIndex) {
        // Legacy Basic Ducking Mix
        const bgVolumeExpr = `if(${conditionStr || '0'},0.25,1.0)`;
        filterParts.push(`[1:a]volume='${bgVolumeExpr}':eval=frame[ducked_music_raw]`);
        filterParts.push(`[${aConcatLabel}]aresample=44100,volume=${rawAudioVolume}[a_primary_adjusted]`);
        filterParts.push(`[ducked_music_raw]aresample=44100[ducked_music_resampled]`);
        filterParts.push(`[a_primary_adjusted][ducked_music_resampled]amix=inputs=2:normalize=0,atrim=end=${timelineDuration.toFixed(3)},loudnorm=I=-14:TP=-1.0[${audioMap}]`);
    }
    else {
        // Advanced Multi-Track Cinematic Sound Mix Graph
        // Conformed primary raw audio channel
        filterParts.push(`[${aConcatLabel}]aresample=44100,volume=${rawAudioVolume}[a_primary_adjusted]`);
        // Compile sidechain music ducking intervals
        const musicDuckingIntervals = [...duckingIntervals];
        activeEvents.forEach(e => {
            if (e.type !== 'music bed' && e.duckingAmount !== undefined && e.duckingAmount > 0) {
                musicDuckingIntervals.push(`between(t,${e.startTime.toFixed(3)},${(e.startTime + e.duration).toFixed(3)})`);
            }
        });
        const duckCondition = musicDuckingIntervals.length > 0 ? musicDuckingIntervals.join('+') : '';
        const musicDuckingExpr = duckCondition ? `if(${duckCondition},0.25,1.0)` : '1.0';
        const mixInputs = ['[a_primary_adjusted]'];
        activeEvents.forEach((e, idx) => {
            const inputIdx = assetIdToInputIndex[e.assetId];
            if (inputIdx === undefined) {
                console.warn(`[FFmpeg compiler] Skipping event ${idx} because assetId ${e.assetId} has no resolved input.`);
                return; // Skip missing assets gracefully
            }
            const outLabel = `se_${idx}`;
            mixInputs.push(`[${outLabel}]`);
            // Determine fades
            let fadeFilter = '';
            if (e.fadeIn && e.fadeIn > 0) {
                fadeFilter += `,afade=t=in:ss=0:d=${e.fadeIn.toFixed(3)}`;
            }
            if (e.fadeOut && e.fadeOut > 0) {
                const fadeStart = e.duration - e.fadeOut;
                fadeFilter += `,afade=t=out:st=${fadeStart.toFixed(3)}:d=${e.fadeOut.toFixed(3)}`;
            }
            // Determine pitch shift semitone filters
            let pitchFilter = '';
            if (e.pitch !== undefined && e.pitch !== 0) {
                const ratio = Math.pow(2, e.pitch / 12);
                const rate = Math.round(44100 * ratio);
                pitchFilter = `,asetrate=${rate},atempo=${(1 / ratio).toFixed(3)},aresample=44100`;
            }
            // Determine stereo panning filter
            let panFilter = '';
            if (e.pan !== undefined) {
                const p = Math.max(-1.0, Math.min(1.0, e.pan));
                const leftGain = ((1 - p) / 2).toFixed(3);
                const rightGain = ((1 + p) / 2).toFixed(3);
                panFilter = `,pan=stereo|c0=${leftGain}*c0|c1=${rightGain}*c1`;
            }
            // Delay offset timing filter
            const delayMs = Math.round(e.startTime * 1000);
            const delayFilter = delayMs > 0 ? `,adelay=${delayMs}|${delayMs}` : '';
            if (e.type === 'music bed') {
                // Music bed stream is looped and ducked dynamically
                filterParts.push(`[${inputIdx}:a]atrim=end=${timelineDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume='${musicDuckingExpr}':eval=frame,volume=${e.volume.toFixed(3)}${fadeFilter}${pitchFilter}${panFilter}${delayFilter},aresample=44100[${outLabel}]`);
            }
            else {
                // SFX sound event is trimmed, faded, panned, pitched and delayed
                filterParts.push(`[${inputIdx}:a]atrim=end=${e.duration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${e.volume.toFixed(3)}${fadeFilter}${pitchFilter}${panFilter}${delayFilter},aresample=44100[${outLabel}]`);
            }
        });
        // Mix conformed tracks & sound events, conform final length, and master normalize/limit
        filterParts.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:normalize=0,atrim=end=${timelineDuration.toFixed(3)},loudnorm=I=-14:TP=-1.0[${audioMap}]`);
    }
    return {
        filterComplex: filterParts.join('; '),
        videoMap,
        audioMap,
        hasAudio: true
    };
}
