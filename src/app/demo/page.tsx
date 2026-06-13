"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Sparkles, Play, ArrowRight, Clock, Settings, Film, Eye, 
  Volume2, Palette, Cpu, Check, Loader2, ArrowLeft,
  ChevronLeft, ChevronRight, AlertCircle, Shield, Briefcase, Target, HelpCircle
} from 'lucide-react';
import { CINEFORGE_MODES } from '@/lib/cineforgeModes';
import { createProject } from '@/lib/projects';

// Slide Deck content
const SLIDES = [
  {
    id: 'problem',
    label: '01. Problem',
    title: 'The Short-Form Bottleneck',
    bullets: [
      {
        heading: 'Extreme Editorial Friction',
        text: 'Manually syncing cuts to audio beats, writing custom dynamic text captions, and applying split color grading consumes hours of editor attention.'
      },
      {
        heading: 'Exponential Content Demand',
        text: 'To feed social media algorithms, creators and brands must deliver 10x-50x more vertical content weekly, causing edit resources to saturate.'
      },
      {
        heading: 'Rendering Pipeline Latency',
        text: 'Traditional desktop workstations suffer under heavy transcode times, while remote pipelines lack dynamic, content-aware resource management.'
      }
    ]
  },
  {
    id: 'solution',
    label: '02. Solution',
    title: 'Decoupled Creative EditDNA',
    bullets: [
      {
        heading: 'Blueprints over Video Files',
        text: 'CineForge decouples creative decisions from heavy video files. We compile lightweight JSON blueprints (EditDNA) containing timing metadata.'
      },
      {
        heading: 'Directorial EditDNA Engine',
        text: 'Directorial presets translate abstract style prompts into exact frame-by-frame pacing vectors, speed curves, and visual grading guidelines.'
      },
      {
        heading: 'Zero-Friction Staging',
        text: 'Users and agencies stage assets instantly, preview draft seek timelines, and dispatch encoding commands to headless background workers.'
      }
    ]
  },
  {
    id: 'technology',
    label: '03. Technology',
    title: 'High-Performance Local Transcode',
    bullets: [
      {
        heading: 'DSP Beat-Snapping Analytics',
        text: 'Extracts soundtrack tempos and transient peaks. Programmatic bounds snap cuts to precise audio transients within a 250ms safety window.'
      },
      {
        heading: 'QSV Hardware Acceleration',
        text: 'Offloads frame processing to local GPUs via Intel Quick Sync Video (QSV), reducing 15-second UHD 4K compile times to under 20 seconds.'
      },
      {
        heading: 'Dual-Pool Concurrency Queues',
        text: 'Queues renders and previews in independent concurrent pools (Phase S1), protecting host machines from CPU/RAM spikes.'
      }
    ]
  },
  {
    id: 'opportunity',
    label: '04. Opportunity',
    title: 'Scale & SaaS Monetization',
    bullets: [
      {
        heading: 'SaaS Tokenized Subscriptions',
        text: 'A high-margin credit model where clients purchase render tokens. Gated previews and atomic balances protect computing margins.'
      },
      {
        heading: 'Enterprise Agency Hubs',
        text: 'Enables media agencies to scale client short-form ad variations programmatically using unified style DNA templates.'
      },
      {
        heading: 'Autonomous API Integrations',
        text: 'Future horizontal scaling maps to shared queues (BullMQ/Redis), letting developer pipelines connect and command remote render nodes.'
      }
    ]
  }
];

import { STYLE_PRESETS } from '@/lib/presetsRegistry';

const DEMO_PRESETS = STYLE_PRESETS;

