"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Play, Film, Cpu, Sparkles, Wand2, Server, HardDrive, 
  User, Mail, Briefcase, MessageSquare, Check, CheckCircle2, 
  TrendingUp, Clock, Shield, Zap, Target, Star, Eye, ChevronRight
} from 'lucide-react';
import HeroCommandCenter from '@/components/HeroCommandCenter';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';

// Preset Products details for Landing Page Showcase
const LANDING_PRESETS = [
  {
    id: 'bmw-commercial',
    name: 'BMW Commercial',
    tagline: 'Automotive Edition',
    mode: 'Luxury Demon Reveal',
    spec: '15s • YouTube • Max Quality',
    details: 'Dynamic chiaroscuro grading, reflections tracing sleek car contours, and speed ramps synced to low-bass impacts.',
    badgeColor: 'border-brand-cyan/20 text-brand-cyan bg-brand-cyan/5',
    glowColor: 'group-hover:border-brand-cyan/30'
  },
  {
    id: 'luxury-fashion',
    name: 'Luxury Fashion',
    tagline: 'Editorial Drop',
    mode: 'Fashion Drop Impact',
    spec: '15s • Reels • Max Quality',
    details: 'Low-saturation luxury grading, editorial typeface overlays, and sharp jump cuts synced to vinyl dust and garage beats.',
    badgeColor: 'border-brand-violet/20 text-brand-violet bg-brand-violet/5',
    glowColor: 'group-hover:border-brand-violet/30'
  },
  {
    id: 'product-reveal',
    name: 'Product Reveal',
    tagline: 'Tech Campaign',
    mode: 'Product Awakening',
    spec: '10s • Shorts • Max Quality',
    details: 'Extreme macro close-ups, digital wireframe overlaps, tech hum risers, and camera shutter click sync.',
    badgeColor: 'border-brand-magenta/20 text-brand-magenta bg-brand-magenta/5',
    glowColor: 'group-hover:border-brand-magenta/30'
  },
  {
    id: 'real-estate-showcase',
    name: 'Real Estate Showcase',
    tagline: 'Cinematic Tour',
    mode: 'Cinematic Brand Trailer',
    spec: '30s • YouTube • Max Quality',
    details: 'Hollywood block-buster orange-and-teal grading, smooth gimbal panning, film light leaks, and ambient piano sync.',
    badgeColor: 'border-brand-amber/20 text-brand-amber bg-brand-amber/5',
    glowColor: 'group-hover:border-brand-amber/30'
  },
  {
    id: 'travel-reel',
    name: 'Travel Reel',
    tagline: 'Vlog & Adventure',
    mode: 'Street Pulse Edit',
    spec: '15s • TikTok • Fast Transcode',
    details: 'Handheld camera shake, tape noise glitched transitions, vintage film grain overlays, and boom-bap hip-hop cuts.',
    badgeColor: 'border-brand-green/20 text-brand-green bg-brand-green/5',
    glowColor: 'group-hover:border-brand-green/30'
  },
  {
    id: 'viral-reel',
    name: 'Viral Reel',
    tagline: 'Phonk Social Intro',
    mode: 'Boss Entrance',
    spec: '5s • Reels • Fast Transcode',
    details: 'Neon font outlines, rotoscope edge glows on high-energy freeze frames, and aggressive cowboy phonk cowbell hits.',
    badgeColor: 'border-white/25 text-white bg-white/5',
    glowColor: 'group-hover:border-white/30'
  }
];

// Commercial Use Cases replacing testimonials
const USE_CASES = [
  {
    title: 'Automotive Marketing',
    preset: 'BMW Commercial preset',
    benefit: 'Saves 4 hours per video edit',
    description: 'Deploys deep teal/gold grading and speed ramping curves automatically, compiling standard running clips into dealer-ready commercials.'
  },
  {
    title: 'Editorial Runway Launches',
    preset: 'Luxury Fashion preset',
    benefit: '80% workflow reduction',
    description: 'Applies precise low-saturated portrait grids and clean rhythm-snapped jump cuts, converting raw model runway feeds into highly styled social reels.'
  },
  {
    title: 'Consumer Tech Promos',
    preset: 'Product Reveal preset',
    benefit: 'No manual keyframing required',
    description: 'Generates macro device detail sweeps, digital overlay lines, and sound effects to showcase hardware products with zero manual sound design.'
  }
];

