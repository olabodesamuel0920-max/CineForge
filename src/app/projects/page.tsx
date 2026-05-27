"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Project } from '@/types/project';
import { getProjects, deleteProject } from '@/lib/projects';
import ProjectCard from '@/components/ProjectCard';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';
import { FolderGit2, Sparkles, Plus, AlertCircle, Loader } from 'lucide-react';

export default function ProjectsDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load projects on component mount (client-side only to prevent hydration mismatches)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (e) {
        console.error('Error loading projects', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this edit project and its EditDNA blueprint?')) {
      try {
        await deleteProject(id);
        const data = await getProjects(); // Refresh state
        setProjects(data);
      } catch (e) {
        console.error('Failed to delete project', e);
      }
    }
  };

  return (
    <div className="flex-1 bg-space-black relative py-8 px-4 sm:px-6 lg:px-8">
      {/* Background radial glows */}
      <div className="absolute top-20 right-10 w-96 h-96 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-brand-violet/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10">
        
        {/* Dashboard Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <FolderGit2 className="w-7 h-7 text-brand-cyan shrink-0" />
              Saved Project Dashboard
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Access your generated EditDNA blueprints and monitor render status queues.
            </p>
          </div>
          <Link
            href="/studio"
            className="self-start px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,243,255,0.1)] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-space-black" /> Create New Edit
          </Link>
        </div>

        {/* Dashboard Projects Grid / Content States */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-500 font-mono text-xs gap-3">
            <Loader className="w-6 h-6 animate-spin text-brand-cyan" />
            <span>Scanning local database registers...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 border border-white/5 bg-space-card/20 text-center max-w-2xl mx-auto my-8 flex flex-col items-center gap-4 relative overflow-hidden">
            {/* Ambient scanner detail inside empty state */}
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-white/10"></div>
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/10"></div>
            
            <div className="w-12 h-12 rounded-full bg-white/5 text-gray-500 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-gray-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-gray-200">No Cinematic Edit Projects Found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                You haven't initialized any CineForge editing jobs yet. Enter the studio to upload media and draft your first blueprint.
              </p>
            </div>

            <Link
              href="/studio"
              className="mt-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:bg-white/10 hover:text-brand-cyan transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand-cyan animate-pulse" /> Enter CineForge Studio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <RightsSafetyNotice />
      </div>
    </div>
  );
}
