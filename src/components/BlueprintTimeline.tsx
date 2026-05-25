"use client";

import React, { useState } from 'react';
import { TimelineBlock } from '@/types/project';
import { Play, Eye, Volume2, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BlueprintTimelineProps {
  blocks: TimelineBlock[];
  accentColor?: string; // e.g. cyan, magenta, violet
}

export default function BlueprintTimeline({ blocks, accentColor = 'cyan' }: BlueprintTimelineProps) {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(blocks[0]?.id || null);

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
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">EDITDNA TIMELINE BLUEPRINT</h4>
        <span className="text-[10px] font-mono text-gray-400">
          {blocks.length} EDIT SEGMENTS
        </span>
      </div>

      <div className="relative border-l border-white/10 pl-6 ml-2 py-2 flex flex-col gap-4">
        {blocks.map((block, index) => {
          const isExpanded = expandedBlock === block.id;
          const accent = getAccentClass(accentColor);

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
                  onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-gray-300">
                      {block.timestamp}
                    </span>
                    <span className="text-sm font-semibold text-gray-200">
                      {block.title}
                    </span>
                  </div>
                  <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                      <div className="p-3 pt-0 border-t border-white/5 flex flex-col gap-3">
                        <p className="text-xs text-gray-300 leading-relaxed font-sans pt-3">
                          {block.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                          <div className="p-2.5 rounded bg-space-black/50 border border-white/[0.03] flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 font-bold tracking-wide uppercase">
                              <Eye className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                              <span>VISUAL LANES</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-normal">
                              {block.visualCue}
                            </p>
                          </div>

                          <div className="p-2.5 rounded bg-space-black/50 border border-white/[0.03] flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 font-bold tracking-wide uppercase">
                              <Volume2 className="w-3.5 h-3.5 text-brand-magenta shrink-0" />
                              <span>AUDIO WAVE</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-normal">
                              {block.audioAction}
                            </p>
                          </div>

                          <div className="p-2.5 rounded bg-space-black/50 border border-white/[0.03] flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 font-bold tracking-wide uppercase">
                              <Gauge className="w-3.5 h-3.5 text-brand-amber shrink-0" />
                              <span>SPEED RAMP</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-normal font-mono">
                              {block.speedRamp}
                            </p>
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