export default function LandingPage() {
  const [waitlist, setWaitlist] = useState({
    name: '',
    email: '',
    role: 'creator',
    useCase: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{
    submitted: boolean;
    position: number;
    email: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    // Check if user has already submitted waitlist in this browser session
    const storedSub = localStorage.getItem('cineforge_waitlist_submitted');
    if (storedSub) {
      try {
        setSubmittedData(JSON.parse(storedSub));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlist.email || !waitlist.name) return;

    setIsSubmitting(true);
    // Short artificial delay for premium interface responsiveness feel
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      const existing = localStorage.getItem('cineforge_waitlist');
      const list = existing ? JSON.parse(existing) : [];
      
      const newEntry = {
        ...waitlist,
        createdAt: new Date().toISOString(),
      };
      
      list.push(newEntry);
      localStorage.setItem('cineforge_waitlist', JSON.stringify(list));

      const position = 17 + list.length;
      const subInfo = {
        submitted: true,
        position,
        email: waitlist.email,
        role: waitlist.role,
      };

      localStorage.setItem('cineforge_waitlist_submitted', JSON.stringify(subInfo));
      setSubmittedData(subInfo);
    } catch (err) {
      alert('Failed to register: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-space-black relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-radial from-brand-cyan/5 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-radial from-brand-violet/5 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-[600px] h-[600px] bg-radial from-brand-magenta/3 to-transparent blur-3xl pointer-events-none"></div>

      {/* 1. HERO SECTION */}
      <section className="relative pt-16 pb-8 md:pt-24 md:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center gap-6 md:gap-8 z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
          <span>PHASE P2: CONVERSION & PRESENTATION CHANNELS LIVE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-4xl leading-[1.15] font-sans">
          Turn raw clips into <br />
          <span className="bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-magenta bg-clip-text text-transparent">
            platform-ready cinematic content
          </span> <br />
          with one click.
        </h1>

        <p className="text-sm md:text-base text-gray-400 max-w-2xl leading-relaxed">
          Upload footage, choose a style, and let CineForge generate the pacing, cuts, color grade, and final render automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-2 w-full sm:w-auto">
          <Link
            href="/demo"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] cursor-pointer hover:scale-[1.02]"
          >
            Start Demo Now <Play className="w-4 h-4 fill-space-black" />
          </Link>
          <a
            href="#presets"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            Explore Presets
          </a>
        </div>
      </section>

      {/* 2. AESTHETIC METRIC BAR */}
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 mb-12 md:mb-16 z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 p-4 rounded-xl border border-white/5 bg-[#05050a]/40 backdrop-blur-md text-center font-mono">
          <div className="p-3 border-r border-white/5 last:border-0 flex flex-col gap-0.5">
            <span className="text-xl md:text-2xl font-black text-brand-cyan">4.38×</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">Fast Rendering</span>
          </div>
          <div className="p-3 md:border-r border-white/5 last:border-0 flex flex-col gap-0.5">
            <span className="text-xl md:text-2xl font-black text-brand-violet">6</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">Style Presets</span>
          </div>
          <div className="p-3 border-r border-white/5 last:border-0 flex flex-col gap-0.5">
            <span className="text-xl md:text-2xl font-black text-brand-magenta">&lt;2 Min</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">Demo Journey</span>
          </div>
          <div className="p-3 flex flex-col gap-0.5">
            <span className="text-xl md:text-2xl font-black text-brand-amber">95/100</span>
            <span className="text-[9px] text-gray-400 uppercase tracking-widest">QA Readiness</span>
          </div>
        </div>
      </section>

      {/* 3. WHO IS THIS FOR? SECTION */}
      <section className="py-12 md:py-16 border-t border-white/5 bg-space-dark/10 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Who is CineForge for?
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-2">
              Calibrated to automate video editing across high-growth content sectors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Creators Card */}
            <div className="glass-panel border border-white/5 bg-space-card/20 rounded-xl p-6 flex flex-col gap-3 hover:border-brand-cyan/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-100 mt-2">Creators</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Create reels, shorts, and promos faster. Focus entirely on capturing and storytelling while CineForge automates the tedious cuts and timing.
              </p>
            </div>

            {/* Agencies Card */}
            <div className="glass-panel border border-white/5 bg-space-card/20 rounded-xl p-6 flex flex-col gap-3 hover:border-brand-violet/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-brand-violet/10 border border-brand-violet/20 flex items-center justify-center text-brand-violet">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-100 mt-2">Agencies</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Scale content production operations without scaling editors. Deliver professional, highly-calibrated short-form campaigns for multiple client accounts.
              </p>
            </div>

            {/* Brands Card */}
            <div className="glass-panel border border-white/5 bg-space-card/20 rounded-xl p-6 flex flex-col gap-3 hover:border-brand-magenta/20 transition-all duration-300 group">
              <div className="w-10 h-10 rounded-lg bg-brand-magenta/10 border border-brand-magenta/20 flex items-center justify-center text-brand-magenta">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-100 mt-2">Brands</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Generate premium social media content from existing b-roll. Turn raw product footage and raw assets into high-converting organic video ads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BEFORE VS AFTER SHOWCASE SECTION */}
      <section className="py-16 md:py-20 border-t border-white/5 bg-space-dark/20 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <Eye className="w-6 h-6 text-brand-cyan" />
              Before & After Render Reality
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-2">
              No simulation. Review the raw video input side-by-side with an actual rendered output compile.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            {/* Raw Footage Player (Left/Cols 2) */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-[10px] text-gray-500 px-1">
                <span>INPUT SOURCE: PROMO.MP4</span>
                <span className="uppercase text-gray-400 bg-white/5 border border-white/15 px-1.5 py-0.5 rounded">Raw Footage</span>
              </div>
              <div className="relative w-full aspect-[9/16] rounded-xl border border-white/10 overflow-hidden bg-black shadow-lg">
                <video 
                  src="/uploads/promo.mp4"
                  className="w-full h-full object-cover opacity-70"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-4 left-4 font-mono text-xs text-white bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
                  Flat profile, unedited b-roll
                </div>
              </div>
            </div>

            {/* Metrics Panel (Center/Col 1) */}
            <div className="lg:col-span-1 flex flex-col gap-4 text-center font-mono py-6 lg:py-0">
              <div className="text-gray-500 text-[10px] tracking-wider">REAL RENDER METRICS</div>
              
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[9px] text-gray-500 block">TRANSCODE SPEED</span>
                  <span className="text-xs text-brand-cyan font-bold">18.7s</span>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[9px] text-gray-500 block">EDITDNA MODE</span>
                  <span className="text-xs text-brand-violet font-bold truncate block font-sans">Luxury Demon</span>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[9px] text-gray-500 block">PLATFORM TARGET</span>
                  <span className="text-xs text-brand-magenta font-bold">9:16 Shorts</span>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[9px] text-gray-500 block">DURATION CLAMP</span>
                  <span className="text-xs text-brand-amber font-bold">15.0s</span>
                </div>
              </div>

              <div className="hidden lg:flex justify-center items-center text-brand-cyan">
                <ArrowRight className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            {/* Rendered Output Player (Right/Cols 2) */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="flex items-center justify-between font-mono text-[10px] text-brand-cyan px-1">
                <span>OUTPUT FILE: OUTPUT-CONCURRENCY-1.MP4</span>
                <span className="uppercase text-brand-cyan bg-brand-cyan/15 border border-brand-cyan/35 px-1.5 py-0.5 rounded font-extrabold">CineForge Master</span>
              </div>
              <div className="relative w-full aspect-[9/16] rounded-xl border border-brand-cyan/20 overflow-hidden bg-black shadow-[0_0_30px_rgba(0,243,255,0.08)]">
                <video 
                  src="/renders/output-concurrency-1.mp4"
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-4 left-4 font-mono text-xs text-brand-cyan bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-brand-cyan/25 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-cyan" /> Speed Ramps + Color Grade Synced
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HERO MOCKUP: COMMAND CENTER */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-20 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <Cpu className="w-6 h-6 text-brand-violet" />
            Directorial Timeline Command Center
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-2">
            Inspect the underlying synchronization dashboard. Monitor multi-track timelines mapping video cuts to audio BPM peaks.
          </p>
        </div>
        <HeroCommandCenter />
      </section>

      {/* 6. HOW IT WORKS SECTION */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Operational Protocol
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-2">
            The automated pipeline from raw asset uploads to finished cinematic renders.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center font-mono">
          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center hover:border-brand-cyan/25 transition-all duration-300">
            <span className="text-[10px] text-brand-cyan font-bold bg-brand-cyan/10 px-2 py-0.5 rounded-full border border-brand-cyan/20">STEP 01</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Upload Video</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Stage a local b-roll file or click "Use Demo Video" to instant-stage our pre-loaded 15s mp4 source.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center hover:border-brand-violet/25 transition-all duration-300">
            <span className="text-[10px] text-brand-violet font-bold bg-brand-violet/10 px-2 py-0.5 rounded-full border border-brand-violet/20">STEP 02</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">AI Builds Edit DNA</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Directorial models digest your prompt to compile a structured timeline of cut bounds, ramps, and grades.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center hover:border-brand-magenta/25 transition-all duration-300">
            <span className="text-[10px] text-brand-magenta font-bold bg-brand-magenta/10 px-2 py-0.5 rounded-full border border-brand-magenta/20">STEP 03</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Preview Timeline</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Seek and play fast-seek draft clips. Check cut alignments snapped to peak soundtrack transients.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center hover:border-brand-amber/25 transition-all duration-300">
            <span className="text-[10px] text-brand-amber font-bold bg-brand-amber/10 px-2 py-0.5 rounded-full border border-brand-amber/20">STEP 04</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Render Output</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Dispatch task to the queue. Watch real-time rendering compile the final video using GPU-accelerated QSV.
            </p>
          </div>
        </div>
      </section>

      {/* 7. PRESET PRODUCT SHOWCASE */}
      <section id="presets" className="border-t border-white/5 bg-space-dark/30 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <Star className="w-6 h-6 text-brand-magenta" />
              Style Preset Editions
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-2">
              Explore presets engineered as standalone products. Each template applies strict directorial guidelines to source video grids.
            </p>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LANDING_PRESETS.map((preset) => (
              <div 
                key={preset.id}
                className="glass-panel rounded-xl border border-white/5 bg-space-card/20 flex flex-col overflow-hidden hover:border-white/10 transition-all duration-300 group shadow-lg p-5 gap-4 relative"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-mono font-bold tracking-widest px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                    {preset.tagline.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono text-gray-500">{preset.spec}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-white tracking-wide group-hover:text-brand-cyan transition-colors">
                    {preset.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono">
                    Directorial Mode: <code className="text-brand-violet font-semibold">{preset.mode}</code>
                  </p>
                </div>

                <p className="text-xs text-gray-300 font-sans leading-relaxed min-h-[54px]">
                  {preset.details}
                </p>

                <div className="border-t border-white/5 pt-3 mt-1 flex justify-between items-center">
                  <Link 
                    href={`/demo?preset=${preset.id}`}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-cyan hover:text-brand-magenta transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Launch Preset Demo <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* 8. COMMERCIAL USE CASES PANEL (Replacing mock testimonials) */}
          <div className="mt-20 border-t border-white/5 pt-16">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="text-[9px] font-mono tracking-widest text-brand-cyan bg-brand-cyan/5 border border-brand-cyan/25 px-2.5 py-1 rounded uppercase font-extrabold">COMMERCIAL VIABILITY</span>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-4">Example Use Cases</h3>
              <p className="text-xs text-gray-400 mt-2">
                Real-world deployments illustrating the performance and efficiency gains of the CineForge edit automation model.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              {USE_CASES.map((useCase, idx) => (
                <div key={idx} className="p-5 rounded-xl border border-white/5 bg-[#05050a]/60 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px] text-brand-cyan border-b border-white/5 pb-2">
                    <span>{useCase.title.toUpperCase()}</span>
                    <span className="text-brand-green font-bold">{useCase.benefit}</span>
                  </div>
                  <div className="text-gray-400 text-[9px] flex gap-1 items-center font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green shrink-0" />
                    <span>Using {useCase.preset}</span>
                  </div>
                  <p className="text-gray-300 font-sans leading-relaxed text-xs">
                    {useCase.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 9. Waitlist Early Access Form */}
      <section className="py-16 md:py-24 max-w-3xl mx-auto px-4 z-10">
        <div className="glass-panel border border-white/10 bg-[#07070e]/80 rounded-2xl p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col gap-6">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-magenta"></div>
          
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Request early beta access</h2>
            <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
              Register to join the testing queue for the multi-user cloud workspace. Get notified when dedicated rendering credits are allocated to your profile.
            </p>
          </div>

          {submittedData ? (
            <div className="p-5 rounded-xl border border-brand-green/20 bg-brand-green/5 text-left font-mono space-y-4">
              <div className="flex items-center gap-2 text-brand-green font-sans">
                <Check className="w-5 h-5 text-brand-green shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest font-mono">SECURE BETA CONNECTION CONFIRMED</span>
              </div>
              <div className="border-t border-brand-green/10 pt-3 space-y-2 text-[10px] text-gray-300 leading-normal">
                <p>&gt; Ingesting user registers: <code className="text-brand-cyan">{submittedData.email}</code></p>
                <p>&gt; Assigned priority category: <code className="text-brand-violet font-semibold">{submittedData.role.toUpperCase()}</code></p>
                <p>&gt; Waitlist Position: <code className="text-brand-amber font-bold">#{submittedData.position}</code></p>
                <p>&gt; Status: <code className="text-brand-green font-bold">ACTIVE WAITLIST PIPELINE INGESTED.</code></p>
              </div>
              <p className="text-xs text-gray-400 font-sans leading-relaxed pt-2">
                Welcome to the CineForge beta network. We have logged your request. We will dispatch your access instructions and beta key via email once a rendering node becomes available.
              </p>
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Your Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      id="name"
                      type="text" 
                      required
                      placeholder="e.g. John Doe"
                      value={waitlist.name}
                      onChange={(e) => setWaitlist({...waitlist, name: e.target.value})}
                      className="w-full bg-space-black border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/60 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      id="email"
                      type="email" 
                      required
                      placeholder="e.g. john@agency.com"
                      value={waitlist.email}
                      onChange={(e) => setWaitlist({...waitlist, email: e.target.value})}
                      className="w-full bg-space-black border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/60 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="role" className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Your Role</label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="role"
                      value={waitlist.role}
                      onChange={(e) => setWaitlist({...waitlist, role: e.target.value})}
                      className="w-full bg-space-black border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-cyan/60 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="creator">Content Creator</option>
                      <option value="agency">Media Agency</option>
                      <option value="brand">Brand / E-commerce</option>
                      <option value="investor">Investor / Partner</option>
                      <option value="developer">Developer / Engineer</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="useCase" className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">Primary Use Case</label>
                  <div className="relative">
                    <MessageSquare className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      id="useCase"
                      type="text" 
                      placeholder="e.g. Scaling automotive ads"
                      value={waitlist.useCase}
                      onChange={(e) => setWaitlist({...waitlist, useCase: e.target.value})}
                      className="w-full bg-space-black border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan/60 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,243,255,0.1)] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-space-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Establishing connection...
                  </>
                ) : (
                  "Submit Early Access Request"
                )}
              </button>
            </form>
          )}

        </div>
      </section>

      {/* 10. FOOTER COMPLIANCE */}
      <footer className="border-t border-white/5 py-12 bg-space-black/90 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 items-center">
          <RightsSafetyNotice />
          <div className="text-[10px] font-mono text-gray-500 mt-4">
            &copy; {new Date().getFullYear()} CINEFORGE. ALL SYSTEMS CONFIGURED. SYSTEM OPERATING IN DEMO PHASE P2 STAGE.
          </div>
        </div>
      </footer>
    </div>
  );
}
