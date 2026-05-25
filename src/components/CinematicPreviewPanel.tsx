"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Grid, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface CinematicPreviewPanelProps {
  filename: string;
  duration: number; // in seconds
  isMaxQuality: boolean;
  platform: 'TikTok' | 'Reels' | 'Shorts' | 'YouTube';
}

export default function CinematicPreviewPanel({ filename, duration, isMaxQuality, platform }: CinematicPreviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Format aspect ratio depending on platform
  const isPortrait = platform !== 'YouTube';

  // Tick timecode when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            return 0; // loop
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Format timecode e.g. 00:00:04:12 (Hours:Minutes:Seconds:Frames)
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30 fps timecode representation

    const pad = (val: number) => String(val).padStart(2, '0');
    return `00:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/30 flex flex-col gap-4">
      {/* Panel Title Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-magenta animate-pulse"></div>
          <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">CINEMATIC PREVIEW ROUTER</h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
          <span>SOURCE: {filename}</span>
          <span className="text-gray-400">|</span>
          <span className="text-brand-cyan uppercase">
            {isMaxQuality ? '4K UHD MASTER (60 FPS)' : '1080P FHD ROUGH (30 FPS)'}
          </span>
        </div>
      </div>

      {/* Screen Monitor Container */}
      <div className="relative bg-[#020204] rounded-lg border border-white/10 overflow-hidden flex items-center justify-center min-h-[300px] md:min-h-[380px] group">
        {/* Dynamic scanline grid overlay simulating monitor */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-10 opacity-30"></div>
        
        {/* CRT Scanline sweep animation */}
        {isPlaying && (
          <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-cyan/20 blur-[1px] animate-scanline pointer-events-none z-10"></div>
        )}

        {/* Video Canvas Backdrop Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

        {/* Safe-zone Grids overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none border border-white/5 z-20">
            {/* Thirds guidelines */}
            <div className="absolute left-1/3 top-0 bottom-0 w-[1px] border-l border-dashed border-white/10"></div>
            <div className="absolute right-1/3 top-0 bottom-0 w-[1px] border-l border-dashed border-white/10"></div>
            <div className="absolute top-1/3 left-0 right-0 h-[1px] border-t border-dashed border-white/10"></div>
            <div className="absolute bottom-1/3 left-0 right-0 h-[1px] border-t border-dashed border-white/10"></div>
            
            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center">
              <div className="w-2 h-[1px] bg-brand-cyan/40"></div>
              <div className="h-2 w-[1px] bg-brand-cyan/40 absolute"></div>
            </div>
          </div>
        )}

        {/* Portrait/Landscape Active Aspect Ratio Frame */}
        <div 
          className={`relative border border-white/20 transition-all duration-500 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden bg-space-dark/80 ${
            isPortrait 
              ? 'w-[180px] h-[320px] md:w-[200px] md:h-[356px]' 
              : 'w-full max-w-[500px] aspect-video'
          }`}
        >
          {/* Top Frame Info */}
          <div className="p-2 flex items-center justify-between z-20 text-[9px] font-mono text-gray-400 bg-gradient-to-b from-black/80 to-transparent">
            <span>REC</span>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></span>
              {formatTimecode(currentTime)}
            </span>
          </div>

          {/* Center Graphic */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 select-none">
            <span className="text-[10px] font-mono text-brand-cyan/40 tracking-widest font-bold uppercase mb-1">
              EditDNA Visualizer
            </span>
            <p className="text-[11px] text-gray-500 leading-snug font-sans max-w-[140px] truncate">
              {filename}
            </p>
            {isPlaying ? (
              <div className="flex gap-1.5 mt-3 items-end h-6">
                <span className="w-1 bg-brand-cyan animate-waveform h-4"></span>
                <span className="w-1 bg-brand-cyan animate-waveform h-6" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1 bg-brand-cyan animate-waveform h-3" style={{ animationDelay: '0.4s' }}></span>
                <span className="w-1 bg-brand-cyan animate-waveform h-5" style={{ animationDelay: '0.6s' }}></span>
              </div>
            ) : (
              <span className="text-[10px] text-gray-600 font-mono mt-3 uppercase tracking-wider">
                MONITOR STANDBY
              </span>
            )}
          </div>

          {/* Bottom Frame Info */}
          <div className="p-2 flex justify-between items-center z-20 text-[9px] font-mono text-gray-400 bg-gradient-to-t from-black/80 to-transparent">
            <span>{isPortrait ? '9:16 PORTRAIT' : '16:9 LANDSCAPE'}</span>
            <span>{isMaxQuality ? '4K UHD' : '1080P'}</span>
          </div>
        </div>

        {/* Ambient background glows mirroring video play state */}
        <div className={`absolute -inset-10 bg-radial transition-all duration-1000 opacity-20 pointer-events-none mix-blend-screen filter blur-3xl ${
          isPlaying 
            ? 'from-brand-cyan/30 via-brand-magenta/10 to-transparent scale-110' 
            : 'from-transparent to-transparent'
        }`}></div>
      </div>

      {/* Control Panel Deck */}
      <div className="flex flex-col gap-3">
        {/* Timeline Slider bar */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-gray-400 w-8">
            {currentTime.toFixed(1)}s
          </span>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleTimelineChange}
            className="flex-1 accent-brand-cyan h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] font-mono text-gray-400 w-8 text-right">
            {duration.toFixed(1)}s
          </span>
        </div>

        {/* Action Button Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isPlaying 
                  ? 'bg-brand-cyan/15 text-brand-cyan hover:bg-brand-cyan/25' 
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Safe-zone grid toggle */}
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                showGrid ? 'bg-white/10 text-brand-cyan' : 'bg-transparent text-gray-500 hover:text-gray-300'
              }`}
              title="Toggle Safe Zone Guides"
            >
              <Grid className="w-4 h-4" />
            </button>

            {/* Mute button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-brand-magenta" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
