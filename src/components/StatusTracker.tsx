import React from 'react';
import { PlatformStatus, EngineStatus } from '@/types/project';
import { Cpu, Film, Sparkles, Server } from 'lucide-react';

interface StatusTrackerProps {
  status: PlatformStatus;
}

export default function StatusTracker({ status }: StatusTrackerProps) {
  const getStatusDetails = (engineName: string, state: EngineStatus) => {
    switch (state) {
      case 'Active':
        return {
          label: 'ACTIVE',
          colorClass: 'text-brand-green bg-brand-green/10 border-brand-green/20',
          indicator: 'bg-brand-green animate-pulse',
          description: engineName === 'Blueprint Engine'
            ? 'EditDNA code mapped and structural assets loaded.'
            : 'Upscaling pathways calibrated. High frame-rate grids ready.'
        };
      case 'Preparing':
        return {
          label: 'PREPARING',
          colorClass: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
          indicator: 'bg-brand-amber animate-pulse',
          description: 'Analyzing content rhythm, subject positioning, and beat sync alignment...'
        };
      case 'Provider Connection Pending':
        return {
          label: 'CONNECTION PENDING',
          colorClass: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20',
          indicator: 'bg-brand-cyan animate-pulse',
          description: 'Ready to dispatch blueprint. Awaiting manual user export or cloud worker handoff.'
        };
      case 'Inactive':
      default:
        return {
          label: 'INACTIVE',
          colorClass: 'text-gray-500 bg-white/5 border-white/5',
          indicator: 'bg-gray-600',
          description: 'Bypassed. Standard output pipeline running.'
        };
    }
  };

  const engines = [
    {
      name: 'Blueprint Engine',
      key: 'blueprintEngine',
      icon: Cpu,
      state: status.blueprintEngine
    },
    {
      name: 'Media Analysis',
      key: 'mediaAnalysis',
      icon: Film,
      state: status.mediaAnalysis
    },
    {
      name: 'Max Quality Planning',
      key: 'maxQualityPlanning',
      icon: Sparkles,
      state: status.maxQualityPlanning
    },
    {
      name: 'Render Engine',
      key: 'renderEngine',
      icon: Server,
      state: status.renderEngine
    }
  ];

  return (
    <div className="glass-panel rounded-xl p-5 border border-white/5 bg-space-card/40 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h4 className="text-xs font-mono font-bold tracking-widest text-gray-400">ENGINE STATUS MONITOR</h4>
        <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded border border-brand-cyan/20">
          DIAGNOSTICS ONLINE
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {engines.map((engine) => {
          const Icon = engine.icon;
          const details = getStatusDetails(engine.name, engine.state);
          return (
            <div key={engine.key} className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-200">{engine.name}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold ${details.colorClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${details.indicator}`}></span>
                  {details.label}
                </div>
              </div>
              <p className="text-[11px] text-gray-400 leading-normal font-mono">
                {details.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
