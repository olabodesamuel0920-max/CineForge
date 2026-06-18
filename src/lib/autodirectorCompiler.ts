import { EditDNABlueprint, TimelineBlock, ProjectDuration, ProjectPlatform } from '@/types/project';
import { AutoDirectorAnalysis, AutoDirectorShot } from '@/types/autodirector';
import { STYLE_PRESETS, getPresetById } from './presetsRegistry';
import { compileSoundDesignPlan, SoundDesignSettings } from './soundDesignCompiler';

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export function compileAutoDirectorAnalysis(
  projectId: string,
  analysis: AutoDirectorAnalysis,
  recommendedPresetId: string,
  platform: ProjectPlatform,
  desiredDuration: ProjectDuration,
  maxQualityMode: boolean
): EditDNABlueprint {
  // 1. Retrieve the preset configuration
  const preset = getPresetById(recommendedPresetId) || STYLE_PRESETS[0];
  const niche = analysis.detectedNiche || preset.niche || 'general';

  // 2. Clamp duration to the actual usable video duration if the video is shorter
  const parsedDesiredSec = parseInt(desiredDuration) || 15;
  const usableSec = analysis.usableDuration || parsedDesiredSec;
  const targetDuration = Math.min(parsedDesiredSec, usableSec);

  // 3. Determine the number of blocks to generate based on target duration
  let numBlocks = 4;
  let splitRatios: number[] = []; // Cumulative ratios of targetDuration
  
  if (targetDuration <= 5) {
    numBlocks = 2;
    splitRatios = [0.3, 1.0]; // Hook gets 30%, Climax gets 70%
  } else if (targetDuration <= 10) {
    numBlocks = 3;
    splitRatios = [0.2, 0.7, 1.0]; // Hook: 20%, Detail: 50%, Climax: 30%
  } else if (targetDuration <= 15) {
    numBlocks = 4;
    splitRatios = [0.2, 0.5, 0.8, 1.0]; // Hook: 20%, Detail: 30%, Climax: 30%, Outro: 20%
  } else {
    numBlocks = 5;
    splitRatios = [0.15, 0.4, 0.65, 0.85, 1.0]; // Hook: 15%, Details: 50%, Climax: 20%, Outro: 15%
  }

  // 4. Select the best segments from compositionSequence based on usableScore
  const rawSegments = analysis.compositionSequence || [];
  
  // Clean up unusable segments
  const validSegments = rawSegments.filter(s => s.usableScore >= 5.0);
  const candidateSegments = validSegments.length > 0 ? validSegments : rawSegments;

  // Select top N segments based on scores
  let selectedSegments: AutoDirectorShot[] = [];
  if (candidateSegments.length > 0) {
    // Sort descending by score, take top N
    const sortedByScore = [...candidateSegments].sort((a, b) => b.usableScore - a.usableScore);
    const topN = sortedByScore.slice(0, numBlocks);
    
    // Sort the selected subset chronologically by startTime so visual flow makes sense
    selectedSegments = topN.sort((a, b) => a.startTime - b.startTime);
  }

  // Fallback segment builder if none exist
  const getFallbackSegment = (index: number): AutoDirectorShot => {
    const shotTypes: Array<'close_up' | 'wide_establishing' | 'medium_action' | 'pan_reveal'> = [
      'wide_establishing', 'medium_action', 'close_up', 'pan_reveal'
    ];
    const motionTypes: Array<'static' | 'slow_drift' | 'rapid_pan' | 'unstable'> = [
      'slow_drift', 'rapid_pan', 'static', 'slow_drift'
    ];
    return {
      startTime: 0,
      endTime: targetDuration,
      shotType: shotTypes[index % shotTypes.length],
      subjectDescription: `Fallback dynamic conformed scene block ${index + 1}`,
      motionIntensity: motionTypes[index % motionTypes.length],
      usableScore: 8.0
    };
  };

  // 5. Generate blocks sequentially with zero gaps and overlaps
  const blocks: TimelineBlock[] = [];
  let currentStart = 0;

  for (let i = 0; i < numBlocks; i++) {
    const endRatio = splitRatios[i];
    let currentEnd = parseFloat((targetDuration * endRatio).toFixed(2));
    
    // Safety clamp: Ensure the last block snaps exactly to targetDuration
    if (i === numBlocks - 1) {
      currentEnd = parseFloat(targetDuration.toFixed(2));
    }
    
    // Enforce a minimum block duration of 1.0s where possible
    if (currentEnd - currentStart < 1.0 && i > 0 && i < numBlocks - 1) {
      currentEnd = currentStart + 1.0;
    }

    const timestamp = `${currentStart.toFixed(1)}s - ${currentEnd.toFixed(1)}s`;

    // Map to segment (round-robin if selectedSegments is smaller than numBlocks)
    const segment = (selectedSegments.length > 0) 
      ? selectedSegments[i % selectedSegments.length] 
      : getFallbackSegment(i);

    // Dynamic field generation based on block position
    let title = '';
    let speedRamp = '';
    let fracture = false;
    let audioAction = '';
    let caption = '';

    const presetVisualSig = preset.visualSignature.split(',')[0] || 'Cinematic grading';
    const presetAudio = preset.audioProfile.split(',')[0] || 'Ambient backing';

    // Tailor sound design cues based on niche
    let contextFoley = 'soft ambient sound design';
    if (niche.includes('car')) contextFoley = 'subtle engine rev & tire grip overlay';
    else if (niche.includes('food')) contextFoley = 'food sizzle & utensil click FX';
    else if (niche.includes('sport') || niche.includes('foot')) contextFoley = 'crowd thuds & turf impacts';
    else if (niche.includes('salon')) contextFoley = 'airy blow-dryer swells & shear snip FX';
    else if (niche.includes('product')) contextFoley = 'mechanical clicking & digital sweep clicks';

    if (i === 0) {
      // Hook
      title = 'AutoDirector Hook';
      speedRamp = 'Fast -> Slow (300% to 50%)';
      fracture = false;
      audioAction = `Hook: whoosh on transition | ${presetAudio} | ${contextFoley}`;
      caption = `DISCOVER ${niche.toUpperCase()}`;
    } else if (i === numBlocks - 1) {
      // CTA / Outro
      title = 'Brand CTA Outro';
      speedRamp = 'Gradual slow down: 100% -> 50%';
      fracture = false;
      audioAction = `Outro: soft luxury ambient bed | logo zoom swell | audio fade-out`;
      caption = `CINEFORGE ${niche.toUpperCase()}`;
    } else if (i === numBlocks - 2) {
      // Climax
      title = 'Climax Reveal';
      speedRamp = 'Variable Ramping: 200% -> 25% on drop';
      fracture = true;
      audioAction = `Climax: bass hit on reveal | heavy industrial drop | ${presetAudio}`;
      caption = 'THE CHOSEN ONE';
    } else {
      // Detail montage
      title = `Detail Montage ${i}`;
      speedRamp = 'Normal Speed (100%)';
      fracture = true;
      audioAction = `Montage: upbeat rhythm sync | context sound FX | ${contextFoley}`;
      caption = 'FOCUSING DETAILS';
    }

    const description = `Conformed raw video segment (${segment.startTime}s - ${segment.endTime}s). Usable score: ${segment.usableScore}/10. Features: ${segment.subjectDescription}.`;
    const visualCue = `Shot Type: ${segment.shotType.replace('_', ' ')} | Movement: ${segment.motionIntensity.replace('_', ' ')}. Apply ${presetVisualSig} look.`;

    blocks.push({
      id: generateId(),
      timestamp,
      title,
      description,
      visualCue,
      audioAction,
      speedRamp,
      fracture,
      caption
    });

    currentStart = currentEnd;
  }

  // 6. Build target specifications
  const maxQualityPlan = maxQualityMode 
    ? 'Max Quality Mode: DeepDetail Upscaling engine activated (1080p source -> 4K Cinematic Master). super-fluid optical flow 60fps frame interpolation.'
    : 'Standard 1080p rendering with bicubic scaling.';

  // Determine default music mood based on preset
  let musicMood = 'luxury_track';
  if (recommendedPresetId === 'food-crave') musicMood = 'sugar_track';
  else if (recommendedPresetId === 'salon-transform') musicMood = 'fashion_track';
  else if (recommendedPresetId === 'sports-stadium') musicMood = 'stadium_track';
  else if (recommendedPresetId === 'real-estate-showcase') musicMood = 'brand_track';
  else if (recommendedPresetId === 'boss-entrance') musicMood = 'boss_track';
  else if (recommendedPresetId === 'luxury-fashion') musicMood = 'fashion_track';
  else if (recommendedPresetId === 'street-pulse') musicMood = 'street_track';
  else if (recommendedPresetId === 'product-awakening') musicMood = 'product_track';

  const soundDesignSettings: SoundDesignSettings = {
    enabled: true,
    intensity: 'balanced',
    preserveOriginal: 'auto',
    musicMood,
    foleyEnabled: true
  };

  const soundEvents = compileSoundDesignPlan(blocks, analysis, preset, soundDesignSettings);

  return {
    editTitle: `${preset.name} - AutoDirector Blueprint`,
    viewerEmotion: preset.colorGrade || 'Atmospheric Engagement',
    hookStrategy: `Start with a 1.5s visual hook. ${blocks[0]?.visualCue || 'Establish scene immediately.'}`,
    timelineBlocks: blocks,
    cutRhythm: preset.visualSignature || 'Dynamic cut rhythms synced to transitions.',
    speedRampPlan: preset.visualSignature || 'Pacing adjustments mapping to raw action intensity.',
    vfxDirection: `Visual Signature: ${preset.visualSignature}. Quality status: Sharp. Clean layout.`,
    captionStyle: `Clean safe-zone subtitles matching the ${preset.name} theme.`,
    colorGrade: preset.colorGrade,
    soundDirection: `Audio Profile: ${preset.audioProfile}. Target: ${preset.tagline}.`,
    maxQualityPlan,
    exportRecommendation: `Format: 9:16 Portrait MP4 | Destination: ${platform} | Estimated Render Time: ${preset.estimatedRenderTime}.`,
    soundDesignSettings,
    soundEvents
  };
}
