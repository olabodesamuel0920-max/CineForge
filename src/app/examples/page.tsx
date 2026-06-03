"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Sparkles, Play, ArrowRight, Clock, Settings, Film, Eye, 
  Volume2, Palette, Cpu, Check, Loader2, ArrowLeft 
} from 'lucide-react';
import { CINEFORGE_MODES } from '@/lib/cineforgeModes';
import { createProject } from '@/lib/projects';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';

// Custom Style Presets for Examples Page (matching studio list)
const EXAMPLES_PRESETS = [
  {
    id: 'bmw-commercial',
    name: 'BMW Commercial',
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
    videoSrc: '/uploads/promo.mp4'
  },
  {
    id: 'luxury-fashion',
    name: 'Luxury Fashion',
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
    videoSrc: '/uploads/promo.mp4'
  },
  {
    id: 'product-reveal',
    name: 'Product Reveal',
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
    videoSrc: '/uploads/promo.mp4'
  },
  {
    id: 'real-estate-showcase',
    name: 'Real Estate Showcase',
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
    videoSrc: '/uploads/promo.mp4'
  },
  {
    id: 'travel-reel',
    name: 'Travel Reel',
    mode: 'street-pulse-edit',
    prompt: 'Fast-paced travel collage. Gritty film grain, hand-held camera movement, retro exposure flashes, hip-hop boom-bap cuts.',
    duration: '15s',
    platform: 'TikTok',
    maxQualityMode: false,
    estimatedRenderTime: '30–60s',
    description: 'Handheld camera shakes, tape glitches, and gritty grain.',
    colorGrade: 'Gritty retro document tone, warm amber highlights, green-biased film shadows.',
    visualSignature: 'Organic camera shake, analog tape glitches, lens distortion snaps.',
    audioProfile: 'Syncopated boom-bap hip-hop groove, sirens, horn hits, ambient street noise.',
    videoSrc: '/uploads/promo.mp4'
  },
  {
    id: 'viral-reel',
    name: 'Viral Reel',
    mode: 'boss-entrance',
    prompt: 'Distorted bass cowboy phonk intro. High-contrast neon glows, dramatic freeze frame on key action moment with glowing text overlays.',
    duration: '5s',
    platform: 'Reels',
    maxQualityMode: false,
    estimatedRenderTime: '15–30s',
    description: 'Distorted Cowbells, neon caption outlines, freeze-frames.',
    colorGrade: 'High contrast graphic novel grading, dark desaturated backgrounds.',
    visualSignature: 'Cyan/magenta rotoscope strokes on freeze-frames, pop-art halftone vignette.',
    audioProfile: 'Aggressive drift phonk cowbells, distorted 808 sub hits, gun cocks.',
    videoSrc: '/uploads/promo.mp4'
  }
];

