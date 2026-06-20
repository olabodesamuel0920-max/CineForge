"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, HelpCircle, Sliders, Info, ShieldAlert, Check } from 'lucide-react';
import { EditDNABlueprint, MaxQualitySettings } from '@/types/project';

interface MaxQualitySettingsPanelProps {
  blueprint: EditDNABlueprint;
  onChange: (newSettings: MaxQualitySettings) => void;
}

export default function MaxQualitySettingsPanel({ blueprint, onChange }: MaxQualitySettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Resolve current settings with default fallbacks
  const settings: MaxQualitySettings = blueprint.maxQualitySettings || {
    stabilization: false,
    denoise: false,
    sharpen: false,
    colorRecovery: false,
    upscaleFactor: 'none',
    resolution: '1080p'
  };

  const updateSetting = (key: keyof MaxQualitySettings, value: any) => {
    const updated = {
      ...settings,
      [key]: value
    };
    onChange(updated);
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-3">
      {/* Header Toggle */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none"
      >
        <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" /> MAXQUALITY ENGINE (G5.1)
        </h3>
        <span className="text-[10px] font-mono text-gray-500">
          {isExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            {/* Honest Positioning & Disclosure box */}
            <div className="p-3 rounded-lg bg-brand-cyan/5 border border-brand-cyan/10 flex gap-2">
              <Info className="w-4.5 h-4.5 text-brand-cyan shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
                AI restoration cleans, stabilizes, and sharpens low-quality input clips. 
                <span className="text-gray-300 font-bold block mt-1">
                  Note: CineForge restores and enhances existing pixels. It cannot recreate real-world detail that was never captured.
                </span>
              </p>
            </div>

            {/* Resolution Scaling Ladder */}
            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
              <span className="text-gray-400 font-bold">EXPORT RESOLUTION</span>
              <div className="grid grid-cols-3 gap-2">
                {(['720p', '1080p', '4K'] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => updateSetting('resolution', res)}
                    className={`py-2 rounded font-bold uppercase transition-all text-[10px] cursor-pointer text-center border ${
                      settings.resolution === res
                        ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/35'
                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Experimental resolution indicators (disabled render paths) */}
            <div className="flex flex-col gap-1 font-mono text-[10px] text-gray-600 bg-black/10 p-2 rounded border border-white/[0.01]">
              <div className="flex justify-between items-center">
                <span>8K Cinematic Export</span>
                <span className="text-[8px] bg-white/5 px-1 py-0.2 rounded uppercase tracking-wider">Coming in G5.3</span>
              </div>
              <div className="flex justify-between items-center">
                <span>16K Ultra-Res [Experimental]</span>
                <span className="text-[8px] bg-white/5 px-1 py-0.2 rounded uppercase tracking-wider">Coming in G5.3</span>
              </div>
            </div>

            {/* Classical Enhancements settings list */}
            <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
              <span className="text-[10px] font-mono text-gray-500 font-bold tracking-wider">FOUNDATION ENHANCEMENTS</span>
              
              {/* Stabilization */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-300">Footage Stabilization</span>
                  <span className="text-[9px] text-gray-500">2-pass VidStab / Deshake fallback</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('stabilization', !settings.stabilization)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    settings.stabilization
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-white/5 text-gray-500 border border-white/5'
                  }`}
                >
                  {settings.stabilization ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Denoise */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-300">Denoise filter</span>
                  <span className="text-[9px] text-gray-500">Remove sensor & compression grain</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('denoise', !settings.denoise)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    settings.denoise
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-white/5 text-gray-500 border border-white/5'
                  }`}
                >
                  {settings.denoise ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Sharpening */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-300">Improve Clarity</span>
                  <span className="text-[9px] text-gray-500">Conservative unsharp sharpening</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('sharpen', !settings.sharpen)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    settings.sharpen
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-white/5 text-gray-500 border border-white/5'
                  }`}
                >
                  {settings.sharpen ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Color Recovery */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-300">Color Recovery</span>
                  <span className="text-[9px] text-gray-500">Subtle eq contrast/saturation boost</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('colorRecovery', !settings.colorRecovery)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                    settings.colorRecovery
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                      : 'bg-white/5 text-gray-500 border border-white/5'
                  }`}
                >
                  {settings.colorRecovery ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* AI Upscale Placeholder Warning */}
            <div className="mt-2 border-t border-white/5 pt-3 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-gray-500 font-bold">NEURAL PATHWAYS</span>
              <div className="p-2.5 rounded bg-brand-violet/5 border border-brand-violet/15 flex gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-violet shrink-0 mt-0.5" />
                <span className="text-[9px] text-brand-violet/85 leading-normal font-mono">
                  Neural Detail Upscaling (2x/4x) is currently locked. It will be enabled in Phase G5.2.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
