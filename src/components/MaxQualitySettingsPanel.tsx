"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Info, ShieldAlert, AlertTriangle, CheckSquare, Square, Lock, HelpCircle } from 'lucide-react';
import { EditDNABlueprint, MaxQualitySettings, ProjectDuration } from '@/types/project';

interface MaxQualitySettingsPanelProps {
  blueprint: EditDNABlueprint;
  onChange: (newSettings: MaxQualitySettings) => void;
  projectDuration?: ProjectDuration;
}

export default function MaxQualitySettingsPanel({ blueprint, onChange, projectDuration = '10s' }: MaxQualitySettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [optInConfirmed, setOptInConfirmed] = useState(false);
  const [isFaceRestoreUnlocked, setIsFaceRestoreUnlocked] = useState(false);

  // Check guarded flag for experimental face restoration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasQuery = window.location.search.includes('experimental=true');
      const hasStorage = localStorage.getItem('cf_experimental_g52') === 'true';
      setIsFaceRestoreUnlocked(hasQuery || hasStorage);
    }
  }, []);

  // Resolve current settings with default fallbacks
  const settings: MaxQualitySettings = {
    stabilization: false,
    denoise: false,
    sharpen: false,
    colorRecovery: false,
    upscaleFactor: 'none',
    resolution: '1080p',
    neuralUpscale: false,
    aiUpscaleFactor: 'none',
    aiBudgetCap: 1.00,
    faceRestoration: false,
    ...blueprint.maxQualitySettings
  };

  // Sync local opt-in confirmation with blueprint state
  useEffect(() => {
    if (settings.neuralUpscale) {
      setOptInConfirmed(true);
    }
  }, [settings.neuralUpscale]);

  const updateSetting = (key: keyof MaxQualitySettings, value: any) => {
    const updated = {
      ...settings,
      [key]: value
    };

    // If neuralUpscale is toggled OFF, clear the upscale factor back to none
    if (key === 'neuralUpscale' && !value) {
      updated.aiUpscaleFactor = 'none';
    }
    // If neuralUpscale is toggled ON but factor was none, default to 2x
    if (key === 'neuralUpscale' && value && updated.aiUpscaleFactor === 'none') {
      updated.aiUpscaleFactor = '2x';
    }

    onChange(updated);
  };

  // Check if clip duration exceeds the 10-second guardrail for AI Upscaling
  const isDurationBlocked = projectDuration === '15s' || projectDuration === '30s';

  // Cost estimation logic
  const getEstimatedCost = (duration: string, factor: 'none' | '2x' | '4x'): number => {
    if (factor === 'none') return 0;
    const durSec = duration === '5s' ? 5 : duration === '10s' ? 10 : duration === '15s' ? 15 : 30;
    // 2x upscaling: $0.05 per video second
    // 4x upscaling: $0.07 per video second
    const rate = factor === '2x' ? 0.05 : 0.07;
    return durSec * rate;
  };

  const estimatedCost = getEstimatedCost(projectDuration, settings.neuralUpscale ? (settings.aiUpscaleFactor || '2x') : 'none');
  const showWarning = estimatedCost >= 0.50 && estimatedCost <= 1.00;
  const exceedsCap = estimatedCost > 1.00;

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-3">
      {/* Header Toggle */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none"
      >
        <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" /> MAXQUALITY ENGINE (G5.2A)
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

            {/* AI Neural Pathways Section */}
            <div className="mt-2 border-t border-white/5 pt-3 flex flex-col gap-3">
              <span className="text-[10px] font-mono text-gray-500 font-bold tracking-wider">NEURAL PATHWAYS (G5.2A)</span>

              {/* Neural Detail Upscale Toggle */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-300">AI Super-Resolution</span>
                  <span className="text-[9px] text-gray-500">Real-ESRGAN video neural upscale</span>
                </div>
                <button
                  type="button"
                  disabled={isDurationBlocked}
                  onClick={() => {
                    const nextVal = !settings.neuralUpscale;
                    if (nextVal && !optInConfirmed) {
                      // Handled by user toggling opt-in checkbox
                      return;
                    }
                    updateSetting('neuralUpscale', nextVal);
                  }}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all border ${
                    isDurationBlocked
                      ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                      : settings.neuralUpscale && optInConfirmed
                        ? 'bg-brand-violet/20 text-brand-violet border-brand-violet/30 cursor-pointer'
                        : 'bg-white/5 text-gray-500 border-white/5 cursor-pointer'
                  }`}
                >
                  {isDurationBlocked ? 'LOCKED' : settings.neuralUpscale && optInConfirmed ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Duration Block Message */}
              {isDurationBlocked && (
                <div className="p-2 rounded bg-red-950/20 border border-red-500/20 flex gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[9px] text-red-400/90 leading-normal font-mono">
                    AI Upscaling is restricted to clips under 10 seconds. (Current project duration: {projectDuration})
                  </span>
                </div>
              )}

              {/* Active Neural Controls */}
              {!isDurationBlocked && (
                <div className="flex flex-col gap-2">
                  {/* Opt-In Confirmation Checkbox */}
                  <div 
                    onClick={() => {
                      const nextConfirm = !optInConfirmed;
                      setOptInConfirmed(nextConfirm);
                      if (!nextConfirm) {
                        updateSetting('neuralUpscale', false);
                      } else {
                        updateSetting('neuralUpscale', true);
                      }
                    }}
                    className="flex items-start gap-2 cursor-pointer select-none group mt-1"
                  >
                    {optInConfirmed ? (
                      <CheckSquare className="w-4.5 h-4.5 text-brand-violet shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-300 shrink-0 mt-0.5" />
                    )}
                    <span className="text-[9px] text-gray-400 leading-tight font-mono group-hover:text-gray-300">
                      I opt-in to GPU AI processing. Acknowledge this consumes rendering budget.
                    </span>
                  </div>

                  {settings.neuralUpscale && optInConfirmed && (
                    <div className="pl-6 flex flex-col gap-3 border-l border-white/5 mt-1">
                      {/* Factor Selection */}
                      <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                        <span className="text-gray-500 font-bold uppercase">UPSCALING STRENGTH</span>
                        <div className="flex gap-2">
                          {(['2x', '4x'] as const).map((factor) => (
                            <button
                              key={factor}
                              type="button"
                              onClick={() => updateSetting('aiUpscaleFactor', factor)}
                              className={`px-3 py-1 rounded font-bold uppercase transition-all text-[9px] cursor-pointer border ${
                                settings.aiUpscaleFactor === factor
                                  ? 'bg-brand-violet/25 text-brand-violet border-brand-violet/40'
                                  : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {factor} Strength
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cost Estimate Telemetry */}
                      <div className="flex flex-col gap-1 font-mono text-[9px] p-2 bg-black/20 rounded border border-white/5">
                        <div className="flex justify-between items-center text-gray-400">
                          <span>Est. GPU processing cost:</span>
                          <span className={exceedsCap ? 'text-red-400 font-bold' : showWarning ? 'text-amber-400 font-bold' : 'text-brand-violet font-bold'}>
                            ${estimatedCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-500">
                          <span>Hard budget cap:</span>
                          <span>$1.00 max</span>
                        </div>

                        {/* Warnings */}
                        {showWarning && (
                          <div className="mt-1.5 flex gap-1 items-start text-[8px] text-amber-400/90 leading-tight">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Warning: Cost approaches/reaches the $0.50 notification limit.</span>
                          </div>
                        )}
                        {exceedsCap && (
                          <div className="mt-1.5 flex gap-1 items-start text-[8px] text-red-400/90 leading-tight">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            <span>Error: Cost exceeds the $1.00 hard budget cap! System will fall back to classical Lanczos.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Face Restoration (Guarded / Disabled) */}
              <div className="flex items-center justify-between text-[11px] font-mono border-t border-white/5 pt-3">
                <div className="flex flex-col">
                  <span className="text-gray-300 flex items-center gap-1">
                    Face Restoration {!isFaceRestoreUnlocked && <Lock className="w-3 h-3 text-gray-500" />}
                  </span>
                  <span className="text-[9px] text-gray-500">CodeFormer facial detail reconstruction</span>
                </div>
                <button
                  type="button"
                  disabled={!isFaceRestoreUnlocked}
                  onClick={() => updateSetting('faceRestoration', !settings.faceRestoration)}
                  className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all border ${
                    !isFaceRestoreUnlocked
                      ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                      : settings.faceRestoration
                        ? 'bg-brand-violet/20 text-brand-violet border-brand-violet/30 cursor-pointer'
                        : 'bg-white/5 text-gray-500 border-white/5 cursor-pointer'
                  }`}
                >
                  {!isFaceRestoreUnlocked ? 'LOCKED' : settings.faceRestoration ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Guarded Flag explanation if locked */}
              {!isFaceRestoreUnlocked && (
                <span className="text-[8px] font-mono text-gray-600 leading-normal pl-1">
                  Disabled pending commercial usage rights review. Run with experimental=true flag to test.
                </span>
              )}

              {isFaceRestoreUnlocked && (
                <div className="p-2 rounded bg-brand-violet/5 border border-brand-violet/10 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-brand-violet shrink-0 mt-0.5" />
                  <span className="text-[9px] text-brand-violet/90 leading-normal font-mono">
                    Experimental Face Restoration unlocked for testing. Do not use in production yet.
                  </span>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
