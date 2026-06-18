import { z } from 'zod';

export const soundDesignSchemaVersion = 1;

export interface SoundEvent {
  type: 'music bed' | 'whoosh' | 'riser' | 'bass impact' | 'soft impact' | 'ambience' | 'contextual Foley' | 'outro sting';
  assetId: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  volume: number; // gain (0.0 to 2.0)
  pan?: number; // stereo pan (-1.0 to 1.0)
  pitch?: number; // semitone adjustment (-12 to 12)
  fadeIn?: number;
  fadeOut?: number;
  duckingAmount?: number; // ducking music gain (0.0 to 1.0)
  relatedBlockId?: string;
  reason?: string;
}

export interface SoundDesignSettings {
  enabled: boolean;
  intensity: 'subtle' | 'balanced' | 'aggressive';
  preserveOriginal: 'auto' | 'yes' | 'no';
  musicMood: string; // asset ID of music
  foleyEnabled: boolean;
}

export interface AudioAssetDefinition {
  id: string;
  category: 'music' | 'whoosh' | 'riser' | 'impact' | 'ambience' | 'foley' | 'sting';
  fileName: string;
  duration: number; // in seconds
  loudness: number; // LUFS or average dB
  license: string;
  gcsPath: string;
  allowedNiches: string[];
}

