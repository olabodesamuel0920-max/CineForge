import { EditDNABlueprint, TimelineBlock, ProjectDuration, ProjectPlatform } from '@/types/project';
import { getModeById } from './cineforgeModes';

// Helper to generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export function generateEditDNABlueprint(
  title: string,
  modeId: string,
  prompt: string,
  duration: ProjectDuration,
  platform: ProjectPlatform,
  maxQualityMode: boolean
): EditDNABlueprint {
  const mode = getModeById(modeId);
  const modeName = mode ? mode.name : 'Custom Cinematic';
  const emotion = mode ? mode.viewerEmotion : 'Emotional Engagement';
  const cleanPrompt = prompt.trim() || 'No custom description provided.';

  // Determine timeline blocks based on duration
  const blocks: TimelineBlock[] = [];
  const durationSec = parseInt(duration); // 5, 10, 15, 30

  // Standardize timestamps based on splits
  if (durationSec === 5) {
    blocks.push(
      {
        id: generateId(),
        timestamp: '0.0s - 1.5s',
        title: 'Cinematic Hook',
        description: `Visual hook capturing attention based on: "${cleanPrompt.substring(0, 45)}..."`,
        visualCue: `${mode?.visualSignature.split(',')[0] || 'High-contrast framing'} with sharp forward push-in.`,
        audioAction: 'Sub-bass impact note + digital zoom whoosh.',
        speedRamp: 'Fast -> Slow (300% to 50%)',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '1.5s - 5.0s',
        title: 'Core Impact & Reveal',
        description: 'Primary product or subject showcase with high kinetic energy.',
        visualCue: 'Extreme close-up focusing on dynamic textures, finishing with a quick flash frame.',
        audioAction: `${mode?.audioProfile.split(',')[0] || 'Heavy bass drop'} syncing with visual flash.`,
        speedRamp: 'Sudden ramp down (100% to 25% on beat, then 100%)',
        fracture: true,
        caption: ""
      }
    );
  } else if (durationSec === 10) {
    blocks.push(
      {
        id: generateId(),
        timestamp: '0.0s - 2.0s',
        title: 'Instant Attention Hook',
        description: `Opener tailored for ${platform} feed: "${cleanPrompt.substring(0, 30)}..."`,
        visualCue: 'High-contrast tracking shot with high-speed shutter look.',
        audioAction: 'Reverse swell transition + sharp industrial snap.',
        speedRamp: 'Speed Ramp: 250% -> 50% on beat',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '2.0s - 6.5s',
        title: 'Detail Build-up',
        description: 'Introducing details and angles of the main subject.',
        visualCue: 'Macro panning shots showing lighting shifts, shadows, and contours.',
        audioAction: 'Pulsing synth riser building in volume and high-frequency harmonics.',
        speedRamp: 'Linear slow motion (50% constant)',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '6.5s - 10.0s',
        title: 'Cinematic Drop Climax',
        description: 'Peak visual payoff and brand/subject reveal.',
        visualCue: 'Whip-pan transition leading to low-angle hero framing with light flares.',
        audioAction: `${mode?.audioProfile.split(',')[2] || 'Distorted sub-bass drop'} with heavy kick snap.`,
        speedRamp: 'Hyper-ramp (400% -> 100% -> 25% on final hit)',
        fracture: true,
        caption: ""
      }
    );
  } else if (durationSec === 15) {
    blocks.push(
      {
        id: generateId(),
        timestamp: '0.0s - 2.5s',
        title: 'Atmospheric Opener',
        description: `Hook introducing the mood: "${cleanPrompt.substring(0, 30)}..."`,
        visualCue: 'Slow zoom-in through light leak layers or custom vignette overlay.',
        audioAction: 'Deep atmospheric drone + high-pitch clock ticking sound.',
        speedRamp: 'Normal Speed (100%)',
        fracture: false,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '2.5s - 7.0s',
        title: 'Subject Introduction & Motion',
        description: 'Subject enters frame or movement begins.',
        visualCue: 'Tracking shot following subject movement, employing motion blur frames.',
        audioAction: 'Rhythmic bass kick drums aligning with footsteps or mechanical clicks.',
        speedRamp: 'Variable Ramping: 200% -> 75%',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '7.0s - 12.0s',
        title: 'Kinetic Drop & Peak VFX',
        description: 'VFX climax and main thematic drop.',
        visualCue: 'Particle sweeps or digital overlays highlighting details, glitch transitions.',
        audioAction: 'Explosive sub hit + melodic synth chord release.',
        speedRamp: 'Frame-rate slow down to 25% (simulated high frame rate)',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '12.0s - 15.0s',
        title: 'Clean Cinematic Outro',
        description: 'Closing shot with logo, call to action, or loop reset.',
        visualCue: 'Smooth gimbal back-pedal, fading to custom cinematic black border.',
        audioAction: 'Sustained reverb tail of music + low-pass filter sweep.',
        speedRamp: 'Gradual slow down: 100% -> 50%',
        fracture: false,
        caption: "CINEFORGE"
      }
    );
  } else {
    // 30s
    blocks.push(
      {
        id: generateId(),
        timestamp: '0.0s - 3.0s',
        title: 'Intro Narrative Hook',
        description: `Setting the scene: "${cleanPrompt.substring(0, 30)}..."`,
        visualCue: 'Desaturated wide establishing shot with anamorphic crop.',
        audioAction: 'Minimal ambient piano chord + vinyl dust rumble.',
        speedRamp: 'Normal (100%)',
        fracture: false,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '3.0s - 9.0s',
        title: 'Detail Sequence',
        description: 'Showing macro details and premium features.',
        visualCue: 'Series of 3 close-up match-cuts focusing on texture and design details.',
        audioAction: 'Adding electronic arpeggio elements and clock-ticking layers.',
        speedRamp: 'Slow-motion sweeps (40%)',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '9.0s - 16.0s',
        title: 'Energy Build & Rise',
        description: 'Camera speed and motion increases, raising tension.',
        visualCue: 'Rapid whip-pans, camera shake overlays, and high shutter frame rates.',
        audioAction: 'Snare roll rise + rising synth frequencies + heart-beat acceleration.',
        speedRamp: 'Dynamic ramps: 100% -> 300% -> 100% -> 400% on cuts',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '16.0s - 25.0s',
        title: 'Thematic Drop Climax',
        description: 'The maximum impact section. High intensity edits.',
        visualCue: 'Full cinematic performance scene, high action, volumetric lighting sweeps.',
        audioAction: 'Main bass drop with heavy industrial metallic clanks and full melody.',
        speedRamp: 'Slow-mo drops (25% on action points, 100% on recovery)',
        fracture: true,
        caption: ""
      },
      {
        id: generateId(),
        timestamp: '25.0s - 30.0s',
        title: 'Visual CTA / Seamless Loop',
        description: 'Framing logo, title, or resetting for seamless loop play.',
        visualCue: 'Whip pan back to matching start position or clean central branding card.',
        audioAction: 'Echo filter sweep, sudden music cut, loop-ready ambient drone.',
        speedRamp: 'Fast whip ramp: 100% -> 500% -> 100%',
        fracture: false,
        caption: "BUILD YOURS AT CINEFORGE.COM"
      }
    );
  }

  // VFX plan based on mode and max quality
  let vfxDir = '';
  let colorGr = '';
  let soundDir = '';
  let maxQualityPlan = '';

  switch (modeId) {
    case 'luxury-demon-reveal':
      vfxDir = 'Anamorphic lens flares, volumetric fog sweeps, and high-fidelity gold/silver metallic reflection glints. Edge-glow highlight maps tracing main body lines.';
      colorGr = 'Deep gold highlights, crushed cold teal shadows, desaturated secondary colors for premium high-contrast drama. Film grain: Fine (35mm).';
      soundDir = 'Ultra-low sub-bass sweeps (24Hz), heavy metallic friction risers, engine exhaust growl modulated with synth bass, clean mechanical clock snaps.';
      break;
    case 'sugar-storm-3d':
      vfxDir = '3D particle trails, colorful bubble dynamics, chromatic zooms, hyper-saturated speed lines, glowing outlines tracking dynamic action.';
      colorGr = 'High saturation candy grading, neon magenta/violet color bias, elevated midtone contrast, high brightness levels. Film grain: None.';
      soundDir = 'Hyperpop synth chords, pitch-bent vocal risers, explosive glitter pops, high-tempo syncopated rimshots.';
      break;
    case 'fashion-drop-impact':
      vfxDir = 'Minimalistic halftone screen overlays, retro VHS tape noise, frame-jitter effects, clean typographical layout overlays on pauses.';
      colorGr = 'High fashion editorial look: clean whites, accurate skin tones, low warm saturation, slight green color bias in shadows. Film grain: 16mm medium.';
      soundDir = 'Lo-fi deep house basslines, organic snaps and claps, vinyl dust crackles, smooth vocal loops echoing in deep hall reverb.';
      break;
    case 'stadium-god-mode':
      vfxDir = 'Motion-blur streaks, concrete dust particles on impact, heavy shockwave ripples, sweat-bead reflective enhancement overlays.';
      colorGr = 'High contrast desaturated action grade. Bleach-bypass style, heavy dark vignettes, glowing highlights. Film grain: High-intensity gritty.';
      soundDir = 'Muffled crowd cheering swells, heavy heartbeat thump, high-impact concrete stomp, explosive industrial drops.';
      break;
    case 'boss-entrance':
      vfxDir = 'Cyan/magenta outline rotoscoping on freeze frames, custom halftone pop-art graphics, drop-shadow cutouts, glowing background aura.';
      colorGr = 'Aggressive comic book high-contrast grade. Glowing cyan outlines, high black level density, rich magenta ambient glow.';
      soundDir = 'Aggressive cowbell beats, heavy 808 sub-bass hits, gun-cocking triggers on freeze-frames, low guttural vocal hums.';
      break;
    case 'cinematic-brand-trailer':
      vfxDir = 'Volumetric light beams, realistic dust motes in light beams, anamorphic anamorphic bokeh, micro-contrast surface polishing.';
      colorGr = 'Hollywood blockbuster style: orange and teal cinematic grading, organic soft highlights, rich warm midtones. Film grain: Fine 35mm.';
      soundDir = 'Orchestral string swells, high-end grand piano notes, rising wind noise, low heartbeat rumble, clean speech clarity optimization.';
      break;
    case 'street-pulse-edit':
      vfxDir = 'Glitch transitions, VHS scanlines, lens distortion sweeps, frame-jitter, retro camcorder overlay details.';
      colorGr = 'Gritty retro-documentary look: warm amber highlights, green-tinted shadows, high contrast, low-fidelity film emulation.';
      soundDir = 'Syncopated boom-bap drum beats, record scratch transitions, sirens and street noise layers, low-pass filter sweeps on cuts.';
      break;
    case 'product-awakening':
      vfxDir = 'Sleek HUD interfaces, floating UI labels with lines pointing to details, metallic surface polishing, glowing electricity arcs.';
      colorGr = 'Clean technical grade: cold blue/grey shadows, clean white highlights, high detail sharpness, neutral color balance. Film grain: None.';
      soundDir = 'Mechanical ticks, camera shutter snaps, electric hum risers, clean high-tech UI beep cues.';
      break;
    default:
      vfxDir = 'Standard motion blur, dynamic cross-fades, soft glow effects.';
      colorGr = 'Natural grading, slightly elevated contrast and color vibrance.';
      soundDir = 'Beat-matched transitions, ambient rise, solid kick hit.';
  }

  // Max Quality planning logic
  if (maxQualityMode) {
    maxQualityPlan = `
1. Upscale Pipeline: DeepDetail Upscaling engine activated (1080p source -> 4K Cinematic Master).
2. Temporal Processing: Super-Fluid Optical Flow Frame Interpolation (interpolate source clips to 60fps).
3. Frame Restoration: Artifact-reduction neural filter sweeps targeting compression blocks.
4. Color Depth: Prepare HDR10 Metadata mapping with Rec. 2020 color coordinates.
5. Contrast: Local contrast adaptive map to enhance metal reflections, neon glow boundaries, and dark shadow levels.
    `.trim();
  } else {
    maxQualityPlan = 'Max Quality Mode is inactive. System will fall back to standard bicubic rendering and output 1080p with default compression settings. Activate Max Quality Mode to generate HDR10 metadata and trigger deep detail upscaling.';
  }

  // Platform specific export plan
  let exportRec = '';
  switch (platform) {
    case 'TikTok':
      exportRec = 'Format: 9:16 Portrait MP4 | Codec: H.264 (High Profile) | Bitrate: 15-18 Mbps | Target Resolution: 1080x1920 @ 60fps (Render-ready). Sound: Stereo 320kbps AAC. Loop optimization active.';
      break;
    case 'Reels':
      exportRec = 'Format: 9:16 Portrait MP4 | Codec: H.264 | Bitrate: 18-20 Mbps | Target Resolution: 1080x1920 @ 60fps. Safe-zone check: Ensure logo is clear of bottom caption blocks (top 15% / bottom 20% safe zone).';
      break;
    case 'Shorts':
      exportRec = 'Format: 9:16 Portrait MP4 | Codec: AV1 / VP9 (Auto-transcoded) | Bitrate: 16 Mbps | Target Resolution: 1080x1920 @ 60fps. Beat-synced title hooks baked into bottom-center.';
      break;
    case 'YouTube':
      exportRec = 'Format: 16:9 Landscape MP4 | Codec: HEVC (H.265) / ProRes 422 HQ (if available) | Bitrate: 45-60 Mbps | Target Resolution: 3840x2160 @ 60fps (Ultra HD Master). Dual stereo sound tracks.';
      break;
  }

  return {
    editTitle: `${title} - ${modeName} Cut`,
    viewerEmotion: emotion,
    hookStrategy: `Start with a 1.5s visual hook. ${blocks[0]?.visualCue || 'Establish scene immediately.'}`,
    timelineBlocks: blocks,
    cutRhythm: mode?.pacingPreset || 'Dynamic cuts synced to rhythmic patterns.',
    speedRampPlan: mode?.pacingPreset || 'Normal playback with gradual pacing adjustments.',
    vfxDirection: vfxDir,
    captionStyle: `Style matches ${modeName}. High contrast kinetic text tracking, centered in safe-zone areas.`,
    colorGrade: colorGr,
    soundDirection: soundDir,
    maxQualityPlan,
    exportRecommendation: exportRec,
    maxQualitySettings: {
      stabilization: maxQualityMode,
      denoise: maxQualityMode,
      sharpen: maxQualityMode,
      colorRecovery: maxQualityMode,
      upscaleFactor: 'none',
      resolution: maxQualityMode ? '4K' : '1080p'
    }
  };
}
