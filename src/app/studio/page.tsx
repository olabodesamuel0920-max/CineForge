"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CINEFORGE_MODES } from '@/lib/cineforgeModes';
import { createProject } from '@/lib/projects';
import { ProjectDuration, ProjectPlatform } from '@/types/project';
import StudioUpload, { UploadedFileMetadata } from '@/components/StudioUpload';
import MaxQualityToggle from '@/components/MaxQualityToggle';
import EditModeCard from '@/components/EditModeCard';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';
import { Sparkles, Clapperboard, FolderGit2, AlertCircle, Loader2 } from 'lucide-react';

import { STYLE_PRESETS, StylePreset } from '@/lib/presetsRegistry';


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
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const [sourceType, setSourceType] = useState<'upload' | 'demo'>('upload');
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('');
  
  // Validation error state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickerText, setTickerText] = useState('CONNECTING TO OUTBOUND NEURAL MODEL...');

  // Preset Applier logic
  const applyPreset = (preset: StylePreset) => {
    setTitle(`${preset.name} - Demo`);
    setPrompt(preset.prompt);
    setSelectedMode(preset.mode);
    setDuration(preset.duration as ProjectDuration);
    setPlatform(preset.platform as ProjectPlatform);
    setMaxQualityMode(preset.maxQualityMode);
    
    // Auto-stage the demo video as a first class source
    setMediaFilename('promo.mp4');
    setMediaSize('242 KB');
    setVideoDuration(15);
    setSourceType('demo');
    setSourceUrl('/uploads/promo.mp4');
    setError(null);
  };

  // Mount logic: Parse URL parameters and generate project UUID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const uuid = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setProjectId(uuid);

      const params = new URLSearchParams(window.location.search);
      const presetId = params.get('preset');
      if (presetId) {
        const found = STYLE_PRESETS.find(p => p.id === presetId);
        if (found) {
          applyPreset(found);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isSubmitting) return;

    const statuses = [
      'CONNECTING TO OUTBOUND NEURAL MODEL...',
      'INTERCEPTING BRAND PROMPT PARAMETERS...',
      'DISSECTING DIRECTORIAL STYLE MATRICES...',
      'GENERATING FRAME-BY-FRAME TIMELINE BLOCKS...',
      'RUNNING HARDENED VALIDATION GATES...',
      'ALIGNING TIMELINE BLOCK BOUNDARIES...',
      'APPLYING TIMELINE TEMPO CORRECTIONS...',
      'SYNCHRONIZING AUDIO DUCKING CODES...',
      'SAVING COMPILATION TO STORAGE LAYER...'
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % statuses.length;
      setTickerText(statuses[currentIdx]);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitting]);

  const handleFileSelect = (metadata: UploadedFileMetadata) => {
    setMediaFilename(metadata.fileName);
    const sizeStr = `${(metadata.fileSize / (1024 * 1024)).toFixed(1)} MB`;
    setMediaSize(sizeStr);
    setVideoDuration(metadata.duration);
    setSourceType(metadata.sourceType || 'upload');
    setSourceUrl(metadata.sourceUrl || metadata.filePath);
    setError(null);
  };

  const handleClearFile = () => {
    setMediaFilename(null);
    setMediaSize('0 MB');
    setVideoDuration(undefined);
    setSourceType('upload');
    setSourceUrl(undefined);
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
      const startTime = Date.now();
      
      const numericDuration = parseInt(duration, 10);
      const matchingMode = CINEFORGE_MODES.find(m => m.id === selectedMode);
      const emotion = matchingMode ? matchingMode.viewerEmotion : 'Neutral';

      // 1. Fetch generated blueprint from API route
      const response = await fetch('/api/blueprint/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          selectedMode,
          viewerEmotion: emotion,
          duration: numericDuration,
          platform,
          videoDuration
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate blueprint: status ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.blueprint) {
        throw new Error(data.error || 'Blueprint generation was unsuccessful.');
      }

      const generatedBlueprint = data.blueprint;

      // 2. Create project in localStorage or Supabase and pass compiled blueprint
      await createProject({
        id: projectId,
        title,
        selectedMode,
        maxQualityMode,
        mediaFilename,
        mediaSize,
        duration,
        platform,
        prompt,
        sourceType,
        sourceUrl
      }, generatedBlueprint);

      // Ensure loader stays visible for at least 1500ms for premium kinetic feel
      const elapsed = Date.now() - startTime;
      const minDelay = 1500;
      if (elapsed < minDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
      }

      setIsSubmitting(false);
      router.push('/projects');
    } catch (e) {
      setError((e as Error).message || 'Failed to create the project. Please check database configuration or local storage capacity.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-space-black relative py-8 px-4 sm:px-6 lg:px-8">
      {/* Full screen dark glassmorphism loading overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
          {/* Floating Ambient Glowing Orbs */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-cyan/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-brand-violet/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>

          <div className="glass-panel border border-white/10 bg-space-card/60 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center flex flex-col items-center gap-6">
            {/* Corner borders for premium tech look */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-brand-cyan/60"></div>
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-brand-cyan/60"></div>

            {/* Cybernetic pulsing icon/spinner */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Outer glowing spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand-cyan/20 animate-[spin_8s_linear_infinite]"></div>
              {/* Middle gradient spinning ring */}
              <div className="absolute inset-2 rounded-full border-4 border-y-transparent border-x-brand-cyan animate-spin"></div>
              {/* Inner pulsing orb */}
              <div className="absolute inset-5 rounded-full bg-gradient-to-tr from-brand-cyan/20 to-brand-violet/20 flex items-center justify-center animate-pulse">
                <Sparkles className="w-6 h-6 text-brand-cyan" />
              </div>
            </div>

            {/* Main loading state text */}
            <div className="space-y-2 relative z-10">
              <h3 className="text-sm font-mono font-bold tracking-widest text-brand-cyan animate-pulse">
                EditDNA Engine compiling cinematic structure blocks...
              </h3>
              <p className="text-[10px] font-mono text-gray-400">
                PLEASE DO NOT DISCONNECT OR REFRESH
              </p>
            </div>

            {/* Dynamic Status Ticker */}
            <div className="w-full bg-[#050508]/80 border border-white/5 rounded-lg px-4 py-3 min-h-[44px] flex items-center justify-center">
              <span className="text-[10px] font-mono text-brand-violet uppercase tracking-wider animate-fadeIn">
                {tickerText}
              </span>
            </div>
          </div>
        </div>
      )}

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

        {/* Style Presets Section */}
        <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/25 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" />
            <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400">
              ONE-CLICK STYLE PRESETS (AUTO-LOAD & STAGE DEMO)
            </h3>
          </div>

          {/* Niche Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-3">
            {[
              { id: 'all', label: 'All' },
              { id: 'cars', label: 'Cars' },
              { id: 'food', label: 'Food' },
              { id: 'fashion', label: 'Fashion' },
              { id: 'salons', label: 'Salons' },
              { id: 'real estate', label: 'Real Estate' },
              { id: 'football/sports', label: 'Sports' },
              { id: 'products', label: 'Products' },
              { id: 'talking-head content', label: 'Talking Head' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedNiche(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  selectedNiche === tab.id
                    ? 'bg-brand-cyan text-space-black font-extrabold shadow-[0_0_10px_rgba(0,243,255,0.25)]'
                    : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {STYLE_PRESETS.filter(p => selectedNiche === 'all' || p.niche === selectedNiche).map((preset) => {
              const isSelected = selectedMode === preset.mode && title.startsWith(preset.name);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-cyan/40 bg-brand-cyan/5 shadow-[0_0_15px_rgba(0,243,255,0.05)]'
                      : 'border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-200 truncate">{preset.name}</span>
                    <span className="text-[9px] font-mono text-brand-cyan px-1.5 py-0.5 rounded bg-brand-cyan/10 shrink-0 font-semibold">{preset.estimatedRenderTime}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-normal line-clamp-2 font-sans">{preset.description}</span>
                  <span className="text-[9px] font-mono text-gray-500 mt-0.5 uppercase tracking-wider">{preset.duration} • {preset.platform}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                  projectId={projectId}
                  onFileSelect={handleFileSelect} 
                  selectedFilename={mediaFilename} 
                  onClear={handleClearFile} 
                />
              </div>

              {videoDuration !== undefined && videoDuration > 10 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-mono flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block mb-1">AI Limit Notice</span>
                    Your uploaded video is {videoDuration.toFixed(1)}s. AI Super-Resolution (upscaling) and Face Restoration are restricted to clips under 10 seconds. Standard MaxQuality enhancements (Denoise, Deblock, and Color Recovery) will still apply. Trim to 5–10 seconds for full AI enhancement.
                  </div>
                </div>
              )}
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
