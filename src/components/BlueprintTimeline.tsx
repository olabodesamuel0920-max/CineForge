"use client";

import React, { useState } from 'react';
import { TimelineBlock, Project } from '@/types/project';
import { Play, Eye, Volume2, Gauge, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase';

interface BlueprintTimelineProps {
  blocks: TimelineBlock[];
  accentColor?: string; // e.g. cyan, magenta, violet
  project?: Project;
  onPreviewUrl?: (url: string) => void;
  onCreditExhausted?: () => void;
  onTimelineChange?: (newBlocks: TimelineBlock[]) => void;
}

export default function BlueprintTimeline({ blocks, accentColor = 'cyan', project, onPreviewUrl, onCreditExhausted, onTimelineChange }: BlueprintTimelineProps) {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(blocks[0]?.id || null);
  const [previewingBlockId, setPreviewingBlockId] = useState<string | null>(null);
  const [regeneratingBlockId, setRegeneratingBlockId] = useState<string | null>(null);
  const [activeRegenBlockId, setActiveRegenBlockId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState<string>('');

  const handleTriggerRegen = async (block: TimelineBlock, index: number) => {
    if (!project || !regenPrompt.trim()) return;

    const promptText = regenPrompt.trim();
    if (promptText.length > 500) {
      alert('Prompt must be 500 characters or less.');
      return;
    }

    setRegeneratingBlockId(block.id);
    setActiveRegenBlockId(null);
    setRegenPrompt('');

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

      const response = await fetch('/api/blueprint/regenerate-block', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: project.id,
          blockId: block.id,
          blockPrompt: promptText,
          currentBlock: block,
          selectedMode: project.selectedMode,
          platform: project.platform,
          duration: project.duration
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Regeneration failed: status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.block) {
        const newBlocks = [...blocks];
        newBlocks[index] = {
          ...newBlocks[index],
          title: data.block.title || newBlocks[index].title,
          description: data.block.description || newBlocks[index].description,
          caption: data.block.caption !== undefined ? data.block.caption : newBlocks[index].caption,
          visualCue: data.block.visualCue || newBlocks[index].visualCue,
          audioAction: data.block.audioAction || newBlocks[index].audioAction,
          speedRamp: data.block.speedRamp || newBlocks[index].speedRamp
        };
        if (onTimelineChange) {
          onTimelineChange(newBlocks);
        }
      } else {
        throw new Error(data.error || 'Failed to regenerate block creative fields.');
      }
    } catch (err) {
      console.error('AI regeneration failed:', err);
      alert((err as Error).message || 'Failed to regenerate block.');
    } finally {
      setRegeneratingBlockId(null);
    }
  };

  const handlePreviewClick = async (block: TimelineBlock) => {
    if (!project || !onPreviewUrl) return;

    let start = 0.0;
    let end = 2.0;
    const matches = block.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
    if (matches) {
      start = parseFloat(matches[1]);
      end = parseFloat(matches[2]);
    }

    const previewStart = start;
    const previewDuration = end - start;

    setPreviewingBlockId(block.id);

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

      const response = await fetch('/api/render/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project,
          previewStart,
          previewDuration
        })
      });

      if (response.status === 402) {
        if (onCreditExhausted) {
          onCreditExhausted();
        } else {
          alert('Serverless Render Credits Exhausted. Upgrade to Premium for 50 Studio-Grade AI Exports.');
        }
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to generate segment preview: status ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'COMPLETED' && data.outputUrl) {
        onPreviewUrl(data.outputUrl);
      } else {
        throw new Error(data.error || 'Failed to render segment preview.');
      }
    } catch (err) {
      console.error('Segment preview generation failed:', err);
      alert((err as Error).message || 'Failed to compile segment preview.');
    } finally {
      setPreviewingBlockId(null);
    }
  };

  const handleCaptionChange = (index: number, val: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], caption: val };
    if (onTimelineChange) {
      onTimelineChange(newBlocks);
    }
  };

  const handleSpeedRampChange = (index: number, val: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], speedRamp: val };
    if (onTimelineChange) {
      onTimelineChange(newBlocks);
    }
  };

  const handleVisualCueChange = (index: number, val: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], visualCue: val };
    if (onTimelineChange) {
      onTimelineChange(newBlocks);
    }
  };

  const handleAudioActionChange = (index: number, val: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], audioAction: val };
    if (onTimelineChange) {
      onTimelineChange(newBlocks);
    }
  };

  const handleDurationChange = (index: number, newDur: number) => {
    if (isNaN(newDur) || newDur < 0.5) newDur = 0.5;
    
    // Round to 1 decimal place to prevent float precision drift
    newDur = Math.round(newDur * 10) / 10;

    const newBlocks = [...blocks];
    const oldDurations = newBlocks.map(b => {
      const matches = b.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
      return matches ? Math.round((parseFloat(matches[2]) - parseFloat(matches[1])) * 10) / 10 : 5.0;
    });

    const targetIndex = index;
    let delta = Math.round((oldDurations[targetIndex] - newDur) * 10) / 10;

    const newDurations = [...oldDurations];
    newDurations[targetIndex] = newDur;

    // Propagate delta to subsequent blocks
    for (let i = targetIndex + 1; i < newDurations.length; i++) {
      const originalDur = newDurations[i];
      let proposedDur = Math.round((originalDur + delta) * 10) / 10;
      if (proposedDur < 0.5) {
        newDurations[i] = 0.5;
        delta = Math.round((originalDur + delta - 0.5) * 10) / 10;
      } else {
        newDurations[i] = proposedDur;
        delta = 0;
        break;
      }
    }

    // If there's still delta leftover, clamp the target block duration to satisfy constraints
    if (delta !== 0) {
      newDurations[targetIndex] = Math.round((newDurations[targetIndex] + delta) * 10) / 10;
    }

    // Reconstruct timestamps
    let currentStart = 0.0;
    const updatedBlocks = newBlocks.map((b, i) => {
      const dur = newDurations[i];
      const startStr = currentStart.toFixed(1);
      const endStr = (currentStart + dur).toFixed(1);
      currentStart = Math.round((currentStart + dur) * 10) / 10;
      return {
        ...b,
        timestamp: `${startStr}s - ${endStr}s`
      };
    });

    if (onTimelineChange) {
      onTimelineChange(updatedBlocks);
    }
  };

  const getAccentClass = (color: string) => {
    switch (color) {
      case 'amber': return 'border-brand-amber text-brand-amber';
      case 'magenta': return 'border-brand-magenta text-brand-magenta';
      case 'violet': return 'border-brand-violet text-brand-violet';
      case 'green': return 'border-brand-green text-brand-green';
      case 'cyan':
      default: return 'border-brand-cyan text-brand-cyan';
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/30 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">EDITDNA TIMELINE OS</h4>
        <span className="text-[10px] font-mono text-gray-400">
          {blocks.length} EDIT SEGMENTS
        </span>
      </div>

      <div className="relative border-l border-white/10 pl-6 ml-2 py-2 flex flex-col gap-4">
        {blocks.map((block, index) => {
          const isExpanded = expandedBlock === block.id;
          const accent = getAccentClass(accentColor);
          
          // Calculate current block duration for display
          const matches = block.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
          const blockDuration = matches ? Math.round((parseFloat(matches[2]) - parseFloat(matches[1])) * 10) / 10 : 5.0;

          return (
            <div key={block.id} className="relative group">
              {/* Timeline bubble marker */}
              <div 
                onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                className={`absolute -left-[31px] top-1.5 w-[11px] h-[11px] rounded-full border-2 bg-space-black transition-all cursor-pointer ${
                  isExpanded ? `${accent} scale-125` : 'border-gray-600 hover:border-gray-400'
                }`}
              />

              <div 
                className={`rounded-lg border transition-all duration-300 ${
                  isExpanded 
                    ? 'border-white/10 bg-white/[0.03]' 
                    : 'border-transparent hover:bg-white/[0.01]'
                }`}
              >
                <div 
                  className="p-3 flex items-center justify-between select-none"
                >
                  <div 
                    onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-gray-300">
                      {block.timestamp}
                    </span>
                    <span className="text-sm font-semibold text-gray-200">
                      {block.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {project && onPreviewUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewClick(block);
                        }}
                        disabled={previewingBlockId !== null}
                        className="text-[10px] font-mono font-bold text-brand-cyan hover:text-brand-magenta transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {previewingBlockId === block.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>RENDERING...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>PREVIEW SEGMENT</span>
                          </>
                        )}
                      </button>
                    )}
                    <div 
                      onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                      className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 border-t border-white/5 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4 pt-3">
                          <p className="text-[11px] text-gray-400 leading-normal font-sans italic flex-1">
                            {block.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRegenBlockId(activeRegenBlockId === block.id ? null : block.id);
                              setRegenPrompt('');
                            }}
                            disabled={regeneratingBlockId !== null}
                            className="shrink-0 text-[10px] font-mono font-bold text-brand-violet hover:text-brand-magenta border border-brand-violet/30 hover:border-brand-magenta/50 px-2.5 py-1 rounded bg-brand-violet/5 hover:bg-brand-magenta/5 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {regeneratingBlockId === block.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-brand-magenta" />
                                <span>REGENERATING...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-brand-violet" />
                                <span>AI REGENERATE</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Inline AI Regenerate Prompt Box */}
                        <AnimatePresence>
                          {activeRegenBlockId === block.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3 rounded-lg bg-[#0c0b18]/65 border border-brand-violet/20 flex flex-col gap-2.5 mt-1 mb-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-mono text-brand-violet font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-brand-violet animate-pulse" />
                                    AI Segment Director Prompt
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveRegenBlockId(null)}
                                    className="text-[10px] font-mono text-gray-500 hover:text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={regenPrompt}
                                    onChange={(e) => setRegenPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleTriggerRegen(block, index);
                                      }
                                    }}
                                    placeholder="e.g. make this more dramatic with wheel close-up and neon energy"
                                    className="flex-1 bg-[#050508]/85 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-violet/60 font-sans"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerRegen(block, index)}
                                    disabled={!regenPrompt.trim() || regeneratingBlockId !== null}
                                    className="px-3.5 py-1.5 rounded bg-brand-violet text-space-black font-extrabold text-[10px] uppercase tracking-wider hover:bg-brand-magenta hover:text-white transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                  >
                                    Regen
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Interactive Editor Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Viewer Caption</label>
                            <input
                              type="text"
                              value={block.caption || ''}
                              onChange={(e) => handleCaptionChange(index, e.target.value)}
                              className="bg-[#050508]/85 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-cyan/60 font-sans"
                              placeholder="No overlay subtitle"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Duration (sec)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.5"
                              value={blockDuration}
                              onChange={(e) => handleDurationChange(index, parseFloat(e.target.value))}
                              className="bg-[#050508]/85 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-cyan/60 font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-mono text-gray-500 font-bold uppercase tracking-wider">Speed Ramp mapping</label>
                            <select
                              value={block.speedRamp || 'Normal'}
                              onChange={(e) => handleSpeedRampChange(index, e.target.value)}
                              className="bg-[#050508]/85 border border-white/10 rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-cyan/60 font-mono cursor-pointer"
                            >
                              <option value="Normal">Normal (100% Speed)</option>
                              <option value="Slow-mo (50% Speed)">Slow Motion (50% Speed)</option>
                              <option value="Quarter Speed (25% Speed)">Quarter Speed (25% Speed)</option>
                              <option value="Fast-In / Slow-Out (200% -> 100%)">Fast Motion (200% Speed)</option>
                              <option value="Fast (300% Speed)">Hyper Speed (300% Speed)</option>
                              <option value="Super Fast (400% Speed)">Super Fast (400% Speed)</option>
                            </select>
                          </div>
                        </div>

                        {/* Directorial Guidelines */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                          <div className="p-3 rounded bg-[#050508]/50 border border-white/[0.03] flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 font-bold tracking-wide uppercase">
                              <Eye className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                              <span>VISUAL LANES GUIDELINES</span>
                            </div>
                            <textarea
                              rows={2}
                              value={block.visualCue || ''}
                              onChange={(e) => handleVisualCueChange(index, e.target.value)}
                              className="w-full bg-transparent border-0 resize-none text-[11px] text-gray-300 leading-normal p-0 focus:ring-0 focus:outline-none font-sans"
                            />
                          </div>

                          <div className="p-3 rounded bg-[#050508]/50 border border-white/[0.03] flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 font-bold tracking-wide uppercase">
                              <Volume2 className="w-3.5 h-3.5 text-brand-magenta shrink-0" />
                              <span>AUDIO WAVE SYNCHRONIZATION</span>
                            </div>
                            <textarea
                              rows={2}
                              value={block.audioAction || ''}
                              onChange={(e) => handleAudioActionChange(index, e.target.value)}
                              className="w-full bg-transparent border-0 resize-none text-[11px] text-gray-300 leading-normal p-0 focus:ring-0 focus:outline-none font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