export default function FeaturedExamplesPage() {
  const router = useRouter();
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [stagingPresetId, setStagingPresetId] = useState<string | null>(null);
  const [tickerText, setTickerText] = useState('ALLOCATING DEMO STORAGE...');

  useEffect(() => {
    if (!stagingPresetId) return;

    const statuses = [
      'ALLOCATING DEMO STORAGE REGISTERS...',
      'ATTACHING SYSTEM DEMO VIDEO SOURCE...',
      'INJECTING PRESET EDITDNA SPECIFICATIONS...',
      'MAPPING FRACTURE & PACING SCALES...',
      'COMPILING TIMELINE SEGMENT BOUNDARIES...',
      'CREATING WORKSPACE AND REDIRECTING...'
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % statuses.length;
      setTickerText(statuses[currentIdx]);
    }, 800);

    return () => clearInterval(interval);
  }, [stagingPresetId]);

  const handleQuickDemoRender = async (preset: typeof EXAMPLES_PRESETS[0]) => {
    setStagingPresetId(preset.id);
    try {
      const numericDuration = parseInt(preset.duration, 10);
      const matchingMode = CINEFORGE_MODES.find(m => m.id === preset.mode);
      const emotion = matchingMode ? matchingMode.viewerEmotion : 'Neutral';

      // 1. Generate blueprint for this preset
      const response = await fetch('/api/blueprint/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: preset.prompt,
          selectedMode: preset.mode,
          viewerEmotion: emotion,
          duration: numericDuration,
          platform: preset.platform,
          videoDuration: 15
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate blueprint: status ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.blueprint) {
        throw new Error(data.error || 'Blueprint generation was unsuccessful.');
      }

      // 2. Create local/cloud project with sourceType: "demo"
      const newProj = await createProject({
        title: `${preset.name} - Demo`,
        selectedMode: preset.mode,
        maxQualityMode: preset.maxQualityMode,
        mediaFilename: 'promo.mp4',
        mediaSize: '242 KB',
        duration: preset.duration as any,
        platform: preset.platform as any,
        prompt: preset.prompt,
        sourceType: 'demo',
        sourceUrl: '/uploads/promo.mp4'
      }, data.blueprint);

      await new Promise(resolve => setTimeout(resolve, 1200)); // Short delay for premium compilation feel
      router.push(`/projects/${newProj.id}`);
    } catch (e) {
      alert(`Staging failed: ${(e as Error).message}`);
      setStagingPresetId(null);
    }
  };

  return (
    <div className="flex-1 bg-space-black relative py-8 px-4 sm:px-6 lg:px-8">
      {/* Background ambient sweeps */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-violet/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Cybernetic Loading Overlay */}
      {stagingPresetId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300">
          <div className="glass-panel border border-white/10 bg-space-card/80 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center flex flex-col items-center gap-6">
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-brand-cyan/60"></div>

            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand-cyan/20 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-y-transparent border-x-brand-cyan animate-spin"></div>
              <Sparkles className="w-5 h-5 text-brand-cyan animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold tracking-widest text-brand-cyan uppercase animate-pulse">
                Staging Preset Project Workspace
              </h3>
              <p className="text-[10px] font-mono text-gray-500">
                INITIALIZING COLD METADATA CACHE...
              </p>
            </div>

            <div className="w-full bg-[#050508]/80 border border-white/5 rounded-lg px-4 py-3 min-h-[44px] flex items-center justify-center">
              <span className="text-[10px] font-mono text-brand-violet uppercase tracking-wider">
                {tickerText}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-brand-cyan shrink-0" />
              Featured Style Presets
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Explore pre-configured cinematic styles. Preview the DNA signature and clone them with a single click.
            </p>
          </div>
          <button
            onClick={() => router.push('/studio')}
            className="self-start px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs text-gray-300 flex items-center gap-1.5 hover:bg-white/10 hover:border-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Studio
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {EXAMPLES_PRESETS.map((preset) => {
            const isHovered = hoveredPreset === preset.id;
            return (
              <div 
                key={preset.id}
                onMouseEnter={() => setHoveredPreset(preset.id)}
                onMouseLeave={() => setHoveredPreset(null)}
                className="glass-panel rounded-xl border border-white/5 bg-space-card/30 flex flex-col overflow-hidden hover:border-white/10 transition-all duration-300 group shadow-lg"
              >
                {/* Visual Preview Window Container */}
                <div className="h-[320px] w-full bg-[#030307] relative overflow-hidden flex items-center justify-center border-b border-white/5 py-4">
                  {/* Blurred background video for premium aesthetic */}
                  <video 
                    src={preset.videoSrc}
                    className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md scale-110 pointer-events-none"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                  
                  {/* True 9:16 Phone Mock Container */}
                  <div className="relative w-[160px] aspect-[9/16] bg-black rounded-xl border border-white/15 overflow-hidden shadow-2xl flex items-center justify-center group-hover:border-brand-cyan/40 transition-all duration-300">
                    <video 
                      src={preset.videoSrc}
                      className="w-full h-full object-cover opacity-80"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/30 pointer-events-none"></div>

                    {/* Aesthetic Beat Grid Overlay on Hover */}
                    {isHovered && (
                      <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none animate-fadeIn">
                        <div className="flex justify-between items-start">
                          <span className="text-[7px] font-mono text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/20 px-1 py-0.5 rounded tracking-widest font-extrabold uppercase scale-90 origin-top-left">
                            BEATS
                          </span>
                          <span className="text-[7px] font-mono text-gray-400 scale-90 origin-top-right">120 BPM</span>
                        </div>
                        
                        {/* Audio visualizer peaks mockup */}
                        <div className="flex items-end gap-0.5 h-4 mb-2 opacity-80 justify-center">
                          <div className="w-[1px] bg-brand-cyan h-3 animate-waveform" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-1.5 animate-waveform" style={{ animationDelay: '0.4s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-4 animate-waveform" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-5 animate-waveform" style={{ animationDelay: '0.7s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-2 animate-waveform" style={{ animationDelay: '0.3s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-3 animate-waveform" style={{ animationDelay: '0.5s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-0.5 animate-waveform" style={{ animationDelay: '0.9s' }}></div>
                          <div className="w-[1px] bg-brand-cyan h-4 animate-waveform" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview Tag overlay */}
                  <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                    <span className="text-[9px] font-mono text-brand-cyan px-2 py-0.5 rounded bg-brand-cyan/15 border border-brand-cyan/25 font-bold uppercase tracking-wide">
                      {preset.duration} Output
                    </span>
                    {preset.maxQualityMode && (
                      <span className="text-[9px] font-mono text-brand-violet px-2 py-0.5 rounded bg-brand-violet/15 border border-brand-violet/25 font-bold uppercase tracking-wide">
                        UHD 4K
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 text-[9px] text-gray-400 font-mono z-10 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    <Clock className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>Est: {preset.estimatedRenderTime}</span>
                  </div>

                  {/* Play HUD layout */}
                  <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-0.5 z-10 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/5">
                    <h3 className="text-xs font-bold text-white tracking-wide">{preset.name}</h3>
                    <p className="text-[9px] text-gray-400 font-mono">Platform: <code className="text-gray-200">{preset.platform}</code></p>
                  </div>
                </div>

                {/* Technical Specifications Sheet */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-5 bg-[#07070d]/50">
                  <div className="flex flex-col gap-3.5 text-[11px] font-mono leading-relaxed">
                    
                    {/* Visual Description */}
                    <p className="text-gray-300 font-sans leading-relaxed text-xs">
                      {preset.description}
                    </p>

                    <div className="space-y-2 border-t border-white/5 pt-3">
                      {/* Color Grade */}
                      <div className="flex items-start gap-2">
                        <Palette className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase block">Color Grade</span>
                          <span className="text-gray-300 text-[10px]">{preset.colorGrade}</span>
                        </div>
                      </div>

                      {/* Visual Signature */}
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-brand-violet shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase block">Visual Signature</span>
                          <span className="text-gray-300 text-[10px]">{preset.visualSignature}</span>
                        </div>
                      </div>

                      {/* Sound profile */}
                      <div className="flex items-start gap-2">
                        <Volume2 className="w-4 h-4 text-brand-magenta shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] text-gray-500 font-bold uppercase block">Sound Profile</span>
                          <span className="text-gray-300 text-[10px]">{preset.audioProfile}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4">
                    {/* Quick Demo Render */}
                    <button
                      onClick={() => handleQuickDemoRender(preset)}
                      className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,243,255,0.1)] active:scale-[0.98] cursor-pointer"
                    >
                      <Film className="w-4 h-4" /> Quick Demo Render
                    </button>
                    {/* Customize in Studio */}
                    <Link
                      href={`/studio?preset=${preset.id}`}
                      className="w-full py-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                    >
                      <Settings className="w-4 h-4" /> Customize in Studio
                    </Link>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        <RightsSafetyNotice />
      </div>
    </div>
  );
}
