"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Activity, Cpu, Terminal, Layers } from 'lucide-react';

export default function HeroCommandCenter() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [frameCode, setFrameCode] = useState('00:00:08:14');
  const [logs, setLogs] = useState<string[]>([
    'EditDNA Engine initialized.',
    'Running Media Analysis on demon_reveal_raw.mp4...',
    'Visual motion vectors mapped (60fps dynamic range).',
    'Beat transients synched at 2.4s, 6.8s, and 12.1s.'
  ]);

  // Tick timecode for demo playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        const date = new Date();
        const mins = String(date.getMinutes()).padStart(2, '0');
        const secs = String(date.getSeconds() % 15).padStart(2, '0');
        const frames = String(Math.floor(Math.random() * 30)).padStart(2, '0');
        setFrameCode(`00:${mins}:${secs}:${frames}`);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Rotate log lines for terminal feed simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        const events = [
          'Calculated speed ramp curves (400% -> 50% shift).',
          'Applying chiaroscuro grading model: Luxury Demon.',
          'Injecting volumetric fog rendering coordinates.',
          'Syncing audio transitions with sub-bass drop targets.',
          'VFX overlay: gold reflection tracing activated.',
          'Analyzing safe-zone compliance for TikTok Reels.'
        ];
        const nextLog = events[Math.floor(Math.random() * events.length)];
        setLogs((prev) => [...prev.slice(1), nextLog]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-white/10 bg-space-dark/80 p-3 md:p-5 shadow-[0_0_80px_rgba(0,243,255,0.06)] relative overflow-hidden glass-panel">
      {/* Corner crosshairs to emphasize tech look */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/20"></div>
      <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/20"></div>
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/20"></div>
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/20"></div>

      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-10">
        
        {/* LEFT COLUMN: Cinematic Preview Panel Monitor */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[#020204] rounded-xl border border-white/5 overflow-hidden relative flex flex-col justify-between p-3 min-h-[260px] md:min-h-[340px]">
            {/* Screen static and grid overlays */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none z-10 opacity-30"></div>
            
            {/* Top monitor bar */}
            <div className="flex items-center justify-between text-[9px] font-mono text-gray-500 z-20">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
                MONITOR FEED: SOURCE_TRACK_1
              </span>
              <span className="text-brand-magenta font-semibold tracking-wide">
                EDITDNA PREVIEW ACTIVE
              </span>
            </div>

            {/* Simulated cinematic frame */}
            <div className="my-auto self-center relative border border-white/10 w-full max-w-[420px] aspect-video flex flex-col justify-between p-2 overflow-hidden bg-space-black shadow-2xl shadow-black/80">
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan/5 via-brand-magenta/5 to-transparent"></div>
              
              <div className="flex justify-between items-center text-[8px] font-mono text-gray-400 z-10">
                <span>RAW REC</span>
                <span className="text-brand-cyan">{frameCode}</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 text-center z-10">
                <span className="text-[9px] font-mono text-brand-cyan tracking-wider font-bold uppercase mb-1">
                  Luxury Demon Reveal Cut
                </span>
                <span className="text-[10px] text-gray-400 font-mono italic">
                  "slow reveal, epic sub drop..."
                </span>
                
                {/* Audio visualizer peaks */}
                {isPlaying && (
                  <div className="flex gap-1 mt-4 h-6 items-end">
                    <span className="w-0.5 bg-brand-cyan h-3 animate-waveform"></span>
                    <span className="w-0.5 bg-brand-cyan h-5 animate-waveform" style={{ animationDelay: '0.1s' }}></span>
                    <span className="w-0.5 bg-brand-cyan h-2 animate-waveform" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-0.5 bg-brand-cyan h-6 animate-waveform" style={{ animationDelay: '0.3s' }}></span>
                    <span className="w-0.5 bg-brand-cyan h-4 animate-waveform" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-[8px] font-mono text-gray-400 z-10">
                <span>PLATFORM: TIKTOK (9:16 CROP)</span>
                <span>4K ULTRA HD MASTER</span>
              </div>
            </div>

            {/* Bottom playback dashboard */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 z-20">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 rounded bg-white/5 text-gray-300 hover:text-white cursor-pointer hover:bg-white/10"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <div className="h-1 bg-white/10 rounded flex-1 mx-3 relative">
                <div 
                  className="absolute top-0 bottom-0 bg-brand-cyan rounded transition-all duration-100" 
                  style={{ width: isPlaying ? '58%' : '30%' }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-glow"></div>
                </div>
              </div>
              <span className="text-[9px] font-mono text-gray-400">15.0s</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Director Console & Stats */}
        <div className="flex flex-col gap-4 justify-between">
          {/* AI Director Console Output */}
          <div className="bg-[#020204] rounded-xl border border-white/5 p-4 flex flex-col flex-1 min-h-[160px]">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-3">
              <Terminal className="w-3.5 h-3.5 text-brand-cyan" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-gray-400">EDITDNA SYSTEM LOGS</span>
            </div>
            
            <div className="flex flex-col gap-2 font-mono text-[10px] text-gray-400 flex-1 overflow-hidden leading-normal">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-brand-cyan shrink-0">&gt;</span>
                  <span className={idx === logs.length - 1 ? 'text-gray-200 font-semibold' : ''}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Core Engine diagnostics */}
          <div className="glass-panel border border-white/5 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[9px] font-mono text-gray-500">
              <span>SYSTEM DIAGNOSTICS</span>
              <span className="text-brand-green">STABLE</span>
            </div>

            <div className="flex flex-col gap-2 text-[10px] font-mono text-gray-400">
              <div className="flex justify-between items-center bg-white/[0.01] p-1.5 rounded border border-white/5">
                <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-brand-cyan" /> Blueprint Engine</span>
                <span className="text-brand-cyan">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.01] p-1.5 rounded border border-white/5">
                <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-brand-amber" /> Media Analysis</span>
                <span className="text-brand-amber animate-pulse">PREPARING</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.01] p-1.5 rounded border border-white/5">
                <span className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-brand-magenta" /> Render Route</span>
                <span className="text-brand-magenta">PENDING CONNECTION</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM TRACKS: Video editing lane track mockup */}
      <div className="border-t border-white/5 mt-4 pt-4 relative z-10 flex flex-col gap-3 font-mono text-[9px]">
        <div className="flex items-center justify-between text-gray-500 mb-1">
          <span>EDITDNA FLOW TRACKS</span>
          <span>COMPLIANCE CHECK: VERIFIED</span>
        </div>

        {/* Timeline Visual Track row */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-gray-400 text-right">VISUALS:</span>
          <div className="flex-1 bg-white/5 rounded border border-white/5 p-1 flex gap-1 h-7">
            <div className="w-[30%] bg-brand-cyan/20 border border-brand-cyan/30 rounded flex items-center justify-center text-[8px] text-brand-cyan font-bold truncate px-1">
              HOOK [0.0 - 2.5s]
            </div>
            <div className="w-[45%] bg-brand-cyan/15 border border-brand-cyan/20 rounded flex items-center justify-center text-[8px] text-brand-cyan font-bold truncate px-1">
              INTRO / DETAIL DYNAMICS
            </div>
            <div className="w-[25%] bg-brand-cyan/30 border border-brand-cyan/40 rounded flex items-center justify-center text-[8px] text-brand-cyan font-bold truncate px-1">
              DROP PAYOFF
            </div>
          </div>
        </div>

        {/* Timeline Audio Track row */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-gray-400 text-right">AUDIO:</span>
          <div className="flex-1 bg-white/5 rounded border border-white/5 p-1 flex gap-1 h-7">
            <div className="w-[35%] bg-brand-magenta/15 border border-brand-magenta/20 rounded flex items-center justify-center text-[8px] text-brand-magenta font-bold truncate px-1">
              ATMOSPHERIC SWELL
            </div>
            <div className="w-[40%] bg-brand-magenta/20 border border-brand-magenta/30 rounded flex items-center justify-center text-[8px] text-brand-magenta font-bold truncate px-1">
              RISER BUILD-UP
            </div>
            <div className="w-[25%] bg-brand-magenta/35 border border-brand-magenta/40 rounded flex items-center justify-center text-[8px] text-brand-magenta font-bold truncate px-1">
              BASS DROP HIT
            </div>
          </div>
        </div>

        {/* Timeline Speed Ramp Track row */}
        <div className="flex items-center gap-2">
          <span className="w-16 text-gray-400 text-right">SPEED RAMP:</span>
          <div className="flex-1 bg-white/5 rounded border border-white/5 p-1 flex gap-1 h-7">
            <div className="w-[30%] bg-brand-amber/15 border border-brand-amber/20 rounded flex items-center justify-center text-[8px] text-brand-amber font-bold truncate px-1">
              FAST-IN (200%)
            </div>
            <div className="w-[45%] bg-brand-amber/20 border border-brand-amber/30 rounded flex items-center justify-center text-[8px] text-brand-amber font-bold truncate px-1">
              SLOW MOTION (40%)
            </div>
            <div className="w-[25%] bg-brand-amber/35 border border-brand-amber/40 rounded flex items-center justify-center text-[8px] text-brand-amber font-bold truncate px-1">
              {"HYPER-RAMP (400% -> 25%)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
