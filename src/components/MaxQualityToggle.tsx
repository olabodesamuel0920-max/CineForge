"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, HelpCircle } from 'lucide-react';

interface MaxQualityToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function MaxQualityToggle({ checked, onChange }: MaxQualityToggleProps) {
  return (
    <div className={`p-4 rounded-xl border transition-all duration-300 ${
      checked 
        ? 'bg-space-card/80 border-brand-cyan/30 shadow-[0_0_15px_rgba(0,243,255,0.05)]' 
        : 'bg-space-card/30 border-white/5'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg transition-colors ${
            checked ? 'bg-brand-cyan/10 text-brand-cyan' : 'bg-white/5 text-gray-400'
          }`}>
            <Sparkles className={`w-5 h-5 ${checked ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide text-gray-200">MAX QUALITY MODE</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                checked ? 'bg-brand-cyan/20 text-brand-cyan text-glow-cyan' : 'bg-white/10 text-gray-400'
              }`}>
                {checked ? 'Ultra HD 4K Enabled' : 'Standard 1080p'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed max-w-xs md:max-w-md">
              Activates EditDNA Deep Detail Upscaling, Super-Fluid Frame Interpolation to 60fps, and artifact reduction sweeps.
            </p>
          </div>
        </div>

        {/* Custom Toggle Switch */}
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            checked ? 'bg-brand-cyan' : 'bg-gray-800'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {checked && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-brand-cyan/10 text-[11px] text-gray-400 flex flex-col gap-1 font-mono"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
            <span>Neural Upscaling Pathway: Active (4K AI Reconstruction)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
            <span>Temporal Flow Interpolation: Active (Targeting 60fps)</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
