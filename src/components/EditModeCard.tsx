"use client";

import React from 'react';
import { CineForgeMode } from '@/types/project';
import { Sparkles, Eye, Zap, Flame } from 'lucide-react';

interface EditModeCardProps {
  mode: CineForgeMode;
  isSelected: boolean;
  onSelect: () => void;
  showSelector?: boolean; // If false, displays in non-interactive preview (landing page mode)
}

export default function EditModeCard({ mode, isSelected, onSelect, showSelector = true }: EditModeCardProps) {
  // Define glow colors mapping
  const getGlowStyles = (color: string) => {
    switch (color) {
      case 'amber':
        return {
          border: 'border-brand-amber/20',
          borderActive: 'border-brand-amber bg-brand-amber/5',
          textActive: 'text-brand-amber text-glow-amber',
          badge: 'bg-brand-amber/10 text-brand-amber',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]'
        };
      case 'magenta':
        return {
          border: 'border-brand-magenta/20',
          borderActive: 'border-brand-magenta bg-brand-magenta/5',
          textActive: 'text-brand-magenta text-glow-magenta',
          badge: 'bg-brand-magenta/10 text-brand-magenta',
          glow: 'shadow-[0_0_20px_rgba(255,0,127,0.08)]'
        };
      case 'violet':
        return {
          border: 'border-brand-violet/20',
          borderActive: 'border-brand-violet bg-brand-violet/5',
          textActive: 'text-brand-violet text-glow-violet',
          badge: 'bg-brand-violet/10 text-brand-violet',
          glow: 'shadow-[0_0_20px_rgba(139,92,246,0.08)]'
        };
      case 'cyan':
        return {
          border: 'border-brand-cyan/20',
          borderActive: 'border-brand-cyan bg-brand-cyan/5',
          textActive: 'text-brand-cyan text-glow-cyan',
          badge: 'bg-brand-cyan/10 text-brand-cyan',
          glow: 'shadow-[0_0_20px_rgba(0,243,255,0.08)]'
        };
      case 'green':
        return {
          border: 'border-brand-green/20',
          borderActive: 'border-brand-green bg-brand-green/5',
          textActive: 'text-brand-green text-glow-green',
          badge: 'bg-brand-green/10 text-brand-green',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]'
        };
      default:
        return {
          border: 'border-white/10',
          borderActive: 'border-white bg-white/5',
          textActive: 'text-white',
          badge: 'bg-white/10 text-white',
          glow: ''
        };
    }
  };

  const styles = getGlowStyles(mode.glowColor);

  return (
    <div
      onClick={() => showSelector && onSelect()}
      className={`relative rounded-xl border p-5 transition-all duration-300 ${
        showSelector ? 'cursor-pointer select-none' : ''
      } ${
        isSelected 
          ? `${styles.borderActive} ${styles.glow}` 
          : `border-white/5 hover:border-white/15 bg-space-card/20`
      }`}
    >
      {/* Glow highlight badge in corners */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex gap-1">
          <span className={`text-[8px] font-mono tracking-widest px-1 py-0.5 rounded font-bold uppercase ${styles.badge}`}>
            ACTIVE MODE
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div>
          <h3 className={`text-base font-bold tracking-wide transition-colors ${
            isSelected ? styles.textActive : 'text-gray-200'
          }`}>
            {mode.name}
          </h3>
          <p className="text-xs text-gray-400 mt-1 leading-normal">
            {mode.description}
          </p>
        </div>

        <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2 text-[11px] font-mono text-gray-500">
          <div className="flex items-start gap-1.5">
            <Eye className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong className="text-gray-300">Look: </strong>{mode.visualSignature}
            </span>
          </div>

          <div className="flex items-start gap-1.5">
            <Zap className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong className="text-gray-300">Pacing: </strong>{mode.pacingPreset}
            </span>
          </div>

          <div className="flex items-start gap-1.5">
            <Flame className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong className="text-gray-300">Emotion Trigger: </strong>
              <span className={`font-semibold ${isSelected ? styles.textActive : 'text-gray-300'}`}>
                {mode.viewerEmotion}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
