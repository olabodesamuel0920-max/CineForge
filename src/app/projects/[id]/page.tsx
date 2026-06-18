"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Project, TimelineBlock } from '@/types/project';
import { getProjectById, getActiveUser, updateProject, getProjectVersions, getBrandPresets, createBrandPreset, deleteBrandPreset, createProjectVersion } from '@/lib/projects';
import { ProjectVersion, BrandPreset } from '@/types/project';
import { compileAutoDirectorAnalysis } from '@/lib/autodirectorCompiler';
import { getModeById } from '@/lib/cineforgeModes';
import { getSupabase } from '@/lib/supabase';
import CinematicPreviewPanel from '@/components/CinematicPreviewPanel';
import BeatMapPreview from '@/components/BeatMapPreview';
import BlueprintTimeline from '@/components/BlueprintTimeline';
import StatusTracker from '@/components/StatusTracker';
import RenderQueuePanel from '@/components/RenderQueuePanel';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';
import { 
  ArrowLeft, Cpu, Sparkles, Film, Eye, 
  Volume2, Palette, FileText, ClipboardCheck, Clipboard, ExternalLink, CloudRain,
  History, Trash2, Save, PlayCircle, Undo, Loader2, Wand2
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [brandPresets, setBrandPresets] = useState<BrandPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSignLoading, setIsSignLoading] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(true);

  const loadVersionsAndPresets = async () => {
    if (!id) return;
    try {
      const vers = await getProjectVersions(id);
      setVersions(vers);
      const prs = await getBrandPresets();
      setBrandPresets(prs);
    } catch (err) {
      console.error('Failed to load versions/presets:', err);
    }
  };

  // Load versions and presets on load
  useEffect(() => {
    if (id) {
      loadVersionsAndPresets();
    }
  }, [id, project?.status?.renderEngine]); // Reload when project is fetched or render status completes!

  const handlePlayVersion = async (version: ProjectVersion) => {
    setIsSignLoading(version.id);
    try {
      const client = getSupabase();
      let token = '';
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          token = session.access_token;
        }
      }

      if (!token) {
        setActiveVideoUrl(version.outputPath.startsWith('/') ? version.outputPath : `/${version.outputPath}`);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch('/api/projects/sign-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: id,
          versionId: version.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch presigned playback URL.');
      }

      const data = await response.json();
      if (data.url) {
        setActiveVideoUrl(data.url);
      } else {
        throw new Error('Playback URL signing failed.');
      }
    } catch (err) {
      console.error('Failed to sign version URL:', err);
      setActiveVideoUrl(version.outputPath.startsWith('/') ? version.outputPath : `/${version.outputPath}`);
    } finally {
      setIsSignLoading(null);
    }
  };

  const handleRestoreVersion = async (version: ProjectVersion) => {
    if (!project) return;
    if (!confirm(`Are you sure you want to restore Version ${version.versionNumber}? This will replace your current timeline layout.`)) return;

    const restoredProject: Project = {
      ...project,
      blueprint: version.blueprint
    };

    setProject(restoredProject);
    setSaveStatus('unsaved');
  };

  const handleSaveBrandPreset = async () => {
    if (!project || !presetName.trim()) return;
    try {
      const newPreset = await createBrandPreset({
        name: presetName.trim(),
        tone: project.blueprint.viewerEmotion,
        colorMood: project.blueprint.colorGrade,
        captionStyle: project.blueprint.captionStyle,
        ctaStyle: project.blueprint.exportRecommendation,
        platformPreference: project.platform,
        motionStyle: project.blueprint.cutRhythm,
        soundDesignStyle: project.blueprint.soundDirection
      });
      setBrandPresets([newPreset, ...brandPresets]);
      setPresetName('');
      setShowSavePreset(false);
    } catch (err) {
      console.error('Failed to save brand preset:', err);
      alert('Failed to save brand preset.');
    }
  };

  const handleApplyPreset = async (preset: BrandPreset) => {
    if (!project) return;
    
    const updatedBlueprint = {
      ...project.blueprint,
      viewerEmotion: preset.tone || project.blueprint.viewerEmotion,
      colorGrade: preset.colorMood || project.blueprint.colorGrade,
      captionStyle: preset.captionStyle || project.blueprint.captionStyle,
      soundDirection: preset.soundDesignStyle || project.blueprint.soundDirection,
      cutRhythm: preset.motionStyle || project.blueprint.cutRhythm,
      exportRecommendation: preset.ctaStyle || project.blueprint.exportRecommendation
    };

    const updatedProject: Project = {
      ...project,
      platform: (preset.platformPreference as any) || project.platform,
      blueprint: updatedBlueprint
    };

    setProject(updatedProject);
    setSaveStatus('unsaved');
  };

  const handleDeletePreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this brand style preset?')) return;
    try {
      await deleteBrandPreset(presetId);
      setBrandPresets(brandPresets.filter(p => p.id !== presetId));
    } catch (err) {
      console.error('Failed to delete brand preset:', err);
      alert('Failed to delete preset.');
    }
  };

  // Debounced auto-save effect
  useEffect(() => {
    if (!project || saveStatus !== 'unsaved') return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateProject(project);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to auto-save blueprint changes:', err);
        setSaveStatus('unsaved');
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(timer);
  }, [project, saveStatus]);

  const handleTimelineChange = (newBlocks: TimelineBlock[]) => {
    if (!project) return;
    setProject({
      ...project,
      blueprint: {
        ...project.blueprint,
        timelineBlocks: newBlocks
      }
    });
    setSaveStatus('unsaved');
  };

  const handleAnalyzeFootage = async () => {
    if (!project) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const client = getSupabase();
      let token = '';
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          token = session.access_token;
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/autodirector/inspect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: project.id,
          assetPath: project.sourceUrl || project.mediaFilename, // gs:// format or filename
          selectedNiche: project.selectedMode.split('-')[0] || 'cars',
          selectedPreset: project.selectedMode,
          maxAnalyzeSeconds: 60
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to inspect source footage.');
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error('AutoDirector Analysis failed:', err);
      setAnalysisError((err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateEditDNA = async () => {
    if (!project || !analysisResult || !analysisResult.analysis) return;

    const confirmReplace = confirm(
      "Replace current timeline with AutoDirector-generated EditDNA?\n\nTip: We will automatically save a backup of your current timeline in the Version History."
    );
    if (!confirmReplace) return;

    try {
      // 1. Auto-save current timeline as a backup version snapshot
      try {
        await createProjectVersion(project.id, {
          blueprint: project.blueprint,
          outputPath: project.mediaFilename,
          diagnostics: {
            videoDuration: project.blueprint.timelineBlocks.reduce((acc, b) => {
              const parts = b.timestamp.split(' - ');
              if (parts.length === 2) {
                return Math.max(acc, parseFloat(parts[1]));
              }
              return acc;
            }, 0),
            codec: 'Backup before AutoDirector',
            outputSize: 0
          }
        });
        
        // Reload versions list
        const vers = await getProjectVersions(project.id);
        setVersions(vers);
      } catch (err) {
        console.warn('Failed to auto-save backup version snapshot:', err);
      }

      // 2. Compile new EditDNA blueprint from the analysis result
      const compiledBlueprint = compileAutoDirectorAnalysis(
        project.id,
        analysisResult.analysis,
        analysisResult.recommendedPreset,
        project.platform,
        project.duration,
        project.maxQualityMode
      );

      // 3. Update project state
      const updatedProject: Project = {
        ...project,
        selectedMode: analysisResult.recommendedPreset,
        blueprint: compiledBlueprint
      };

      setProject(updatedProject);
      setSaveStatus('unsaved');
      
      // Success alert
      alert("AutoDirector blueprint generated from raw footage.");
    } catch (err) {
      console.error('Failed to compile AutoDirector EditDNA:', err);
      alert(`AutoDirector compiler failed: ${(err as Error).message}`);
    }
  };

  const handleUpgradeRedirect = async () => {
    setIsRedirecting(true);
    try {
      const client = getSupabase();
      let token = '';
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          token = session.access_token;
        }
      }
      if (token) {
        window.location.href = `/api/checkout/session?token=${token}`;
      } else {
        alert('Authentication required to upgrade account.');
        setIsRedirecting(false);
      }
    } catch (err) {
      console.error('Failed to redirect to checkout:', err);
      alert('Failed to connect to checkout service. Please try again.');
      setIsRedirecting(false);
    }
  };

  useEffect(() => {
    if (project) {
      if (project.status.renderEngine === 'Active') {
        setActiveVideoUrl(project.mediaFilename.startsWith('/renders/') || project.mediaFilename.startsWith('http')
          ? project.mediaFilename
          : `/renders/output-${project.id}.mp4`);
      } else {
        setActiveVideoUrl(project.mediaFilename);
      }
    }
  }, [project?.mediaFilename, project?.status.renderEngine, project?.id]);

  useEffect(() => {
    if (id) {
      const fetchProject = async () => {
        try {
          const user = await getActiveUser();
          const data = await getProjectById(id);
          if (data) {
            setProject(data);
            setIsLoading(false);
          } else {
            if (user) {
              router.push('/projects?error=unauthorized');
            } else {
              setIsLoading(false);
            }
          }
        } catch (e) {
          console.error('Failed to fetch project detail:', e);
          const user = await getActiveUser();
          if (user) {
            router.push('/projects?error=unauthorized');
          } else {
            setIsLoading(false);
          }
        }
      };
      fetchProject();
    }
  }, [id, router]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-gray-500 font-mono text-xs gap-3">
        <div className="w-6 h-6 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin"></div>
        <span>Accessing project DNA logs...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-space-black">
        <div className="p-3.5 rounded-full bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta mb-4">
          <Film className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-200">Project Workspace Not Found</h2>
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
          The requested project ID does not exist in local registers. It may have been deleted.
        </p>
        <Link
          href="/projects"
          className="mt-5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-brand-cyan hover:bg-white/10 transition-colors cursor-pointer"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const mode = getModeById(project.selectedMode);
  const durationSec = parseInt(project.duration) || 15;
  const accentColor = mode?.glowColor || 'cyan';

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getGlowColorHex = (color: string) => {
    switch (color) {
      case 'amber': return 'from-brand-amber/20';
      case 'magenta': return 'from-brand-magenta/20';
      case 'violet': return 'from-brand-violet/20';
      case 'green': return 'from-brand-green/20';
      case 'cyan':
      default: return 'from-brand-cyan/20';
    }
  };

  return (
    <div className="flex-1 bg-space-black py-6 md:py-8 px-4 sm:px-6 lg:px-8">
      {/* Background soft ambient flow */}
      <div className={`absolute top-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-b ${getGlowColorHex(accentColor)} to-transparent blur-3xl opacity-10 pointer-events-none`}></div>

      <div className="max-w-7xl mx-auto flex flex-col gap-6 relative z-10">
        
        {/* Workspace Nav Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/projects')}
              className="p-2 rounded-lg border border-white/5 bg-white/[0.02] text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white truncate max-w-[200px] sm:max-w-md">
                  {project.title}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-white/5 border border-white/5 text-brand-cyan font-semibold">
                  ID: {project.id}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                Platform: <span className="text-gray-200">{project.platform}</span> | Duration: <span className="text-gray-200">{project.duration}</span> | Selected Mode: <span className="text-brand-cyan">{mode?.name || 'Custom'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Auto-save Status Indicator */}
            {saveStatus === 'saved' && (
              <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                ✓ Saved to Cloud
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="text-brand-amber flex items-center gap-1 text-[11px] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse"></span>
                ⚡ Saving...
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="text-gray-400 flex items-center gap-1 text-[11px]">
                <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                ● Unsaved Changes
              </span>
            )}

            <div className="flex items-center gap-2">
              <span className="text-gray-500">EditDNA:</span>
              <span className="text-brand-green font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
                VERIFIED
              </span>
            </div>
          </div>
        </div>

        {/* WORKSPACE SUITE GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT & CENTER COLUMN: Video Player & Track Lanes */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Cinematic Player */}
            <CinematicPreviewPanel
              filename={activeVideoUrl}
              duration={durationSec}
              isMaxQuality={project.maxQualityMode}
              platform={project.platform}
            />

            {/* Waveform BeatSync Map */}
            <BeatMapPreview
              duration={durationSec}
              blocks={project.blueprint.timelineBlocks}
              accentColor={accentColor}
            />

            {/* Timeline track blocks */}
            <BlueprintTimeline
              blocks={project.blueprint.timelineBlocks}
              accentColor={accentColor}
              project={project}
              onPreviewUrl={(url) => setActiveVideoUrl(url)}
              onCreditExhausted={() => setShowUpgradeModal(true)}
              onTimelineChange={handleTimelineChange}
            />

          </div>

          {/* RIGHT COLUMN: Engine diagnostics, Render controller & full Spec documentation */}
          <div className="flex flex-col gap-6">
            
            {/* Status indicators */}
            <StatusTracker status={project.status} />

            {/* Render actions panel */}
            <RenderQueuePanel
              project={project}
              onStatusChange={(updated) => {
                setProject(updated);
              }}
              onCreditExhausted={() => setShowUpgradeModal(true)}
            />

            {/* AutoDirector AI Inspector Collapsible Panel */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-3">
              <div 
                onClick={() => setIsInspectorExpanded(!isInspectorExpanded)}
                className="flex items-center justify-between border-b border-white/5 pb-2 cursor-pointer select-none"
              >
                <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-brand-cyan" /> AUTODIRECTOR AI INSPECTOR
                </h3>
                <span className="text-[10px] font-mono text-gray-500">
                  {isInspectorExpanded ? 'COLLAPSE ▲' : 'EXPAND ▼'}
                </span>
              </div>

              {isInspectorExpanded && (
                <div className="flex flex-col gap-3">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider animate-pulse">
                        Analyzing source footage...
                      </span>
                    </div>
                  ) : analysisError ? (
                    <div className="flex flex-col gap-2 p-3 rounded bg-red-950/20 border border-red-900/30">
                      <span className="text-[10px] font-mono text-red-400 font-bold uppercase">Analysis Error</span>
                      <p className="text-[10px] font-mono text-red-300">{analysisError}</p>
                      <button
                        onClick={handleAnalyzeFootage}
                        className="mt-1 w-full py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-200 font-bold font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Retry Analysis
                      </button>
                    </div>
                  ) : !analysisResult ? (
                    <div className="flex flex-col gap-2 text-center py-4">
                      <p className="text-[10px] font-mono text-gray-500">
                        Analyze raw video to extract layout metadata, quality signals, and recommended editing parameters.
                      </p>
                      <button
                        onClick={handleAnalyzeFootage}
                        className="w-full py-2 rounded bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan font-bold font-mono text-[10px] uppercase tracking-widest border border-brand-cyan/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Analyze Raw Footage
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 font-mono text-[11px] leading-relaxed">
                      {/* Basic Meta Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-white/[0.01] border border-white/5 flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-bold">Detected Niche</span>
                          <span className="text-gray-200 font-bold uppercase">{analysisResult.analysis?.detectedNiche || analysisResult.detectedNiche || 'N/A'}</span>
                        </div>
                        <div className="p-2 rounded bg-[#000]/20 border border-white/5 flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-bold">Rec Preset</span>
                          <span className="text-gray-200 font-bold uppercase text-[10px] truncate">{analysisResult.recommendedPreset || 'N/A'}</span>
                        </div>
                        <div className="p-2 rounded bg-white/[0.01] border border-white/5 flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-bold">Usable Dur</span>
                          <span className="text-gray-200 font-bold">{analysisResult.analysis?.usableDuration || analysisResult.duration || 0}s</span>
                        </div>
                        <div className="p-2 rounded bg-white/[0.01] border border-white/5 flex flex-col">
                          <span className="text-[8px] text-gray-500 uppercase font-bold">Proxy Samples</span>
                          <span className="text-gray-200 font-bold">{analysisResult.sampleCount || 0} Frames</span>
                        </div>
                      </div>

                      {/* Quality status flags */}
                      <div className="p-2.5 rounded bg-white/[0.01] border border-white/5 flex flex-col gap-1.5">
                        <span className="text-[8px] text-gray-500 uppercase font-bold">Quality Status Flags</span>
                        <div className="grid grid-cols-3 gap-1.5 text-[9px] uppercase font-bold">
                          <div className={`px-1.5 py-0.5 rounded text-center border ${analysisResult.qualityFlags?.blurry ? 'bg-brand-magenta/10 border-brand-magenta/30 text-brand-magenta' : 'bg-green-950/10 border-green-900/30 text-green-400'}`}>
                            {analysisResult.qualityFlags?.blurry ? 'Blurry' : 'Sharp'}
                          </div>
                          <div className={`px-1.5 py-0.5 rounded text-center border ${analysisResult.qualityFlags?.shaky ? 'bg-brand-magenta/10 border-brand-magenta/30 text-brand-magenta' : 'bg-green-950/10 border-green-900/30 text-green-400'}`}>
                            {analysisResult.qualityFlags?.shaky ? 'Shaky' : 'Stable'}
                          </div>
                          <div className={`px-1.5 py-0.5 rounded text-center border ${analysisResult.qualityFlags?.dark ? 'bg-brand-magenta/10 border-brand-magenta/30 text-brand-magenta' : 'bg-green-950/10 border-green-900/30 text-green-400'}`}>
                            {analysisResult.qualityFlags?.dark ? 'Low-Light' : 'Lit'}
                          </div>
                        </div>
                      </div>

                      {/* Composition Sequence List */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[8px] text-gray-500 uppercase font-bold">Composition Sequence</span>
                        <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                          {analysisResult.analysis?.compositionSequence?.map((seq: any, idx: number) => (
                            <div key={idx} className="p-2 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-300 font-bold uppercase">{seq.shotType?.replace('_', ' ') || 'Unknown Shot'}</span>
                                <span className={`font-bold ${seq.usableScore >= 8.0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                  Score: {seq.usableScore}
                                </span>
                              </div>
                              <p className="text-[9px] text-gray-500 leading-normal">{seq.subjectDescription}</p>
                              <div className="flex justify-between text-[8px] text-gray-500 font-mono">
                                <span>TIMECODE: {seq.startTime}s - {seq.endTime}s</span>
                                <span className="uppercase">MOTION: {seq.motionIntensity || 'static'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={handleGenerateEditDNA}
                        className="w-full mt-1 py-1.5 rounded bg-brand-cyan/25 hover:bg-brand-cyan/35 text-brand-cyan font-bold font-mono text-[9px] uppercase tracking-wider cursor-pointer text-center border border-brand-cyan/30 transition-all flex items-center justify-center gap-1"
                      >
                        <Wand2 className="w-3 h-3 text-brand-cyan" /> Generate EditDNA from Analysis
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Version History Collapsible Panel */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-brand-cyan" /> RENDER VERSION HISTORY
                </h3>
                <span className="text-[10px] font-mono text-gray-500">
                  {versions.length} SAVED
                </span>
              </div>

              {versions.length === 0 ? (
                <p className="text-[10px] font-mono text-gray-500 italic py-1">
                  No rendered versions logged. Dispatch a full render job to auto-save a version state.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {versions.map((ver) => {
                    return (
                      <div key={ver.id} className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1.5 hover:bg-white/[0.04] transition-all">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-brand-cyan font-bold">V{ver.versionNumber} Snapshot</span>
                          <span className="text-gray-500 text-[10px]">
                            {new Date(ver.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Diagnostics summary if present */}
                        {ver.diagnostics && (
                          <div className="text-[9px] font-mono text-gray-500 flex justify-between">
                            <span>{ver.diagnostics.videoDuration ? `${ver.diagnostics.videoDuration.toFixed(1)}s` : '15s'} | {ver.diagnostics.outputSize ? `${(ver.diagnostics.outputSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</span>
                            <span className="uppercase">{ver.diagnostics.codec || 'H.264'}</span>
                          </div>
                        )}

                        <div className="flex gap-2 mt-0.5">
                          <button
                            onClick={() => handlePlayVersion(ver)}
                            disabled={isSignLoading === ver.id}
                            className="flex-1 py-1 rounded bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan font-bold font-mono text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isSignLoading === ver.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <PlayCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Play version</span>
                          </button>
                          <button
                            onClick={() => handleRestoreVersion(ver)}
                            className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 font-bold font-mono text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Undo className="w-3.5 h-3.5" />
                            <span>Restore blueprint</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Brand Presets Collapsible Panel */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-violet" /> BRAND STYLE MEMORY
                </h3>
                <span className="text-[10px] font-mono text-gray-500">
                  {brandPresets.length} PRESETS
                </span>
              </div>

              {/* Save Style Control */}
              {!showSavePreset ? (
                <button
                  onClick={() => setShowSavePreset(true)}
                  className="w-full py-1.5 rounded border border-brand-violet/30 bg-brand-violet/5 hover:bg-brand-violet/10 text-brand-violet font-bold font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> Save Current Style as Preset
                </button>
              ) : (
                <div className="p-2.5 rounded bg-brand-violet/5 border border-brand-violet/20 flex flex-col gap-2">
                  <span className="text-[9px] font-mono text-brand-violet font-bold uppercase tracking-wider">Preset Name</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g. Neon Luxury Vibe"
                      className="flex-1 bg-[#050508]/85 border border-white/10 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-brand-violet/60 font-sans"
                    />
                    <button
                      onClick={handleSaveBrandPreset}
                      disabled={!presetName.trim()}
                      className="px-2.5 py-1 rounded bg-brand-violet text-space-black font-mono font-bold text-[10px] uppercase hover:bg-brand-magenta hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSavePreset(false);
                        setPresetName('');
                      }}
                      className="text-[10px] font-mono text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {brandPresets.length === 0 ? (
                <p className="text-[10px] font-mono text-gray-500 italic py-1">
                  No saved presets. Save your current styling to reuse across timelines.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {brandPresets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className="p-2 rounded bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-brand-violet/20 transition-all flex items-center justify-between group cursor-pointer text-xs"
                      title="Click to apply style preset properties to timeline"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-200 font-semibold text-[11px] font-sans">{preset.name}</span>
                        <span className="text-[9px] font-mono text-gray-500 uppercase">
                          {preset.colorMood || 'No Mood'} | {preset.tone || 'Neutral'} | {preset.platformPreference || 'All'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        className="text-gray-600 hover:text-brand-magenta transition-colors opacity-0 group-hover:opacity-100 p-1 cursor-pointer"
                        title="Delete Preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Full Spec sheet copy cards */}
            <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4">
              <h3 className="text-xs font-mono font-bold tracking-widest text-gray-400 border-b border-white/5 pb-2">
                EDITDNA INSTRUCTION SPEC SHEET
              </h3>

              <div className="flex flex-col gap-4 font-mono text-[11px] leading-relaxed">
                
                {/* Viewer Emotion */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-brand-cyan" /> Target Emotion
                  </span>
                  <p className="text-gray-200">{project.blueprint.viewerEmotion}</p>
                </div>

                {/* Hook Strategy */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.hookStrategy, 'hook')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'hook' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-brand-cyan" /> Hook Strategy
                  </span>
                  <p className="text-gray-200">{project.blueprint.hookStrategy}</p>
                </div>

                {/* VFX Direction */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.vfxDirection, 'vfx')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'vfx' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-brand-violet" /> VFX Direction
                  </span>
                  <p className="text-gray-200">{project.blueprint.vfxDirection}</p>
                </div>

                {/* Color Grade */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.colorGrade, 'color')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'color' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-brand-magenta" /> Color Grade
                  </span>
                  <p className="text-gray-200">{project.blueprint.colorGrade}</p>
                </div>

                {/* Sound Direction */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.soundDirection, 'sound')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'sound' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-brand-amber" /> Sound Direction
                  </span>
                  <p className="text-gray-200">{project.blueprint.soundDirection}</p>
                </div>

                {/* Max Quality Plan */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.maxQualityPlan, 'quality')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'quality' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-brand-cyan animate-pulse" /> Max Quality Plan
                  </span>
                  <p className="text-gray-300 whitespace-pre-wrap">{project.blueprint.maxQualityPlan}</p>
                </div>

                {/* Export recommendation */}
                <div className="flex flex-col gap-1.5 p-3 rounded bg-white/[0.01] border border-white/5 relative group">
                  <button
                    onClick={() => copyToClipboard(project.blueprint.exportRecommendation, 'export')}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copiedSection === 'export' ? <ClipboardCheck className="w-3.5 h-3.5 text-brand-green" /> : <Clipboard className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-brand-green" /> Export Recommendations
                  </span>
                  <p className="text-gray-200">{project.blueprint.exportRecommendation}</p>
                </div>

              </div>
            </div>

          </div>

        </div>

        <RightsSafetyNotice />
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
          <div className="relative overflow-hidden glass-panel border border-brand-magenta/30 bg-space-card/90 text-white rounded-xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(255,0,127,0.25)] animate-in fade-in zoom-in-95 duration-200">
            {/* Ambient left border accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-magenta"></div>

            {/* Corner styling */}
            <div className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer" onClick={() => setShowUpgradeModal(false)}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <div className="flex flex-col gap-5 pr-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-brand-magenta/20 border border-brand-magenta/30 text-brand-magenta shrink-0 animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-wide uppercase text-brand-magenta font-mono">
                    Premium Upgrade Required
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase mt-0.5">
                    Serverless Render Limits
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-1">
                <p className="text-xs text-gray-200 leading-relaxed font-mono font-bold">
                  Serverless Render Credits Exhausted. Upgrade to Premium for 50 Studio-Grade AI Exports.
                </p>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-[11px] space-y-1.5 text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                    <span>50 high-fidelity 4K compilation exports</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                    <span>Optical flow temporal frame interpolations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                    <span>Priority GPU compute rendering queues</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleUpgradeRedirect}
                disabled={isRedirecting}
                className="w-full mt-2 py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)] disabled:opacity-50 cursor-pointer"
              >
                {isRedirecting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-space-black" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting Secure Stripe Node...
                  </>
                ) : (
                  <>
                    <span>Unlock Premium Exports ($15)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
