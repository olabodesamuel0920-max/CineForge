"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Cpu, Share2, Loader2, Download, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '@/types/project';
import { updateProject, createProjectVersion } from '@/lib/projects';
import { getSupabase } from '@/lib/supabase';

interface RenderQueuePanelProps {
  project: Project;
  onStatusChange?: (updatedProject: Project) => void;
  onCreditExhausted?: () => void;
}

type RenderStep = 'IDLE' | 'QUEUED' | 'DOWNLOADING' | 'ANALYZING' | 'RENDERING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';

export default function RenderQueuePanel({ project, onStatusChange, onCreditExhausted }: RenderQueuePanelProps) {
  const [step, setStep] = useState<RenderStep>('IDLE');
  const [percent, setPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [estTime, setEstTime] = useState<number>(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedVersionRef = useRef<boolean>(false);

  // Sync state from project on mount or project changes
  useEffect(() => {
    if (project.status.renderEngine === 'Active') {
      setStep('COMPLETED');
      setPercent(100);
      setOutputUrl(`/renders/output-${project.id}.mp4`);
    } else if (project.status.renderEngine === 'Preparing') {
      setStep('RENDERING');
      setPercent(10);
      startPolling();
    } else {
      setStep('IDLE');
      setPercent(0);
      stopPolling();
    }
  }, [project.id]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const getRenderSpecs = () => {
    const isMax = project.maxQualityMode;
    const duration = parseInt(project.duration) || 15;
    const res = isMax ? '3840x2160 (4K UHD)' : '1080x1920 (FHD Portrait)';
    const fps = isMax ? '60 FPS' : '30 FPS';
    const codec = isMax ? 'HEVC / H.265' : 'H.264 (AAC)';
    const mbps = isMax ? 45 : 15;
    const estSizeMB = ((mbps * duration) / 8).toFixed(1);
    const estRenderTime = isMax 
      ? `${(duration * 2.5).toFixed(0)} seconds (Neural Up + Interpolation)`
      : `${(duration * 0.8).toFixed(0)} seconds (Standard Linear)`;

    return { res, fps, codec, estSizeMB, estRenderTime };
  };

  const specs = getRenderSpecs();

  const startPolling = () => {
    if (pollIntervalRef.current) return;

    let consecutiveFailures = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/render/status/${project.id}`);
        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }
        const data = await res.json();
        
        // Reset consecutive failures on success
        consecutiveFailures = 0;
        
        const nextPercent = data.progress ?? 0;
        const nextStatus = data.status ?? 'analysis_preparing';
        const nextError = data.error ?? null;
        
        setPercent(nextPercent);
        setEstTime(data.estimatedTimeRemaining ?? 0);
        setErrorMsg(nextError);
        setQueuePosition(data.queuePosition ?? null);
        
        if (nextStatus === 'completed') {
          setStep('COMPLETED');
          setOutputUrl(data.outputUrl || `/renders/output-${project.id}.mp4`);
          setDiagnostics(data.diagnostics || null);
          stopPolling();

          if (!hasLoggedVersionRef.current) {
            hasLoggedVersionRef.current = true;
            const isCloud = process.env.NEXT_PUBLIC_RENDER_MODE === 'cloud' || (data.outputUrl && data.outputUrl.includes('storage.googleapis.com'));
            const outputPath = isCloud 
              ? `rendered/output-${project.id}.mp4`
              : `renders/output-${project.id}.mp4`;

            createProjectVersion(project.id, {
              blueprint: project.blueprint,
              outputPath,
              diagnostics: data.diagnostics
            }).catch(err => {
              console.error('Failed to log project render version:', err);
            });
          }
          
          // Trigger dynamic parent page path switch: raw asset -> output-rendered file
          updateParentProject('Active');
        } else if (nextStatus === 'failed') {
          setStep('FAILED');
          setErrorMsg(nextError || 'Rendering process aborted unexpectedly.');
          stopPolling();
          updateParentProject('Inactive');
        } else if (nextStatus === 'queued') {
          setStep('QUEUED');
        } else if (nextStatus === 'analysis_preparing') {
          setStep(nextPercent > 2 ? 'ANALYZING' : 'DOWNLOADING');
        } else if (nextStatus === 'rendering') {
          setStep(nextPercent >= 95 ? 'UPLOADING' : 'RENDERING');
        }
      } catch (err) {
        consecutiveFailures++;
        console.warn(`Polling attempt failed (${consecutiveFailures}/5):`, err);
        
        if (consecutiveFailures >= 5) {
          stopPolling();
          setStep('FAILED');
          const errMsg = (err as Error).message;
          if (errMsg.includes('fetch failed') || errMsg.includes('connection') || errMsg.includes('ECONNREFUSED')) {
            setErrorMsg('Status polling connection failed. The render worker node appears to have disconnected. Please ensure the rendering worker is running (run "npm run dev" inside "infrastructure/render-gcp").');
          } else {
            setErrorMsg(`Status polling connection failed repeatedly: ${errMsg}`);
          }
          updateParentProject('Inactive');
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const updateParentProject = async (
    renderEngineState: 'Active' | 'Preparing' | 'Provider Connection Pending' | 'Inactive'
  ) => {
    const updated: Project = {
      ...project,
      status: {
        ...project.status,
        renderEngine: renderEngineState
      }
    };
    
    // Save state back to local storage or Supabase database
    try {
      await updateProject(updated);
    } catch (e) {
      console.error('Failed to update project registers:', e);
    }

    if (onStatusChange) {
      onStatusChange(updated);
    }
  };

  const triggerRender = async () => {
    setStep('DOWNLOADING');
    setPercent(2);
    setEstTime(15);
    setErrorMsg(null);
    updateParentProject('Preparing');
    hasLoggedVersionRef.current = false;

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
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/render', {
        method: 'POST',
        headers,
        body: JSON.stringify({ project }),
      });

      const data = await response.json();
      
      if (response.status === 402) {
        stopPolling();
        setStep('IDLE');
        updateParentProject('Inactive');
        if (onCreditExhausted) {
          onCreditExhausted();
        } else {
          setErrorMsg(data.error || 'Serverless Render Credits Exhausted.');
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Trigger failed: Render Node rejected task.');
      }

      startPolling();
    } catch (err) {
      stopPolling();
      setStep('FAILED');
      const errMsg = (err as Error).message;
      if (errMsg.includes('fetch failed') || errMsg.includes('connection') || errMsg.includes('ECONNREFUSED') || errMsg.includes('rejected task') || errMsg.includes('failed to fetch')) {
        setErrorMsg('Could not connect to the local render worker. Please make sure the rendering server is running on http://localhost:8080. If running locally, run: "npm run dev" inside the "infrastructure/render-gcp" directory.');
      } else {
        setErrorMsg(errMsg);
      }
      updateParentProject('Inactive');
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4 relative overflow-hidden">
      
      {/* Background pulsing line during active uploads/renders */}
      {step !== 'IDLE' && step !== 'COMPLETED' && step !== 'FAILED' && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-brand-cyan via-brand-violet to-brand-magenta animate-pulse"></div>
      )}

      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">RENDER QUEUE CONTROLLER</h4>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors duration-300 ${
          step === 'COMPLETED' 
            ? 'text-brand-green bg-brand-green/10 border-brand-green/20' 
            : step === 'FAILED'
              ? 'text-brand-magenta bg-brand-magenta/10 border-brand-magenta/20'
              : step === 'IDLE'
                ? 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20'
                : step === 'QUEUED'
                  ? 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20'
                  : 'text-brand-amber bg-brand-amber/10 border-brand-amber/20 animate-pulse'
        }`}>
          {step === 'IDLE' && 'READY'}
          {step === 'QUEUED' && 'QUEUED'}
          {step === 'DOWNLOADING' && 'PRE-FETCHING'}
          {step === 'ANALYZING' && 'ANALYZING'}
          {step === 'RENDERING' && `PROCESSING ${percent}%`}
          {step === 'UPLOADING' && 'COMPILING STREAM'}
          {step === 'COMPLETED' && 'FINISHED'}
          {step === 'FAILED' && 'CRASHED'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* --- IDLE STATE --- */}
        {step === 'IDLE' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <span className="text-gray-500 text-[10px] uppercase">Resolution</span>
                <span className="text-gray-200 font-semibold">{specs.res}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <span className="text-gray-500 text-[10px] uppercase">Frame Rate</span>
                <span className="text-gray-200 font-semibold">{specs.fps}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <span className="text-gray-500 text-[10px] uppercase">Bitrate Codec</span>
                <span className="text-gray-200 font-semibold">{specs.codec}</span>
              </div>
              <div className="p-2.5 rounded bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                <span className="text-gray-500 text-[10px] uppercase">Est. Size</span>
                <span className="text-gray-200 font-semibold">~{specs.estSizeMB} MB</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-space-dark border border-white/5 text-xs font-mono flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Cpu className="w-3.5 h-3.5 text-brand-cyan" />
                <span>ESTIMATED COMPILING TIME</span>
              </div>
              <span className="text-gray-200 font-bold mt-0.5">{specs.estRenderTime}</span>
            </div>

            <button
              onClick={triggerRender}
              className={`w-full py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,243,255,0.25)] cursor-pointer active:scale-[0.98] ${
                project.sourceType === 'demo' ? 'border border-brand-cyan/35 animate-pulse' : ''
              }`}
            >
              <Share2 className="w-4.5 h-4.5 text-space-black" />
              {project.sourceType === 'demo' ? 'Render This Demo' : 'Dispatch Render Job'}
            </button>
          </motion.div>
        )}

        {/* --- ACTIVE PROGRESS STATE --- */}
        {step !== 'IDLE' && step !== 'COMPLETED' && step !== 'FAILED' && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 py-2 font-mono text-xs"
          >
            <div className="flex items-center justify-between text-gray-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand-cyan" />
                {step === 'QUEUED' && `Queued | Position: ${queuePosition ?? 1}`}
                {step === 'DOWNLOADING' && 'Fetching source video...'}
                {step === 'ANALYZING' && 'Running resolution pre-flights...'}
                {step === 'RENDERING' && 'FFmpeg compiling filter graphs...'}
                {step === 'UPLOADING' && 'Finalizing streams and indexing...'}
              </span>
              <span className="font-bold text-brand-cyan">{percent}%</span>
            </div>

            {/* Framer Motion Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-brand-cyan to-brand-violet rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
              <span>Mode: <code className="text-brand-cyan">local-proxy</code></span>
              {estTime > 0 && (
                <span>
                  {step === 'QUEUED'
                    ? `Estimated wait: ~${Math.ceil(estTime / 60)}m`
                    : `Est. Remaining: ${estTime}s`}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* --- COMPLETED STATE --- */}
        {step === 'COMPLETED' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 py-2 font-mono text-xs"
          >
            <div className="p-4 rounded-lg bg-brand-green/5 border border-brand-green/20 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-brand-green font-bold">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>COMPILATION COMPLETED</span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[11px]">
                The EditDNA has been successfully compiled into a portrait MP4 and cached to local public workspace.
              </p>

              {/* Render success metadata */}
              {diagnostics && (
                <div className="p-3 rounded bg-black/40 border border-white/5 text-[10px] text-gray-400 flex flex-col gap-1.5 leading-normal">
                  <div className="font-bold text-gray-200 uppercase tracking-wider border-b border-white/5 pb-1 mb-1">Render Metadata</div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="text-gray-200">{diagnostics.videoDuration ? `${diagnostics.videoDuration.toFixed(1)}s` : '15.0s'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolution:</span>
                    <span className="text-gray-200">{diagnostics.resolution ? `${diagnostics.resolution[0]}x${diagnostics.resolution[1]}` : '1080x1920'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="text-gray-200">
                      {diagnostics.outputSize ? `${(diagnostics.outputSize / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Render Time:</span>
                    <span className="text-gray-200">{diagnostics.renderDuration ? `${diagnostics.renderDuration.toFixed(1)}s` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Codec/Format:</span>
                    <span className="text-gray-200 uppercase">{diagnostics.codec || 'H.264'}</span>
                  </div>
                </div>
              )}

              {outputUrl && (
                <a
                  href={outputUrl}
                  download={`rendered-${project.id}.mp4`}
                  className="mt-1 py-2 rounded bg-brand-green text-space-black font-bold text-center flex items-center justify-center gap-1.5 hover:bg-brand-green/90 transition-colors shadow-[0_0_10px_rgba(46,213,115,0.2)]"
                >
                  <Download className="w-4 h-4" /> Download final video
                </a>
              )}
            </div>
            
            <button
              onClick={() => {
                setStep('IDLE');
                setPercent(0);
                setDiagnostics(null);
                updateParentProject('Provider Connection Pending');
              }}
              className="w-full py-2 border border-white/5 bg-white/[0.02] text-gray-400 hover:text-white rounded text-center flex items-center justify-center gap-1.5 transition-all text-[11px]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-compile Blueprint
            </button>
          </motion.div>
        )}

        {/* --- FAILED STATE --- */}
        {step === 'FAILED' && (
          <motion.div
            key="failed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 py-2 font-mono text-xs"
          >
            <div className="p-4 rounded-lg bg-brand-magenta/5 border border-brand-magenta/20 flex flex-col gap-3">
              <div className="flex items-start gap-2 text-brand-magenta font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>COMPILER ABORTED</span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[11px]">
                FFmpeg failed with the following traceback diagnostics:
              </p>
              <div className="p-2.5 rounded bg-black/40 border border-brand-magenta/20 text-brand-magenta text-[10px] overflow-x-auto max-h-[120px] whitespace-pre-wrap leading-normal break-all">
                {errorMsg || 'Unknown compilation failure.'}
              </div>
            </div>
            
            <button
              onClick={() => {
                setStep('IDLE');
                setPercent(0);
                setErrorMsg(null);
              }}
              className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Reset Workspace
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
