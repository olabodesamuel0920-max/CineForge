"use client";

import React, { useMemo } from 'react';
import { TimelineBlock } from '@/types/project';

interface BeatMapPreviewProps {
  duration: number; // in seconds
  blocks: TimelineBlock[];
  accentColor?: string;
}

export default function BeatMapPreview({ duration, blocks, accentColor = 'cyan' }: BeatMapPreviewProps) {
  // Generate random waveform heights, but keep them consistent between renders
  const waveformBars = useMemo(() => {
    const barsCount = 60;
    const items = [];
    for (let i = 0; i < barsCount; i++) {
      // Create some structure: low at start, peaks at intervals
      const baseHeight = Math.sin((i / barsCount) * Math.PI * 4) * 30 + 40;
      const noise = Math.random() * 20;
      const height = Math.max(10, Math.min(95, baseHeight + noise));
      
      // Check if this bar corresponds to a cut trigger in our blocks
      // We map the bars 0-60 to time 0-duration
      const barTime = (i / barsCount) * duration;
      
      // Find if any block timestamp start is close to this barTime
      let isBeatMarker = false;
      let markerLabel = '';
      
      blocks.forEach((block) => {
        const timeParts = block.timestamp.split(' ');
        const startTime = parseFloat(timeParts[0]); // e.g. "2.5s" -> 2.5
        if (Math.abs(barTime - startTime) < (duration / barsCount) * 0.8) {
          isBeatMarker = true;
          markerLabel = block.title;
        }
      });

      items.push({
        height,
        isBeatMarker,
        markerLabel,
        time: barTime.toFixed(1) + 's'
      });
    }
    return items;
  }, [duration, blocks]);

  const getColors = (color: string, active: boolean) => {
    if (!active) return 'bg-gray-700/40';
    switch (color) {
      case 'amber': return 'bg-brand-amber shadow-[0_0_8px_rgba(245,158,11,0.6)]';
      case 'magenta': return 'bg-brand-magenta shadow-[0_0_8px_rgba(255,0,127,0.6)]';
      case 'violet': return 'bg-brand-violet shadow-[0_0_8px_rgba(139,92,246,0.6)]';
      case 'green': return 'bg-brand-green shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'cyan':
      default: return 'bg-brand-cyan shadow-[0_0_8px_rgba(0,243,255,0.6)]';
    }
  };

  const getTextColor = (color: string) => {
    switch (color) {
      case 'amber': return 'text-brand-amber text-glow-amber';
      case 'magenta': return 'text-brand-magenta text-glow-magenta';
      case 'violet': return 'text-brand-violet text-glow-violet';
      case 'green': return 'text-brand-green text-glow-green';
      case 'cyan':
      default: return 'text-brand-cyan text-glow-cyan';
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/30 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">BEAT TRANSITION MAP</h4>
        <span className="text-[10px] font-mono text-gray-400">
          AUDIO SYNCHRONIZER ACTIVE
        </span>
      </div>

      <div className="relative flex flex-col gap-6 pt-4">
        {/* Waveform tracks container */}
        <div className="relative h-24 w-full flex items-end justify-between px-1">
          {/* Centered horizontal timeline bar */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-white/10 z-0"></div>

          {waveformBars.map((bar, i) => (
            <div 
              key={i} 
              className={`w-[1%] min-w-[2px] rounded-full transition-all duration-300 z-10 ${
                bar.isBeatMarker 
                  ? `${getColors(accentColor, true)} w-[1.5%] h-full` 
                  : `${getColors(accentColor, false)}`
              }`}
              style={{ 
                height: bar.isBeatMarker ? '100%' : `${bar.height}%` 
              }}
            >
              {/* Tooltip on hover */}
              {bar.isBeatMarker && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-space-dark border border-white/10 p-1.5 rounded text-[9px] font-mono text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {bar.markerLabel} ({bar.time})
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Timeline markers beneath waveform */}
        <div className="flex justify-between text-[10px] font-mono text-gray-500 px-1 border-t border-white/5 pt-2">
          <span>0.0s</span>
          <span>{(duration * 0.25).toFixed(1)}s</span>
          <span>{(duration * 0.5).toFixed(1)}s</span>
          <span>{(duration * 0.75).toFixed(1)}s</span>
          <span>{duration.toFixed(1)}s</span>
        </div>

        {/* Highlighted beat moments list */}
        <div className="flex flex-wrap gap-3 mt-1 justify-center">
          {waveformBars.filter(bar => bar.isBeatMarker).map((marker, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${getColors(accentColor, true)}`}></span>
              <span className="text-gray-400">{marker.time}:</span>
              <span className="text-gray-200 font-semibold truncate max-w-[120px]">{marker.markerLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
