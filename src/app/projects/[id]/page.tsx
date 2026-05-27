"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Project } from '@/types/project';
import { getProjectById, getActiveUser } from '@/lib/projects';
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
  Volume2, Palette, FileText, ClipboardCheck, Clipboard, ExternalLink 
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
      setActiveVideoUrl(project.mediaFilename);
    }
  }, [project?.mediaFilename]);

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

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-gray-500">EditDNA Compiled:</span>
            <span className="text-brand-green font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
              VERIFIED
            </span>
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
