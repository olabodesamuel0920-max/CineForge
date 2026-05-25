"use client";

import React, { useState } from 'react';
import { AlertTriangle, Cpu, Share2 } from 'lucide-react';

interface RenderQueuePanelProps {
  duration: number;
  platform: string;
  isMaxQuality: boolean;
}

export default function RenderQueuePanel({ duration, platform, isMaxQuality }: RenderQueuePanelProps) {
  const [showConnectionAlert, setShowConnectionAlert] = useState(false);

  // Compute file estimations based on inputs
  const getRenderSpecs = () => {
    const res = isMaxQuality ? '3840x2160 (4K UHD)' : '1080x1920 (FHD Portrait)';
    const fps = isMaxQuality ? '60 FPS' : '30 FPS';
    const codec = isMaxQuality ? 'HEVC / H.265' : 'H.264 (AAC)';
    const bitrate = isMaxQuality ? '45 Mbps' : '15 Mbps';
    
    // Estimate size: bitrate (mbps) * duration (s) / 8 = MB
    const mbps = isMaxQuality ? 45 : 15;
    const estSizeMB = ((mbps * duration) / 8).toFixed(1);
    
    const estRenderTime = isMaxQuality 
      ? `${(duration * 2.5).toFixed(0)} seconds (Neural Up + Interpolation)`
      : `${(duration * 0.8).toFixed(0)} seconds (Standard Linear)`;

    return { res, fps, codec, bitrate, estSizeMB, estRenderTime };
  };

  const specs = getRenderSpecs();

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">RENDER QUEUE CONTROLLER</h4>
        <span className="text-[10px] font-mono text-brand-magenta bg-brand-magenta/10 px-2 py-0.5 rounded border border-brand-magenta/20">
          DISPATCH READY
        </span>
      </div>

      {/* Stats specs grid */}
      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-gray-500 text-[10px] uppercase">Target Resolution</span>
          <span className="text-gray-200 font-semibold">{specs.res}</span>
        </div>
        <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-gray-500 text-[10px] uppercase">Frame Rate</span>
          <span className="text-gray-200 font-semibold">{specs.fps}</span>
        </div>
        <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-gray-500 text-[10px] uppercase">Encoding Standard</span>
          <span className="text-gray-200 font-semibold">{specs.codec}</span>
        </div>
        <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
          <span className="text-gray-500 text-[10px] uppercase">Est. Output Size</span>
          <span className="text-gray-200 font-semibold">~{specs.estSizeMB} MB</span>
        </div>
      </div>

      {/* Render Time Info */}
      <div className="p-3 rounded-lg bg-space-dark border border-white/5 text-xs font-mono flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Cpu className="w-3.5 h-3.5 text-brand-cyan" />
          <span>ESTIMATED RENDER TIME</span>
        </div>
        <span className="text-gray-200 font-bold mt-0.5">{specs.estRenderTime}</span>
      </div>

      {/* Dispatch Button */}
      <button
        onClick={() => setShowConnectionAlert(true)}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,243,255,0.15)] cursor-pointer active:scale-[0.98]"
      >
        <Share2 className="w-4 h-4" /> Dispatch Render Job
      </button>

      {/* Honest Platform Warning Banner */}
      {showConnectionAlert && (
        <div className="p-3.5 rounded-lg bg-brand-amber/10 border border-brand-amber/30 text-xs flex flex-col gap-2 animate-fadeIn">
          <div className="flex items-start gap-2 text-brand-amber font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>RENDER ENGINE PENDING CONNECTION</span>
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px] font-mono">
            <strong>Honest Status Notice:</strong> CineForge cannot compile video output directly in the client. The Render Router is in a <em>Provider Connection Pending</em> state. You must connect a cloud worker or integrate a local GPU node to execute compiling.
          </p>
          <button
            onClick={() => setShowConnectionAlert(false)}
            className="self-end text-[10px] text-brand-amber underline hover:text-brand-amber/80 font-mono mt-1"
          >
            Acknowledge Notice
          </button>
        </div>
      )}
    </div>
  );
}
