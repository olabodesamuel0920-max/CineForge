"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Play, Film, Cpu, Sparkles, Wand2, Server, HelpCircle, HardDrive } from 'lucide-react';
import HeroCommandCenter from '@/components/HeroCommandCenter';
import EditModeCard from '@/components/EditModeCard';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';
import { CINEFORGE_MODES } from '@/lib/cineforgeModes';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-space-black relative">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-radial from-brand-cyan/5 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-radial from-brand-violet/5 to-transparent blur-3xl pointer-events-none"></div>

      {/* 1. HERO SECTION */}
      <section className="relative pt-16 pb-12 md:pt-24 md:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center gap-6 md:gap-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
          <span>PHASE 1A: FEEDS & BLUEPRINTS ONLINE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-4xl leading-[1.1] font-sans">
          Your AI Edit Director for <br />
          <span className="bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-magenta bg-clip-text text-transparent">
            Cinematic Short-Form Videos
          </span>
        </h1>

        <p className="text-sm md:text-base text-gray-400 max-w-3xl leading-relaxed">
          Upload your media, choose a CineForge mode, activate Max Quality Mode, and generate a cinematic edit blueprint with cuts, speed ramps, VFX direction, captions, color grade, beat timing, and export strategy.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-2 w-full sm:w-auto">
          <Link
            href="/studio"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,243,255,0.2)] cursor-pointer"
          >
            Enter Studio <Play className="w-4 h-4 fill-space-black" />
          </Link>
          <a
            href="#modes"
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            Explore CineForge Modes
          </a>
        </div>
      </section>

      {/* 2. HERO MOCKUP: COMMAND CENTER */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-24">
        <HeroCommandCenter />
      </section>

      {/* 3. CINEFORGE MODES SECTION */}
      <section id="modes" className="border-t border-white/5 bg-space-dark/30 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Tailored Cinematic Modes
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-2">
              Select from specialized EditDNA profiles. Each mode applies native pacing, color grids, and audio transitions calibrated for viral aesthetics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CINEFORGE_MODES.map((mode) => (
              <EditModeCard
                key={mode.id}
                mode={mode}
                isSelected={false}
                onSelect={() => {}}
                showSelector={false}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Operational Protocol
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-2">
            The step-by-step workflow from raw files to render-ready blueprints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-center font-mono">
          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center">
            <span className="text-[10px] text-brand-cyan font-bold bg-brand-cyan/10 px-2 py-0.5 rounded-full border border-brand-cyan/20">STEP 01</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Upload Media</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Drop your raw video or image. The platform parses file parameters and prepares structural mapping files.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center">
            <span className="text-[10px] text-brand-violet font-bold bg-brand-violet/10 px-2 py-0.5 rounded-full border border-brand-violet/20">STEP 02</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Choose Mode</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Select one of the 8 CineForge modes to define the core visual signature, sound profile, and pacing model.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center">
            <span className="text-[10px] text-brand-magenta font-bold bg-brand-magenta/10 px-2 py-0.5 rounded-full border border-brand-magenta/20">STEP 03</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">DNA Blueprint</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              The EditDNA Engine matches your edit prompt and mode, structuring visual timelines, cuts, and audio triggers.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center">
            <span className="text-[10px] text-brand-amber font-bold bg-brand-amber/10 px-2 py-0.5 rounded-full border border-brand-amber/20">STEP 04</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Max Quality</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Toggle Max Quality Mode to trigger details upscaling (4K AI reconstruction) and 60fps frame interpolation plans.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/5 bg-space-card/20 flex flex-col gap-3 items-center">
            <span className="text-[10px] text-brand-green font-bold bg-brand-green/10 px-2 py-0.5 rounded-full border border-brand-green/20">STEP 05</span>
            <h3 className="text-sm font-semibold text-gray-200 mt-1">Render Ready</h3>
            <p className="text-[11px] text-gray-400 leading-normal">
              Project is committed to local storage, mapping visual track layers ready for cloud export or GPU compiles.
            </p>
          </div>
        </div>
      </section>

      {/* 5. PLATFORM ENGINES */}
      <section className="border-t border-white/5 bg-space-dark/20 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              The Intelligence Layer
            </h2>
            <p className="text-xs md:text-sm text-gray-400 mt-2">
              Inside the CineForge core are 6 dedicated sub-engines driving your project blueprints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-cyan">
                <Cpu className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">EditDNA Engine</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                The core structural compiler. Encodes timestamps, maps raw edit blocks, specifies cut rhythm thresholds, and designs frame-by-frame pacing curves.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-violet">
                <Wand2 className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">AI Director Engine</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Translates descriptive inputs. Aligning user intent, story prompts, and mood requests with suitable visual hooks and transitions.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-magenta">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">Max Quality Engine</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Maps frame interpolation instructions, details deep detail upscaling runs, resolves macro resolution maps, and generates HDR color metadata coordinates.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-amber">
                <Film className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">VFX Enhancement Engine</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Calculates lighting overlays. Specifies glare sweeps, chromatic shifts, anamorphic lens flares, and edge glows tracking subject outlines on cuts.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand-green">
                <Server className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">Render Router</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Handles encoding handoffs. Packs blueprint assets, validates target bitrates, monitors node logs, and queues final export actions.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-white/5 bg-space-card/30 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-gray-400">
                <HardDrive className="w-4 h-4" />
                <h3 className="font-bold text-gray-200">Memory Engine</h3>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Retains user styling standards, past clip pacing, aspect preferences, and platform rules to optimize subsequent edit prompts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOOTER COMPLIANCE */}
      <footer className="border-t border-white/5 py-12 bg-space-black/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 items-center">
          <RightsSafetyNotice />
          <div className="text-[10px] font-mono text-gray-500 mt-4">
            &copy; {new Date().getFullYear()} CINEFORGE. ALL SYSTEMS CONFIGURED. SYSTEM OPERATING IN LOCAL PHASE 1A STAGE.
          </div>
        </div>
      </footer>
    </div>
  );
}