// Master Asset Manifest - Frontend and Worker use this to resolve asset IDs
export const AUDIO_ASSETS: AudioAssetDefinition[] = [
  // Music beds
  { id: 'luxury_track', category: 'music', fileName: 'luxury_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/luxury_track.mp3', allowedNiches: ['cars', 'luxury', 'general'] },
  { id: 'stadium_track', category: 'music', fileName: 'stadium_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/stadium_track.mp3', allowedNiches: ['sports', 'football', 'general'] },
  { id: 'sugar_track', category: 'music', fileName: 'sugar_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/sugar_track.mp3', allowedNiches: ['food', 'cooking', 'general'] },
  { id: 'fashion_track', category: 'music', fileName: 'fashion_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/fashion_track.mp3', allowedNiches: ['fashion', 'beauty', 'general'] },
  { id: 'boss_track', category: 'music', fileName: 'boss_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/boss_track.mp3', allowedNiches: ['corporate', 'interviews', 'general'] },
  { id: 'brand_track', category: 'music', fileName: 'brand_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/brand_track.mp3', allowedNiches: ['real estate', 'commercial', 'general'] },
  { id: 'street_track', category: 'music', fileName: 'street_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/street_track.mp3', allowedNiches: ['street', 'dance', 'general'] },
  { id: 'product_track', category: 'music', fileName: 'product_track.mp3', duration: 60, loudness: -14, license: 'Royalty-Free', gcsPath: 'gs://cineforge-assets/audio/product_track.mp3', allowedNiches: ['product', 'tech', 'general'] },

  // SFX and Ambience
  { id: 'whoosh_fast', category: 'whoosh', fileName: 'whoosh_fast.mp3', duration: 1.5, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/whoosh_fast.mp3', allowedNiches: ['general'] },
  { id: 'riser_cinematic', category: 'riser', fileName: 'riser_cinematic.mp3', duration: 4.0, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/riser_cinematic.mp3', allowedNiches: ['general'] },
  { id: 'bass_impact_heavy', category: 'impact', fileName: 'bass_impact_heavy.mp3', duration: 3.0, loudness: -10, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/bass_impact_heavy.mp3', allowedNiches: ['general'] },
  { id: 'soft_impact_clean', category: 'impact', fileName: 'soft_impact_clean.mp3', duration: 2.0, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/soft_impact_clean.mp3', allowedNiches: ['general'] },
  { id: 'outro_sting_logo', category: 'sting', fileName: 'outro_sting_logo.mp3', duration: 3.5, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/outro_sting_logo.mp3', allowedNiches: ['general'] },
  { id: 'ambience_subtle', category: 'ambience', fileName: 'ambience_subtle.mp3', duration: 30.0, loudness: -20, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/ambience_subtle.mp3', allowedNiches: ['general'] },

  // Niche Foley
  { id: 'foley_engine_rev', category: 'foley', fileName: 'foley_engine_rev.mp3', duration: 5.0, loudness: -15, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_engine_rev.mp3', allowedNiches: ['cars'] },
  { id: 'foley_sizzle_pan', category: 'foley', fileName: 'foley_sizzle_pan.mp3', duration: 5.0, loudness: -16, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_sizzle_pan.mp3', allowedNiches: ['food'] },
  { id: 'foley_crunch_crisp', category: 'foley', fileName: 'foley_crunch_crisp.mp3', duration: 1.0, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_crunch_crisp.mp3', allowedNiches: ['food'] },
  { id: 'foley_sports_cheer', category: 'foley', fileName: 'foley_sports_cheer.mp3', duration: 4.0, loudness: -15, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_sports_cheer.mp3', allowedNiches: ['sports', 'football'] },
  { id: 'foley_salon_dryer', category: 'foley', fileName: 'foley_salon_dryer.mp3', duration: 4.0, loudness: -18, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_salon_dryer.mp3', allowedNiches: ['salons'] },
  { id: 'foley_salon_snip', category: 'foley', fileName: 'foley_salon_snip.mp3', duration: 1.0, loudness: -14, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_salon_snip.mp3', allowedNiches: ['salons'] },
  { id: 'foley_camera_click', category: 'foley', fileName: 'foley_camera_click.mp3', duration: 0.8, loudness: -12, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_camera_click.mp3', allowedNiches: ['fashion'] },
  { id: 'foley_accent_pop', category: 'foley', fileName: 'foley_accent_pop.mp3', duration: 0.6, loudness: -14, license: 'Public Domain', gcsPath: 'gs://cineforge-assets/audio/foley_accent_pop.mp3', allowedNiches: ['talking-head', 'general'] }
];

// Zod Validation Schemas
export const soundEventSchema = z.object({
  type: z.enum(['music bed', 'whoosh', 'riser', 'bass impact', 'soft impact', 'ambience', 'contextual Foley', 'outro sting']),
  assetId: z.string(),
  startTime: z.number().nonnegative(),
  duration: z.number().positive(),
  volume: z.number().nonnegative(),
  pan: z.number().min(-1.0).max(1.0).optional(),
  pitch: z.number().min(-12).max(12).optional(),
  fadeIn: z.number().nonnegative().optional(),
  fadeOut: z.number().nonnegative().optional(),
  duckingAmount: z.number().min(0.0).max(1.0).optional(),
  relatedBlockId: z.string().optional(),
  reason: z.string().optional()
});

export const soundDesignSettingsSchema = z.object({
  enabled: z.boolean(),
  intensity: z.enum(['subtle', 'balanced', 'aggressive']),
  preserveOriginal: z.enum(['auto', 'yes', 'no']),
  musicMood: z.string(),
  foleyEnabled: z.boolean()
});

export interface SoundDesignEnvelope {
  schemaVersion: number;
  direction: string;
  settings: SoundDesignSettings;
  events: SoundEvent[];
}

/**
 * Parses compatibility envelope inside sound_direction, safely falling back to legacy plain text.
 */
export function parseSoundDirection(soundDirection: string, defaultPresetDirection: string): {
  direction: string;
  settings: SoundDesignSettings;
  events: SoundEvent[];
} {
  const defaultSettings: SoundDesignSettings = {
    enabled: true,
    intensity: 'balanced',
    preserveOriginal: 'auto',
    musicMood: 'luxury_track',
    foleyEnabled: true
  };

  if (!soundDirection || !soundDirection.trim()) {
    return {
      direction: defaultPresetDirection,
      settings: defaultSettings,
      events: []
    };
  }

  try {
    const trimmed = soundDirection.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.schemaVersion === soundDesignSchemaVersion) {
        return {
          direction: parsed.direction || defaultPresetDirection,
          settings: { ...defaultSettings, ...parsed.settings },
          events: parsed.events || []
        };
      }
    }
  } catch (e) {
    // Fall back to plain text
  }

  return {
    direction: soundDirection,
    settings: defaultSettings,
    events: []
  };
}

/**
 * Serializes sound design state into the compatibility envelope for database columns.
 */
export function serializeSoundDirection(
  direction: string,
  settings: SoundDesignSettings,
  events: SoundEvent[]
): string {
  const envelope: SoundDesignEnvelope = {
    schemaVersion: soundDesignSchemaVersion,
    direction,
    settings,
    events
  };
  return JSON.stringify(envelope);
}

/**
 * Validates and clamps sound events to enforce strict resource limits.
 */
export function validateAndNormalizeEvents(
  events: any[],
  totalDuration: number
): SoundEvent[] {
  const validated: SoundEvent[] = [];
  // Cap at 24 events max to prevent oversized FFmpeg graphs
  const rawEvents = (events || []).slice(0, 24);

  for (const ev of rawEvents) {
    try {
      const parsed = soundEventSchema.parse(ev);

      // Clamp values strictly
      const volume = Math.max(0.0, Math.min(2.0, parsed.volume));
      const startTime = Math.max(0.0, Math.min(totalDuration, parsed.startTime));
      const duration = Math.max(0.05, Math.min(30.0, parsed.duration));

      const fadeIn = parsed.fadeIn !== undefined ? Math.max(0, Math.min(duration / 2, parsed.fadeIn)) : undefined;
      const fadeOut = parsed.fadeOut !== undefined ? Math.max(0, Math.min(duration / 2, parsed.fadeOut)) : undefined;

      const pan = parsed.pan !== undefined ? Math.max(-1.0, Math.min(1.0, parsed.pan)) : undefined;
      const pitch = parsed.pitch !== undefined ? Math.max(-12, Math.min(12, parsed.pitch)) : undefined;
      const duckingAmount = parsed.duckingAmount !== undefined ? Math.max(0.0, Math.min(1.0, parsed.duckingAmount)) : undefined;

      validated.push({
        ...parsed,
        volume,
        startTime,
        duration,
        fadeIn,
        fadeOut,
        pan,
        pitch,
        duckingAmount
      });
    } catch (e) {
      console.warn('Skipping invalid sound event:', ev, e);
    }
  }
  return validated;
}

/**
 * Deterministically compiles a sequence of sound events based on raw analysis and preset.
 */
export function compileSoundDesignPlan(
  timelineBlocks: any[],
  analysis: any,
  preset: { id: string; name: string; niche: string; audioProfile: string },
  settings: SoundDesignSettings
): SoundEvent[] {
  if (!settings.enabled) {
    return [];
  }

  const events: SoundEvent[] = [];
  const niche = (analysis?.detectedNiche || preset.niche || 'general').toLowerCase();

  // 1. Calculate timeline block start/durations
  let totalDuration = 0;
  const blockOffsets: { id: string; start: number; duration: number }[] = [];

  timelineBlocks.forEach(block => {
    const parts = block.timestamp.split(' - ');
    const startSec = parseFloat(parts[0]) || 0;
    const endSec = parseFloat(parts[1]) || 0;
    const speed = block.speed || 1.0;
    const duration = (endSec - startSec) / speed;

    blockOffsets.push({
      id: block.id,
      start: totalDuration,
      duration
    });
    totalDuration += duration;
  });

  if (totalDuration <= 0) return [];

  // Master intensity volume scaling
  let volumeMult = 1.0;
  if (settings.intensity === 'subtle') volumeMult = 0.5;
  if (settings.intensity === 'aggressive') volumeMult = 1.5;

  // Dialogue Protection check
  const isTalkingHead = niche.includes('talking-head') || niche.includes('speech') || niche.includes('interview');

  // 2. Music Bed (Looping)
  const defaultMusic = `${preset.id.replace('-crave', '').replace('-transform', '').replace('-showcase', '').replace('-stadium', '')}_track`;
  const musicAssetId = settings.musicMood || defaultMusic;
  
  // Verify music track is in manifest
  const musicAssetExists = AUDIO_ASSETS.some(a => a.id === musicAssetId);
  const finalMusicAssetId = musicAssetExists ? musicAssetId : 'luxury_track';

  events.push({
    type: 'music bed',
    assetId: finalMusicAssetId,
    startTime: 0,
    duration: totalDuration,
    volume: (isTalkingHead ? 0.12 : 0.25) * volumeMult, // Keep music low if dialogue is active
    fadeIn: 1.0,
    fadeOut: 1.5,
    duckingAmount: 0.35, // duck slightly when other SFX/captions trigger
    reason: `Cinematic music bed (${finalMusicAssetId})`
  });

  // 3. Ambience Floor (if Foley is enabled)
  if (settings.foleyEnabled && !isTalkingHead) {
    events.push({
      type: 'ambience',
      assetId: 'ambience_subtle',
      startTime: 0,
      duration: totalDuration,
      volume: 0.12 * volumeMult,
      fadeIn: 2.0,
      fadeOut: 2.0,
      reason: 'Subtle room ambience floor'
    });
  }

  // 4. Trigger events from blocks
  timelineBlocks.forEach((block, idx) => {
    const offset = blockOffsets[idx];
    if (!offset) return;

    const isFirst = idx === 0;
    const isLast = idx === timelineBlocks.length - 1;
    const isClimax = !isFirst && !isLast && (
      (block.title || '').toLowerCase().includes('climax') ||
      (block.audioAction || '').toLowerCase().includes('climax') ||
      (block.title || '').toLowerCase().includes('reveal')
    );

    const hasSpeedRamp = block.speedRamp &&
      !block.speedRamp.toLowerCase().includes('normal') &&
      !block.speedRamp.toLowerCase().includes('constant');

    // Dialogue protection check for this specific block: if dialogue captions are present, reduce effects
    const hasCaptions = block.caption && block.caption.trim().length > 0;
    const localMult = (hasCaptions && isTalkingHead) ? 0.3 : 1.0;

    // Trigger Whoosh on transitions/speed ramps
    if ((isFirst || hasSpeedRamp) && !isTalkingHead) {
      events.push({
        type: 'whoosh',
        assetId: 'whoosh_fast',
        startTime: Math.max(0.0, offset.start - 0.25),
        duration: 1.5,
        volume: 0.4 * volumeMult * localMult,
        relatedBlockId: block.id,
        reason: isFirst ? 'Opening transition hook whoosh' : 'Speed ramp transition whoosh'
      });
    }

    // Trigger Riser leading up to reveal
    if (isClimax && offset.start > 3.0 && !isTalkingHead) {
      events.push({
        type: 'riser',
        assetId: 'riser_cinematic',
        startTime: Math.max(0.0, offset.start - 3.5),
        duration: 4.0,
        volume: 0.35 * volumeMult * localMult,
        fadeIn: 2.0,
        relatedBlockId: block.id,
        reason: 'Reveal tension builder riser'
      });
    }

    // Trigger Bass Impact on drop
    if (isClimax) {
      events.push({
        type: 'bass impact',
        assetId: 'bass_impact_heavy',
        startTime: offset.start,
        duration: 3.0,
        volume: (isTalkingHead ? 0.35 : 0.65) * volumeMult * localMult,
        fadeOut: 1.0,
        relatedBlockId: block.id,
        reason: 'Climax reveal sub-bass drop'
      });
    } else if (isLast) {
      // Outro logo sting
      events.push({
        type: 'outro sting',
        assetId: 'outro_sting_logo',
        startTime: offset.start,
        duration: 3.5,
        volume: 0.5 * volumeMult,
        fadeOut: 1.5,
        relatedBlockId: block.id,
        reason: 'Brand outro logo sting'
      });
    }

    // Contextual Foley (if enabled & not talking head)
    if (settings.foleyEnabled && !isTalkingHead) {
      const blockDesc = (block.description || '').toLowerCase();

      if (niche.includes('car') || niche.includes('bmw')) {
        events.push({
          type: 'contextual Foley',
          assetId: 'foley_engine_rev',
          startTime: offset.start,
          duration: Math.min(5.0, offset.duration),
          volume: 0.22 * volumeMult,
          fadeIn: 0.5,
          fadeOut: 0.5,
          pan: idx % 2 === 0 ? -0.3 : 0.3, // slight stereo panning shifts
          relatedBlockId: block.id,
          reason: 'Engine rev lining up with vehicle motion'
        });
      } else if (niche.includes('food') || niche.includes('cook')) {
        if (isClimax || blockDesc.includes('crunch') || blockDesc.includes('bite')) {
          events.push({
            type: 'contextual Foley',
            assetId: 'foley_crunch_crisp',
            startTime: offset.start + 0.4,
            duration: 1.0,
            volume: 0.5 * volumeMult,
            relatedBlockId: block.id,
            reason: 'Crisp food crunch bite'
          });
        } else {
          events.push({
            type: 'contextual Foley',
            assetId: 'foley_sizzle_pan',
            startTime: offset.start,
            duration: Math.min(5.0, offset.duration),
            volume: 0.25 * volumeMult,
            fadeIn: 0.8,
            fadeOut: 0.8,
            relatedBlockId: block.id,
            reason: 'Sizzling pan cooking Foley'
          });
        }
      } else if (niche.includes('sport') || niche.includes('football')) {
        events.push({
          type: 'contextual Foley',
          assetId: 'foley_sports_cheer',
          startTime: offset.start,
          duration: Math.min(4.0, offset.duration),
          volume: 0.3 * volumeMult,
          fadeIn: 0.5,
          fadeOut: 0.5,
          relatedBlockId: block.id,
          reason: 'Sports stadium crowd cheer action'
        });
      } else if (niche.includes('salon') || niche.includes('hair')) {
        if (blockDesc.includes('cut') || blockDesc.includes('snip') || blockDesc.includes('scissors')) {
          events.push({
            type: 'contextual Foley',
            assetId: 'foley_salon_snip',
            startTime: offset.start + 0.2,
            duration: 1.0,
            volume: 0.45 * volumeMult,
            relatedBlockId: block.id,
            reason: 'Hairdresser shear snip sound'
          });
        } else {
          events.push({
            type: 'contextual Foley',
            assetId: 'foley_salon_dryer',
            startTime: offset.start,
            duration: Math.min(4.0, offset.duration),
            volume: 0.18 * volumeMult,
            fadeIn: 0.5,
            fadeOut: 0.5,
            relatedBlockId: block.id,
            reason: 'Styling hairdryer background swell'
          });
        }
      } else if (niche.includes('fashion') || niche.includes('runway')) {
        events.push({
          type: 'contextual Foley',
          assetId: 'foley_camera_click',
          startTime: offset.start + 0.3,
          duration: 0.8,
          volume: 0.35 * volumeMult,
          relatedBlockId: block.id,
          reason: 'Fashion photographer camera shutter click'
        });
      }
    } else if (settings.foleyEnabled && isTalkingHead) {
      // For talking heads/speech, only add very minimal pop highlights
      const blockDesc = (block.description || '').toLowerCase();
      if ((isClimax || blockDesc.includes('focus') || blockDesc.includes('key')) && idx > 0) {
        events.push({
          type: 'contextual Foley',
          assetId: 'foley_accent_pop',
          startTime: offset.start + 0.15,
          duration: 0.6,
          volume: 0.25 * volumeMult,
          relatedBlockId: block.id,
          reason: 'Minimal vocal highlight accent pop'
        });
      }
    }
  });

  return validateAndNormalizeEvents(events, totalDuration);
}
