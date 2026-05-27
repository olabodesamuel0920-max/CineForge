import { CineForgeMode } from '@/types/project';

export const CINEFORGE_MODES: CineForgeMode[] = [
  {
    id: 'luxury-demon-reveal',
    name: 'Luxury Demon Reveal',
    description: 'High-contrast, shadow-rich vertical framing. Calibrates deep teal shadows, warm highlights, and dynamic speed ramping from 400% down to 50% slow-motion on beat transitions.',
    visualSignature: 'Chiaroscuro lighting, deep blacks, anamorphic flares, chromatic aberration on drops.',
    pacingPreset: 'Suspenseful Build -> Instant Speed Ramp (400% to 50%) -> Slow-motion Detail.',
    audioProfile: 'Sub-bass drone, metallic sweep riser, heavy industrial hit, orchestral bass drop.',
    viewerEmotion: 'Awe & Desire',
    glowColor: 'amber'
  },
  {
    id: 'sugar-storm-3d',
    name: 'Sugar Storm 3D',
    description: 'Vibrant, high-saturated candy color-grading. Configures hyper-pop pacing with rapid-fire cuts and speed-matched cuts designed for high-energy gameplay and modern edits.',
    visualSignature: 'Pop-art colors, particle explosions, 3D camera shifts, chromatic zoom-ins.',
    pacingPreset: 'Hyper-dynamic rapid-fire cuts (0.3s intervals) syncing with high-frequency beats.',
    audioProfile: 'Hyperpop synth stabs, bubble pops, pitched vocal chops, fast digital drums.',
    viewerEmotion: 'Euphoric Energy',
    glowColor: 'magenta'
  },
  {
    id: 'fashion-drop-impact',
    name: 'Fashion Drop Impact',
    description: 'Minimalist vertical crop framing. Calibrates editorial color-grading (low warm saturation, green-tinted shadows) with beat-matched jump cuts on the music rhythm.',
    visualSignature: 'Minimalist backgrounds, high-speed shutter look, grid overlays, posterize-time highlights.',
    pacingPreset: 'Beat-matched jump cuts on every kick drum, pausing on hero items for exactly 1.2 seconds.',
    audioProfile: 'Deep house garage beat, vinyl scratch, smooth sub-bass rumble, atmospheric vocals.',
    viewerEmotion: 'Sophisticated Hype',
    glowColor: 'violet'
  },
  {
    id: 'stadium-god-mode',
    name: 'Stadium God Mode',
    description: 'High-contrast desaturated action grade. Syncs athletic movement with sudden slow-motion drop execution and fast real-time follow-throughs.',
    visualSignature: 'Whip-pans, directional motion blur, camera shake on impact, desaturated grit.',
    pacingPreset: 'Rhythmic acceleration: Slow-mo on execution -> Frame-flash -> Real-time follow-through.',
    audioProfile: 'Muffled arena crowd swell, heavy chest-thumping sub-bass, industrial hit on impact.',
    viewerEmotion: 'Heroic Triumph',
    glowColor: 'cyan'
  },
  {
    id: 'boss-entrance',
    name: 'Boss Entrance',
    description: 'Low-angle tracking optimization. Uses custom freeze-frame pacing highlights with cyan neon-colored captioning style presets for high-authority visual intros.',
    visualSignature: 'Low-angle tracking, custom freeze-frame vignettes, cinematic neon title cards.',
    pacingPreset: 'Normal play speed -> Freeze Frame (desaturated with cyan stroke) -> Smooth zoom-in drop.',
    audioProfile: 'Aggressive drift phonk cowbells, distorted bassline, heavy gun-cock sound effect.',
    viewerEmotion: 'Dominance & Coolness',
    glowColor: 'magenta'
  },
  {
    id: 'cinematic-brand-trailer',
    name: 'Cinematic Brand Trailer',
    description: 'Aspirational story-telling. Employs classic Hollywood orange-and-teal grading and smooth linear pacing curves calibrated for widescreen-to-portrait safe zones.',
    visualSignature: '2.35:1 anamorphic crop, soft light leaks, film grain overlay, volumetric light simulation.',
    pacingPreset: 'Slow, deliberate cross-fades, matched-action cuts, and smooth gimbal slides.',
    audioProfile: 'Cinematic ambient piano, warm rising strings, deep atmospheric pads, analog heartbeats.',
    viewerEmotion: 'Inspiration & Purpose',
    glowColor: 'cyan'
  },
  {
    id: 'street-pulse-edit',
    name: 'Street Pulse Edit',
    description: 'Raw, high-contrast urban lifestyle pacing. Configures gritty retro exposure color shifts and syncopated transition cuts aligned to background music beats.',
    visualSignature: 'Handheld camera shake, analog tape glitches, exposure flashes, night-glow overlays.',
    pacingPreset: 'Jitter cuts, frame-skips, jump-cuts synced to syncopated snare cracks.',
    audioProfile: 'Underground boom-bap drum loop, vinyl dust noise, retro horn hits, street ambience.',
    viewerEmotion: 'Grit & Authenticity',
    glowColor: 'violet'
  },
  {
    id: 'product-awakening',
    name: 'Product Awakening',
    description: 'Sleek close-up detail sweeps. Calibrates cold blue/grey technical color balance and micro-speed ramping for macro hardware and consumer product showcases.',
    visualSignature: 'Super close-up depth of field sweeps, glowing wireframe overlays, lens reflections.',
    pacingPreset: 'Micro-ramping: extreme slow-mo on moving parts -> rapid focus shift -> snap transition.',
    audioProfile: 'Pulsing synth arpeggio, clean click/mechanical sounds, digital activation hum.',
    viewerEmotion: 'Curiosity & Fascination',
    glowColor: 'green'
  }
];

export function getModeById(id: string): CineForgeMode | undefined {
  return CINEFORGE_MODES.find(mode => mode.id === id);
}
