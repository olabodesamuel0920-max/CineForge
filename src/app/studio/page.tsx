"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CINEFORGE_MODES } from '@/lib/cineforgeModes';
import { createProject } from '@/lib/projects';
import { ProjectDuration, ProjectPlatform } from '@/types/project';
import StudioUpload, { UploadedFileMetadata } from '@/components/StudioUpload';
import MaxQualityToggle from '@/components/MaxQualityToggle';
import EditModeCard from '@/components/EditModeCard';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';
import { Sparkles, Clapperboard, FolderGit2, AlertCircle } from 'lucide-react';

export default function StudioPage() {
  const router = useRouter();
  
  // Form states
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState('luxury-demon-reveal');
  const [maxQualityMode, setMaxQualityMode] = useState(false);
  const [duration, setDuration] = useState<ProjectDuration>('15s');
  const [platform, setPlatform] = useState<ProjectPlatform>('TikTok');
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [mediaSize, setMediaSize] = useState<string>('0 MB');
  
  // Validation error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileSelect = (metadata: UploadedFileMetadata) => {
    setMediaFilename(metadata.fileName);
    const sizeStr = `${(metadata.fileSize / (1024 * 1024)).toFixed(1)} MB`;
    setMediaSize(sizeStr);
    setError(null);
  };

  const handleClearFile = () => {
    setMediaFilename(null);
    setMediaSize('0 MB');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!title.trim()) {
      setError('Please provide a project title.');
      return;
    }
    if (!mediaFilename) {
      setError('Please upload a video or image file to analyze.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please describe the edit you want CineForge to direct.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create project in localStorage or Supabase and compile blueprint
      const project = await createProject({
        title,
        selectedMode,
        maxQualityMode,
        mediaFilename,
        mediaSize,
        duration,
        platform,
        prompt
      });

      // Brief delay to simulate engine initialization
      setTimeout(() => {
        setIsSubmitting(false);
        router.push('/projects');
      }, 1000);
    } catch (e) {
      setError((e as Error).message || 'Failed to create the project. Please check database configuration or local storage capacity.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-space-black relative py-8 px-4 sm:px-6 lg:px-8">
      {/* Background ambient sweeps */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-violet/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10">
        
        {/* Header Title Suite */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Clapperboard className="w-7 h-7 text-brand-cyan shrink-0" />
              CineForge Studio
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Configure parameters to trigger the EditDNA Engine structural compilation.
            </p>
          </div>
          <button
            onClick={() => router.push('/projects')}
            className="self-start px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs text-gray-300 flex items-center gap-1.5 hover:bg-white/10 hover:border-white/10 transition-colors cursor-pointer"
          >
            <FolderGit2 className="w-4 h-4" /> View Projects
          </button>
        </div>

        {/* Validation Errors */}
        {error && (
          <div className="p-4 rounded-xl bg-brand-magenta/10 border border-brand-magenta/30 text-xs text-brand-magenta flex items-center gap-2 animate-fadeIn font-mono">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Configuration Grid Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER PANEL: Main inputs */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Title & Media Section */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 border-b border-white/5 pb-2">
                1. SOURCE MEDIA & TITLE
              </h3>
              
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-300 font-bold uppercase tracking-wide">Project Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neon Horizon Car Promo"
                  className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-300 font-bold uppercase tracking-wide">Upload Clip</label>
                <StudioUpload 
                  onFileSelect={handleFileSelect} 
                  selectedFilename={mediaFilename} 
                  onClear={handleClearFile} 
                />
              </div>
            </div>

            {/* Prompt description details */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 border-b border-white/5 pb-2">
                2. AI DIRECTOR EDIT PROMPT
              </h3>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-300 font-bold uppercase tracking-wide">Describe the edit you want</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Explain exactly how you want the video to feel. E.g. 'Rhythmic cuts synced with a heavy sub-bass drop, apply high-contrast dark neon lighting, slow motion focus on the car engine, finishing with a sharp logo lockup.'"
                  rows={4}
                  className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan transition-colors leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Cinematic mode selection */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 pl-1">
                3. SELECT CINEFORGE EDIT MODE
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CINEFORGE_MODES.map((mode) => (
                  <EditModeCard
                    key={mode.id}
                    mode={mode}
                    isSelected={selectedMode === mode.id}
                    onSelect={() => {
                      setSelectedMode(mode.id);
                      setError(null);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE PANEL: Format rules & Dispatch submit */}
          <div className="flex flex-col gap-6">
            
            {/* Format Specs */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-5">
              <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 border-b border-white/5 pb-2">
                4. TARGET FORMAT PROTOCOL
              </h3>

              {/* Target platform */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-300 font-bold uppercase tracking-wide">Platform Destination</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as ProjectPlatform)}
                  className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-300 focus:outline-none focus:border-brand-cyan cursor-pointer transition-colors"
                >
                  <option value="TikTok">TikTok (9:16 Portrait)</option>
                  <option value="Reels">Instagram Reels (9:16 Portrait)</option>
                  <option value="Shorts">YouTube Shorts (9:16 Portrait)</option>
                  <option value="YouTube">YouTube (16:9 Landscape)</option>
                </select>
              </div>

              {/* Duration select */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-300 font-bold uppercase tracking-wide">Output Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as ProjectDuration)}
                  className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-300 focus:outline-none focus:border-brand-cyan cursor-pointer transition-colors"
                >
                  <option value="5s">5 Seconds (Short Impact)</option>
                  <option value="10s">10 Seconds (Standard Feed Hook)</option>
                  <option value="15s">15 Seconds (Story / Reveal)</option>
                  <option value="30s">30 Seconds (Narrative Teaser)</option>
                </select>
              </div>
            </div>

            {/* Quality planning toggle */}
            <MaxQualityToggle checked={maxQualityMode} onChange={setMaxQualityMode} />

            {/* Trigger Compile Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,243,255,0.15)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-space-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Initializing EditDNA Engine...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-space-black animate-pulse" />
                  Create Edit Project
                </>
              )}
            </button>

            {/* Micro warning notice */}
            <p className="text-[10px] text-gray-500 font-mono text-center leading-normal max-w-xs mx-auto">
              Creating a project consumes local compiler cycles. Projects compile instantly and save to localStorage database registers.
            </p>
          </div>

        </form>

        <RightsSafetyNotice />
      </div>
    </div>
  );
}
