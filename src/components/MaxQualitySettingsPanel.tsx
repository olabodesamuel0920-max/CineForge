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
  const [optIn8KConfirmed, setOptIn8KConfirmed] = useState(
    blueprint.maxQualitySettings?.resolution === '8K'
  );
  const [optIn16KConfirmed, setOptIn16KConfirmed] = useState(
    blueprint.maxQualitySettings?.resolution === '16K'
  );
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
    faceProvider: 'gfpgan',
    faceFidelity: 0.6,
    faceBudgetCap: 0.50,
    faceCacheTtlDays: 7,
    identityPreservationMode: 'balanced',
    ...blueprint.maxQualitySettings
  };

  // Sync local opt-in confirmation with blueprint state
  const [optInConfirmed, setOptInConfirmed] = useState(false);
  const [optInFaceConfirmed, setOptInFaceConfirmed] = useState(false);

  useEffect(() => {
    if (settings.neuralUpscale) {
      setOptInConfirmed(true);
    }
  }, [settings.neuralUpscale]);

  useEffect(() => {
    if (settings.faceRestoration) {
      setOptInFaceConfirmed(true);
    }
  }, [settings.faceRestoration]);

  const is8KDurationBlocked = projectDuration === '15s' || projectDuration === '30s';
  const is16KDurationBlocked = projectDuration !== '5s';

  // Revert 8K / 16K if duration changed to blocked
  useEffect(() => {
    if (is8KDurationBlocked && settings.resolution === '8K') {
      updateSetting('resolution', '1080p');
      setOptIn8KConfirmed(false);
    }
  }, [is8KDurationBlocked, settings.resolution]);

  useEffect(() => {
    if (is16KDurationBlocked && settings.resolution === '16K') {
      updateSetting('resolution', '1080p');
      setOptIn16KConfirmed(false);
    }
  }, [is16KDurationBlocked, settings.resolution]);

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
              <div className="grid grid-cols-5 gap-2">
                {(['720p', '1080p', '4K', '8K', '16K'] as const).map((res) => {
                  const isLocked = 
                    (res === '8K' && is8KDurationBlocked) ||
                    (res === '16K' && is16KDurationBlocked);
                  return (
                    <button
                      key={res}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        updateSetting('resolution', res);
                        if (res === '8K') {
                          setOptIn8KConfirmed(false);
                        } else if (res === '16K') {
                          setOptIn16KConfirmed(false);
                        } else {
                          setOptIn8KConfirmed(false);
                          setOptIn16KConfirmed(false);
                        }
                      }}
                      className={`py-2 rounded font-bold uppercase transition-all text-[9px] flex items-center justify-center gap-0.5 border ${
                        isLocked
                          ? 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed'
                          : settings.resolution === res
                            ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/35 cursor-pointer'
                            : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300 cursor-pointer'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-2.5 h-2.5 text-gray-600 shrink-0" /> {res}
                        </>
                      ) : (
                        res
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* G5.3A Experimental 8K Warning & Opt-In */}
            {settings.resolution === '8K' && (
              <div className="p-3 rounded-lg bg-brand-cyan/5 border border-brand-cyan/15 flex flex-col gap-3 font-mono text-[10px]">
                <div className="flex gap-2 text-brand-cyan">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-bold uppercase tracking-wider">Experimental 8K Export</span>
                </div>
                <p className="text-gray-400 leading-normal">
                  8K export increases render time and file size. It improves presentation resolution but cannot create true native detail from low-quality footage.
                </p>
                <div 
                  onClick={() => {
                    const nextConfirm = !optIn8KConfirmed;
                    setOptIn8KConfirmed(nextConfirm);
                    if (!nextConfirm) {
                      updateSetting('resolution', '1080p');
                    }
                  }}
                  className="flex items-start gap-2 cursor-pointer select-none group mt-1"
                >
                  {optIn8KConfirmed ? (
                    <CheckSquare className="w-4.5 h-4.5 text-brand-cyan shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-300 shrink-0 mt-0.5" />
                  )}
                  <span className="text-[9px] text-gray-400 leading-tight group-hover:text-gray-300">
                    I acknowledge the warning and confirm experimental 8K export.
                  </span>
                </div>
              </div>
            )}

            {/* G5.3B Experimental 16K Warning & Opt-In */}
            {settings.resolution === '16K' && (
              <div className="p-3 rounded-lg bg-brand-amber/5 border border-brand-amber/15 flex flex-col gap-3 font-mono text-[10px]">
                <div className="flex gap-2 text-brand-amber">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-bold uppercase tracking-wider">Experimental 16K Export</span>
                </div>
                <p className="text-gray-400 leading-normal">
                  Experimental 16K export creates extremely large files and long render times. It improves presentation resolution but cannot create true native detail that was never captured.
                </p>
                <div 
                  onClick={() => {
                    const nextConfirm = !optIn16KConfirmed;
                    setOptIn16KConfirmed(nextConfirm);
                    if (!nextConfirm) {
                      updateSetting('resolution', '1080p');
                    }
                  }}
                  className="flex items-start gap-2 cursor-pointer select-none group mt-1"
                >
                  {optIn16KConfirmed ? (
                    <CheckSquare className="w-4.5 h-4.5 text-brand-amber shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-gray-500 group-hover:text-gray-300 shrink-0 mt-0.5" />
                  )}
                  <span className="text-[9px] text-gray-400 leading-tight group-hover:text-gray-300">
                    I acknowledge the warning and confirm experimental 16K export.
                  </span>
                </div>
              </div>
            )}

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

              {/* Experimental Face Clarity Enhancement */}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex flex-col">
                    <span className="text-gray-300">Face Clarity Enhancement</span>
                    <span className="text-[9px] text-gray-500">Experimental face restoration</span>
                  </div>
                  <button
                    type="button"
                    disabled={settings.resolution === '16K' || isDurationBlocked}
                    onClick={() => {
                      const nextVal = !settings.faceRestoration;
                      if (nextVal && !optInFaceConfirmed) {
                        return;
                      }
                      updateSetting('faceRestoration', nextVal);
                    }}
                    className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all border ${
                      (settings.resolution === '16K' || isDurationBlocked)
                        ? 'bg-white/5 text-gray-600 border-white/5 cursor-not-allowed'
                        : settings.faceRestoration && optInFaceConfirmed
                          ? 'bg-brand-violet/20 text-brand-violet border-brand-violet/30 cursor-pointer'
                          : 'bg-white/5 text-gray-500 border-white/5 cursor-pointer'
                    }`}
                  >
                    {(settings.resolution === '16K' || isDurationBlocked) ? 'LOCKED' : settings.faceRestoration && optInFaceConfirmed ? 'ON' : 'OFF'}
                  </button>
                </div>

                {settings.resolution === '16K' && (
                  <div className="p-2 rounded bg-red-950/20 border border-red-500/20 flex gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[9px] text-red-400/90 leading-normal font-mono">
                      Face Restoration is blocked at 16K resolution.
                    </span>
                  </div>
                )}

                {settings.resolution !== '16K' && isDurationBlocked && (
                  <div className="p-2 rounded bg-red-950/20 border border-red-500/20 flex gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[9px] text-red-400/90 leading-normal font-mono">
                      Face Restoration is restricted to clips under 10 seconds. (Current project duration: {projectDuration})
                    </span>
                  </div>
                )}

                {settings.resolution !== '16K' && !isDurationBlocked && (
                  <div className="flex flex-col gap-2">
                    {/* Warning Copy and Opt-In Checkbox */}
                    <div className="p-2.5 rounded bg-brand-violet/5 border border-brand-violet/10 flex flex-col gap-2 font-mono text-[9px]">
                      <p className="text-gray-400 leading-normal">
                        Face enhancement may alter facial details or introduce artifacts. It is not forensic enhancement.
                      </p>
                      <div 
                        onClick={() => {
                          const nextConfirm = !optInFaceConfirmed;
                          setOptInFaceConfirmed(nextConfirm);
                          if (!nextConfirm) {
                            updateSetting('faceRestoration', false);
                          } else {
                            updateSetting('faceRestoration', true);
                          }
                        }}
                        className="flex items-start gap-2 cursor-pointer select-none group mt-1"
                      >
                        {optInFaceConfirmed ? (
                          <CheckSquare className="w-4 h-4 text-brand-violet shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-500 group-hover:text-gray-300 shrink-0 mt-0.5" />
                        )}
                        <span className="text-[9px] text-gray-400 leading-tight group-hover:text-gray-300">
                          I understand that face enhancement may alter facial details and agree to enable this experimental feature.
                        </span>
                      </div>
                    </div>

                    {settings.faceRestoration && optInFaceConfirmed && (
                      <div className="pl-6 flex flex-col gap-3 border-l border-white/5 mt-1 font-mono text-[10px]">
                        {/* Fidelity Weight Slider */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-bold uppercase">FIDELITY WEIGHT</span>
                            <span className="text-brand-violet font-bold">{settings.faceFidelity || 0.6}</span>
                          </div>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="0.8" 
                            step="0.05"
                            value={settings.faceFidelity || 0.6}
                            onChange={(e) => updateSetting('faceFidelity', parseFloat(e.target.value))}
                            className="w-full accent-brand-violet bg-white/10 h-1 rounded"
                          />
                          <span className="text-[8px] text-gray-500">
                            0.5 = High Reconstruction, 0.8 = High Identity Preservation
                          </span>
                        </div>

                        {/* Identity Mode */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-gray-500 font-bold uppercase">PRESERVATION MODE</span>
                          <div className="flex gap-2">
                            {(['balanced', 'strict'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => updateSetting('identityPreservationMode', mode)}
                                className={`px-2.5 py-1 rounded font-bold uppercase text-[9px] border ${
                                  (settings.identityPreservationMode || 'balanced') === mode
                                    ? 'bg-brand-violet/25 text-brand-violet border-brand-violet/40'
                                    : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Selected Provider */}
                        <div className="flex justify-between items-center text-[9px] text-gray-500">
                          <span>PROVIDER:</span>
                          <span className="text-gray-400 uppercase">Tencent GFPGAN v1.4 (Apache 2.0)</span>
                        </div>

                        {/* Cache Policy */}
                        <div className="flex justify-between items-center text-[9px] text-gray-500">
                          <span>BIOMETRIC CACHE RETENTION:</span>
                          <span className="text-gray-400">7 Days Expiry</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