function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [stagingPresetId, setStagingPresetId] = useState<string | null>(null);
  const [tickerText, setTickerText] = useState('ALLOCATING DEMO STORAGE...');

  // Auto-launch preset if ?preset= is passed
  useEffect(() => {
    const presetParam = searchParams.get('preset');
    if (presetParam) {
      const match = DEMO_PRESETS.find(p => p.id === presetParam);
      if (match) {
        handleQuickDemoRender(match);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    // Hide global header in demo mode
    const globalHeader = document.getElementById('global-nav-header');
    if (globalHeader) {
      globalHeader.style.display = 'none';
    }
    
    return () => {
      // Restore global header when leaving demo mode
      if (globalHeader) {
        globalHeader.style.display = '';
      }
    };
  }, []);

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
    }, 400); // Speed up for investor deck presentation snappy experience

    return () => clearInterval(interval);
  }, [stagingPresetId]);

  const handleQuickDemoRender = async (preset: typeof DEMO_PRESETS[0]) => {
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

      await new Promise(resolve => setTimeout(resolve, 800)); // Fast compilation delay
      router.push(`/projects/${newProj.id}`);
    } catch (e) {
      alert(`Staging failed: ${(e as Error).message}`);
      setStagingPresetId(null);
    }
  };

  const nextSlide = () => {
    setActiveSlideIdx((prev) => (prev + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    setActiveSlideIdx((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  return (
    <div className="flex-1 bg-space-black relative min-h-screen flex flex-col overflow-x-hidden">
      
      {/* Dynamic Compilation Overlay */}
      {stagingPresetId && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-300">
          <div className="glass-panel border border-white/10 bg-space-card/85 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center flex flex-col items-center gap-6">
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-brand-cyan/60"></div>

            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand-cyan/20 animate-spin animate-duration-1000"></div>
              <div className="absolute inset-2 rounded-full border-4 border-y-transparent border-x-brand-cyan animate-spin"></div>
              <Sparkles className="w-5 h-5 text-brand-cyan animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold tracking-widest text-brand-cyan uppercase animate-pulse">
                Auto-creating Demo Workspace
              </h3>
              <p className="text-[10px] font-mono text-gray-500">
                BYPASSING ACCOUNT & SIGNUP GATES...
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

      {/* Simplified Presentation Header */}
      <header className="border-b border-white/5 bg-space-black/80 backdrop-blur-md py-4 px-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-brand-cyan shrink-0 animate-pulse" />
          <span className="font-extrabold text-sm text-white tracking-widest font-mono">CINEFORGE <span className="text-brand-violet font-bold">DEMO</span></span>
        </div>
        <Link 
          href="/"
          className="px-3.5 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-gray-300 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Exit Demo
        </Link>
      </header>

      {/* Main presentation grid */}
      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 md:p-8 relative z-10">
        
        {/* LEFT COLUMN: Presentation Deck */}
        <div className="flex flex-col gap-6 justify-between border border-white/5 bg-space-card/10 rounded-2xl p-5 md:p-6 backdrop-blur-md">
          <div className="flex flex-col gap-4">
            
            {/* Slide Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
              {SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveSlideIdx(idx)}
                  className={`px-3 py-1.5 rounded text-[10px] font-mono tracking-wide uppercase transition-all cursor-pointer ${
                    idx === activeSlideIdx 
                      ? 'bg-gradient-to-r from-brand-cyan to-brand-violet text-space-black font-extrabold'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {slide.label}
                </button>
              ))}
            </div>

            {/* Active Slide Body */}
            <div className="space-y-6 pt-2 animate-fadeIn min-h-[320px]">
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-wide">
                {SLIDES[activeSlideIdx].title}
              </h2>
              
              <div className="flex flex-col gap-4">
                {SLIDES[activeSlideIdx].bullets.map((bullet, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan mt-2 shrink-0"></div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-gray-200 uppercase font-mono tracking-wide">{bullet.heading}</h4>
                      <p className="text-xs text-gray-400 leading-relaxed font-sans">{bullet.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Slide Deck Bottom Controls */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4">
            <span className="text-[10px] font-mono text-gray-500">
              SLIDE {activeSlideIdx + 1} OF {SLIDES.length}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={prevSlide}
                className="p-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={nextSlide}
                className="p-1.5 rounded border border-white/15 bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Quick-Launch Console Sandbox */}
        <div className="flex flex-col gap-6 border border-white/5 bg-space-card/25 rounded-2xl p-5 md:p-6 justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" />
              <h3 className="text-sm font-mono font-bold text-gray-200 tracking-wider">DEMO QUICK LAUNCH CONSOLE</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              Choose a preset below to trigger the <code className="text-brand-cyan font-bold font-mono">Start Demo Now</code> flow. The engine will instantly stage the b-roll and redirect you to the render control deck in under 30 seconds.
            </p>

            {/* Preset Options List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleQuickDemoRender(preset)}
                  className="glass-panel text-left p-3.5 border border-white/5 hover:border-brand-cyan/40 bg-space-card/30 rounded-xl transition-all duration-300 group hover:shadow-[0_0_15px_rgba(0,243,255,0.05)] cursor-pointer flex flex-col gap-2 hover:scale-[1.02]"
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[8px] font-mono text-gray-400">{preset.tagline.toUpperCase()}</span>
                    <span className="text-[8px] font-mono text-brand-cyan">{preset.duration} Output</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-white group-hover:text-brand-cyan transition-colors">{preset.name}</h4>
                  <div className="text-[9px] text-gray-500 font-mono flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-brand-violet" />
                    <span>Est Render: {preset.estimatedRenderTime}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Indicator */}
          <div className="p-4 bg-brand-cyan/5 border border-brand-cyan/20 rounded-xl flex gap-3 items-center mt-4">
            <AlertCircle className="w-5 h-5 text-brand-cyan shrink-0" />
            <p className="text-[10px] font-mono text-brand-cyan leading-normal">
              CONNECTION SECURE: System bypassing user registration, credit limits, and billing forms. Staging executes local demo files directly.
            </p>
          </div>
        </div>

      </div>

      {/* CineForge Demo Results Showcase */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-8 pb-16 pt-8 z-10 relative">
        <div className="border border-white/5 bg-space-card/10 rounded-2xl p-6 md:p-8 backdrop-blur-md space-y-6">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-brand-violet animate-pulse" />
              <h3 className="text-base font-mono font-extrabold tracking-widest text-white uppercase">
                CineForge Production Benchmarks
              </h3>
            </div>
            <p className="text-xs text-gray-400 font-sans max-w-2xl leading-relaxed">
              Verify platform capabilities across diverse video content categories. The following benchmark results were compiled directly from E2E remote runs on our Cloud Run transcode nodes using the high-quality HEVC portrait pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                category: 'Automotive/Car',
                preset: 'luxury-demon-reveal',
                renderTime: '72.78s',
                fileSize: '5.97 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'Excellent 9:16 vertical video; high-contrast teal/warm grade; zero placeholder burn-in.',
                tag: 'Luxury Reveal'
              },
              {
                category: 'Fashion/Product',
                preset: 'fashion-drop-impact',
                renderTime: '67.13s',
                fileSize: '5.92 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'Sleek saturated neon tones; clean transitions synced to beat; captions mapped to creative subtitles.',
                tag: 'Editorial Runway'
              },
              {
                category: 'Food/Dessert',
                preset: 'product-awakening',
                renderTime: '66.40s',
                fileSize: '5.90 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'Moody macro pouring detail; warm color temperature; smooth transitions; correct pixel ratios.',
                tag: 'Consumer Brand'
              },
              {
                category: 'Real Estate/Interior',
                preset: 'cinematic-brand-trailer',
                renderTime: '60.00s',
                fileSize: '5.61 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'Clean bright grading; smooth camera panning emulation; subtitles aligned with video pacing.',
                tag: 'Cinematic Tour'
              },
              {
                category: 'Sport/Football',
                preset: 'stadium-god-mode',
                renderTime: '70.92s',
                fileSize: '5.87 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'High-energy editing sequence; aggressive speed cuts and velocity changes matched to transients.',
                tag: 'Sports Phonk'
              },
              {
                category: 'Talking-Head/Brand',
                preset: 'boss-entrance',
                renderTime: '58.86s',
                fileSize: '5.06 MB',
                resolution: '1080x1920',
                codec: 'HEVC (H.265)',
                verdict: 'Premium speaker headshot framing; sharp visual clarity; subtitles burned in on key accents.',
                tag: 'Personal Brand'
              }
            ].map((item, idx) => (
              <div 
                key={idx}
                className="glass-panel border border-white/5 bg-space-card/20 p-5 rounded-xl flex flex-col justify-between gap-4 hover:border-brand-violet/30 transition-all duration-300 group hover:shadow-[0_0_15px_rgba(168,85,247,0.05)]"
              >
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">{item.tag}</span>
                    <span className="inline-flex items-center gap-1 text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider">
                      <Check className="w-2.5 h-2.5" /> SUCCESS
                    </span>
                  </div>
                  
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-extrabold text-white group-hover:text-brand-violet transition-colors">
                      {item.category}
                    </h4>
                    <p className="text-[9px] font-mono text-gray-500">
                      Preset: <code className="text-gray-400">{item.preset}</code>
                    </p>
                  </div>

                  <p className="text-[10px] text-gray-400 leading-relaxed font-sans pt-1">
                    {item.verdict}
                  </p>
                </div>

                <div className="border-t border-white/5 pt-3.5 mt-1 grid grid-cols-2 gap-2 text-[9px] font-mono text-gray-500">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-600 uppercase">Render Duration</span>
                    <span className="text-gray-300 font-bold">{item.renderTime}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-600 uppercase">File size</span>
                    <span className="text-gray-300 font-bold">{item.fileSize}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-600 uppercase">Resolution</span>
                    <span className="text-gray-300 font-bold">{item.resolution}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-gray-600 uppercase">Codec Profile</span>
                    <span className="text-gray-300 font-bold">{item.codec}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Absolute background accent element */}
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-radial from-brand-violet/3 to-transparent blur-3xl pointer-events-none"></div>
    </div>
  );
}

export default function InvestorDemoPage() {
  return (
    <React.Suspense fallback={
      <div className="flex-1 bg-space-black flex flex-col items-center justify-center min-h-screen text-gray-500 font-mono text-xs gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
        <span>Initializing Presentation Session...</span>
      </div>
    }>
      <DemoContent />
    </React.Suspense>
  );
}
