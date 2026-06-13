export interface StylePreset {
  id: string;
  name: string;
  niche: string;
  mode: string;
  prompt: string;
  duration: string;
  platform: string;
  maxQualityMode: boolean;
  estimatedRenderTime: string;
  description: string;
  colorGrade: string;
  visualSignature: string;
  audioProfile: string;
  videoSrc: string;
  tagline: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'bmw-commercial',
    name: 'BMW Commercial',
    niche: 'cars',
    mode: 'luxury-demon-reveal',
    prompt: 'High-contrast commercial style edit. Dramatic shadow-rich lighting, reflections tracing curves of a sleek black vehicle, industrial hits syncing with rapid speed ramping transitions.',
    duration: '15s',
    platform: 'YouTube',
    maxQualityMode: true,
    estimatedRenderTime: '45–90s',
    description: 'Ultra UHD cinematic vehicle showcase with gold/teal grading.',
    colorGrade: 'Deep teal shadows, warm gold highlights, crushed desaturated secondary tones.',
    visualSignature: 'Chiaroscuro lighting, anamorphic lens flares, edge body line glow tracking.',
    audioProfile: 'Sub-bass drone (24Hz), metallic sweep riser, heavy orchestral bass drop hits.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Automotive Edition'
  },
  {
    id: 'food-crave',
    name: 'Food Crave Ad',
    niche: 'food',
    mode: 'sugar-storm-3d',
    prompt: 'High-saturation close-ups of food preparation. Fast jump cuts syncing with upbeat transients, sizzling audio cues, macro food details, warm inviting color grading.',
    duration: '15s',
    platform: 'TikTok',
    maxQualityMode: true,
    estimatedRenderTime: '45–90s',
    description: 'Vibrant macro details and fast-paced jump cuts for culinary displays.',
    colorGrade: 'Rich warm saturation, vibrant reds and yellows, high clarity.',
    visualSignature: 'Close-up macro shots, steam overlays, rapid motion tracking.',
    audioProfile: 'Sizzling sounds, knife chops, upbeat snare cracks, fast digital drums.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Crave-Worthy Ad'
  },
  {
    id: 'salon-transform',
    name: 'Salon Makeover',
    niche: 'salons',
    mode: 'fashion-drop-impact',
    prompt: 'Soft ambient lighting salon makeover. Smooth linear slow sweeps transition into a fast dynamic reveal. Pastel tones, bright highlights, and soothing music build up.',
    duration: '15s',
    platform: 'Reels',
    maxQualityMode: false,
    estimatedRenderTime: '30–60s',
    description: 'Soothing makeovers with elegant soft grading and swift transformation reveals.',
    colorGrade: 'Soft pastel hues, bright airy highlights, gentle warm shadow tint.',
    visualSignature: 'Before-after transitions, light leaks, clean vertical typography.',
    audioProfile: 'Airy swells, synth pads, uplifting kick drops, ambient hair blow-dryer sweeps.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Transformation Reel'
  },
  {
    id: 'real-estate-showcase',
    name: 'Real Estate Showcase',
    niche: 'real estate',
    mode: 'cinematic-brand-trailer',
    prompt: 'Premium real estate walk-through. Warm cinematic orange-and-teal grading, soft orchestral strings, elegant slow panning.',
    duration: '30s',
    platform: 'YouTube',
    maxQualityMode: true,
    estimatedRenderTime: '90–180s',
    description: 'Smooth gimbal pans, ambient piano, and warm sunlight.',
    colorGrade: 'Hollywood block-buster teal and orange grade, rich warm midtones.',
    visualSignature: '2.35:1 widescreen letterbox, soft light leaks, film grain overlay.',
    audioProfile: 'Warm cinematic piano hooks, rising orchestral strings, deep atmospheric pads.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Luxury Property Tour'
  },
  {
    id: 'sports-stadium',
    name: 'Stadium Energy',
    niche: 'football/sports',
    mode: 'stadium-god-mode',
    prompt: 'High-contrast desaturated athletic action. Intense workout/stadium tracking, slow-motion climax drop, white frame-flashes on impact.',
    duration: '15s',
    platform: 'YouTube',
    maxQualityMode: true,
    estimatedRenderTime: '45–90s',
    description: 'High-intensity workout cuts, frame-flashes, and desaturated grit.',
    colorGrade: 'High-contrast desaturated action grade, cool shadow tints.',
    visualSignature: 'Whip-pans, directional motion blur, camera shake on impact, desaturated grit.',
    audioProfile: 'Muffled arena crowd swell, heavy chest-thumping sub-bass, industrial hit on impact.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Stadium Energy Edit'
  },
  {
    id: 'product-reveal',
    name: 'Product Reveal',
    niche: 'products',
    mode: 'product-awakening',
    prompt: 'Macro close-up sweeps of a futuristic device. Sleek UI element lines pointing to key features, electrical sparks, tech beep sounds, mechanical clicking sync.',
    duration: '10s',
    platform: 'Shorts',
    maxQualityMode: true,
    estimatedRenderTime: '30–60s',
    description: 'Extreme macro close-ups, wireframes, and tech risers.',
    colorGrade: 'Clean tech grade, cold blue/grey shadows, high sharpness profile.',
    visualSignature: 'Macro detail sweeps, HUD interface layers, wireframe outlines, lens reflections.',
    audioProfile: 'Pulsing synth arpeggiators, camera shutter clicks, digital active hum sweeps.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Premium Reveal'
  },
  {
    id: 'talking-head',
    name: 'Talking Head',
    niche: 'talking-head content',
    mode: 'boss-entrance',
    prompt: 'Distorted bass Phonk intro. Low-angle tracking zoom, dramatic freeze frame on key action moment with glowing text overlays and clean subtitles.',
    duration: '5s',
    platform: 'Reels',
    maxQualityMode: false,
    estimatedRenderTime: '15–30s',
    description: 'Drift Phonk beats, low-angle zoom, and bold outline subtitles.',
    colorGrade: 'High contrast graphic novel grading, dark desaturated backgrounds.',
    visualSignature: 'Cyan/magenta rotoscope strokes on freeze-frames, pop-art halftone vignette.',
    audioProfile: 'Aggressive drift phonk cowbells, distorted 808 sub hits, gun cocks.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Viral Brand Reel'
  },
  {
    id: 'luxury-fashion',
    name: 'Luxury Fashion',
    niche: 'fashion',
    mode: 'fashion-drop-impact',
    prompt: 'Minimalist fashion runway showcase. Warm desaturated tones, low warm saturation, jump cuts on garage beats, portrait frame centered, editorial typeface overlay.',
    duration: '15s',
    platform: 'Reels',
    maxQualityMode: true,
    estimatedRenderTime: '45–90s',
    description: 'Clean jump-cuts and low-saturated editorial grading.',
    colorGrade: 'High fashion editorial tone, warm desaturated shadows, accurate skin tone balance.',
    visualSignature: 'Minimalist backgrounds, high-speed shutter simulation, grids overlays.',
    audioProfile: 'Deep house garage beat, vinyl dust crackles, smooth hall reverb vocal echoes.',
    videoSrc: '/uploads/promo.mp4',
    tagline: 'Luxury Drop Edit'
  }
];

export function getPresetById(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find(preset => preset.id === id);
}
