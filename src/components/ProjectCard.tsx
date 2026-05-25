"use client";

import React from 'react';
import Link from 'next/link';
import { Project } from '@/types/project';
import { getModeById } from '@/lib/cineforgeModes';
import { Calendar, Trash2, ArrowRight, Video, Play, Clapperboard } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const mode = getModeById(project.selectedMode);

  // Parse platform icons
  const getPlatformDetails = (platform: string) => {
    switch (platform) {
      case 'YouTube':
        return { label: 'YouTube (16:9)', icon: Play, color: 'text-red-500 bg-red-500/10' };
      case 'TikTok':
        return { label: 'TikTok (9:16)', icon: Clapperboard, color: 'text-brand-cyan bg-brand-cyan/10' };
      case 'Reels':
        return { label: 'Instagram Reels', icon: Video, color: 'text-brand-magenta bg-brand-magenta/10' };
      case 'Shorts':
      default:
        return { label: 'YouTube Shorts', icon: Play, color: 'text-brand-violet bg-brand-violet/10' };
    }
  };

  const platformInfo = getPlatformDetails(project.platform);
  const PlatformIcon = platformInfo.icon;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return 'Recent';
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col justify-between gap-4 transition-all duration-300 hover:border-brand-cyan/20 hover:shadow-[0_0_20px_rgba(0,243,255,0.02)] group">
      {/* Card Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full ${platformInfo.color} flex items-center gap-1`}>
            <PlatformIcon className="w-3 h-3" />
            {platformInfo.label}
          </span>
          <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(project.createdAt)}
          </span>
        </div>

        <h3 className="text-base font-bold text-gray-200 group-hover:text-brand-cyan transition-colors mt-2 truncate">
          {project.title}
        </h3>
        
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">Cinematic Mode:</span>
          <span className={`text-xs font-mono font-semibold text-glow-cyan text-brand-cyan`}>
            {mode?.name || 'Custom'}
          </span>
        </div>
      </div>

      {/* Card Middle Info */}
      <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-gray-500">Duration</span>
          <span className="text-gray-300 font-semibold">{project.duration}</span>
        </div>
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-gray-500">Source Media</span>
          <span className="text-gray-300 truncate max-w-[150px]" title={project.mediaFilename}>
            {project.mediaFilename}
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-gray-500">Blueprint Engine</span>
          <span className="text-brand-green font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
            ACTIVE
          </span>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="border-t border-white/5 pt-3 flex items-center justify-between mt-1">
        <button
          onClick={() => onDelete(project.id)}
          className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-gray-500 hover:text-brand-magenta hover:border-brand-magenta/30 hover:bg-brand-magenta/5 transition-colors cursor-pointer"
          title="Delete Project"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <Link
          href={`/projects/${project.id}`}
          className="px-3.5 py-1.5 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan text-brand-cyan hover:text-space-black font-semibold text-xs flex items-center gap-1.5 transition-all border border-brand-cyan/20 cursor-pointer"
        >
          Open Blueprint <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
